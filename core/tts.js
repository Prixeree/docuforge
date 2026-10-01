import { dbGet, dbPut } from './storage.js';

let worker = null;
let status = 'unavailable';
let messageIdCounter = 0;
const resolvers = new Map();
let voicesCache = [];

export async function initTTS(onProgress) {
  if (status === 'ready') return true;
  status = 'loading';
  
  worker = new Worker(new URL('./tts.worker.js', import.meta.url), { type: 'module' });
  
  return new Promise((resolve) => {
    worker.onmessage = (e) => {
      const { type, error, progress, id, samples, sampleRate, duration, voices } = e.data;
      
      if (type === 'init-done') {
        status = 'ready';
        worker.postMessage({ type: 'list-voices' });
        resolve(true);
      } else if (type === 'init-error') {
        status = 'unavailable';
        console.error('TTS Init Error:', error);
        resolve(false);
      } else if (type === 'init-progress' && onProgress) {
        onProgress(progress);
      } else if (type === 'audio' || type === 'generate-error') {
        const resolver = resolvers.get(id);
        if (resolver) {
          if (type === 'generate-error') {
            resolver.reject(new Error(error));
          } else {
            resolver.resolve({ samples, sampleRate, duration });
          }
          resolvers.delete(id);
        }
      } else if (type === 'voices') {
        voicesCache = voices;
      }
    };
    
    worker.postMessage({ type: 'init' });
  });
}

export function getTTSStatus() {
  return status;
}

export async function generateSentence(text, voice = 'bm_george', speed = 0.93) {
  if (status !== 'ready' || !worker) {
    throw new Error('TTS not initialized');
  }
  
  const id = `msg_${messageIdCounter++}`;
  
  return new Promise((resolve, reject) => {
    resolvers.set(id, { resolve, reject });
    worker.postMessage({ type: 'generate', id, text, voice, speed });
  });
}

function splitIntoSentences(text) {
  const raw = text.match(/[^.!?]+[.!?]+[\s]*/g) || [text];
  const sentences = [];
  for (const s of raw) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if (trimmed.length > 300) {
      const parts = trimmed.split(/,\s*/);
      let current = '';
      for (const part of parts) {
        if ((current + ', ' + part).length > 300 && current) {
          sentences.push(current.trim());
          current = part;
        } else {
          current = current ? current + ', ' + part : part;
        }
      }
      if (current.trim()) sentences.push(current.trim());
    } else {
      sentences.push(trimmed);
    }
  }
  return sentences;
}

async function sha1(str) {
  const data = new TextEncoder().encode(str);
  const hash = await crypto.subtle.digest('SHA-1', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function generateSceneAudio(sceneText, options = {}) {
  const { voice = 'bm_george', speed = 0.93, onProgress } = options;
  const sentences = splitIntoSentences(sceneText);
  const audioParts = [];
  const sentenceTimings = [];
  let currentTime = 0;
  
  for (let i = 0; i < sentences.length; i++) {
    const text = sentences[i];
    const cacheKey = await sha1(text + '|' + voice + '|' + speed);
    let cached = await dbGet('tts_cache', cacheKey);
    let audioData;
    
    if (cached) {
      audioData = {
        samples: new Float32Array(cached.samples),
        sampleRate: cached.sampleRate,
        duration: cached.duration
      };
    } else {
      audioData = await generateSentence(text, voice, speed);
      await dbPut('tts_cache', cacheKey, {
        samples: audioData.samples.buffer,
        sampleRate: audioData.sampleRate,
        duration: audioData.duration
      });
    }
    
    audioParts.push(audioData.samples);
    sentenceTimings.push({
      text,
      start: currentTime,
      end: currentTime + audioData.duration
    });
    
    currentTime += audioData.duration;
    
    // Insert 0.25s silence between sentences
    if (i < sentences.length - 1) {
      const silenceSamples = Math.floor(0.25 * audioData.sampleRate);
      audioParts.push(new Float32Array(silenceSamples));
      currentTime += 0.25;
    }
    
    if (onProgress) {
      onProgress(i + 1, sentences.length);
    }
  }
  
  const totalLength = audioParts.reduce((acc, part) => acc + part.length, 0);
  const concatenated = new Float32Array(totalLength);
  let offset = 0;
  for (const part of audioParts) {
    concatenated.set(part, offset);
    offset += part.length;
  }
  
  return {
    samples: concatenated,
    sampleRate: audioParts.length > 0 ? 24000 : 24000,
    duration: currentTime,
    sentenceTimings
  };
}

export async function generateAllScenes(scenes, options = {}) {
  const results = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i];
    const result = await generateSceneAudio(scene.text, {
      ...options,
      onProgress: (sentenceIdx, totalSentences) => {
        if (options.onProgress) {
          options.onProgress(i, scenes.length, sentenceIdx, totalSentences);
        }
      }
    });
    results.push(result);
  }
  return results;
}

export async function previewVoice(text, voice, speed) {
  try {
    const result = await generateSentence(text, voice, speed);
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = audioCtx.createBuffer(1, result.samples.length, result.sampleRate);
    buffer.copyToChannel(result.samples, 0);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start();
  } catch (err) {
    console.error('Voice preview failed:', err);
  }
}

export function terminateTTS() {
  if (worker) {
    worker.terminate();
    worker = null;
    status = 'unavailable';
  }
}
