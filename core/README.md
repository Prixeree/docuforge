# ⚙️ DocuForge Core Engine (`docuforge-core`)

> Ultra-lightweight, zero-dependency, framework-free browser video generation engine written in pure modern ES Modules. Generates broadcast-quality MP4 videos entirely client-side using WebCodecs, Web Audio API, Canvas2D, and WebAssembly ONNX.

---

## 📦 Architecture & Module Breakdown

| Module | Purpose | Key Exports |
| :--- | :--- | :--- |
| [`scene-graph.js`](./scene-graph.js) | Declarative scene graph contract, node types, layer hierarchy, validation | `createDefaultSceneGraph`, `validateSceneGraph`, `renderLayer` |
| [`tts.js`](./tts.js) | In-browser neural speech synthesis via Kokoro ONNX | `initTTS`, `generateSpeech`, `generateAllScenes` |
| [`audio.js`](./audio.js) | Web Audio DSP chain, compressor, voice normalization, ducking, AAC encoding | `processVoiceChain`, `mixAudio`, `encodeAAC` |
| [`stock.js`](./stock.js) | Live vertical stock footage search (Pexels + Pixabay) & procedural gradient fallback | `searchStockClips`, `buildModeQuery`, `drawProceduralBackground` |
| [`render.worker.js`](./render.worker.js) | Background WebWorker rendering OffscreenCanvas frames directly into `VideoEncoder` | Worker lifecycle (`init`, `render-scene`, `finalize`) |
| [`subtitles.js`](./subtitles.js) | 5 kinetic subtitle presets with spring physics & active word-by-word highlights | `drawKineticSubtitles`, `SUBTITLE_PRESETS` |
| [`transitions.js`](./transitions.js) | Inter-scene visual transitions executed on dual canvas buffers | `getTransition` (`crossfade`, `wipe`, `zoom-in`, `slide-up`) |
| [`kenburns.js`](./kenburns.js) | Smooth pan and zoom transforms preventing static image/video fatigue | `applyKenBurns`, `createKenBurnsEffect` |
| [`sprites.js`](./sprites.js) | High-performance procedural vector UI canvas renderers | `createRedditCardSprite`, `createRankBadgeSprite`, `createVsBadgeSprite` |
| [`manifest.js`](./manifest.js) | Static asset catalog parser, clip selection, window duration matching | `loadManifest`, `filterClipsByMode`, `selectClipWindow` |
| [`storage.js`](./storage.js) | IndexedDB persistent storage for stock clips, TTS models, and render cache | `dbGet`, `dbPut`, `dbClear` |
| [`word-timing.js`](./word-timing.js) | Accurate character/syllable-weighted timestamp interpolation per word | `computeWordTimings` |

---

## 📜 Declarative Scene Graph Contract

DocuForge operates on a declarative JSON scene graph. Modes only define content and timing; the Core handles all rendering, transitions, and hardware encoding.

```typescript
interface DocuForgeSceneGraph {
  version: "1.0";
  title: string;
  mode: "viral" | "reddit-story" | "explainer" | "myth-vs-fact" | "quote-motivational" | "quiz-trivia" | "would-you-rather";
  aspectRatio: "9:16" | "16:9" | "1:1";
  width: number;             // e.g. 720 (HD) or 1080 (Full HD)
  height: number;            // e.g. 1280 (HD) or 1920 (Full HD)
  fps: number;               // Default 24 or 30
  quality: "draft" | "hd" | "full-hd";
  audio: {
    music?: {
      src: string;           // URL or asset relative path
      volume: number;        // 0.0 - 1.0 (default 0.7)
      duckLevel: number;     // Volume multiplier during active speech (e.g. 0.18)
      duckRampDuration: number;
      loop: boolean;
      loopCrossfade: number;
    };
    sfx?: Array<{
      id: string;
      src: string;
      triggerTime: number;  // Timeline seconds
      volume: number;
    }>;
  };
  scenes: Array<DocuForgeSceneNode>;
}

interface DocuForgeSceneNode {
  id: string;
  duration: number;          // Scene duration in seconds
  isProcedural?: boolean;    // If true, uses canvas gradient shader
  mode?: string;             // Style hint for procedural shader
  transition?: {
    type: "none" | "crossfade" | "wipe" | "zoom-in" | "slide-up";
    duration: number;        // Transition duration in seconds (e.g. 0.5)
  };
  kenBurns?: {
    type: "none" | "slow-drift" | "pan-left" | "pan-right";
    direction?: "in" | "out";
    scaleRange?: [number, number]; // e.g. [1.0, 1.12]
  };
  layers: Array<SceneLayer>;
}

type SceneLayer = 
  | VideoLayer
  | SubtitleLayer
  | SpriteLayer
  | ShapeLayer;

interface VideoLayer {
  type: "video";
  id: string;
  src: string;               // Local or remote MP4 URL
  startTime: number;         // Seek offset into source video
  duration: number;
}

interface SubtitleLayer {
  type: "subtitles";
  preset: "bold-pop" | "classic" | "karaoke" | "handwritten" | "minimal";
  words: Array<{
    text: string;
    start: number;           // Seconds relative to scene start
    end: number;
  }>;
}

interface SpriteLayer {
  type: "sprite";
  id: string;
  spriteId: string;          // Key registered in canvas cache
  x: number;
  y: number;
  width: number;
  height: number;
  animation?: {
    type: "slide-down" | "spring-pop" | "fade-in";
    startTime: number;
    duration: number;
  };
}
```

---

## ⚡ Minimal Code Example: Render Video in 15 Lines

DocuForge requires zero build tooling or bundlers. You can import modules directly:

```html
<script type="module">
  import { initTTS, generateSpeech } from './core/tts.js';
  import { createDefaultSceneGraph } from './core/scene-graph.js';
  import { runDocuforgePipeline } from './src/app.js';

  // 1. Synthesize audio & build scene graph
  const input = {
    hook: "Did you know honey never ever spoils?",
    facts: ["Archaeologists found 3,000-year-old edible honey in Egyptian tombs."],
    cta: "Follow for more facts!"
  };

  // 2. Run pipeline: audio DSP -> stock video matching -> WebCodecs encoding -> MP4 muxing
  const { blob, duration } = await runDocuforgePipeline('viral', input, { quality: 'hd' });

  // 3. Play or download the finished MP4
  const video = document.createElement('video');
  video.src = URL.createObjectURL(blob);
  video.controls = true;
  document.body.appendChild(video);
  video.play();
</script>
```

---

## 🌐 Browser Support & Hardware Acceleration Matrix

DocuForge leverages modern W3C standards available natively in chromium-based browsers and modern web runtimes:

| Capability | Chrome 94+ | Edge 94+ | Brave | Safari 16.4+ | Firefox 120+ |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **WebCodecs `VideoEncoder` (H.264)** | ✅ Hardware | ✅ Hardware | ✅ Hardware | ⚠️ Software/Limited | ⚠️ Behind Flag |
| **Web Audio API & AudioContext** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **OffscreenCanvas & 2D Worker** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **ONNX WebAssembly (Kokoro TTS)** | ✅ WebAssembly / SIMD | ✅ WebAssembly / SIMD | ✅ WebAssembly / SIMD | ✅ WebAssembly | ✅ WebAssembly |
| **HTTP 206 Partial Streaming** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |
| **IndexedDB Persistent Cache** | ✅ Full | ✅ Full | ✅ Full | ✅ Full | ✅ Full |

> [!NOTE]
> For the best rendering speed and hardware-accelerated H.264 encoding, Chrome, Edge, or Brave on desktop is strongly recommended.
