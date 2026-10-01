export function randomKenBurnsEffect() {
  return {
    startZoom: 1.0 + Math.random() * 0.05, // 1.0 to 1.05
    endZoom: 1.08 + Math.random() * 0.07,  // 1.08 to 1.15
    startX: 0.3 + Math.random() * 0.4,     // 0.3 to 0.7
    startY: 0.3 + Math.random() * 0.4,     // 0.3 to 0.7
    endX: 0.3 + Math.random() * 0.4,       // 0.3 to 0.7
    endY: 0.3 + Math.random() * 0.4        // 0.3 to 0.7
  };
}

export function applyKenBurns(ctx, image, progress, width, height, effect) {
  const iw = image.width;
  const ih = image.height;
  const canvasRatio = width / height;
  const imgRatio = iw / ih;

  let drawW, drawH;

  // Determine the base drawing dimensions if we were to fit the image into the canvas
  if (imgRatio > canvasRatio) {
    // Image is wider than canvas ratio, fit by height
    drawH = ih;
    drawW = ih * canvasRatio;
  } else {
    // Image is taller than canvas ratio, fit by width
    drawW = iw;
    drawH = iw / canvasRatio;
  }

  // Ensure we do not upscale. If image is too small, we center it 1:1 on black.
  if (iw < width && ih < height) {
    const x = (width - iw) / 2;
    const y = (height - ih) / 2;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, x, y, iw, ih);
    return;
  }

  // Interpolate zoom and pan
  const currentZoom = effect.startZoom + (effect.endZoom - effect.startZoom) * progress;
  const currentX = effect.startX + (effect.endX - effect.startX) * progress;
  const currentY = effect.startY + (effect.endY - effect.startY) * progress;

  // Calculate scaled source dimensions
  let srcW = drawW / currentZoom;
  let srcH = drawH / currentZoom;

  // Clamp source dimensions to image bounds
  srcW = Math.min(srcW, iw);
  srcH = Math.min(srcH, ih);

  // Calculate max available panning space
  const maxX = iw - srcW;
  const maxY = ih - srcH;

  // Map 0-1 panning coordinates to actual pixels
  let srcX = currentX * maxX;
  let srcY = currentY * maxY;

  // Final clamping to ensure we don't read out of bounds
  srcX = Math.max(0, Math.min(srcX, iw - srcW));
  srcY = Math.max(0, Math.min(srcY, ih - srcH));

  ctx.drawImage(image, srcX, srcY, srcW, srcH, 0, 0, width, height);
}
