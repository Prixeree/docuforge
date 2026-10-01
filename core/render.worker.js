/**
 * render.worker.js - Offscreen WebCodecs Video Rendering Worker
 * 
 * Executed in DedicatedWorkerGlobalScope.
 * Renders declarative scene frames onto an OffscreenCanvas,
 * applies Ken Burns, transitions, and kinetic subtitles,
 * encodes via VideoEncoder with hardware preference, and sends chunks to main thread.
 * 
 * Strict Memory Policy:
 * - Every VideoFrame is closed immediately after encoder.encode(frame)
 * - Every ImageBitmap is closed after scene completion
 * - Backpressure yields when encoder.encodeQueueSize > 5
 */

import { getTransition } from './transitions.js';
import { applyKenBurns, createKenBurnsEffect } from './kenburns.js';
import { drawKineticSubtitles } from './subtitles.js';
import { renderLayer } from './scene-graph.js';

let canvas, ctx;
let transCanvas1, transCtx1, transCanvas2, transCtx2;
let encoder;
let frameIndex = 0;
let fps, width, height;
let cancelled = false;

self.onmessage = async (e) => {
  const msg = e.data;

  if (msg.type === 'init') {
    width = msg.width;
    height = msg.height;
    fps = msg.fps || 24;
    frameIndex = 0;
    cancelled = false;

    canvas = new OffscreenCanvas(width, height);
    ctx = canvas.getContext('2d', { alpha: false });
    transCanvas1 = new OffscreenCanvas(width, height);
    transCtx1 = transCanvas1.getContext('2d', { alpha: false });
    transCanvas2 = new OffscreenCanvas(width, height);
    transCtx2 = transCanvas2.getContext('2d', { alpha: false });

    encoder = new VideoEncoder({
      output: (chunk, meta) => {
        self.postMessage({ type: 'video-chunk', chunk, meta });
      },
      error: (err) => {
        self.postMessage({ type: 'error', message: err.message });
      }
    });

    // Select profile based on resolution / bitrate
    let codecString = 'avc1.4d001f'; // Main L3.1 (720p default)
    if (width >= 1080 || height >= 1080) {
      codecString = 'avc1.640028'; // High L4.0 (1080p)
    } else if (width <= 540 || height <= 540) {
      codecString = 'avc1.42001f'; // Baseline L3.1 (Draft)
    }

    encoder.configure({
      codec: codecString,
      width,
      height,
      bitrate: msg.bitrate || (width >= 1080 ? 8_000_000 : 3_500_000),
      framerate: fps,
      hardwareAcceleration: 'prefer-hardware',
      avc: { format: 'avc' },
      latencyMode: 'quality'
    });

    self.postMessage({ type: 'ready' });
  }

  if (msg.type === 'cancel') {
    cancelled = true;
  }

  if (msg.type === 'render-scene') {
    try {
      await renderSceneNode(msg);
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }

  if (msg.type === 'flush') {
    try {
      await encoder.flush();
      self.postMessage({ type: 'flushed' });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }

  if (msg.type === 'finalize') {
    try {
      await encoder.flush();
      encoder.close();
      self.postMessage({ type: 'finalized' });
    } catch (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  }
};

async function renderSceneNode(msg) {
  const {
    sceneIndex,
    totalScenes,
    scene,
    nextScene,
    bitmap,
    nextBitmap,
    spriteBitmaps,
    subtitleWords,
    subtitlePreset
  } = msg;

  const duration = scene.duration;
  const totalFrames = Math.max(1, Math.round(duration * fps));
  const transDur = scene.transition ? (scene.transition.duration || 0.6) : 0;
  const transFrames = Math.round(transDur * fps);
  const hasTransition = nextScene && scene.transition && scene.transition.type !== 'none' && sceneIndex < totalScenes - 1;

  const kbEffect = scene.kenBurns ? createKenBurnsEffect(scene.kenBurns.type, scene.kenBurns.direction) : createKenBurnsEffect('slow-drift', 'in');
  const nextKbEffect = (nextScene && nextScene.kenBurns) ? createKenBurnsEffect(nextScene.kenBurns.type, nextScene.kenBurns.direction) : createKenBurnsEffect('slow-drift', 'in');

  const assetsMap = {
    sprites: spriteBitmaps || {},
    videoFrames: { [scene.id]: bitmap }
  };

  for (let f = 0; f < totalFrames; f++) {
    if (cancelled) break;

    const sceneProgress = f / totalFrames;
    const sceneTime = f / fps;
    const inTransition = hasTransition && f >= (totalFrames - transFrames);

    if (inTransition) {
      const transProgress = (f - (totalFrames - transFrames)) / Math.max(1, transFrames);

      // Render Scene 1 to transCanvas1
      transCtx1.fillStyle = '#000000';
      transCtx1.fillRect(0, 0, width, height);
      if (bitmap) applyKenBurns(transCtx1, bitmap, sceneProgress, width, height, kbEffect);

      // Render Scene 2 to transCanvas2
      transCtx2.fillStyle = '#000000';
      transCtx2.fillRect(0, 0, width, height);
      if (nextBitmap) applyKenBurns(transCtx2, nextBitmap, transProgress * 0.1, width, height, nextKbEffect);

      // Apply transition
      const transFn = getTransition(scene.transition.type || 'crossfade');
      transFn(ctx, transCanvas1, transCanvas2, transProgress, width, height);
    } else {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      if (bitmap) applyKenBurns(ctx, bitmap, sceneProgress, width, height, kbEffect);
    }

    // Render Scene Layers (sprites, badges, shapes)
    if (scene.layers && Array.isArray(scene.layers)) {
      for (const layer of scene.layers) {
        if (layer.type !== 'video') {
          renderLayer(ctx, layer, sceneTime, width, height, assetsMap);
        }
      }
    }

    // Render Kinetic Subtitles
    if (subtitleWords && subtitleWords.length > 0) {
      drawKineticSubtitles(ctx, subtitleWords, sceneTime, width, height, {
        preset: subtitlePreset || 'bold-pop',
        yRatio: scene.subtitleYRatio || 0.75
      });
    }

    // Encode frame
    const timestamp = Math.round((frameIndex * 1_000_000) / fps);
    const frameDuration = Math.round(1_000_000 / fps);
    const frame = new VideoFrame(canvas, { timestamp, duration: frameDuration });
    const keyFrame = (f === 0 && sceneIndex === 0) || (f % (fps * 2) === 0);

    // Backpressure management
    while (encoder.encodeQueueSize > 5) {
      await new Promise(r => setTimeout(r, 2));
    }

    encoder.encode(frame, { keyFrame });
    frame.close(); // Immediate memory disposal
    frameIndex++;

    if (f % 6 === 0) {
      self.postMessage({ type: 'progress', sceneIndex, framePercent: f / totalFrames });
    }
  }

  // Free bitmaps immediately
  if (bitmap && typeof bitmap.close === 'function') bitmap.close();
  if (nextBitmap && typeof nextBitmap.close === 'function') nextBitmap.close();

  if (!cancelled) {
    self.postMessage({ type: 'progress', sceneIndex, framePercent: 1.0 });
  }
}
