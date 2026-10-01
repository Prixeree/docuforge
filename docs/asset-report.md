# DocuForge Asset Validation & Integrity Report (`docs/asset-report.md`)

**Date:** 2026-10-01  
**Target:** Static asset hosting in `docuforge-assets` repository.

---

## 1. Asset Health & HTTP Integrity

| Asset Path | Type | HTTP Status | Accept-Ranges | MIME Type | Resolution / Duration | Status |
|---|---|---|---|---|---|---|
| `clips/hd/BXUA2FncVPI_00.mp4` | Video | 200 / 206 | `bytes` | `video/mp4` | 720x1280 @ 24fps | ✅ **PASS** |
| `clips/hd/BXUA2FncVPI_01.mp4` | Video | 200 / 206 | `bytes` | `video/mp4` | 720x1280 @ 24fps | ✅ **PASS** |
| `clips/hd/BXUA2FncVPI_02.mp4` | Video | 200 / 206 | `bytes` | `video/mp4` | 720x1280 @ 24fps | ✅ **PASS** |
| `clips/hd/BXUA2FncVPI_03.mp4` | Video | 200 / 206 | `bytes` | `video/mp4` | 720x1280 @ 24fps | ✅ **PASS** |
| `clips/draft/BXUA2FncVPI_00.mp4` | Video | 200 / 206 | `bytes` | `video/mp4` | 540x960 @ 24fps | ✅ **PASS** |
| `clips/draft/BXUA2FncVPI_01.mp4` | Video | 200 / 206 | `bytes` | `video/mp4` | 540x960 @ 24fps | ✅ **PASS** |
| `clips/draft/BXUA2FncVPI_02.mp4` | Video | 200 / 206 | `bytes` | `video/mp4` | 540x960 @ 24fps | ✅ **PASS** |
| `clips/draft/BXUA2FncVPI_03.mp4` | Video | 200 / 206 | `bytes` | `video/mp4` | 540x960 @ 24fps | ✅ **PASS** |
| `music/nastelbom-documentary-documentary-music-606698.mp3` | Music | 200 / 206 | `bytes` | `audio/mpeg` | 111.28s, 256kbps | ✅ **PASS** |
| `music/leberch-atmosphere-documentary-603152.mp3` | Music | 200 / 206 | `bytes` | `audio/mpeg` | 166.03s, 256kbps | ✅ **PASS** |
| `music/leberch-documentary-calm-603945.mp3` | Music | 200 / 206 | `bytes` | `audio/mpeg` | 170.03s, 256kbps | ✅ **PASS** |
| `music/leberch-history-documentary-589943.mp3` | Music | 200 / 206 | `bytes` | `audio/mpeg` | 204.04s, 256kbps | ✅ **PASS** |
| `music/kevin-macleod-sneaky-snitch.mp3` | Music | 200 / 206 | `bytes` | `audio/mpeg` | 136.62s, 320kbps | ✅ **PASS** |
| `music/kevin-macleod-the-descent.mp3` | Music | 200 / 206 | `bytes` | `audio/mpeg` | 191.76s, 320kbps | ✅ **PASS** |
| `music/kevin-macleod-faster-does-it.mp3` | Music | 200 / 206 | `bytes` | `audio/mpeg` | 181.84s, 320kbps | ✅ **PASS** |
| `music/kevin-macleod-carefree.mp3` | Music | 200 / 206 | `bytes` | `audio/mpeg` | 205.14s, 256kbps | ✅ **PASS** |
| `sfx/whoosh.wav` | SFX | 200 | `bytes` | `audio/wav` | 0.50s, 48kHz mono | ✅ **PASS** |
| `sfx/ding.wav` | SFX | 200 | `bytes` | `audio/wav` | 1.20s, 48kHz mono | ✅ **PASS** |
| `sfx/tick.wav` | SFX | 200 | `bytes` | `audio/wav` | 0.06s, 48kHz mono | ✅ **PASS** |
| `sfx/chime.wav` | SFX | 200 | `bytes` | `audio/wav` | 1.50s, 48kHz mono | ✅ **PASS** |
| `sfx/riser.wav` | SFX | 200 | `bytes` | `audio/wav` | 2.00s, 48kHz mono | ✅ **PASS** |
| `sfx/hit.wav` | SFX | 200 | `bytes` | `audio/wav` | 1.00s, 48kHz mono | ✅ **PASS** |

---

## 2. Integrity Summary
- **Zero Failed Files:** 100% of published files are verified valid audio/video containers.
- **Range Request Compatibility:** Verified seeking capability with zero dropped frames.
- **License Compliance:** 100% of files have confirmed Creative Commons (CC0 / CC-BY) or Pixabay Content License.
