# DocuForge 🎬

> **Open-Source, Free, Ultra-Lightweight In-Browser Short-Form Video Generator (7 Pipeline Modes)**

DocuForge turns a topic, script, or question into a finished 9:16 vertical MP4 video entirely in your browser — **zero backend, zero paid APIs, zero frameworks, and zero `ffmpeg.wasm`**.

Runs smoothly on weak hardware (4GB RAM, dual-core CPU, integrated GPU) using browser-native **WebCodecs** (`VideoEncoder`, `AudioEncoder`) and vendored `mp4-muxer`.

---

## ⚡ 7 Pipeline Modes

DocuForge supports 7 distinct short-form video formats, each tailored with genre-specific typography, pacing, sound effects, and visuals:

| Mode | Visual Engine | Format & Motion | Subtitle Style | Music & SFX | Example Topic |
|---|---|---|---|---|---|
| **1. ⚡ Viral Facts & Hooks** | Live Stock (Pexels / Pixabay) | High-energy hook + facts + CTA, whip-pan & glitch cuts, punch-in Ken Burns | Bold-Pop (Yellow/White) | Upbeat curious (`Sneaky Snitch`), whoosh cuts | *"Did you know raw honey never spoils even after 3,000 years?"* |
| **2. 💬 Reddit Story** | Offline Gameplay (Minecraft / GTA) | Slide-in Reddit header card docking top-left, continuous gameplay footage | Bold-Pop | Tense suspense (`The Descent`) | *"I accidentally won an international trivia contest I never signed up for."* |
| **3. 📚 Explainer / Top List** | Live Stock (Pexels / Pixabay) | Numbered rank badges (#1-#5 spring pop-in), technical/nature B-roll | Bold-Pop | Documentary (`NastelBom`), whoosh + ding on rank | *"Top 3 Most Extreme Volcanoes on Earth and Why They Terrify Geologists."* |
| **4. ⚔️ Myth vs Fact** | Live Stock (Pexels / Pixabay) | Red "MYTH" card with shake + "X" stamp, transitioning to emerald "FACT" card | Classic Translucent Pill | Tense to triumphant, sub-impact + riser | *"Myth: We only use 10% of our brains. Fact: Brain scans prove 100% active."* |
| **5. 📜 Quote & Wisdom** | Live Stock (Pexels / Pixabay) | Slow-motion atmospheric nature drift, elegant cursive typography | Caveat Handwritten | Peaceful ambient (`Leberch Calm`), deep cadence | *"You have power over your mind, not outside events. — Marcus Aurelius"* |
| **6. ❓ Quiz & Trivia** | Live Stock (Pexels / Pixabay) | Staggered glassmorphic choice cards (A/B/C/D), pulsing 3-2-1 timer, green pulse reveal | Bold-Pop | Game Show (`Faster Does It`), tick countdown + chime | *"Which planet in our solar system has the shortest day? (Jupiter: 10 hrs)"* |
| **7. ⚖️ Would You Rather** | Live Stock (Pexels / Pixabay) | Dual split-cards (Cyan Top vs Red Bottom) with animated "VS" badge and % vote bars | Bold-Pop | Playful upbeat (`Carefree`), whoosh on vote reveal | *"Travel 100 years into future (64%) vs 100 years into past with memories (36%)."* |

---

## 🎥 Media & Asset System

### 1. Reddit Story Mode: Pre-Downloaded Gameplay Library
- 100% offline continuous gameplay footage (`BXUA2FncVPI`, `weAUrmRLpnk`, `XBIaqOm0RKQ`) licensed under **Creative Commons Attribution (CC-BY)**.
- Pre-cut into seamless 3-minute 9:16 vertical segments (720x1280 HD and 540x960 draft) hosted on GitHub Pages / Cloudflare R2 via `docuforge-assets`.

### 2. Modes 1–6: Live Stock Video Footage (Pexels + Pixabay)
- Searched at render time via official APIs with `orientation=portrait` (native 9:16 vertical).
- **Accuracy Scoring**: Clips are scored by title/tags against scene keywords, text/logo overlays are automatically rejected, and duration >= scene length is preferred.
- **Zero Upscaling**: Downloads native HD (720p / 1080p) without quality degradation.
- **IndexedDB Caching**: API responses are cached in the browser's IndexedDB to preserve rate limits.
- **Interactive Clip Swapper**: Preview matched clips per scene and click **"🔀 Swap Clip"** to cycle through alternative candidates.
- **Cloudflare Worker Proxy (`tools/stock-proxy`)**: Runs with zero manual setup via a free Cloudflare Worker that holds API keys server-side. Users can also paste their own free keys directly into `localStorage`.
- **Procedural Canvas Fallback**: If offline or rate-limited, DocuForge falls back seamlessly to dynamic animated canvas gradients with a visible status banner — video generation never fails!

---

## 🚀 Quick Start (Zero Build Step)

Because DocuForge uses pure ES modules and Web Workers, you can run it locally with any static HTTP server:

```bash
# Using Node / npx (recommended: serves Range requests for video seeking)
node tools/dev-server.js

# Or using Python 3
python3 -m http.server 3000
```

Open `http://localhost:3000/docuforge/` in Chrome, select your mode, and click **"🚀 Generate Finished MP4"**.

---

## 🛠️ Architecture & Core Engine (`core/`)

- **`core/scene-graph.js`**: Declarative scene graph schema (`{ duration, layers: [video|sprite|shape|subtitles], transitions, sfx }`).
- **`core/render.worker.js`**: OffscreenCanvas Web Worker with `VideoEncoder` and sequential memory backpressure management.
- **`core/stock.js`**: Live Pexels & Pixabay video search engine, scoring heuristics, and procedural canvas gradient fallback.
- **`core/audio.js`**: 48kHz stereo DSP chain (80Hz HPF, compressor, -3 dBFS peak normalization) + automated dynamic music ducking (to 20% during speech) + seamless equal-power crossfaded loops.
- **`core/subtitles.js`**: Kinetic word-by-word subtitles with presets (`bold-pop`, `classic`, `handwritten`).
- **`core/transitions.js`**: Pure canvas transitions (`crossfade`, `slide`, `wipe`, `dip-to-black`, `whip-pan`, `glitch-cut`).
- **`core/tts.js` & `tts.worker.js`**: Kokoro-82M ONNX model running via WebGPU (fp32) with WASM (q8) fallback, high-reliability procedural speech fallback, and SHA-1 IndexedDB caching.
- **`core/mux.js`**: `mp4-muxer` disk streaming via `showSaveFilePicker` for flat RAM usage on videos of any length.

---

## ⚖️ License & Attribution

- **Code:** [MIT License](LICENSE) &copy; 2026 DocuForge Contributors.
- **Stock Footage:**
  - Photos and videos provided by [Pexels](https://www.pexels.com).
  - Videos provided by [Pixabay](https://pixabay.com).
- **Background Music:**
  - *Kevin MacLeod* ([incompetech.com](https://incompetech.com)), licensed under Creative Commons: By Attribution 4.0 (CC-BY 4.0).
  - *NastelBom* & *Leberch* via Pixabay (Pixabay Content License).
- **SFX:** Procedurally synthesized and dedicated to the Public Domain under Creative Commons CC0.

For full license texts and verified source URLs, see [`docs/credits.md`](docs/credits.md) and [`docuforge-assets/ASSETS.md`](../docuforge-assets/ASSETS.md).
