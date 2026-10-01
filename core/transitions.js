/**
 * transitions.js - Pure Canvas 2D Transition Engine
 * 
 * Supports:
 * - crossfade
 * - slide (left/right/up/down)
 * - wipe (left/right/up/down)
 * - dip-to-black
 * - whip-pan (dynamic motion stretch ease-in-out)
 * - glitch-cut (horizontal slice displacement)
 * 
 * Hard Invariant: Zero ctx.filter or getImageData in the loop.
 */

export function crossfade(ctx, fromCanvas, toCanvas, progress, width, height) {
  ctx.drawImage(fromCanvas, 0, 0, width, height);
  ctx.globalAlpha = Math.max(0, Math.min(1, progress));
  ctx.drawImage(toCanvas, 0, 0, width, height);
  ctx.globalAlpha = 1.0;
}

export function slideLeft(ctx, fromCanvas, toCanvas, progress, width, height) {
  const p = easeInOutCubic(progress);
  const offset = p * width;
  ctx.drawImage(fromCanvas, -offset, 0, width, height);
  ctx.drawImage(toCanvas, width - offset, 0, width, height);
}

export function slideRight(ctx, fromCanvas, toCanvas, progress, width, height) {
  const p = easeInOutCubic(progress);
  const offset = p * width;
  ctx.drawImage(fromCanvas, offset, 0, width, height);
  ctx.drawImage(toCanvas, offset - width, 0, width, height);
}

export function slideUp(ctx, fromCanvas, toCanvas, progress, width, height) {
  const p = easeInOutCubic(progress);
  const offset = p * height;
  ctx.drawImage(fromCanvas, 0, -offset, width, height);
  ctx.drawImage(toCanvas, 0, height - offset, width, height);
}

export function wipeLeft(ctx, fromCanvas, toCanvas, progress, width, height) {
  const split = width - (progress * width);
  ctx.drawImage(fromCanvas, 0, 0, width, height);
  if (split < width) {
    ctx.drawImage(toCanvas, split, 0, width - split, height, split, 0, width - split, height);
  }
}

export function wipeDown(ctx, fromCanvas, toCanvas, progress, width, height) {
  const split = progress * height;
  ctx.drawImage(fromCanvas, 0, 0, width, height);
  if (split > 0) {
    ctx.drawImage(toCanvas, 0, 0, width, split, 0, 0, width, split);
  }
}

export function dipToBlack(ctx, fromCanvas, toCanvas, progress, width, height) {
  if (progress < 0.5) {
    const fade = progress * 2;
    ctx.drawImage(fromCanvas, 0, 0, width, height);
    ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
    ctx.fillRect(0, 0, width, height);
  } else {
    const fade = 1 - ((progress - 0.5) * 2);
    ctx.drawImage(toCanvas, 0, 0, width, height);
    ctx.fillStyle = `rgba(0, 0, 0, ${fade})`;
    ctx.fillRect(0, 0, width, height);
  }
}

export function whipPan(ctx, fromCanvas, toCanvas, progress, width, height) {
  // Non-linear acceleration curve
  const p = easeInOutExpo(progress);
  const offset = p * width;
  
  // Stretch factor simulating high speed shutter smear during the middle 50%
  const blurFactor = Math.sin(progress * Math.PI);
  const stretchW = width * (1.0 + blurFactor * 0.35);

  ctx.save();
  if (progress < 0.5) {
    ctx.drawImage(fromCanvas, -offset - (blurFactor * 40), 0, stretchW, height);
  } else {
    ctx.drawImage(toCanvas, width - offset, 0, stretchW, height);
  }
  ctx.restore();
}

export function glitchCut(ctx, fromCanvas, toCanvas, progress, width, height) {
  if (progress < 0.5) {
    ctx.drawImage(fromCanvas, 0, 0, width, height);
  } else {
    ctx.drawImage(toCanvas, 0, 0, width, height);
  }

  // Draw 4-6 displaced horizontal raster slices
  const numSlices = 5;
  const sliceHeight = height / numSlices;
  const glitchIntensity = Math.sin(progress * Math.PI);

  if (glitchIntensity > 0.05) {
    for (let i = 0; i < numSlices; i++) {
      if ((i + Math.floor(progress * 10)) % 2 === 0) {
        const shiftX = (Math.sin(i * 99 + progress * 50) * 40) * glitchIntensity;
        const srcCanvas = (progress < 0.5) ? fromCanvas : toCanvas;
        ctx.drawImage(
          srcCanvas,
          0, i * sliceHeight, width, sliceHeight,
          shiftX, i * sliceHeight, width, sliceHeight
        );
      }
    }
  }
}

function easeInOutCubic(x) {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function easeInOutExpo(x) {
  return x === 0 ? 0 : x === 1 ? 1 : x < 0.5 ? Math.pow(2, 20 * x - 10) / 2 : (2 - Math.pow(2, -20 * x + 10)) / 2;
}

const transitions = {
  crossfade,
  slideLeft,
  slideRight,
  slideUp,
  wipeLeft,
  wipeDown,
  dipToBlack,
  'whip-pan': whipPan,
  'glitch-cut': glitchCut
};

export const transitionNames = Object.keys(transitions);

export function getTransition(name) {
  return transitions[name] || transitions.crossfade;
}
