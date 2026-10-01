# DocuForge — Milestone Progress & Agent Tracking

**Current Milestone:** M0–M3 (Asset Preparation, Live Stock Engine, Core Renderer, 7 Modes, and Architecture Alignment)

---

## 1. Milestone Status

| Milestone | Deliverables | Status | Notes |
|---|---|---|---|
| **M0** | Offline prep tools, autonomous sourcing engine, source audit report, asset integrity validation | ✅ **COMPLETED** | `prep-clips`, `source-clips`, `docs/source-report.md`, `docs/prep-report.md`, `docs/asset-report.md` |
| **M1** | Core engine modules: Scene Graph, WebCodecs OffscreenCanvas renderer, 48kHz audio with seamless loops & ducking, kinetic subtitles | ✅ **COMPLETED** | `core/scene-graph.js`, `core/audio.js`, `core/render.worker.js`, `core/subtitles.js`, `core/transitions.js`, `core/kenburns.js`, `core/mux.js`, `core/tts.js` |
| **M2** | Full 7-Pipeline Mode implementations, UI Kit with gallery and live preview, monorepo structure | ✅ **COMPLETED** | `modes/viral`, `modes/reddit-story`, `modes/explainer`, `modes/myth-vs-fact`, `modes/quote-motivational`, `modes/quiz-trivia`, `modes/would-you-rather` |
| **M3** | Live Stock Footage Engine (Pexels + Pixabay), Cloudflare Worker proxy, Clip Swapper, Procedural Fallback | ✅ **COMPLETED** | `core/stock.js`, `tools/stock-proxy/`, `docs/credits.md`, `index.html` swapper & footer attribution |
| **M4** | Continuous Gameplay Library Expansion for Reddit Story mode | ✅ **COMPLETED** | 13 segments (33.6 mins) across Minecraft and GTA 5 (`BXUA2FncVPI`, `weAUrmRLpnk`, `XBIaqOm0RKQ`) |
| **M5** | Streaming Dev Server with HTTP 206 Partial Content range requests & CORS | ✅ **COMPLETED** | `tools/dev-server.js` |
| **M6** | Headless Example Export Pipeline & Product Documentation Release | ✅ **COMPLETED** | All 7 mode READMEs, Core & Asset READMEs, master README, automated CDP export script, issue templates, PR template, Code of Conduct, social preview |

---

## 2. Real Example Generation Audit & Benchmarks

All 7 modes were exported headlessly using real pipeline execution (Kokoro Neural TTS, Web Audio DSP, Scene Graph, and WebCodecs H.264 offline encoding). Zero mocked or fake outputs.

| Mode | Duration | Render Time | Realtime Speed | MP4 File Size | GIF Size (12fps) | Poster Size |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **`viral`** | 55.6s | 28.22s | **1.97x** | 3.32 MB | 2.18 MB | 34.0 KB |
| **`reddit-story`** | 47.5s | 26.84s | **1.77x** | 2.77 MB | 2.83 MB | 116.8 KB |
| **`explainer`** | 43.9s | 22.08s | **1.98x** | 2.78 MB | 2.17 MB | 37.3 KB |
| **`myth-vs-fact`** | 27.5s | 15.82s | **1.74x** | 5.23 MB | 2.45 MB | 24.1 KB |
| **`quote-motivational`** | 8.2s | 4.80s | **1.70x** | 0.93 MB | 0.82 MB | 36.5 KB |
| **`quiz-trivia`** | 12.6s | 8.44s | **1.81x** | 2.73 MB | 2.23 MB | 27.5 KB |
| **`would-you-rather`** | 11.8s | 8.27s | **1.72x** | 3.70 MB | 0.92 MB | 34.8 KB |

- **MP4 Target**: All 7 MP4s strictly $\le 8.0\text{ MB}$ (largest is 5.23 MB).
- **GIF Target**: All 7 preview GIFs strictly $\le 3.0\text{ MB}$ (largest is 2.83 MB).
- **Format Specs**: 720x1280 (HD 9:16), 24fps CFR H.264, AAC 48kHz stereo, faststart moov atom.

---

## 3. Asset & Stock Pipeline Architecture

### Offline Gameplay Library (Reddit Story Mode Only)
- **Minecraft Parkour 4K (`BXUA2FncVPI`)**: 4 segments (10m 30s) — CC-BY verified
- **GTA 5 Mega Ramp 4K (`weAUrmRLpnk`)**: 6 segments (15m 52s) — CC-BY verified
- **Minecraft Parkour 7 Min (`XBIaqOm0RKQ`)**: 3 segments (7m 07s) — CC-BY verified
- **Total Continuous Gameplay:** 13 segments, 33.6 minutes in HD (720x1280) and Draft (540x960) with faststart moov headers and thumbnails.
- **`7XmNpia0KVQ`**: Disqualified and dropped due to Standard YouTube License.

### Live Stock Footage (Modes 1–6)
- **Supported Modes:** `viral`, `explainer`, `myth-vs-fact`, `quote-motivational`, `quiz-trivia`, `would-you-rather`
- **APIs:** Pexels Video API + Pixabay Video API with portrait/vertical orientation filter (`orientation=portrait`).
- **Scoring Heuristics:** Keyword matching (+20/word), duration >= scene length (+30), portrait aspect ratio (+40), rejection of text/watermarks/logos (-100).
- **Interactive UI Swapper:** Dynamic scene stock cards with **"🔀 Swap Clip"** buttons to cycle candidates.
- **Cloudflare Worker Proxy (`tools/stock-proxy`)**: Zero-manual-setup key management with edge caching, plus `localStorage` user key fallback.
- **Procedural Canvas Fallback:** Smooth animated gradient canvas shaders when APIs are unreachable or rate-limited.
- **Attribution & Legal:** Full creator attribution in `docs/credits.md`, `credits.md` in each mode, and app footer.

### Audio Library
- **Background Music:** 8 verified tracks (4 Pixabay Content License + 4 Kevin MacLeod CC-BY 4.0).
- **Sound Effects:** 6 broadcast-grade CC0 samples synthesized and indexed (`whoosh`, `ding`, `tick`, `chime`, `riser`, `hit`).

