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
| **M6** | Cloudflare R2 Documentation & Fallback Hosting Guide | ✅ **COMPLETED** | `docuforge-assets/docs/r2-setup.md` |

---

## 2. Asset & Stock Pipeline Architecture

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
- **Attribution & Legal:** Full creator attribution in `docs/credits.md` and app footer.

### Audio Library
- **Background Music:** 8 verified tracks (4 Pixabay Content License + 4 Kevin MacLeod CC-BY 4.0).
- **Sound Effects:** 6 broadcast-grade CC0 samples synthesized and indexed (`whoosh`, `ding`, `tick`, `chime`, `riser`, `hit`).
