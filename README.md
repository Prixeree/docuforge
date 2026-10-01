# DocuForge 🎬

> **Open-Source, Free, Ultra-Lightweight In-Browser Short-Form Video Generator (7 Pipeline Modes)**

DocuForge turns a topic, script, or question into a finished 9:16 or 16:9 vertical MP4 video entirely in your browser — **zero backend, zero paid APIs, zero frameworks, and zero `ffmpeg.wasm`**.

Runs smoothly on weak hardware (4GB RAM, dual-core CPU, integrated GPU) using browser-native **WebCodecs** (`VideoEncoder`, `AudioEncoder`) and vendored `mp4-muxer`.

---

## ⚡ 7 Pipeline Modes

1. **⚡ Viral Facts & Hooks** (`modes/viral`): High-energy hooks, rapid A/B cuts, whip-pan & glitch transitions, punch-in Ken Burns zooms, and bold-pop subtitles.
2. **💬 Dramatic Reddit Story** (`modes/reddit-story`): Native Reddit-inspired header card (slide-in with corner dock), continuous endless-runner/gameplay footage, and word-by-word synced subtitles.
3. **📚 Explainer / Top List** (`modes/explainer`): Countdown ranking ladder with animated numbered badges (#N spring pop-in) and B-roll documentary footage.
4. **⚔️ Myth vs Fact** (`modes/myth-vs-fact`): Phase 1 red warning "MYTH" card with shake + "X" stamp, transitioning to emerald "FACT" card with checkmark draw-on and sub-impact SFX.
5. **📜 Quote & Wisdom** (`modes/quote-motivational`): Handwritten cursive typography (Caveat), slow-motion atmospheric nature drift, and deep measured voiceover cadence.
6. **❓ Quiz & Trivia** (`modes/quiz-trivia`): Staggered glassmorphic multiple-choice cards, pulsing 3-2-1 radial countdown timer with clock ticking, and green pulse reveal with chime SFX.
7. **⚖️ Would You Rather** (`modes/would-you-rather`): Dual-card layout (Option A top cyan vs Option B bottom red) with "VS" badge, sequential narration, and animated community percentage vote bars.

---

## 🚀 Quick Start (Zero Build Step)

Because DocuForge uses pure ES modules and Web Workers, serve the directory via any static HTTP server:

```bash
# Using Python 3
python3 -m http.server 8080

# Or using Node / npx
npx serve . -p 8080

# Or using Bun
bunx serve -p 8080
```

Open `http://localhost:8080` in Chrome, select your mode, and click **"🚀 Generate Finished MP4"**.

---

## 🛠️ Architecture & Core Engine (`core/`)

- **`core/scene-graph.js`**: Declarative scene graph schema (`{ duration, layers: [video|sprite|shape|subtitles], transitions, sfx }`).
- **`core/render.worker.js`**: OffscreenCanvas Web Worker with `VideoEncoder` and memory backpressure management.
- **`core/audio.js`**: 48kHz stereo DSP chain (80Hz HPF, compressor, -3 dBFS peak normalization) + automated dynamic music ducking (to 20% during speech) + seamless equal-power crossfaded loops.
- **`core/subtitles.js`**: Kinetic word-by-word subtitles with presets (`bold-pop`, `classic`, `handwritten`).
- **`core/transitions.js`**: Pure canvas transitions (`crossfade`, `slide`, `wipe`, `dip-to-black`, `whip-pan`, `glitch-cut`).
- **`core/tts.js` & `tts.worker.js`**: Kokoro-82M ONNX model running via WebGPU (fp32) with WASM (q8) fallback and SHA-1 IndexedDB caching.
- **`core/mux.js`**: `mp4-muxer` disk streaming via `showSaveFilePicker` for flat RAM usage on videos of any length.

---

## ⚖️ License & Attribution

- **Code:** [MIT License](LICENSE) &copy; 2026 DocuForge Contributors.
- **Music:**
  - *Music: Dmitrii Spis (NastelBom), via Pixabay*
  - *Music: Leberch, via Pixabay*
  - *Music: Kevin MacLeod (incompetech.com), Licensed under Creative Commons: By Attribution 4.0*
- **Footage:**
  - *Footage by Orbital - No Copyright Gameplay via YouTube (Creative Commons Attribution license CC-BY)*
- **SFX:** Dedicated to the Public Domain under Creative Commons CC0.

For full license texts and verified source URLs, see [`docuforge-assets/ASSETS.md`](../docuforge-assets/ASSETS.md).
