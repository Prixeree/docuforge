import { KokoroTTS } from 'https://cdn.jsdelivr.net/npm/kokoro-js@1.1.1/dist/kokoro.web.js';

let tts = null;

self.onmessage = async (e) => {
  const { type, ...payload } = e.data;
  
  if (type === 'init') {
    try {
      const hasWebGPU = typeof navigator !== 'undefined' && !!navigator.gpu;
      const device = hasWebGPU ? 'webgpu' : 'wasm';
      const dtype = hasWebGPU ? 'fp32' : 'q8';
      
      tts = await KokoroTTS.from_pretrained('onnx-community/Kokoro-82M-v1.0-ONNX', {
        dtype,
        device,
        progress_callback: (progress) => {
          self.postMessage({ type: 'init-progress', progress });
        }
      });
      
      self.postMessage({ type: 'init-done' });
    } catch (err) {
      self.postMessage({ type: 'init-error', error: err.message });
    }
  }
  
  if (type === 'generate') {
    if (!tts) {
      self.postMessage({ type: 'generate-error', id: payload.id, error: 'TTS not initialized' });
      return;
    }
    try {
      const result = await tts.generate(payload.text, {
        voice: payload.voice || 'bm_george',
        speed: payload.speed ?? 0.93
      });
      
      const samples = result.audio;
      const sampleRate = result.sampling_rate || 24000;
      const duration = samples.length / sampleRate;
      
      // Transfer the buffer, don't copy
      self.postMessage(
        { type: 'audio', id: payload.id, samples, sampleRate, duration },
        [samples.buffer]
      );
    } catch (err) {
      self.postMessage({ type: 'generate-error', id: payload.id, error: err.message });
    }
  }
  
  if (type === 'list-voices') {
    if (tts && tts.voices) {
      self.postMessage({ type: 'voices', voices: tts.voices });
    } else {
      // Fallback hardcoded list
      self.postMessage({ type: 'voices', voices: [
        'bm_george', 'bm_lewis', 'am_michael', 'am_adam',
        'af_heart', 'af_star', 'af_bella', 'af_sarah',
        'bf_emma', 'bf_isabella', 'bm_daniel', 'bm_fable'
      ]});
    }
  }
};
