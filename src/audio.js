function normalizePeak(buffer, targetDB = -3) {
  const target = Math.pow(10, targetDB / 20); // -3 dBFS ≈ 0.708
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

async function resample(samples, fromRate, toRate) {
  const offCtx = new OfflineAudioContext(1, Math.ceil(samples.length * toRate / fromRate), toRate);
  const buf = offCtx.createBuffer(1, samples.length, fromRate);
  buf.copyToChannel(samples, 0);
  const src = offCtx.createBufferSource();
  src.buffer = buf;
  src.connect(offCtx.destination);
  src.start();
  return offCtx.startRendering();
}

export async function processVoiceChain(sceneSamples, sampleRate = 24000) {
  // 1. Resample to 48kHz
  const resampledBuffer = await resample(sceneSamples, sampleRate, 48000);
  
  const offCtx = new OfflineAudioContext(2, resampledBuffer.length, 48000);
  
  const src = offCtx.createBufferSource();
  src.buffer = resampledBuffer;
  
  // 2. High-pass filter at 80Hz
  const highpass = offCtx.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 80;
  
  // 3. Dynamics Compressor
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
  
  // 4. Normalize peak to -3 dBFS
  return normalizePeak(renderedBuffer, -3);
}

export async function mixAudio(processedVoiceBuffers, musicBuffer, options = {}) {
  const { duckLevel = 0.2, fadeTime = 0.5, sceneGap = 0.6 } = options;
  
  // Calculate total duration
  let totalFrames = 0;
  for (const buf of processedVoiceBuffers) {
    totalFrames += buf.length + (sceneGap * 48000);
  }
  if (processedVoiceBuffers.length > 0) {
    totalFrames -= (sceneGap * 48000); // Remove trailing gap
  }
  
  const offCtx = new OfflineAudioContext(2, totalFrames, 48000);
  
  let currentTime = 0;
  const sceneDurations = [];
  
  // Place voice buffers sequentially
  for (const buf of processedVoiceBuffers) {
    const src = offCtx.createBufferSource();
    src.buffer = buf;
    src.connect(offCtx.destination);
    src.start(currentTime);
    
    sceneDurations.push(buf.duration);
    currentTime += buf.duration + sceneGap;
  }
  
  // Add music if available
  if (musicBuffer) {
    const musicSrc = offCtx.createBufferSource();
    musicSrc.buffer = musicBuffer;
    musicSrc.loop = true;
    
    const gainNode = offCtx.createGain();
    gainNode.gain.setValueAtTime(0, 0);
    gainNode.gain.linearRampToValueAtTime(0.7, fadeTime);
    
    currentTime = 0;
    for (let i = 0; i < processedVoiceBuffers.length; i++) {
      const buf = processedVoiceBuffers[i];
      // Duck down before voice starts
      gainNode.gain.linearRampToValueAtTime(duckLevel, Math.max(0, currentTime - fadeTime));
      gainNode.gain.setValueAtTime(duckLevel, currentTime + buf.duration);
      // Bring up after voice ends
      if (i < processedVoiceBuffers.length - 1) {
        gainNode.gain.linearRampToValueAtTime(0.7, currentTime + buf.duration + fadeTime);
      }
      currentTime += buf.duration + sceneGap;
    }
    
    // Fade out at end
    gainNode.gain.linearRampToValueAtTime(0, offCtx.length / 48000);
    
    musicSrc.connect(gainNode);
    gainNode.connect(offCtx.destination);
    musicSrc.start(0);
  }
  
  const mixedBuffer = await offCtx.startRendering();
  return { mixedBuffer, sceneDurations };
}

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
      audioData.close();
      
      offset += frameCount;
    }
    
    encoder.flush().then(() => resolve(chunksAndMeta)).catch(reject);
  });
}
