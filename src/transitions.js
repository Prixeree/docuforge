function crossfade(ctx, fromCanvas, toCanvas, progress, width, height) {
  ctx.drawImage(fromCanvas, 0, 0, width, height);
  ctx.globalAlpha = progress;
  ctx.drawImage(toCanvas, 0, 0, width, height);
  ctx.globalAlpha = 1.0;
}

function slideLeft(ctx, fromCanvas, toCanvas, progress, width, height) {
  const offset = progress * width;
  ctx.drawImage(fromCanvas, -offset, 0, width, height);
  ctx.drawImage(toCanvas, width - offset, 0, width, height);
}

function slideRight(ctx, fromCanvas, toCanvas, progress, width, height) {
  const offset = progress * width;
  ctx.drawImage(fromCanvas, offset, 0, width, height);
  ctx.drawImage(toCanvas, offset - width, 0, width, height);
}

function wipeLeft(ctx, fromCanvas, toCanvas, progress, width, height) {
  const split = width - (progress * width);
  ctx.drawImage(fromCanvas, 0, 0, width, height);
  if (split < width) {
    ctx.drawImage(toCanvas, split, 0, width - split, height, split, 0, width - split, height);
  }
}

function wipeDown(ctx, fromCanvas, toCanvas, progress, width, height) {
  const split = progress * height;
  ctx.drawImage(fromCanvas, 0, 0, width, height);
  if (split > 0) {
    ctx.drawImage(toCanvas, 0, 0, width, split, 0, 0, width, split);
  }
}

function dipToBlack(ctx, fromCanvas, toCanvas, progress, width, height) {
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

const transitions = {
  crossfade,
  slideLeft,
  slideRight,
  wipeLeft,
  wipeDown,
  dipToBlack
};

export const transitionNames = Object.keys(transitions);

export function getTransition(name) {
  return transitions[name] || transitions.crossfade;
}
