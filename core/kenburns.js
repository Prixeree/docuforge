/**
 * kenburns.js - Pan & Zoom Source-Rect Mathematics
 * 
 * Computes sub-crop coordinates in the source image/video frame
 * and maps them directly to canvas coordinates without upscaling artifacts.
 */

export function createKenBurnsEffect(type = 'slow-drift', direction = 'in') {
  switch (type) {
    case 'punch-in':
      return {
        startZoom: 1.14,
        endZoom: 1.16,
        startX: 0.5,
        startY: 0.5,
        endX: 0.5,
        endY: 0.5
      };
    case 'pan-left':
      return {
        startZoom: 1.08,
        endZoom: 1.08,
        startX: 0.7,
        startY: 0.5,
        endX: 0.3,
        endY: 0.5
      };
    case 'pan-right':
      return {
        startZoom: 1.08,
        endZoom: 1.08,
        startX: 0.3,
        startY: 0.5,
        endX: 0.7,
        endY: 0.5
      };
    case 'slow-drift':
    default:
      if (direction === 'out') {
        return {
          startZoom: 1.12,
          endZoom: 1.02,
          startX: 0.45,
          startY: 0.45,
          endX: 0.55,
          endY: 0.55
        };
      }
      return {
        startZoom: 1.02,
        endZoom: 1.12,
        startX: 0.5,
        startY: 0.5,
        endX: 0.45,
        endY: 0.55
      };
  }
}

export function applyKenBurns(ctx, source, progress, canvasWidth, canvasHeight, effect) {
  const iw = source.width;
  const ih = source.height;
  const canvasRatio = canvasWidth / canvasHeight;
  const imgRatio = iw / ih;

  let baseW, baseH;
  if (imgRatio > canvasRatio) {
    baseH = ih;
    baseW = ih * canvasRatio;
  } else {
    baseW = iw;
    baseH = iw / canvasRatio;
  }

  // Never upscale rule: if source is smaller than target canvas, center 1:1 on black
  if (iw < canvasWidth && ih < canvasHeight) {
    const x = (canvasWidth - iw) / 2;
    const y = (canvasHeight - ih) / 2;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    ctx.drawImage(source, x, y, iw, ih);
    return;
  }

  const p = Math.max(0, Math.min(1, progress));
  const currentZoom = effect.startZoom + (effect.endZoom - effect.startZoom) * p;
  const currentX = effect.startX + (effect.endX - effect.startX) * p;
  const currentY = effect.startY + (effect.endY - effect.startY) * p;

  let srcW = Math.min(iw, baseW / currentZoom);
  let srcH = Math.min(ih, baseH / currentZoom);

  const maxX = Math.max(0, iw - srcW);
  const maxY = Math.max(0, ih - srcH);

  let srcX = Math.max(0, Math.min(iw - srcW, currentX * maxX));
  let srcY = Math.max(0, Math.min(ih - srcH, currentY * maxY));

  ctx.drawImage(source, srcX, srcY, srcW, srcH, 0, 0, canvasWidth, canvasHeight);
}
