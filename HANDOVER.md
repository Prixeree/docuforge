# DocuForge — Master Handover Document for Next AI Agent

Welcome to **DocuForge**. This document provides an exhaustive, production-grade briefing on the codebase architecture, implementation status, file ownership, runtime requirements, and immediate next steps for the next AI agent or engineer taking over.

---

## 1. Project Mission & Core Constraints

DocuForge is an ultra-lightweight, 100% in-browser documentary video generator. It converts a plain text script into a fully produced documentary MP4 containing stock footage, neural voiceover, background music with ducking, transitions, synced subtitles, and Ken Burns camera motion.

### Non-Negotiable Hard Constraints:
1. **Zero Cost / Zero Backend**: No server or cloud functions. Runs entirely inside the client browser.
2. **No Bundler / Pure Vanilla JS Modules**: Must run directly via any static HTTP server by loading `index.html`.
3. **No `ffmpeg.wasm`**: Uses browser-native **WebCodecs** (`VideoEncoder`, `AudioEncoder`, `VideoFrame`, `AudioData`) and vendored `mp4-muxer` (~68KB unminified, ~15KB minified).
4. **Offline Frame-by-Frame Rendering**: Never uses real-time `MediaRecorder`. Renders frame-by-frame on an `OffscreenCanvas` in a Web Worker, ensuring zero dropped frames even on weak hardware (4GB RAM, dual-core CPU).
5. **Aggressive Memory Reclamation**:
   - `VideoFrame.close()` called immediately after `encoder.encode(frame)`.
   - `ImageBitmap.close()` called immediately after scene completion.
   - `AudioData.close()` called immediately after audio encoding.
   - `encoder.flush()` called per scene to keep memory flat.
6. **No GPU/Canvas Filters in Loop**: No `ctx.filter`, blur, dropshadows, or `getImageData` in the render loop.
7. **Free APIs Only**:
   - Stock footage: **Pexels API** (200 req/hr) and **Pixabay API** (100 req/min). User provides free API keys stored in `localStorage`.
   - Script enhancement (optional): **Google Gemini** using model invariant `gemini-flash-latest`.
8. **Permanent Storage**: All project files reside on the external SSD at:
   `/Volumes/SSD 500gb/Project/docuforge/`

---

## 2. Directory & File Inventory

```
/Volumes/SSD 500gb/Project/docuforge/
├── index.html                  # Full single-page UI (dark theme, responsive, inline CSS)
├── HANDOVER.md                 # This handover document
├── README.md                   # User documentation and setup guide
├── .gitignore                  # Git ignore rules (DS_Store, AppleDouble, logs)
├── docs/
│   ├── api-notes.md            # Exhaustive WebCodecs, kokoro-js, mp4-muxer & Stock API research
│   └── progress.md             # Sub-agent milestone tracker
├── src/
│   ├── main.js                 # Orchestrator: wires UI, hardware probe, state & pipeline stages
│   ├── script.js               # Paragraph/sentence parser, stopword extractor, Gemini enhancement
│   ├── stock.js                # Pexels + Pixabay resolution-aware client with rate limiter
│   ├── tts.worker.js           # Web Worker: runs kokoro-js (Kokoro-82M) via WebGPU/WASM
│   ├── tts.js                  # Main-thread TTS bridge: sentence splitting & SHA-1 IndexedDB cache
│   ├── audio.js                # 48kHz voice DSP chain, music ducking mix & AAC AudioEncoder
│   ├── render.worker.js        # Web Worker: OffscreenCanvas frame loop, backpressure & VideoEncoder
│   ├── transitions.js          # 6 pure canvas transitions (crossfade, slide, wipe, dip-to-black)
│   ├── kenburns.js             # Pan & zoom source-rect mathematics without upscaling
│   ├── subtitles.js            # Sentence-timed canvas subtitle caching and blitting
│   ├── mux.js                  # mp4-muxer integration with showSaveFilePicker disk streaming
│   └── storage.js              # IndexedDB wrapper ('audio', 'clips', 'tts_cache' stores)
└── vendor/
    └── mp4-muxer.js            # Vendored official mp4-muxer v5.1.3 ES module
```

---

## 3. Module Architecture & Detailed Data Flow

### A. UI & Orchestrator (`index.html`, `src/main.js`)
- Runs a startup hardware probe using `VideoEncoder.isConfigSupported()` across all 3 quality tiers:
  - **Draft**: `854x480` @ 24fps, 1.5 Mbps (`avc1.42001f`, Baseline L3.1)
  - **HD (Default)**: `1280x720` @ 24fps, 4.0 Mbps (`avc1.4d001f`, Main L3.1)
  - **Full HD**: `1920x1080` @ 24fps, 8.0 Mbps (`avc1.640028`, High L4.0)
- Shows warning banner if 1080p lacks hardware acceleration (`hardwareAcceleration: 'prefer-hardware'`).
- Manages 6-stage linear execution:
  1. Script Parsing
  2. Stock Footage Retrieval
  3. Neural Voiceover Synthesis
  4. Audio DSP Mixing & AAC Encoding
  5. Frame-by-Frame Video Rendering
  6. MP4 Container Multiplexing & Disk Save

### B. Script Parsing & Keyword Extraction (`src/script.js`)
- `parseScript(text)`:
  - Splits paragraphs on `\n\s*\n` (each paragraph = 1 scene).
  - Segments each scene into sentences (`splitSentences`), ensuring sentences > 300 characters are broken safely on commas.
  - Extracts 2 dominant keywords using a curated 120-word stopword filter and frequency analysis.
- `enhanceKeywords(scenes, geminiKey)`:
  - Optional AI enhancement querying Google Gemini (`gemini-flash-latest`) via `generateContent`.

### C. Stock Footage Client (`src/stock.js`)
- Respects strict rate limits: max 200 requests/hour and a 300ms inter-request debounce.
- `fetchClip(keywords, apiKeys, quality)`:
  - Queries **Pexels** first (`https://api.pexels.com/videos/search`), parses `video_files` by width:
    - Draft: width $\le$ 960
    - HD: width $\le$ 1280
    - Full HD: width $\le$ 1920
  - Falls back to **Pixabay** (`https://pixabay.com/api/videos/`) with `video_type=film`, selecting `small`, `medium`, or `large`.
  - Caches results by `keywords + quality` in memory.
  - Enforces the **Never Upscale** rule: provides native width & height so renderers don't stretch low-res clips.

### D. Neural TTS Pipeline (`src/tts.worker.js`, `src/tts.js`)
- **Worker (`tts.worker.js`)**:
  - Dynamically imports `kokoro-js` from ESM CDN.
  - Probes for WebGPU (`navigator.gpu`). If present, loads `onnx-community/Kokoro-82M-v1.0-ONNX` with `device: "webgpu", dtype: "fp32"`; otherwise falls back to `device: "wasm", dtype: "q8"` (~92MB int8 quantization).
  - Transfers raw 24kHz mono `Float32Array` PCM samples using transferable `[samples.buffer]` (zero-copy).
- **Bridge (`tts.js`)**:
  - Segments scene text into individual sentences.
  - Generates a `SHA-1` cryptographic hash of `text + "|" + voice + "|" + speed`.
  - Checks IndexedDB (`tts_cache`). If cached, instant load; if new, generates and caches.
  - Inserts **0.25s silence** between sentences and returns exact `sentenceTimings: [{ text, start, end }]` for subtitle synchronization.
  - Default voice: `bm_george`, speed: `0.93`.

### E. Audio DSP Chain & AAC Encoding (`src/audio.js`)
- `processVoiceChain(samples, sampleRate)`:
  1. Resamples 24kHz mono $\to$ 48kHz stereo using `OfflineAudioContext`.
  2. High-pass filter at **80Hz** (`BiquadFilterNode`) to eliminate low-end rumble and pop artifacts.
  3. Dynamic Range Compression (`DynamicsCompressorNode`: threshold -24dB, knee 30, ratio 3:1, attack 0.003s, release 0.25s).
  4. Peak normalization to **-3 dBFS** ($10^{-3/20} \approx 0.7079$).
- `mixAudio(processedVoiceBuffers, musicBuffer, options)`:
  - Concatenates scene voice tracks with **0.6s inter-scene gaps**.
  - Background music ducking automation: ducks music volume to `0.2` during speech, ramps to `0.7` between scenes, with 0.5s linear ramps.
- `encodeAAC(mixedBuffer)`:
  - Encodes the 48kHz stereo mix to AAC (`mp4a.40.2` @ 128 kbps) using WebCodecs `AudioEncoder`.
  - Feeds planar `f32-planar` chunks of 1024 frames, closing each `AudioData` immediately.

### F. Video Rendering Worker (`src/render.worker.js`)
- Operates in an isolated Web Worker using `OffscreenCanvas`.
- Receives transferred `ImageBitmap` frames from the main thread (captured from hidden `<video>` elements to bypass Worker DOM restrictions).
- Applies **Ken Burns** slow pan/zoom (`src/kenburns.js`) by computing source-rectangle subcrops.
- Blits pre-rendered, word-wrapped subtitle banners (`src/subtitles.js`) matched to the current sentence timestamp.
- Renders 6 transition effects (`src/transitions.js`) across the trailing `0.8s` of each scene.
- Enforces backpressure: if `encoder.encodeQueueSize > 5`, yields until the queue drains.
- Sends encoded chunks back to main thread and flushes per scene.

### G. Multiplexing & Disk Streaming (`src/mux.js`, `vendor/mp4-muxer.js`)
- Supports **unlimited video length** by streaming chunks directly to disk using `showSaveFilePicker()` and `FileSystemWritableFileStreamTarget`.
- If file picker is unsupported (or cancelled), seamlessly degrades to `ArrayBufferTarget` with an in-memory buffer.
- Correctly synchronizes AVC H.264 video chunks and AAC audio chunks with sample rate and channel headers.

---

## 4. Current Milestone Status

| Milestone | Description | Status |
| :--- | :--- | :--- |
| **M1** | Single scene: Stock clip + Kokoro voiceover + Subtitles $\to$ MP4 | **Implemented & Code Complete** |
| **M2** | Multi-scene with crossfade, scene duration driven by voice timing | **Implemented & Code Complete** |
| **M3** | Background music with automated ducking + 4-stage voice DSP chain | **Implemented & Code Complete** |
| **M4** | Auto-fetch Pexels/Pixabay clips with manual scene clip swap | **Implemented & Code Complete** |
| **M5** | Extra transitions (slide, wipe, dip-to-black), selectable per scene | **Implemented & Code Complete** |
| **M6** | Quality tiers (480p/720p/1080p), hardware probe, disk streaming, SHA-1 cache | **Implemented & Code Complete** |

---

## 5. How to Run and Test

### 1. Launch a Local Static Server
Because ES modules and Web Workers require a secure origin (`http://localhost` or HTTPS), serve the project directory:

```bash
# Option A: Python 3
cd "/Volumes/SSD 500gb/Project/docuforge"
python3 -m http.server 8080

# Option B: Node / npx
cd "/Volumes/SSD 500gb/Project/docuforge"
npx serve . -p 8080

# Option C: Bun
cd "/Volumes/SSD 500gb/Project/docuforge"
bunx serve -p 8080
```

### 2. Open in Chrome
Navigate to:
`http://localhost:8080` (or `http://127.0.0.1:8080`)

### 3. Test Verification Checklist for Next Agent
1. **Hardware Probe**: Verify `hw-banner` on startup (inspect console logs).
2. **Script Parser**: Paste 2–3 paragraphs of text, verify live scene counter, click "Parse Script".
3. **Voice Preview**: Select `bm_george`, click "Preview Voice", verify Kokoro downloads model weights (showing download progress) and outputs audio.
4. **Stock Fetching**: Insert a free Pexels or Pixabay key, click "Fetch All Clips", verify video thumbnails load.
5. **Generation & Render**: Click "Generate Documentary", monitor console for Web Worker message exchanges and VideoEncoder queue handling.
6. **Output MP4**: Verify video preview plays smoothly with synced audio, subtitles, Ken Burns motion, and transitions.

---

## 6. Key Invariants for Future Modifications
- **Do not introduce heavy NPM build tools** (Vite, Webpack, Rollup) unless requested. The vanilla ES module structure is a core design constraint.
- **Do not introduce `ffmpeg.wasm`**. WebCodecs + `mp4-muxer` is 100x faster and requires 100x less memory.
- **Always keep Gemini model identifier as `gemini-flash-latest`** when touching Gemini API calls.
- **Always preserve transferable buffer transfers** (`[buffer]`) in workers to maintain 60fps UI responsiveness.

Enjoy building on DocuForge!
