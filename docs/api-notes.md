# DocuForge Engine API Reference & Implementation Notes

This document provides exhaustive, code-level documentation for the core media generation, encoding, multiplexing, and asset retrieval technologies powering DocuForge.

---

## 1. WebCodecs VideoEncoder & AudioEncoder

The WebCodecs API provides low-level, hardware-accelerated access to video and audio codecs directly in modern browser environments (Chromium 94+, Safari 16.4+, Firefox 130+ behind flags).

### 1.1 Import & API Availability

WebCodecs classes are global objects available in both `window` and `DedicatedWorkerGlobalScope`:

```javascript
// Native browser globals (no external npm dependencies required)
const { VideoEncoder, AudioEncoder, VideoFrame, AudioData } = globalThis;

// Verification helper
export function isWebCodecsSupported() {
  return typeof globalThis.VideoEncoder === 'function' &&
         typeof globalThis.AudioEncoder === 'function' &&
         typeof globalThis.VideoFrame === 'function';
}
```

---

### 1.2 VideoEncoder Configurations

H.264 (AVC) uses the FourCC codec string format `avc1.PPCCLL`:
- `PP` = Profile IDC (in hex): `42` (Baseline), `4D` (Main), `64` (High).
- `CC` = Constraint flags (in hex): `00` (standard) or `40` (constrained baseline `avc1.4240xx`).
- `LL` = Level IDC (in hex): `1F` (Level 3.1, up to 720p@30fps), `20` (Level 3.2), `28` (Level 4.0).

For MP4 container muxing, `avc: { format: 'avc' }` (length-delimited NAL units) is **required**. Do not use `'annexb'` (start codes `00 00 00 01`) for MP4 files.

#### Exact Configurations

```javascript
/**
 * Configuration for H.264 480p (854x480 @ 24fps)
 * Note: 854 is not divisible by 16. While 854 is even, some strict hardware encoders
 * require dimensions divisible by 2, 4, 8, or 16. 854x480 is standard 16:9 480p.
 * If hardware encoder throws on 854, round width to 856 (856x480).
 */
export const H264_CONFIG_480P = {
  codec: 'avc1.42001f', // H.264 Baseline Profile, Level 3.1
  width: 854,
  height: 480,
  bitrate: 1_200_000,    // 1.2 Mbps
  framerate: 24,
  hardwareAcceleration: 'prefer-hardware',
  avc: { format: 'avc' },
  latencyMode: 'quality' // 'quality' produces higher compression for non-realtime rendering
};

/**
 * Configuration for H.264 720p (1280x720 @ 24fps)
 */
export const H264_CONFIG_720P = {
  codec: 'avc1.4d001f', // H.264 Main Profile, Level 3.1
  width: 1280,
  height: 720,
  bitrate: 2_800_000,    // 2.8 Mbps
  framerate: 24,
  hardwareAcceleration: 'prefer-hardware',
  avc: { format: 'avc' },
  latencyMode: 'quality'
};
```

---

### 1.3 AudioEncoder Configurations

- **AAC-LC**: Codec string `'mp4a.40.2'` (MPEG-4 Audio, Object Type 2 = AAC Low Complexity). Universal playback in MP4 across Apple, Android, and Windows platforms.
- **Opus Fallback**: Codec string `'opus'`. Primarily supported in WebM, but modern MP4 specifications and Chromium allow Opus-in-MP4. Used as fallback on environments lacking native AAC encoders (e.g. some Linux builds).

```javascript
export const AAC_STEREO_CONFIG = {
  codec: 'mp4a.40.2',
  sampleRate: 48000,
  numberOfChannels: 2,
  bitrate: 128_000 // 128 kbps
};

export const OPUS_STEREO_CONFIG = {
  codec: 'opus',
  sampleRate: 48000,
  numberOfChannels: 2,
  bitrate: 128_000
};

/**
 * Resolves the best supported audio configuration
 */
export async function getSupportedAudioConfig() {
  const aacSupported = await AudioEncoder.isConfigSupported(AAC_STEREO_CONFIG);
  if (aacSupported.supported) {
    return aacSupported.config;
  }

  const opusSupported = await AudioEncoder.isConfigSupported(OPUS_STEREO_CONFIG);
  if (opusSupported.supported) {
    console.warn('AAC encoding not supported by platform; falling back to Opus');
    return opusSupported.config;
  }

  throw new Error('Neither AAC nor Opus encoding is supported on this browser.');
}
```

---

### 1.4 Creating VideoFrame from OffscreenCanvas

`VideoFrame` accepts an `OffscreenCanvas`, `HTMLCanvasElement`, `ImageBitmap`, or `HTMLVideoElement`.

#### Critical Timestamp Unit: Microseconds

WebCodecs uses **integer microseconds** (`1 s = 1,000,000 µs`):
- At 24 fps, frame duration is `1,000,000 / 24 = 41,666.666... µs`.
- Always compute timestamps cumulatively from frame index: `Math.round((i * 1_000_000) / fps)`.

```javascript
/**
 * Creates a VideoFrame from an OffscreenCanvas
 * @param {OffscreenCanvas} canvas
 * @param {number} frameIndex - Zero-indexed frame counter
 * @param {number} fps - e.g. 24
 * @returns {VideoFrame}
 */
export function createFrameFromCanvas(canvas, frameIndex, fps = 24) {
  const timestamp = Math.round((frameIndex * 1_000_000) / fps);
  const duration = Math.round(1_000_000 / fps);

  return new VideoFrame(canvas, {
    timestamp,
    duration
  });
}
```

---

### 1.5 Encode and Flush Lifecycle

The lifecycle follows strict sequential state transitions:
1. `unconfigured`: Initial state.
2. `configured`: After calling `.configure(config)`.
3. Call `.encode(frame, { keyFrame: boolean })`.
4. **IMMEDIATELY** call `frame.close()` after `.encode()`.
5. Call `await encoder.flush()` to drain pending jobs.
6. Call `encoder.close()` to release the codec instance.

```javascript
// State transitions:
// unconfigured -> configured -> encoding -> flushing -> closed
```

> [!CAUTION]
> Failing to call `frame.close()` immediately after `encoder.encode(frame)` keeps the underlying GPU surface/texture alive in memory. At 24–60 fps, this causes the browser tab to crash with GPU Out-Of-Memory (OOM) within seconds.

---

### 1.6 Hardware Acceleration & Software Fallback

When `hardwareAcceleration: 'prefer-hardware'` is set:
- Chrome on macOS uses VideoToolbox (Apple Silicon / Intel QuickSync).
- Chrome on Windows uses MediaFoundation (NVENC / Intel QuickSync / AMD AMF).
- On Linux or low-end devices, hardware encoding for H.264 is frequently disabled or unavailable.

#### Robust Fallback Implementation Pattern

```javascript
/**
 * Probes and configures VideoEncoder with progressive fallbacks
 */
export async function configureVideoEncoderWithFallback(encoder, baseConfig) {
  const candidatePreferences = [
    'prefer-hardware',
    'no-preference',
    'prefer-software'
  ];

  // Try varying levels of acceleration with primary codec
  for (const hwPref of candidatePreferences) {
    const candidate = { ...baseConfig, hardwareAcceleration: hwPref };
    try {
      const support = await VideoEncoder.isConfigSupported(candidate);
      if (support.supported) {
        encoder.configure(support.config);
        return support.config;
      }
    } catch {
      // Continue searching
    }
  }

  // Fallback to Baseline profile if Main/High failed
  if (baseConfig.codec !== 'avc1.42001f') {
    const baselineCandidate = {
      ...baseConfig,
      codec: 'avc1.42001f',
      hardwareAcceleration: 'no-preference'
    };
    const support = await VideoEncoder.isConfigSupported(baselineCandidate);
    if (support.supported) {
      encoder.configure(support.config);
      return support.config;
    }
  }

  throw new Error(`Failed to configure VideoEncoder for ${baseConfig.width}x${baseConfig.height}`);
}
```

---

### 1.7 Error Handling Patterns & Backpressure Control

`VideoEncoder` runs encoding asynchronously in a background thread or GPU queue. Flow control is required to prevent generating frames faster than the encoder can process them.

```javascript
/**
 * Backpressure helper: Waits if encoder queue is backlogged
 * @param {VideoEncoder} encoder
 * @param {number} maxQueueSize - Max allowed pending frames
 */
export async function waitForEncoderQueue(encoder, maxQueueSize = 5) {
  if (encoder.encodeQueueSize <= maxQueueSize) return;

  await new Promise(resolve => {
    const onDequeue = () => {
      if (encoder.encodeQueueSize <= maxQueueSize) {
        encoder.removeEventListener('dequeue', onDequeue);
        resolve();
      }
    };
    encoder.addEventListener('dequeue', onDequeue);
  });
}
```

---

### 1.8 Minimal Working Code Snippet: End-to-End Encoding

```javascript
export async function renderCanvasToVideoChunks({
  width = 1280,
  height = 720,
  fps = 24,
  totalFrames = 72,
  onChunk,
  drawFrame
}) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  let encoderError = null;

  const encoder = new VideoEncoder({
    output: (chunk, metadata) => {
      onChunk(chunk, metadata);
    },
    error: (e) => {
      console.error('VideoEncoder error:', e);
      encoderError = e;
    }
  });

  const baseConfig = {
    codec: 'avc1.4d001f',
    width,
    height,
    bitrate: 2_500_000,
    framerate: fps,
    hardwareAcceleration: 'prefer-hardware',
    avc: { format: 'avc' }
  };

  await configureVideoEncoderWithFallback(encoder, baseConfig);

  const keyFrameInterval = fps * 2; // Keyframe every 2 seconds

  for (let i = 0; i < totalFrames; i++) {
    if (encoderError) throw encoderError;

    // Wait for encoder backpressure if necessary
    await waitForEncoderQueue(encoder, 4);

    // Draw scene onto canvas
    drawFrame(ctx, i, totalFrames);

    // Generate frame
    const frame = createFrameFromCanvas(canvas, i, fps);
    const isKeyframe = (i % keyFrameInterval === 0);

    encoder.encode(frame, { keyFrame: isKeyframe });
    
    // MANDATORY: Close frame to prevent VRAM memory leak
    frame.close();
  }

  // Drain encoder and wait for all output callbacks to complete
  await encoder.flush();
  encoder.close();
}
```

---

### 1.9 Browser Compatibility & Gotchas

1. **Macroblock Alignment (Mod-2 / Mod-16)**:
   - Resolutions like `854x480` may fail on some hardware encoders (Intel / Apple Silicon) because 854 is not divisible by 4, 8, or 16. If `isConfigSupported` returns `false` or throws a configuration error, switch to `856x480` or `848x480`.
2. **First Frame Must Be a Keyframe**:
   - The first encoded frame passed to `encode()` MUST have `{ keyFrame: true }`. If the first frame is a delta frame, downstream decoders and muxers cannot initialize.
3. **Annex B vs AVC Format**:
   - WebCodecs defaults to `'avc'` for H.264. Never set `avc: { format: 'annexb' }` when outputting to MP4.
4. **Metadata on Keyframes**:
   - The `output` callback receives `metadata.decoderConfig` primarily on keyframes. This contains the `description` (AVCDecoderConfigurationRecord containing SPS and PPS bytes), which is mandatory for the MP4 file header.

---

### 1.10 Memory Management Considerations

- **VideoFrame Disposal**: A 1080p RGBA `VideoFrame` holds ~8.3 MB of uncompressed bitmap data. 100 unclosed frames consume nearly 1 GB of GPU VRAM. Call `frame.close()` in a `try...finally` block.
- **AudioData Disposal**: `AudioData` objects produced for `AudioEncoder` also implement `.close()`. Always close them once `encoder.encode(audioData)` completes.
- **Encoder Teardown**: After `flush()`, always invoke `encoder.close()`. Failing to close unreferenced encoders can hold hardware codec handles open, blocking subsequent encode sessions in other tabs.

---

## 2. mp4-muxer (npm: mp4-muxer)

`mp4-muxer` (authored by **Vanilagy**) is a pure TypeScript/JavaScript library (~10 KB minified) for creating ISO Base Media File Format (MP4) files in web browsers and Node.js using WebCodecs chunks.

> [!NOTE]
> `mp4-muxer` is succeeded by **Mediabunny** (by the same author, Vanilagy). While `mp4-muxer` is in maintenance/deprecated status in favor of Mediabunny's multi-track engine, the `mp4-muxer` package remains widely used for lightweight, zero-dependency browser video compilation. Both usage patterns are covered below.

### 2.1 Installation & Imports

```bash
npm install mp4-muxer
```

```javascript
// ES Module Import (bundler or unpkg / jsdelivr)
import { 
  Muxer, 
  ArrayBufferTarget, 
  StreamTarget, 
  FileSystemWritableFileStreamTarget 
} from 'mp4-muxer';

// Or in vanilla browser ES module from CDN / vendor folder:
// import { Muxer, ArrayBufferTarget } from './vendor/mp4-muxer.js';
```

---

### 2.2 Muxer Constructor Options

```typescript
interface MuxerOptions {
  target: ArrayBufferTarget | StreamTarget | FileSystemWritableFileStreamTarget;
  video?: {
    codec: 'avc' | 'hevc' | 'vp9' | 'av1';
    width: number;
    height: number;
    rotation?: 0 | 90 | 180 | 270;
  };
  audio?: {
    codec: 'aac' | 'opus';
    numberOfChannels: number;
    sampleRate: number;
  };
  fastStart: 'in-memory' | false | { expectedVideoChunks?: number; expectedAudioChunks?: number };
  firstTimestampBehavior?: 'strict' | 'offset' | 'modify';
}
```

#### Explanation of Key Options

1. **`fastStart`**:
   - `'in-memory'` (Default recommendation for web): Places the `moov` (movie metadata) atom at the beginning of the MP4 file before the `mdat` (media data) atom. This enables instant web playback without downloading the full video.
   - `false`: Writes `mdat` first and appends `moov` at the end. Recommended for long videos or low-memory devices to avoid holding all chunks in RAM.
   - `{ expectedVideoChunks: N }`: Pre-reserves header space in the stream so `moov` can be written at the beginning even when streaming to disk.
2. **`firstTimestampBehavior`**:
   - `'offset'`: Automatically rebases timestamps so the first video/audio chunk starts at `t = 0`. Prevents playback lag if WebCodecs starts encoding at non-zero timestamps.
   - `'strict'`: Rejects chunks if the first timestamp is non-zero.

---

### 2.3 Ingestion: Feeding Encoded Chunks

Chunks received from `VideoEncoder` and `AudioEncoder` output callbacks are passed directly to `muxer.addVideoChunk` and `muxer.addAudioChunk`:

```javascript
// VideoEncoder output callback
const onVideoOutput = (chunk, metadata) => {
  // metadata contains decoderConfig (SPS/PPS) on keyframes
  muxer.addVideoChunk(chunk, metadata);
};

// AudioEncoder output callback
const onAudioOutput = (chunk, metadata) => {
  muxer.addAudioChunk(chunk, metadata);
};
```

---

### 2.4 Streaming Targets: ArrayBufferTarget vs File Targets

#### Option A: `ArrayBufferTarget` (In-Memory)
Collects the final MP4 in memory. Best for short clips (< 2 minutes) or direct Blob creation.

```javascript
const target = new ArrayBufferTarget();
const muxer = new Muxer({ target, video: { ... }, fastStart: 'in-memory' });

// After muxer.finalize():
const buffer = target.buffer; // ArrayBuffer
const blob = new Blob([buffer], { type: 'video/mp4' });
```

#### Option B: `FileSystemWritableFileStreamTarget` (Disk Streaming)
Streams chunks directly to the client's file system using the File System Access API. Bypasses browser RAM limits entirely.

```javascript
// User picks save location via File System Access API
const fileHandle = await window.showSaveFilePicker({
  suggestedName: 'export.mp4',
  types: [{ description: 'MP4 Video', accept: { 'video/mp4': ['.mp4'] } }]
});
const writableStream = await fileHandle.createWritable();

const target = new FileSystemWritableFileStreamTarget(writableStream);
const muxer = new Muxer({
  target,
  video: { codec: 'avc', width: 1280, height: 720 },
  fastStart: false // Streams straight to disk without in-memory buffering
});
```

#### Option C: `StreamTarget` (Custom Stream Callback)
Provides chunk-by-chunk write callbacks for upload or WebSocket streaming.

```javascript
const target = new StreamTarget({
  onData: (data, position) => {
    // data is a Uint8Array slice
    console.log(`Writing ${data.byteLength} bytes at position ${position}`);
  }
});
```

---

### 2.5 Finalization & Blob Creation

```javascript
// Finalize flushes all atom headers (moov, mvhd, trak, mdat)
muxer.finalize();

// With ArrayBufferTarget, target.buffer is now fully populated
const mp4Blob = new Blob([target.buffer], { type: 'video/mp4' });
const mp4Url = URL.createObjectURL(mp4Blob);
```

---

### 2.6 Minimal Working Code Snippet: Muxing H.264 + AAC

```javascript
import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

/**
 * Encodes and muxes canvas frames + an AudioBuffer into an MP4 Blob
 */
export async function createMP4Video({
  width = 1280,
  height = 720,
  fps = 24,
  durationSeconds = 3,
  audioBuffer = null, // Web Audio API AudioBuffer (48kHz stereo)
  drawFrame
}) {
  const target = new ArrayBufferTarget();

  const muxerOptions = {
    target,
    video: {
      codec: 'avc',
      width,
      height
    },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset'
  };

  if (audioBuffer) {
    muxerOptions.audio = {
      codec: 'aac',
      numberOfChannels: audioBuffer.numberOfChannels,
      sampleRate: audioBuffer.sampleRate
    };
  }

  const muxer = new Muxer(muxerOptions);

  // Initialize VideoEncoder
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => console.error('VideoEncoder error:', e)
  });

  videoEncoder.configure({
    codec: 'avc1.4d001f',
    width,
    height,
    bitrate: 2_500_000,
    framerate: fps,
    hardwareAcceleration: 'prefer-hardware',
    avc: { format: 'avc' }
  });

  // Render & encode video frames
  const totalFrames = Math.round(durationSeconds * fps);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  for (let i = 0; i < totalFrames; i++) {
    drawFrame(ctx, i, totalFrames);
    const timestamp = Math.round((i * 1_000_000) / fps);
    const frame = new VideoFrame(canvas, { timestamp, duration: Math.round(1_000_000 / fps) });
    
    videoEncoder.encode(frame, { keyFrame: i % (fps * 2) === 0 });
    frame.close();
  }

  await videoEncoder.flush();
  videoEncoder.close();

  // Encode audio if present
  if (audioBuffer) {
    const audioEncoder = new AudioEncoder({
      output: (chunk, meta) => muxer.addAudioChunk(chunk, meta),
      error: (e) => console.error('AudioEncoder error:', e)
    });

    audioEncoder.configure({
      codec: 'mp4a.40.2',
      sampleRate: audioBuffer.sampleRate,
      numberOfChannels: audioBuffer.numberOfChannels,
      bitrate: 128_000
    });

    // Create planar AudioData from AudioBuffer
    const audioData = new AudioData({
      format: 'f32-planar',
      sampleRate: audioBuffer.sampleRate,
      numberOfFrames: audioBuffer.length,
      numberOfChannels: audioBuffer.numberOfChannels,
      timestamp: 0,
      data: audioBuffer.getChannelData(0) // If stereo, supply combined or interleaved buffer
    });

    audioEncoder.encode(audioData);
    audioData.close();

    await audioEncoder.flush();
    audioEncoder.close();
  }

  // Finalize MP4
  muxer.finalize();

  return new Blob([target.buffer], { type: 'video/mp4' });
}
```

---

### 2.7 Browser Compatibility & Gotchas

1. **Decoder Config Forwarding**:
   - `muxer.addVideoChunk(chunk, meta)`: Always forward `meta` from the `output` callback. Without `meta.decoderConfig` on the first keyframe, `mp4-muxer` cannot construct the AVCC box, resulting in unplayable output.
2. **Timestamp Monotonicity**:
   - Chunks must be fed in strictly monotonic timestamp order per track. If out-of-order chunks are fed, the muxer will produce a corrupted timescale table.
3. **Safari Audio Requirement**:
   - Safari's native MP4 demuxer will fail if an MP4 track uses Opus audio. For Safari compatibility, always encode audio with AAC (`'mp4a.40.2'`).

---

### 2.8 Memory Management Considerations

- `fastStart: 'in-memory'` buffers all media chunks in JavaScript heap memory until `finalize()` rearranges the atoms. A 1080p 60-second video at 5 Mbps requires ~40 MB of RAM; a 10-minute video requires ~400 MB.
- When generating long videos, use `FileSystemWritableFileStreamTarget` and `fastStart: false` to stream data directly to storage with near-zero memory footprint.

---

## 3. kokoro-js TTS

`kokoro-js` is an in-browser neural text-to-speech engine powered by **Transformers.js** and **ONNX Runtime Web**. It runs the **Kokoro-82M** model entirely client-side on WebAssembly (WASM) or WebGPU without requiring any backend TTS server.

### 3.1 Architecture & Package Overview

- **Package**: `npm install kokoro-js` (or import via ESM CDN `https://cdn.jsdelivr.net/npm/kokoro-js@1.1.1/dist/kokoro.web.js`).
- **Core Technology**: ONNX Runtime Web (`ort-wasm-simd-threaded.wasm` or WebGPU backend) + Transformers.js tokenizer & acoustic generator.
- **Model Identifier**: `"onnx-community/Kokoro-82M-v1.0-ONNX"` (hosted on Hugging Face).

---

### 3.2 Model Weights & Quantizations

| Quantization (`dtype`) | Size on Disk / Download | Target Device / Backend | Quality Profile |
| :--- | :--- | :--- | :--- |
| **`q8`** (int8) | **~92.4 MB** | **CPU / WASM (Recommended)** | Near-lossless acoustic fidelity, lowest CPU latency |
| **`q4`** (int4) | ~46.0 MB | Mobile / Low RAM WASM | Slight high-frequency degradation |
| **`fp16`** (float16) | ~163.0 MB | WebGPU | Best performance on modern GPUs |
| **`fp32`** (float32) | ~326.0 MB | Desktop WebGPU / Fallback | Reference baseline |

---

### 3.3 Web Worker Implementation Pattern

Loading an 82M model and executing ONNX graph inference on the main UI thread freezes DOM rendering. Kokoro must execute inside a **Dedicated Web Worker**.

#### File: `src/workers/tts.worker.js`

```javascript
import { KokoroTTS } from 'kokoro-js';

let ttsInstance = null;

self.onmessage = async (e) => {
  const { type, payload, id } = e.data;

  try {
    if (type === 'INIT') {
      const modelId = payload.modelId || 'onnx-community/Kokoro-82M-v1.0-ONNX';
      const dtype = payload.dtype || 'q8';
      const device = payload.device || 'wasm';

      ttsInstance = await KokoroTTS.from_pretrained(modelId, {
        dtype,
        device,
        progress_callback: (progressData) => {
          self.postMessage({
            type: 'INIT_PROGRESS',
            payload: progressData
          });
        }
      });

      self.postMessage({ type: 'INIT_SUCCESS', id });
    }

    if (type === 'GENERATE') {
      if (!ttsInstance) {
        throw new Error('TTS model has not been initialized.');
      }

      const { text, voice = 'af_bella', speed = 1.0 } = payload;

      // Generate raw audio
      const rawAudio = await ttsInstance.generate(text, {
        voice,
        speed
      });

      // rawAudio.audio is a Float32Array (mono, 24kHz)
      // Transfer the underlying ArrayBuffer for zero-copy efficiency
      const pcmData = rawAudio.audio;
      const sampleRate = rawAudio.sampling_rate || 24000;

      self.postMessage(
        {
          type: 'GENERATE_SUCCESS',
          id,
          payload: {
            samples: pcmData,
            sampleRate,
            duration: pcmData.length / sampleRate
          }
        },
        [pcmData.buffer] // Transferable object
      );
    }
  } catch (err) {
    self.postMessage({
      type: 'ERROR',
      id,
      error: err.message || String(err)
    });
  }
};
```

---

### 3.4 Speech Generation API & Audio Conversion

`tts.generate(text, { voice })` returns a `RawAudio` object:
- `rawAudio.audio`: `Float32Array` containing mono PCM samples normalized between `-1.0` and `+1.0`.
- `rawAudio.sampling_rate`: `24000` (24 kHz fixed).

#### Converting Float32Array to Web Audio API AudioBuffer

```javascript
/**
 * Converts Kokoro 24kHz Float32Array into an AudioBuffer
 * @param {Float32Array} pcmData
 * @param {number} sampleRate - 24000
 * @param {AudioContext} audioCtx
 * @returns {AudioBuffer}
 */
export function pcmToAudioBuffer(pcmData, sampleRate, audioCtx) {
  const buffer = audioCtx.createBuffer(1, pcmData.length, sampleRate);
  buffer.copyToChannel(pcmData, 0);
  return buffer;
}

/**
 * Resamples a 24kHz AudioBuffer to 48kHz stereo for MP4 muxing
 */
export async function resampleTo48kStereo(sourceBuffer) {
  const targetSampleRate = 48000;
  const targetLength = Math.round(sourceBuffer.duration * targetSampleRate);

  const offlineCtx = new OfflineAudioContext(2, targetLength, targetSampleRate);
  const source = offlineCtx.createBufferSource();
  source.buffer = sourceBuffer;

  // Route mono to both left and right channels
  source.connect(offlineCtx.destination);
  source.start(0);

  return await offlineCtx.startRendering();
}
```

---

### 3.5 Progress and Status Events

The `progress_callback` reports download progress for individual model files (`model_q8.onnx`, `tokenizer.json`, voices):

```javascript
const onProgress = (report) => {
  if (report.status === 'initiate') {
    console.log(`Starting download: ${report.file}`);
  } else if (report.status === 'progress') {
    // report.progress is a percentage (0 to 100)
    console.log(`Downloading ${report.file}: ${report.progress.toFixed(1)}%`);
  } else if (report.status === 'done') {
    console.log(`Finished loading: ${report.file}`);
  }
};
```

---

### 3.6 Model Caching (Cache API & IndexedDB)

Kokoro-js utilizes Transformers.js environment configurations:
- By default, `@huggingface/transformers` uses the **Cache Storage API** (`caches.open('transformers-cache')`).
- Files are saved as HTTP Response objects keyed by URL. Subsequent loads bypass the network entirely.

#### Caching Verification and Manual Control

```javascript
import { env } from '@huggingface/transformers';

export function configureTTSCache() {
  // Ensure browser cache is enabled
  env.useBrowserCache = true;
  
  // Disable local node fs lookups
  env.allowLocalModels = false;
}

/**
 * Checks if the Kokoro q8 model is already present in browser cache
 */
export async function isKokoroModelCached(modelId = 'onnx-community/Kokoro-82M-v1.0-ONNX') {
  if (!('caches' in window)) return false;
  
  const cache = await caches.open('transformers-cache');
  const modelUrl = `https://huggingface.co/${modelId}/resolve/main/onnx/model_q8.onnx`;
  const match = await cache.match(modelUrl);
  return !!match;
}
```

---

### 3.7 Minimal Working Code Snippet: Main Thread Controller

```javascript
// src/tts-controller.js
export class TTSService {
  constructor() {
    this.worker = null;
    this.isReady = false;
    this.pendingRequests = new Map();
    this.requestId = 0;
  }

  async init(onProgress) {
    if (this.isReady) return;

    this.worker = new Worker(new URL('./workers/tts.worker.js', import.meta.url), {
      type: 'module'
    });

    return new Promise((resolve, reject) => {
      this.worker.onmessage = (e) => {
        const { type, payload, error, id } = e.data;

        if (type === 'INIT_PROGRESS' && onProgress) {
          onProgress(payload);
        } else if (type === 'INIT_SUCCESS') {
          this.isReady = true;
          resolve();
        } else if (type === 'GENERATE_SUCCESS') {
          const req = this.pendingRequests.get(id);
          if (req) {
            this.pendingRequests.delete(id);
            req.resolve(payload);
          }
        } else if (type === 'ERROR') {
          if (!this.isReady) reject(new Error(error));
          const req = this.pendingRequests.get(id);
          if (req) {
            this.pendingRequests.delete(id);
            req.reject(new Error(error));
          }
        }
      };

      this.worker.postMessage({
        type: 'INIT',
        payload: { dtype: 'q8', device: 'wasm' }
      });
    });
  }

  async synthesize(text, voice = 'af_bella') {
    if (!this.isReady) throw new Error('TTSService is not initialized');

    const id = ++this.requestId;
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.worker.postMessage({
        type: 'GENERATE',
        id,
        payload: { text, voice }
      });
    });
  }
}
```

---

### 3.8 Browser Compatibility & Gotchas

1. **WASM SIMD and Multithreading**:
   - For optimal inference speeds, `ort-wasm-simd-threaded.wasm` requires `SharedArrayBuffer`.
   - `SharedArrayBuffer` requires Cross-Origin Opener Policy (COOP) and Cross-Origin Embedder Policy (COEP) HTTP headers:
     ```http
     Cross-Origin-Opener-Policy: same-origin
     Cross-Origin-Embedder-Policy: require-corp
     ```
   - If COOP/COEP headers cannot be configured on your host, Kokoro falls back to single-threaded SIMD, which increases inference duration by ~2.5x.
2. **Sample Rate Mismatch**:
   - Kokoro outputs strictly **24 kHz**. The WebCodecs AAC encoder requires 44.1 kHz or 48 kHz. Feeding 24 kHz directly into a 48 kHz AAC encoder causes high-pitch chipmunk distortion. Always resample via `OfflineAudioContext`.

---

### 3.9 Memory Management Considerations

- **Transferable Objects**: Always pass `pcmData.buffer` in the transfer list of `postMessage`. This transfers memory ownership directly without cloning large arrays across threads.
- **Worker Recycling**: If memory usage in the Web Worker accumulates over hundreds of generations, terminate the worker (`worker.terminate()`) and recreate it.

---

## 4. Pexels Video API

The Pexels API provides programmatic search and retrieval for royalty-free stock footage.

### 4.1 Search Endpoint & Authentication

- **Endpoint**: `GET https://api.pexels.com/videos/search`
- **Required Header**: `Authorization: <YOUR_API_KEY>` (Do not prefix with `Bearer `)

#### Query Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `query` | `string` | Yes | Search query (e.g., `"ocean waves"`, `"aerial city"`) |
| `orientation` | `string` | No | `landscape`, `portrait`, `square` |
| `size` | `string` | No | `small` (< 1280x720), `medium`, `large` |
| `per_page` | `integer` | No | Number of results (default: `15`, max: `80`) |
| `page` | `integer` | No | Page number for pagination (default: `1`) |

---

### 4.2 Response Schema

```json
{
  "page": 1,
  "per_page": 5,
  "total_results": 240,
  "url": "https://www.pexels.com/search/videos/nature/",
  "videos": [
    {
      "id": 855564,
      "width": 1920,
      "height": 1080,
      "duration": 15,
      "image": "https://images.pexels.com/videos/855564/free-video-855564.jpg",
      "video_files": [
        {
          "id": 101,
          "quality": "hd",
          "file_type": "video/mp4",
          "width": 1920,
          "height": 1080,
          "fps": 29.97,
          "link": "https://player.vimeo.com/external/855564.hd.mp4?s=..."
        },
        {
          "id": 102,
          "quality": "sd",
          "file_type": "video/mp4",
          "width": 960,
          "height": 540,
          "fps": 29.97,
          "link": "https://player.vimeo.com/external/855564.sd.mp4?s=..."
        }
      ],
      "video_pictures": []
    }
  ]
}
```

---

### 4.3 Selection Algorithm: Picking SD/540p MP4 Files

For browser rendering pipelines operating at 480p or 720p, downloading 4K or 1080p MP4 files wastes bandwidth and causes frame decode drops. The selection algorithm targets `960x540` (540p) or standard definition.

```javascript
/**
 * Picks the most optimal SD/540p MP4 file from Pexels video_files
 * @param {Array} videoFiles - video.video_files array
 * @returns {string|null} - Direct video URL
 */
export function pickPexelsSDVideoUrl(videoFiles = []) {
  const mp4Files = videoFiles.filter(f => f.file_type === 'video/mp4' && f.link);

  if (mp4Files.length === 0) return null;

  // 1. Exact match for standard 540p
  const exact540p = mp4Files.find(f => f.height === 540 || f.width === 960);
  if (exact540p) return exact540p.link;

  // 2. Marked as "sd" quality
  const sdFile = mp4Files.find(f => f.quality === 'sd');
  if (sdFile) return sdFile.link;

  // 3. Closest resolution under or equal to 720p
  const lowRes = mp4Files
    .filter(f => (f.height && f.height <= 720) || (f.width && f.width <= 1280))
    .sort((a, b) => (b.height || 0) - (a.height || 0));

  if (lowRes.length > 0) return lowRes[0].link;

  // 4. Fallback to smallest available MP4
  mp4Files.sort((a, b) => ((a.width || 0) * (a.height || 0)) - ((b.width || 0) * (b.height || 0)));
  return mp4Files[0].link;
}
```

---

### 4.4 Rate Limits & Headers

- **Limit**: **200 requests per hour** and **20,000 requests per month**.
- Response Headers:
  - `X-Ratelimit-Limit`: `200`
  - `X-Ratelimit-Remaining`: Count remaining in current hourly window.
  - `X-Ratelimit-Reset`: Unix timestamp when the rate limit window refreshes.
- Exceeding limit returns `HTTP 429 Too Many Requests`.

---

### 4.5 Minimal Working Code Snippet

```javascript
export async function searchPexelsVideo(query, apiKey, targetCount = 1) {
  const endpoint = new URL('https://api.pexels.com/videos/search');
  endpoint.searchParams.set('query', query);
  endpoint.searchParams.set('per_page', String(Math.max(targetCount, 5)));
  endpoint.searchParams.set('orientation', 'landscape');
  endpoint.searchParams.set('size', 'small');

  const response = await fetch(endpoint.toString(), {
    method: 'GET',
    headers: {
      'Authorization': apiKey
    }
  });

  if (response.status === 429) {
    const resetTime = response.headers.get('X-Ratelimit-Reset');
    throw new Error(`Pexels rate limit reached. Resets at: ${resetTime}`);
  }

  if (!response.ok) {
    throw new Error(`Pexels API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const results = [];

  for (const video of (data.videos || [])) {
    const url = pickPexelsSDVideoUrl(video.video_files);
    if (url) {
      results.push({
        id: video.id,
        duration: video.duration,
        preview: video.image,
        url,
        width: video.width,
        height: video.height
      });
      if (results.length >= targetCount) break;
    }
  }

  return results;
}
```

---

### 4.6 Browser Compatibility & Gotchas

1. **CORS and Canvas Tainting**:
   - Pexels CDN video files (hosted on `player.vimeo.com` or Akamai) send `Access-Control-Allow-Origin: *`.
   - When loading the video into an `HTMLVideoElement` to draw onto a canvas for WebCodecs, you **MUST** set `video.crossOrigin = 'anonymous'` **before** setting `video.src`. If omitted, the canvas becomes tainted and `new VideoFrame(canvas)` will throw a security error.
2. **CDN Expiration**:
   - Direct download links (`player.vimeo.com/external/...`) contain temporary access tokens that expire after several hours. Do not store these URLs in permanent database records; re-fetch or cache locally.

---

### 4.7 Memory Management Considerations

- When decoding multiple stock videos in sequence, reuse a single `HTMLVideoElement`. After each clip is finished, reset `video.src = ''` and call `video.load()` to purge native media decoding buffers from memory.

---

## 5. Pixabay Video API

The Pixabay Video API offers another large repository of stock clips with straightforward JSON schemas.

### 5.1 Search Endpoint & Authentication

- **Endpoint**: `GET https://pixabay.com/api/videos/`
- **Authentication**: Key is passed directly in the query string parameter `key`.

#### Query Parameters

| Parameter | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `key` | `string` | Yes | Your Pixabay API key |
| `q` | `string` | No | URL-encoded search term |
| `video_type` | `string` | No | `'all'`, `'film'`, `'animation'` (default: `'all'`) |
| `category` | `string` | No | e.g. `'nature'`, `'backgrounds'`, `'science'` |
| `min_width` / `min_height` | `integer` | No | Minimum video resolution |
| `per_page` | `integer` | No | Results per page (default: `20`, range: `3-200`) |
| `page` | `integer` | No | Pagination page (default: `1`) |

---

### 5.2 Response Schema

```json
{
  "total": 4692,
  "totalHits": 500,
  "hits": [
    {
      "id": 12345,
      "pageURL": "https://pixabay.com/videos/nature-forest-trees-12345/",
      "type": "film",
      "tags": "nature, forest, trees",
      "duration": 15,
      "picture_id": "5299281",
      "videos": {
        "large": {
          "url": "https://cdn.pixabay.com/video/2020/05/25/40149-425203309_large.mp4",
          "width": 1920,
          "height": 1080,
          "size": 8452100,
          "thumbnail": "https://i.vimeocdn.com/video/..."
        },
        "medium": {
          "url": "https://cdn.pixabay.com/video/2020/05/25/40149-425203309_medium.mp4",
          "width": 1280,
          "height": 720,
          "size": 4210450,
          "thumbnail": "https://i.vimeocdn.com/video/..."
        },
        "small": {
          "url": "https://cdn.pixabay.com/video/2020/05/25/40149-425203309_small.mp4",
          "width": 960,
          "height": 540,
          "size": 1820300,
          "thumbnail": "https://i.vimeocdn.com/video/..."
        },
        "tiny": {
          "url": "https://cdn.pixabay.com/video/2020/05/25/40149-425203309_tiny.mp4",
          "width": 640,
          "height": 360,
          "size": 950200,
          "thumbnail": "https://i.vimeocdn.com/video/..."
        }
      }
    }
  ]
}
```

---

### 5.3 Selection Algorithm: Picking Appropriate Quality

Pixabay structures sizes into four fixed keys: `large`, `medium`, `small`, and `tiny`.

> [!WARNING]
> Pixabay does not always encode all 4 sizes for every uploaded clip. If a size is missing, Pixabay returns an empty string `url: ""` rather than omitting the property. Always check `Boolean(sizeObj.url)`.

```javascript
/**
 * Picks the appropriate quality stream from Pixabay hits
 * @param {Object} videosObj - hit.videos object
 * @param {'480p'|'720p'|'1080p'} targetQuality
 * @returns {{ url: string, width: number, height: number } | null}
 */
export function pickPixabayVideo(videosObj = {}, targetQuality = '480p') {
  const { small, medium, large, tiny } = videosObj;

  const isValid = (entry) => entry && typeof entry.url === 'string' && entry.url.trim().length > 0;

  if (targetQuality === '480p') {
    // Priority: small (960x540) -> medium (1280x720) -> tiny (640x360) -> large (1080p)
    if (isValid(small)) return small;
    if (isValid(medium)) return medium;
    if (isValid(tiny)) return tiny;
    if (isValid(large)) return large;
  } else if (targetQuality === '720p') {
    // Priority: medium (1280x720) -> small (960x540) -> large (1080p) -> tiny
    if (isValid(medium)) return medium;
    if (isValid(small)) return small;
    if (isValid(large)) return large;
    if (isValid(tiny)) return tiny;
  } else {
    // 1080p
    if (isValid(large)) return large;
    if (isValid(medium)) return medium;
    if (isValid(small)) return small;
  }

  return null;
}
```

---

### 5.4 Rate Limits & 24-Hour Caching Requirements

- **Rate Limit**: **100 requests per minute**.
- Headers:
  - `X-RateLimit-Limit`: `100`
  - `X-RateLimit-Remaining`: Count remaining
  - `X-RateLimit-Reset`: Seconds remaining until quota reset
- **API Terms Requirement**: Pixabay's Developer Terms require developers to **cache API responses for at least 24 hours**. Never execute repetitive live queries for identical keyword searches.

---

### 5.5 Minimal Working Code Snippet

```javascript
// In-memory or persistent search cache satisfying the 24-hour Pixabay requirement
const pixabayCache = new Map();

export async function searchPixabayVideo(query, apiKey, targetQuality = '480p') {
  const cacheKey = `${query.toLowerCase().trim()}_${targetQuality}`;
  const now = Date.now();
  const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

  if (pixabayCache.has(cacheKey)) {
    const cached = pixabayCache.get(cacheKey);
    if (now - cached.timestamp < TWENTY_FOUR_HOURS) {
      return cached.data;
    }
  }

  const endpoint = new URL('https://pixabay.com/api/videos/');
  endpoint.searchParams.set('key', apiKey);
  endpoint.searchParams.set('q', query);
  endpoint.searchParams.set('video_type', 'film');
  endpoint.searchParams.set('per_page', '5');

  const response = await fetch(endpoint.toString());
  if (!response.ok) {
    throw new Error(`Pixabay API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const hits = data.hits || [];
  const results = [];

  for (const hit of hits) {
    const selected = pickPixabayVideo(hit.videos, targetQuality);
    if (selected) {
      results.push({
        id: hit.id,
        duration: hit.duration,
        url: selected.url,
        width: selected.width,
        height: selected.height,
        preview: hit.videos.tiny?.thumbnail || ''
      });
    }
  }

  pixabayCache.set(cacheKey, { timestamp: now, data: results });
  return results;
}
```

---

### 5.6 Browser Compatibility & Gotchas

1. **CDN Domain**:
   - Pixabay video URLs reside on `cdn.pixabay.com`. These endpoints support CORS and send `Access-Control-Allow-Origin: *`.
2. **Missing Formats**:
   - Never assume `hit.videos.small` exists. Older uploads or animated clips may only have `large` and `tiny`. Always implement a fallback selector.
3. **Attribution**:
   - Pixabay free license requires or strongly recommends attributing authors when displaying content in client UIs.

---

### 5.7 Memory Management Considerations

- Video elements used to stream Pixabay MP4s into WebCodecs pipelines must be scrubbed and released:
  ```javascript
  function releaseVideoElement(videoEl) {
    videoEl.pause();
    videoEl.removeAttribute('src');
    videoEl.load();
    videoEl.remove();
  }
  ```

---

## 6. End-to-End DocuForge Pipeline Architecture

```
                       +-----------------------+
                       | Stock APIs:           |
                       | Pexels / Pixabay      |
                       +-----------+-----------+
                                   | (MP4 Stream)
                                   v
+------------------+    +----------+-----------+    +-----------------------+
|  kokoro-js TTS   |    | HTMLVideoElement /   |    | WebCodecs             |
|  (WASM Worker)   |    | OffscreenCanvas      |    | VideoEncoder          |
+--------+---------+    +----------+-----------+    +-----------+-----------+
         |                         |                            |
         | Float32Array (24kHz)    | VideoFrame                 | EncodedVideoChunk
         v                         v                            v
+--------+---------+    +----------+-----------+    +-----------+-----------+
| Web Audio API /  |    | WebCodecs            |    | mp4-muxer             |
| OfflineAudioCtx  |--->| AudioEncoder         |--->| Muxer                 |
| (Resample 48kHz) |    | (mp4a.40.2 / AAC)    |    | (ArrayBufferTarget)   |
+------------------+    +----------------------+    +-----------+-----------+
                                                                |
                                                                v
                                                    +-----------+-----------+
                                                    | Final MP4 Blob        |
                                                    | (video/mp4)           |
                                                    +-----------------------+
```

### Complete Ingestion Pipeline Summary Table

| Stage | Input | Engine / Worker | Output | Output Destination |
| :--- | :--- | :--- | :--- | :--- |
| **TTS Generation** | Scene Text | KokoroTTS (82M q8 ONNX) | `Float32Array` (24 kHz) | Transferred from Worker |
| **Audio Resampling** | `Float32Array` | `OfflineAudioContext` | `AudioBuffer` (48 kHz stereo) | Web Audio Pipeline |
| **Visual Rendering** | Stock Video + Subtitles | `OffscreenCanvas` (2D) | `VideoFrame` (µs timestamps) | `VideoEncoder.encode()` |
| **Audio Encoding** | Planar PCM | `AudioEncoder` | `EncodedAudioChunk` (AAC) | `muxer.addAudioChunk()` |
| **Video Encoding** | `VideoFrame` | `VideoEncoder` (H.264 AVC) | `EncodedVideoChunk` (avc1) | `muxer.addVideoChunk()` |
| **Multiplexing** | Chunks + SPS/PPS | `Muxer` (`fastStart: 'in-memory'`) | `ArrayBuffer` | Downloadable `Blob` |
