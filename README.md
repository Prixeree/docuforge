# DocuForge

Free, ultra-lightweight, in-browser documentary video generator. Paste a script, get a finished MP4 with stock footage, AI voiceover, background music, transitions, and subtitles — all running 100% in your browser.

## Features
- Offline frame-by-frame rendering (no dropped frames, even on weak PCs)
- AI voiceover via kokoro-js (82M parameter model, runs in WebGPU or WASM)
- Auto stock footage from Pexels + Pixabay (free APIs, you bring your own keys)
- Ken Burns zoom/pan effects on every clip
- 6 transition types: crossfade, slide, wipe, dip-to-black
- Per-sentence subtitles synced to voice timing
- Background music with intelligent ducking
- Voice processing chain: high-pass, compression, normalization
- 3 quality tiers: Draft (480p), HD (720p), Full HD (1080p)
- Streams MP4 directly to disk (no length limit) via File System Access API
- IndexedDB caching: re-renders skip TTS for unchanged sentences
- Total app code: ~110KB (excluding TTS model)

## Quick Start

1. Serve the `docuforge/` directory with any static server:
   ```bash
   # Using Python
   python3 -m http.server 8080 -d docuforge
   
   # Using Node.js
   npx serve docuforge
   
   # Using Bun
   bunx serve docuforge
   ```

2. Open `http://localhost:8080` in Chrome 94+ (or any Chromium browser)

3. Enter your free API keys:
   - [Pexels](https://www.pexels.com/api/) — free, 200 requests/hour
   - [Pixabay](https://pixabay.com/api/docs/) — free, 100 requests/minute
   - [Google Gemini](https://aistudio.google.com/app/apikey) — optional, for better keyword extraction

4. Paste your documentary script (each paragraph = one scene)

5. Click "Generate Documentary" and wait

## Browser Requirements
- Chrome 94+ / Edge 94+ / Safari 16.4+ (WebCodecs required)
- WebGPU support recommended for faster TTS (falls back to WASM)
- File System Access API for disk streaming (Chrome only, fallback to in-memory)

## Performance Notes
- First run downloads the TTS model (~92MB for q8 quantization). It's cached by the browser afterward.
- A 3-minute 720p video takes ~5-8 minutes on a modern laptop.
- A weak PC (4GB RAM, dual-core) can export 480p at ~2-3x real-time.
- Memory stays flat during rendering (encoder flushed per scene).
- For videos over 10 minutes, use Chrome for disk streaming support.

## Architecture
- `index.html` — UI (all CSS inline, no framework)
- `src/main.js` — Orchestrator
- `src/script.js` — Script parser + keyword extraction
- `src/stock.js` — Pexels + Pixabay API client
- `src/tts.worker.js` — TTS Web Worker (kokoro-js + ONNX)
- `src/tts.js` — TTS bridge (main thread ↔ worker)
- `src/audio.js` — Voice chain + music mixing + AAC encoding
- `src/render.worker.js` — Render Web Worker (OffscreenCanvas + VideoEncoder)
- `src/transitions.js` — 6 transition effects
- `src/kenburns.js` — Ken Burns zoom/pan
- `src/subtitles.js` — Per-sentence subtitle rendering
- `src/mux.js` — MP4 muxing with disk streaming
- `src/storage.js` — IndexedDB cache helpers
- `vendor/mp4-muxer.js` — Vendored mp4-muxer v5.1.3

## License
MIT
