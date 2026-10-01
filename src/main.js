import { parseScript, enhanceKeywords } from './script.js';
import { fetchClip, clearCache } from './stock.js';
import { initTTS, getTTSStatus, generateSceneAudio, generateAllScenes, previewVoice, terminateTTS } from './tts.js';
import { processVoiceChain, mixAudio, encodeAAC } from './audio.js';
import { createMuxer, addVideoChunk, addAudioChunk, finalize } from './mux.js';
import { initDB } from './storage.js';

const TIERS = {
  draft:  { width: 854,  height: 480,  bitrate: 1_500_000, label: 'Draft 480p' },
  hd:     { width: 1280, height: 720,  bitrate: 4_000_000, label: 'HD 720p' },
  fullhd: { width: 1920, height: 1080, bitrate: 8_000_000, label: 'Full HD 1080p' },
};

let currentScenes = [];
let abortController = null;
let renderWorker = null;
let musicBuffer = null;

// UI Elements
const els = {
  keyPexels: document.getElementById('key-pexels'),
  keyPixabay: document.getElementById('key-pixabay'),
  keyGemini: document.getElementById('key-gemini'),
  scriptInput: document.getElementById('script-input'),
  sceneCount: document.getElementById('scene-count'),
  btnParse: document.getElementById('btn-parse'),
  btnEnhance: document.getElementById('btn-enhance'),
  btnFetchClips: document.getElementById('btn-fetch-clips'),
  sceneList: document.getElementById('scene-list'),
  voiceSelect: document.getElementById('voice-select'),
  speedSlider: document.getElementById('speed-slider'),
  speedVal: document.getElementById('speed-val'),
  btnPreviewVoice: document.getElementById('btn-preview-voice'),
  musicUpload: document.getElementById('music-upload'),
  qualitySelect: document.getElementById('quality-select'),
  transitionSelect: document.getElementById('transition-select'),
  btnGenerate: document.getElementById('btn-generate'),
  btnCancel: document.getElementById('btn-cancel'),
  progressSection: document.getElementById('progress-section'),
  outputSection: document.getElementById('output-section'),
  outputVideo: document.getElementById('output-video'),
  btnDownload: document.getElementById('btn-download'),
  outputSize: document.getElementById('output-size'),
  btnNew: document.getElementById('btn-new'),
  hwBanner: document.getElementById('hw-banner'),
  errorBanner: document.getElementById('error-banner')
};

// Initialize
async function init() {
  loadApiKeys();
  els.keyPexels.addEventListener('input', saveApiKeys);
  els.keyPixabay.addEventListener('input', saveApiKeys);
  els.keyGemini.addEventListener('input', saveApiKeys);

  els.scriptInput.addEventListener('input', updateSceneCount);
  els.speedSlider.addEventListener('input', (e) => els.speedVal.textContent = e.target.value);
  els.musicUpload.addEventListener('change', handleMusicUpload);

  els.btnParse.addEventListener('click', handleParse);
  els.btnEnhance.addEventListener('click', handleEnhance);
  els.btnFetchClips.addEventListener('click', handleFetchAllClips);
  els.btnPreviewVoice.addEventListener('click', handleVoicePreview);
  els.btnGenerate.addEventListener('click', generateDocumentary);
  els.btnCancel.addEventListener('click', cancelGeneration);
  els.btnNew.addEventListener('click', () => location.reload());

  try {
    await initDB();
    const hwSupport = await probeHardware();
    if (!hwSupport.fullhd.hw) {
      els.hwBanner.classList.add('visible');
    }
  } catch (err) {
    console.error('Initialization error:', err);
  }
}

function loadApiKeys() {
  els.keyPexels.value = localStorage.getItem('df_pexels') || '';
  els.keyPixabay.value = localStorage.getItem('df_pixabay') || '';
  els.keyGemini.value = localStorage.getItem('df_gemini') || '';
}

function saveApiKeys() {
  localStorage.setItem('df_pexels', els.keyPexels.value.trim());
  localStorage.setItem('df_pixabay', els.keyPixabay.value.trim());
  localStorage.setItem('df_gemini', els.keyGemini.value.trim());
}

function getApiKeys() {
  return {
    pexels: els.keyPexels.value.trim(),
    pixabay: els.keyPixabay.value.trim(),
    gemini: els.keyGemini.value.trim()
  };
}

async function probeHardware() {
  const tiers = [
    { name: 'fullhd', width: 1920, height: 1080, bitrate: 8_000_000, codec: 'avc1.640028' },
    { name: 'hd', width: 1280, height: 720, bitrate: 4_000_000, codec: 'avc1.4d001f' },
    { name: 'draft', width: 854, height: 480, bitrate: 1_500_000, codec: 'avc1.42001f' },
  ];
  const results = {};
  for (const tier of tiers) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec: tier.codec, width: tier.width, height: tier.height,
        bitrate: tier.bitrate, framerate: 24,
        hardwareAcceleration: 'prefer-hardware',
        avc: { format: 'avc' }, latencyMode: 'quality'
      });
      results[tier.name] = { supported: support.supported, hw: support.config?.hardwareAcceleration === 'prefer-hardware' };
    } catch { results[tier.name] = { supported: false, hw: false }; }
  }
  return results;
}

function updateSceneCount() {
  const text = els.scriptInput.value;
  const scenes = parseScript(text);
  els.sceneCount.textContent = `${scenes.length} scenes detected`;
  els.btnGenerate.disabled = scenes.length === 0;
}

async function handleMusicUpload(e) {
  const file = e.target.files[0];
  if (!file) {
    musicBuffer = null;
    return;
  }
  try {
    musicBuffer = await decodeMusicFile(file);
  } catch (err) {
    showError("Failed to decode music file");
  }
}

async function decodeMusicFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new AudioContext({ sampleRate: 48000 });
  const buffer = await audioCtx.decodeAudioData(arrayBuffer);
  await audioCtx.close();
  return buffer;
}

function handleParse() {
  const text = els.scriptInput.value;
  if (!text.trim()) return showError("Script is empty");
  currentScenes = parseScript(text);
  renderSceneList();
  els.btnGenerate.disabled = currentScenes.length === 0;
}

function renderSceneList() {
  els.sceneList.innerHTML = '';
  currentScenes.forEach((scene, i) => {
    const card = document.createElement('div');
    card.className = 'scene-card';
    const thumbSrc = scene.clip?.preview || 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="68"><rect width="120" height="68" fill="%23333"/></svg>';
    card.innerHTML = `
      <img src="${thumbSrc}" class="scene-thumb" id="thumb-${i}">
      <div class="scene-info">
        <div class="scene-text"><strong>Scene ${i+1}:</strong> ${scene.text}</div>
        <div class="scene-meta">
          <span id="kw-${i}">Keywords: ${scene.keywords.join(', ')}</span>
        </div>
      </div>
      <div class="scene-actions">
        <select id="trans-${i}">
          <option value="auto">Auto Transition</option>
          <option value="crossfade">Crossfade</option>
          <option value="slideLeft">Slide Left</option>
          <option value="wipeLeft">Wipe Left</option>
          <option value="none">None</option>
        </select>
        <button onclick="window.fetchSingleClip(${i})">Fetch Clip</button>
      </div>
    `;
    els.sceneList.appendChild(card);
  });
}

window.fetchSingleClip = async (index) => {
  const scene = currentScenes[index];
  if (!scene) return;
  const keys = getApiKeys();
  if (!keys.pexels && !keys.pixabay) return showError("Please enter at least one Stock API key");
  
  const clip = await fetchClip(scene.keywords, keys, 'hd');
  if (clip) {
    scene.clip = clip;
    document.getElementById(`thumb-${index}`).src = clip.preview;
  } else {
    showError(`Could not find clip for Scene ${index+1}`);
  }
};

async function handleFetchAllClips() {
  if (currentScenes.length === 0) return showError("Parse script first");
  const keys = getApiKeys();
  if (!keys.pexels && !keys.pixabay) return showError("Please enter at least one Stock API key");

  for (let i = 0; i < currentScenes.length; i++) {
    await window.fetchSingleClip(i);
  }
}

async function handleEnhance() {
  if (currentScenes.length === 0) return showError("Parse script first");
  const keys = getApiKeys();
  if (!keys.gemini) return showError("Gemini API key is required for enhancement");
  
  try {
    currentScenes = await enhanceKeywords(currentScenes, keys.gemini);
    currentScenes.forEach((scene, i) => {
      document.getElementById(`kw-${i}`).textContent = `Keywords: ${scene.keywords.join(', ')}`;
    });
  } catch (err) {
    showError("Failed to enhance keywords: " + err.message);
  }
}

async function handleVoicePreview() {
  const voice = els.voiceSelect.value;
  const speed = parseFloat(els.speedSlider.value);
  try {
    await previewVoice('This is a preview of the selected voice.', voice, speed);
  } catch (err) {
    showError("Voice preview failed: " + err.message);
  }
}

// UI Helpers
function setProgress(stage, percent) {
  const fill = document.getElementById('prog-' + stage);
  const pct = document.getElementById('pct-' + stage);
  if (fill) fill.style.width = Math.round(percent * 100) + '%';
  if (pct) pct.textContent = Math.round(percent * 100) + '%';
  if (percent >= 1 && fill) fill.classList.add('done');
}

function setStatus(text) {
  if (els.progressSection.style.display !== 'block') {
    els.progressSection.classList.add('visible');
  }
  const el = document.getElementById('progress-status');
  if (el) el.textContent = text;
}

function showError(message) {
  els.errorBanner.textContent = message;
  els.errorBanner.classList.add('visible');
  setTimeout(() => els.errorBanner.classList.remove('visible'), 5000);
}

function cancelGeneration() {
  if (abortController) {
    abortController.abort();
  }
  if (renderWorker) {
    renderWorker.terminate();
    renderWorker = null;
  }
  els.btnGenerate.style.display = 'block';
  els.btnCancel.style.display = 'none';
  setStatus('Generation cancelled');
}

// --- MAIN PIPELINE ---
async function generateDocumentary() {
  if (currentScenes.length === 0) handleParse();
  if (currentScenes.length === 0) return;

  abortController = new AbortController();
  const signal = abortController.signal;
  
  els.btnGenerate.style.display = 'none';
  els.btnCancel.style.display = 'block';
  els.progressSection.classList.add('visible');
  els.outputSection.classList.remove('visible');
  
  const keys = getApiKeys();
  const voice = els.voiceSelect.value;
  const speed = parseFloat(els.speedSlider.value);
  const quality = els.qualitySelect.value;
  const defTransition = els.transitionSelect.value;
  const tier = TIERS[quality];

  try {
    // STAGE 1: Script
    setStatus('Stage 1: Preparing script...');
    setProgress('script', 1);

    // STAGE 2: Stock Clips
    setStatus('Stage 2: Fetching stock clips...');
    let clipsFetched = 0;
    for (let i = 0; i < currentScenes.length; i++) {
      if (signal.aborted) throw new Error("Aborted");
      if (!currentScenes[i].clip) {
        await window.fetchSingleClip(i);
      }
      clipsFetched++;
      setProgress('stock', clipsFetched / currentScenes.length);
    }
    
    // Check if any scene is missing a clip
    if (currentScenes.some(s => !s.clip)) {
      throw new Error("Missing clips for some scenes. Please provide valid keywords or API keys.");
    }

    // STAGE 3: Voiceover
    setStatus('Stage 3: Generating voiceover...');
    await initTTS();
    const ttsResults = await generateAllScenes(currentScenes, {
      voice, 
      speed,
      onProgress: (sceneIdx, totalScenes, sentenceIdx, totalSentences) => {
        const scenePart = sceneIdx / totalScenes;
        const sentencePart = sentenceIdx / totalSentences / totalScenes;
        setProgress('voice', scenePart + sentencePart);
      }
    });
    
    if (signal.aborted) throw new Error("Aborted");
    
    // Assign audio data to scenes
    currentScenes.forEach((scene, i) => {
      scene.audio = ttsResults[i];
      // Sync subtitle segments from TTS
      scene.subtitleSegments = ttsResults[i].sentenceTimings.map(t => ({
        start: t.start,
        end: t.end,
        text: t.text
      }));
    });

    // STAGE 4: Audio Mix
    setStatus('Stage 4: Mixing and encoding audio...');
    const processedBuffers = [];
    for (const scene of currentScenes) {
      if (signal.aborted) throw new Error("Aborted");
      const processed = await processVoiceChain(scene.audio.samples, scene.audio.sampleRate);
      processedBuffers.push(processed);
    }
    
    const { mixedBuffer, sceneDurations } = await mixAudio(processedBuffers, musicBuffer, { sceneGap: 0.6 });
    
    // Update scene durations: voice duration + 0.6s gap (except last scene)
    currentScenes.forEach((scene, i) => {
      scene.duration = sceneDurations[i] + (i < currentScenes.length - 1 ? 0.6 : 0);
    });

    const audioChunks = await encodeAAC(mixedBuffer);
    setProgress('audio', 1);

    // STAGE 5: Render
    setStatus('Stage 5: Rendering video frames...');
    const muxData = await createMuxer({
      width: tier.width,
      height: tier.height,
      fps: 24,
      sampleRate: 48000,
      numberOfChannels: 2
    });

    renderWorker = new Worker('./src/render.worker.js', { type: 'module' });

    // Unified promise-based worker message handler
    function waitForWorker(expectedType) {
      return new Promise((resolve, reject) => {
        function handler(e) {
          const msg = e.data;
          if (msg.type === 'video-chunk') {
            addVideoChunk(muxData.muxer, msg.chunk, msg.meta);
          } else if (msg.type === 'progress') {
            const overall = (msg.sceneIndex + msg.framePercent) / currentScenes.length;
            setProgress('render', overall);
          } else if (msg.type === expectedType) {
            renderWorker.removeEventListener('message', handler);
            resolve(msg);
          } else if (msg.type === 'error') {
            renderWorker.removeEventListener('message', handler);
            reject(new Error(msg.message));
          }
        }
        renderWorker.addEventListener('message', handler);
      });
    }

    // Init the encoder in the worker
    renderWorker.postMessage({
      type: 'init',
      width: tier.width,
      height: tier.height,
      fps: 24,
      bitrate: tier.bitrate,
      transitionDuration: 0.8
    });
    await waitForWorker('ready');

    // Render each scene
    for (let i = 0; i < currentScenes.length; i++) {
      if (signal.aborted) throw new Error("Aborted");
      setStatus(`Stage 5: Rendering scene ${i+1}/${currentScenes.length}...`);
      const scene = currentScenes[i];

      const bitmap = await loadClipBitmap(scene.clip.url);
      let nextBitmap = null;
      if (i < currentScenes.length - 1 && currentScenes[i+1].clip) {
        nextBitmap = await loadClipBitmap(currentScenes[i+1].clip.url);
      }

      const transSelect = document.getElementById(`trans-${i}`);
      let transition = transSelect ? transSelect.value : defTransition;
      if (transition === 'auto') {
        const names = ['crossfade', 'slideLeft', 'slideRight', 'wipeLeft', 'wipeDown', 'dipToBlack'];
        transition = names[i % names.length];
      }

      const transfers = [bitmap];
      if (nextBitmap) transfers.push(nextBitmap);

      renderWorker.postMessage({
        type: 'render-scene',
        sceneIndex: i,
        totalScenes: currentScenes.length,
        bitmap,
        nextBitmap,
        duration: scene.duration,
        subtitleSegments: scene.subtitleSegments || [],
        transition,
        kenburns: null,     // null = random Ken Burns in worker
        nextKenburns: null
      }, transfers);

      // Wait for all frames of this scene to be rendered, then flush
      // The scene finishes when progress reaches 1.0, then we send flush
      await new Promise((resolve, reject) => {
        function sceneHandler(e) {
          const msg = e.data;
          if (msg.type === 'video-chunk') {
            addVideoChunk(muxData.muxer, msg.chunk, msg.meta);
          } else if (msg.type === 'progress' && msg.sceneIndex === i) {
            const overall = (i + msg.framePercent) / currentScenes.length;
            setProgress('render', overall);
            if (msg.framePercent >= 1) {
              renderWorker.removeEventListener('message', sceneHandler);
              resolve();
            }
          } else if (msg.type === 'error') {
            renderWorker.removeEventListener('message', sceneHandler);
            reject(new Error(msg.message));
          }
        }
        renderWorker.addEventListener('message', sceneHandler);
      });

      // Flush encoder per scene (keeps memory flat)
      renderWorker.postMessage({ type: 'flush' });
      await waitForWorker('flushed');
    }

    // Finalize video encoder
    renderWorker.postMessage({ type: 'finalize' });
    await waitForWorker('finalized');
    renderWorker.terminate();
    renderWorker = null;
    setProgress('render', 1);

    // Feed audio to muxer
    setStatus('Stage 6: Finalizing audio & muxing...');
    for (const { chunk, meta } of audioChunks) {
      addAudioChunk(muxData.muxer, chunk, meta);
    }
    
    const blob = await finalize(muxData);
    setProgress('mux', 1);
    
    // Done!
    setStatus('Generation complete!');
    els.btnGenerate.style.display = 'block';
    els.btnCancel.style.display = 'none';
    els.outputSection.classList.add('visible');
    
    if (blob) {
      const url = URL.createObjectURL(blob);
      els.outputVideo.src = url;
      els.btnDownload.href = url;
      els.outputSize.textContent = `Size: ${(blob.size / (1024*1024)).toFixed(2)} MB`;
    } else {
      // Streaming mode: file already saved to disk
      els.outputSize.textContent = 'Video saved to disk!';
      els.btnDownload.style.display = 'none';
    }

  } catch (err) {
    console.error(err);
    if (err.message !== "Aborted") {
      showError("Generation failed: " + err.message);
    }
    if (renderWorker) {
      renderWorker.terminate();
      renderWorker = null;
    }
    els.btnGenerate.style.display = 'block';
    els.btnCancel.style.display = 'none';
  }
}

async function loadClipBitmap(url) {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'auto';
    video.playsInline = true;
    
    // Basic timeout to prevent hanging forever
    const timeout = setTimeout(() => reject(new Error('Timeout loading video: ' + url)), 15000);

    video.onloadeddata = () => {
      // Seek slightly into the video
      video.currentTime = Math.min(1, video.duration / 2 || 0.1);
    };
    video.onseeked = async () => {
      clearTimeout(timeout);
      try {
        const bitmap = await createImageBitmap(video);
        video.src = '';
        video.load();
        resolve(bitmap);
      } catch (e) { reject(e); }
    };
    video.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('Failed to load video: ' + url));
    };
    video.src = url;
  });
}

// Boot
window.addEventListener('DOMContentLoaded', init);
