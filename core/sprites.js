/**
 * sprites.js - Pre-Rendered Canvas Sprite Generator
 * 
 * Pre-renders UI cards, badges, and glassmorphic overlays ONCE to OffscreenCanvases
 * so they can be blitted directly per frame with zero ctx.filter, blur, or getImageData.
 */

export function createGlassmorphicRect(width, height, radius = 16, borderColor = 'rgba(255,255,255,0.25)', bgTop = 'rgba(255,255,255,0.12)', bgBottom = 'rgba(255,255,255,0.04)') {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Linear gradient fill simulating glass reflection
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, bgTop);
  grad.addColorStop(1, bgBottom);

  ctx.beginPath();
  ctx.roundRect(1, 1, width - 2, height - 2, radius);
  ctx.fillStyle = grad;
  ctx.fill();

  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  return canvas;
}

export function createRedditCardSprite(width, height, post) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  // Dark Reddit Card Background
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, 18);
  ctx.fillStyle = 'rgba(18, 24, 38, 0.92)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // Subreddit & Author
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillStyle = '#FF4500'; // Reddit Orange
  ctx.fillText(post.subreddit || 'r/AskReddit', 24, 42);

  ctx.font = '500 18px system-ui, sans-serif';
  ctx.fillStyle = '#94A3B8';
  ctx.fillText(`• Posted by ${post.username || 'u/Anonymous'}`, 170, 42);

  // Title
  ctx.font = '800 28px system-ui, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(post.title ? post.title.slice(0, 45) + (post.title.length > 45 ? '...' : '') : 'A Story to Remember', 24, 86);

  // Upvotes & Comments pill
  ctx.font = '700 18px system-ui, sans-serif';
  ctx.fillStyle = '#F59E0B';
  ctx.fillText(`▲ ${post.upvotes || '24.5k'} Upvotes   💬 ${post.comments || '1.8k'} Comments`, 24, 126);

  return canvas;
}

export function createRankBadgeSprite(rank, size = 96, color = '#38BDF8') {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.font = `900 ${Math.round(size * 0.45)}px "Arial Black", sans-serif`;
  ctx.fillStyle = '#0F172A';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`#${rank}`, size / 2, size / 2 + 2);

  return canvas;
}

export function createMythCardSprite(width, height, text) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, 20);
  ctx.fillStyle = 'rgba(185, 28, 28, 0.90)'; // Red
  ctx.fill();
  ctx.strokeStyle = '#EF4444';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Header Badge
  ctx.font = '900 36px "Impact", sans-serif';
  ctx.fillStyle = '#FEE2E2';
  ctx.textAlign = 'center';
  ctx.fillText('❌ MYTH', width / 2, 54);

  // Body Text
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text.slice(0, 50), width / 2, 108);

  return canvas;
}

export function createFactCardSprite(width, height, text) {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, 20);
  ctx.fillStyle = 'rgba(6, 95, 70, 0.92)'; // Emerald Green
  ctx.fill();
  ctx.strokeStyle = '#10B981';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Header Badge
  ctx.font = '900 36px "Impact", sans-serif';
  ctx.fillStyle = '#D1FAE5';
  ctx.textAlign = 'center';
  ctx.fillText('✔ FACT', width / 2, 54);

  // Body Text
  ctx.font = '700 24px system-ui, sans-serif';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillText(text.slice(0, 50), width / 2, 108);

  return canvas;
}

export function createTriviaOptionSprite(width, height, letter, text, state = 'normal') {
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');

  let bgColor = 'rgba(30, 41, 59, 0.85)';
  let borderColor = 'rgba(255, 255, 255, 0.2)';
  let letterBg = '#38BDF8';
  let letterFg = '#0F172A';

  if (state === 'correct') {
    bgColor = 'rgba(16, 185, 129, 0.95)';
    borderColor = '#34D399';
    letterBg = '#FFFFFF';
    letterFg = '#065F46';
  } else if (state === 'faded') {
    bgColor = 'rgba(15, 23, 42, 0.45)';
    borderColor = 'rgba(255, 255, 255, 0.08)';
    letterBg = 'rgba(255,255,255,0.2)';
    letterFg = '#94A3B8';
  }

  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, 16);
  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Letter Circle
  ctx.beginPath();
  ctx.arc(42, height / 2, 22, 0, Math.PI * 2);
  ctx.fillStyle = letterBg;
  ctx.fill();

  ctx.font = '900 20px system-ui, sans-serif';
  ctx.fillStyle = letterFg;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(letter, 42, height / 2);

  // Option Text
  ctx.font = '700 22px system-ui, sans-serif';
  ctx.fillStyle = (state === 'faded') ? '#64748B' : '#FFFFFF';
  ctx.textAlign = 'left';
  ctx.fillText(text.slice(0, 35), 80, height / 2);

  return canvas;
}

export function createVsBadgeSprite(size = 96) {
  const canvas = new OffscreenCanvas(size, size);
  const ctx = canvas.getContext('2d');

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2 - 4, 0, Math.PI * 2);
  ctx.fillStyle = '#EF4444'; // Red
  ctx.fill();
  ctx.strokeStyle = '#FFFFFF';
  ctx.lineWidth = 4;
  ctx.stroke();

  ctx.font = `900 ${Math.round(size * 0.42)}px "Impact", sans-serif`;
  ctx.fillStyle = '#FFFFFF';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('VS', size / 2, size / 2);

  return canvas;
}
