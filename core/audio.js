/**
 * audio.js - DocuForge Audio Engine
 * 
 * Features:
 * 1. 48kHz Stereo OfflineAudioContext processing pipeline.
 * 2. Voice chain: 80Hz HPF, DynamicsCompressor (-24dB, 3:1), -3 dBFS peak normalization.
 * 3. Seamless music looping with silence trim, zero-crossing detection, and equal-power 1.5s crossfade.
 * 4. Multi-track shuffle / chaining with crossfades.
 * 5. Automated dynamic ducking (ducks to ~0.2 during speech, ramps to 0.7 in pauses).
 * 6. Timestamped SFX cue mixing.
 * 7. 2.0s master music outro fade.
 * 8. WebCodecs AudioEncoder AAC (mp4a.40.2) export with zero-copy AudioData disposal.
 */

// Zero-crossing search to prevent audible clicks at loop seams
function findZeroCrossing(channelData, startIndex, windowSize = 2048) {
  const start = Math.max(0, Math.min(startIndex, channelData.length - 2));
  const end = Math.min(start + windowSize, channelData.length - 2);
  let bestIdx = start;
  let minVal = Math.abs(channelData[start]);

  for (let i = start; i < end; i++) {
    // Check if zero crossing occurred
    if (channelData[i] * channelData[i + 1] <= 0) {
      return i;
    }
    const absVal = Math.abs(channelData[i]);
    if (absVal < minVal) {
      minVal = absVal;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// Trims leading and trailing silence below thresholdDB
export function trimSilence(buffer, thresholdDB = -55) {
  const threshold = Math.pow(10, thresholdDB / 20);
  const channels = buffer.numberOfChannels;
  let startFrame = 0;
  let endFrame = buffer.length - 1;

  // Find start
  outerStart: for (let i = 0; i < buffer.length; i++) {
    for (let c = 0; c < channels; c++) {
      if (Math.abs(buffer.getChannelData(c)[i]) > threshold) {
        startFrame = i;
        break outerStart;
      }
    }
  }

  // Find end
  outerEnd: for (let i = buffer.length - 1; i >= startFrame; i--) {
    for (let c = 0; c < channels; c++) {
      if (Math.abs(buffer.getChannelData(c)[i]) > threshold) {
        endFrame = i;
        break outerEnd;
      }
    }
  }

  const trimmedLength = Math.max(1, endFrame - startFrame + 1);
  if (trimmedLength === buffer.length) return buffer;

  const ctx = new OfflineAudioContext(channels, trimmedLength, buffer.sampleRate);
  const trimmed = ctx.createBuffer(channels, trimmedLength, buffer.sampleRate);

  for (let c = 0; c < channels; c++) {
    const srcData = buffer.getChannelData(c);
    const destData = trimmed.getChannelData(c);
    destData.set(srcData.subarray(startFrame, endFrame + 1));
  }

  return trimmed;
}

// Equal-power crossfade gain curves
function equalPowerCrossfade(t) {
  // t from 0 to 1
  return {
    gainOut: Math.cos(t * 0.5 * Math.PI),
    gainIn: Math.sin(t * 0.5 * Math.PI)
  };
}

/**
 * Builds a seamless loop of an AudioBuffer to meet or exceed targetDuration.
 * Uses an equal-power crossfade of ~1.5s at zero-crossing points.
 */
export async function createSeamlessLoopBuffer(buffer, targetDuration, crossfadeSec = 1.5) {
  const trimmed = trimSilence(buffer);
  const sr = trimmed.sampleRate;
  const channels = trimmed.numberOfChannels;
  const srcLen = trimmed.length;

  if (trimmed.duration >= targetDuration + 1.0) {
    return trimmed; // Already long enough
  }

  const xfadeFrames = Math.min(Math.floor(crossfadeSec * sr), Math.floor(srcLen * 0.25));
  const effectiveLen = srcLen - xfadeFrames;
  const loopCount = Math.ceil((targetDuration * sr) / effectiveLen) + 1;
  const totalFrames = Math.ceil(targetDuration * sr) + xfadeFrames;

  const offCtx = new OfflineAudioContext(channels, totalFrames, sr);
  const outBuffers = [];

  for (let c = 0; c < channels; c++) {
    const outData = new Float32Array(totalFrames);
    const inData = trimmed.getChannelData(c);

    let writePos = 0;

    for (let loop = 0; loop < loopCount; loop++) {
      if (loop === 0) {
        // First block: direct copy until crossfade tail
        outData.set(inData.subarray(0, srcLen - xfadeFrames), 0);
        writePos = srcLen - xfadeFrames;
      } else {
        // Equal-power crossfade between tail of prev and head of current
        const zeroCross = (c === 0) ? findZeroCrossing(inData, 0, 512) : 0;
        
        for (let i = 0; i < xfadeFrames; i++) {
          const t = i / xfadeFrames;
          const { gainOut, gainIn } = equalPowerCrossfade(t);
          const prevSample = inData[srcLen - xfadeFrames + i] || 0;
          const nextSample = inData[zeroCross + i] || 0;
          
          if (writePos + i < totalFrames) {
            outData[writePos + i] = (prevSample * gainOut) + (nextSample * gainIn);
          }
        }

        // Copy remaining body of current loop
        const remainingLen = Math.min(srcLen - xfadeFrames - zeroCross, totalFrames - (writePos + xfadeFrames));
        if (remainingLen > 0) {
          outData.set(inData.subarray(zeroCross + xfadeFrames, zeroCross + xfadeFrames + remainingLen), writePos + xfadeFrames);
        }
        writePos += (srcLen - xfadeFrames);
      }
      if (writePos >= totalFrames) break;
    }
    outBuffers.push(outData);
  }

  const resultBuffer = offCtx.createBuffer(channels, totalFrames, sr);
  for (let c = 0; c < channels; c++) {
    resultBuffer.copyToChannel(outBuffers[c], c);
  }

  return resultBuffer;
}

// Normalizes peak level of an AudioBuffer to targetDBFS
export function normalizePeak(buffer, targetDB = -3) {
  const target = Math.pow(10, targetDB / 20);
  let peak = 0;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
  }
  if (peak === 0) return buffer;
  const gain = target / peak;
  for (let ch = 0; ch < buffer.numberOfChannels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < data.length; i++) {
      data[i] *= gain;
    }
  }
  return buffer;
}

// High quality resampling to targetRate (e.g. 24kHz -> 48kHz)
async function resample(samples, fromRate, toRate) {
  const targetLen = Math.ceil(samples.length * toRate / fromRate);
  const offCtx = new OfflineAudioContext(1, targetLen, toRate);
  const buf = offCtx.createBuffer(1, samples.length, fromRate);
  buf.copyToChannel(samples, 0);
  const src = offCtx.createBufferSource();
  src.buffer = buf;
  src.connect(offCtx.destination);
  src.start();
  return offCtx.startRendering();
}

/**
 * 4-Stage Voice DSP Chain:
 * 1. Resample 24kHz Mono -> 48kHz Stereo
 * 2. High-pass filter at 80Hz
 * 3. Dynamics compression
 * 4. Peak normalization to -3 dBFS
 */
export async function processVoiceChain(sceneSamples, sampleRate = 24000) {
  const resampledBuffer = await resample(sceneSamples, sampleRate, 48000);
  const offCtx = new OfflineAudioContext(2, resampledBuffer.length, 48000);
  
  const src = offCtx.createBufferSource();
  src.buffer = resampledBuffer;
  
  // 80Hz High-pass filter
  const highpass = offCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 80;
  
  // Dynamics compressor
  const compressor = offCtx.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 30;
  compressor.ratio.value = 3;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.25;
  
  src.connect(highpass);
  highpass.connect(compressor);
  compressor.connect(offCtx.destination);
  
  src.start();
  const renderedBuffer = await offCtx.startRendering();
  return normalizePeak(renderedBuffer, -3);
}

/**
 * Mixes processed voice buffers, background music (with automated ducking),
 * and SFX cues into a unified 48kHz stereo master.
 */
export async function mixAudio(processedVoiceBuffers, musicBuffer, sfxCues = [], options = {}) {
  const {
    duckLevel = 0.2,
    musicVolume = 0.7,
    fadeTime = 0.5,
    sceneGap = 0.6,
    outroFadeDuration = 2.0
  } = options;

  let totalFrames = 0;
  for (const buf of processedVoiceBuffers) {
    totalFrames += buf.length + Math.round(sceneGap * 48000);
  }
  if (processedVoiceBuffers.length > 0) {
    totalFrames -= Math.round(sceneGap * 48000);
  }
  totalFrames = Math.max(totalFrames, 48000); // Minimum 1 sec

  const totalDurationSec = totalFrames / 48000;
  const offCtx = new OfflineAudioContext(2, totalFrames, 48000);

  let currentTime = 0;
  const sceneDurations = [];

  // 1. Position Voice Buffers
  for (const buf of processedVoiceBuffers) {
    const src = offCtx.createBufferSource();
    src.buffer = buf;
    src.connect(offCtx.destination);
    src.start(currentTime);

    sceneDurations.push(buf.duration);
    currentTime += buf.duration + sceneGap;
  }

  // 2. Add Background Music with Seamless Looping & Ducking
  if (musicBuffer) {
    const loopedMusic = await createSeamlessLoopBuffer(musicBuffer, totalDurationSec + 2.0, 1.5);
    const musicSrc = offCtx.createBufferSource();
    musicSrc.buffer = loopedMusic;

    const gainNode = offCtx.createGain();
    gainNode.gain.setValueAtTime(0, 0);
    gainNode.gain.linearRampToValueAtTime(musicVolume, fadeTime);

    currentTime = 0;
    for (let i = 0; i < processedVoiceBuffers.length; i++) {
      const buf = processedVoiceBuffers[i];
      // Duck down as speech begins
      gainNode.gain.linearRampToValueAtTime(duckLevel, Math.max(0, currentTime - fadeTime));
      gainNode.gain.setValueAtTime(duckLevel, currentTime + buf.duration);
      // Bring music volume back up between scenes
      if (i < processedVoiceBuffers.length - 1) {
        gainNode.gain.linearRampToValueAtTime(musicVolume, currentTime + buf.duration + fadeTime);
      }
      currentTime += buf.duration + sceneGap;
    }

    // Outro fade out over last 2s
    const fadeOutStart = Math.max(0, totalDurationSec - outroFadeDuration);
    gainNode.gain.setValueAtTime(gainNode.gain.value || duckLevel, fadeOutStart);
    gainNode.gain.linearRampToValueAtTime(0, totalDurationSec);

    musicSrc.connect(gainNode);
    gainNode.connect(offCtx.destination);
    musicSrc.start(0);
  }

  // 3. Add SFX Cues
  for (const cue of sfxCues) {
    if (cue.buffer && cue.time < totalDurationSec) {
      const sfxSrc = offCtx.createBufferSource();
      sfxSrc.buffer = cue.buffer;
      const sfxGain = offCtx.createGain();
      sfxGain.gain.value = cue.volume ?? 0.8;
      sfxSrc.connect(sfxGain);
      sfxGain.connect(offCtx.destination);
      sfxSrc.start(cue.time);
    }
  }

  const mixedBuffer = await offCtx.startRendering();
  return { mixedBuffer, sceneDurations, totalDurationSec };
}

/**
 * Encodes an AudioBuffer to AAC using WebCodecs AudioEncoder
 */
export async function encodeAAC(mixedBuffer) {
  const sampleRate = mixedBuffer.sampleRate;
  const numberOfChannels = mixedBuffer.numberOfChannels;
  const chunksAndMeta = [];

  return new Promise((resolve, reject) => {
    const encoder = new AudioEncoder({
      output: (chunk, meta) => {
        chunksAndMeta.push({ chunk, meta });
      },
      error: reject
    });

    encoder.configure({
      codec: 'mp4a.40.2',
      sampleRate,
      numberOfChannels,
      bitrate: 128000
    });

    const leftChannel = mixedBuffer.getChannelData(0);
    const rightChannel = mixedBuffer.numberOfChannels > 1 ? mixedBuffer.getChannelData(1) : leftChannel;

    const framesPerChunk = 1024;
    const totalFrames = mixedBuffer.length;
    let offset = 0;

    while (offset < totalFrames) {
      const frameCount = Math.min(framesPerChunk, totalFrames - offset);
      const planarData = new Float32Array(frameCount * 2);
      planarData.set(leftChannel.subarray(offset, offset + frameCount), 0);
      planarData.set(rightChannel.subarray(offset, offset + frameCount), frameCount);

      const audioData = new AudioData({
        format: 'f32-planar',
        sampleRate,
        numberOfFrames: frameCount,
        numberOfChannels: 2,
        timestamp: (offset / sampleRate) * 1e6,
        data: planarData
      });

      encoder.encode(audioData);
      audioData.close(); // Immediate memory reclamation
      offset += frameCount;
    }

    encoder.flush().then(() => resolve(chunksAndMeta)).catch(reject);
  });
}
