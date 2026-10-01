# Contributing to DocuForge

Thank you for your interest in contributing to DocuForge!

## Core Engineering Principles

1. **Zero Cost / Zero Backend**: Everything runs client-side inside the browser. Never introduce server requirements.
2. **No Bundler**: DocuForge runs on standard native ES modules (`import`/`export`). Do not add Webpack, Vite, or Rollup.
3. **No `ffmpeg.wasm` in Browser**: The web client uses native **WebCodecs** (`VideoEncoder`, `AudioEncoder`) and vendored `mp4-muxer`. Offline clip preparation tools in `/tools/` are permitted to use local `ffmpeg` and `yt-dlp`.
4. **Declarative Scene Graph**: Pipeline modes must only construct declarative `SceneGraph` JSON objects. Only `docuforge-core` renders them.
5. **Aggressive Memory Reclamation**: Always call `.close()` on `VideoFrame`, `ImageBitmap`, and `AudioData` immediately after encoding.

## Submitting New Pipeline Modes

Each mode lives under `modes/<mode-name>/` and implements:
- `mode.js`: parsing logic and `buildSceneGraph()`
- Conforms to `docs/scene-graph.md`
