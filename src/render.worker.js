import { getTransition } from './transitions.js';
import { applyKenBurns, randomKenBurnsEffect } from './kenburns.js';
import { createSubtitleCache, drawSubtitleAtTime } from './subtitles.js';

let canvas, ctx;
let transCanvas1, transCtx1, transCanvas2, transCtx2;
let encoder;
let frameIndex = 0;
let fps, width, height, transitionDuration, transitionFrames;
let cancelled = false;

self.onmessage = async (e) => {
  const msg = e.data;
  
  if (msg.type === 'init') {
    width = msg.width;
    height = msg.height;
    fps = msg.fps;
    transitionDuration = msg.transitionDuration || 0.8;
    transitionFrames = Math.round(transitionDuration * fps);
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
    
    encoder.configure({
      codec: msg.bitrate >= 8_000_000 ? 'avc1.640028' : (msg.bitrate >= 4_000_000 ? 'avc1.4d001f' : 'avc1.42001f'),
      width,
      height,
      bitrate: msg.bitrate,
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
      await renderScene(msg);
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

async function renderScene(msg) {
  const { sceneIndex, totalScenes, bitmap, nextBitmap, duration, subtitleSegments, transition, kenburns, nextKenburns } = msg;
  const totalFrames = Math.round(duration * fps);
  const kb = kenburns || randomKenBurnsEffect();
  const nextKb = nextKenburns || randomKenBurnsEffect();
  const hasTransition = nextBitmap && sceneIndex < totalScenes - 1;
  
  // Pre-render subtitle cache for this scene's sentences
  const subCache = createSubtitleCache(subtitleSegments || [], width, height);
  
  for (let f = 0; f < totalFrames; f++) {
    if (cancelled) break;
    
    const sceneProgress = f / totalFrames;
    const sceneTime = f / fps;
    const inTransition = hasTransition && f >= totalFrames - transitionFrames;
    
    if (inTransition) {
      const transProgress = (f - (totalFrames - transitionFrames)) / transitionFrames;
      
      // Render current scene to temp canvas 1
      transCtx1.fillStyle = '#000';
      transCtx1.fillRect(0, 0, width, height);
      applyKenBurns(transCtx1, bitmap, sceneProgress, width, height, kb);
      
      // Render next scene to temp canvas 2
      const nextProgress = (f - (totalFrames - transitionFrames)) / totalFrames; // slight progress into next
      transCtx2.fillStyle = '#000';
      transCtx2.fillRect(0, 0, width, height);
      applyKenBurns(transCtx2, nextBitmap, nextProgress * 0.1, width, height, nextKb);
      
      // Apply transition effect
      const transitionFn = getTransition(transition || 'crossfade');
      transitionFn(ctx, transCanvas1, transCanvas2, transProgress, width, height);
    } else {
      // Normal frame
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, width, height);
      applyKenBurns(ctx, bitmap, sceneProgress, width, height, kb);
    }
    
    // Draw subtitle for the current timestamp within this scene
    drawSubtitleAtTime(ctx, subCache, subtitleSegments || [], sceneTime, width, height);
    
    // Create VideoFrame and encode
    const timestamp = Math.round((frameIndex * 1_000_000) / fps);
    const frameDuration = Math.round(1_000_000 / fps);
    const frame = new VideoFrame(canvas, { timestamp, duration: frameDuration });
    const keyFrame = f === 0;
    
    // Backpressure: wait if encoder queue is too deep
    while (encoder.encodeQueueSize > 5) {
      await new Promise(r => setTimeout(r, 1));
    }
    
    encoder.encode(frame, { keyFrame });
    frame.close();
    
    frameIndex++;
    
    // Report progress every 4 frames
    if (f % 4 === 0) {
      self.postMessage({ type: 'progress', sceneIndex, framePercent: f / totalFrames });
    }
  }
  
  // Close bitmaps to free memory
  if (bitmap) bitmap.close();
  if (nextBitmap) nextBitmap.close();
  
  if (!cancelled) {
    self.postMessage({ type: 'progress', sceneIndex, framePercent: 1 });
  }
}
