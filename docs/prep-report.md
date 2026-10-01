# DocuForge Offline Clip Preparation Report (`docs/prep-report.md`)

**Date:** 2026-10-01  
**Tool:** `/tools/prep-clips` (Node.js + ffmpeg + yt-dlp + ffprobe)  
**Execution Environment:** macOS Apple Silicon, External 500GB SSD (`/Volumes/SSD 500gb/`)

---

## 1. Encoding Specifications & Pipeline

Each video is processed strictly through the following offline filter chain:
1. **License Verification:** Machine query via `yt-dlp --dump-json` confirming `Creative Commons Attribution license`.
2. **Download Stream:** Best MP4 stream up to 1080p saved to gitignored `raw_downloads/`.
3. **9:16 Aspect Conversion:** Center-crop filter `crop=ih*9/16:ih:(iw-ow)/2:0` (or portrait scaling), followed by `scale=720:1280:flags=lanczos` at `24fps`.
4. **Encoding Parameters:** H.264 Main Profile, CRF 26, `yuv420p`, `-g 24 -keyint_min 24` (guaranteed keyframe every 1 second for fast browser scrubbing on weak PCs), audio stripped (`-an`), `-movflags +faststart`.
5. **Draft Generation:** 540x960 version at CRF 28 (`scale=540:960:flags=bilinear`) for low-RAM draft previews.
6. **3-Minute Segmentation:** Split via `-f segment -segment_time 180 -reset_timestamps 1` named `{videoId}_{index}.mp4`.
7. **Thumbnails:** Extracted at $t=2.0\text{s}$ to `clips/thumbs/{videoId}_{index}.jpg`.

---

## 2. Processed Video Inventory

### Video 1: `BXUA2FncVPI` (Minecraft Parkour Gameplay 4K)
- **Source Uploader:** Orbital - No Copyright Gameplay
- **License:** CC-BY (reuse allowed)
- **Source Dimensions:** 1920x1080 @ 60fps
- **Total Duration:** 10m 30s (629.88s)
- **Segments Created:**
  - `BXUA2FncVPI_00.mp4`: 180.00s (HD: 62MB, Draft: 28MB)
  - `BXUA2FncVPI_01.mp4`: 180.00s (HD: 64MB, Draft: 29MB)
  - `BXUA2FncVPI_02.mp4`: 180.00s (HD: 70MB, Draft: 32MB)
  - `BXUA2FncVPI_03.mp4`: 89.88s (HD: 29MB, Draft: 13MB)
- **Total HD Size:** 225 MB
- **Total Draft Size:** 102 MB

### Video 2: `weAUrmRLpnk` (GTA 5 Gameplay 4K Mega Ramp)
- **Source Uploader:** Orbital - No Copyright Gameplay
- **License:** CC-BY (reuse allowed)
- **Source Dimensions:** 1920x1080 @ 60fps
- **Total Duration:** 15m 52s (952.00s)
- **Segments Created:** 6 segments (`weAUrmRLpnk_00` to `05`) of ~180s each.

---

## 3. Storage & Bandwidth Budget

- **Target Threshold:** < 800 MB on GitHub Pages
- **Current Total Asset Size (Clips + Music + SFX):** ~540 MB
- **Cloudflare R2 Status:** Under budget, GitHub Pages hosting active. If total exceeds 800 MB, R2 free tier will be activated automatically.
