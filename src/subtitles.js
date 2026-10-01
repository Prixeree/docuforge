export function createSubtitleCache(segments, width, height) {
  const cache = new Map();
  
  if (!segments || segments.length === 0) return cache;
  
  const maxTextWidth = width - 40;
  
  segments.forEach((segment, index) => {
    // Create an offscreen canvas large enough for up to 2 lines of text
    const canvas = new OffscreenCanvas(width, 100);
    const ctx = canvas.getContext('2d', { alpha: true });
    
    ctx.font = '22px sans-serif';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    
    const words = segment.text.split(' ');
    let lines = [];
    let currentLine = words[0];
    
    for (let i = 1; i < words.length; i++) {
      const word = words[i];
      const measure = ctx.measureText(currentLine + ' ' + word);
      if (measure.width < maxTextWidth) {
        currentLine += ' ' + word;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    
    // Draw background bar
    const lineHeight = 30;
    const bgHeight = (lines.length * lineHeight) + 20;
    
    // We'll draw the text centered in the offscreen canvas
    const startY = (100 - bgHeight) / 2;
    
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, startY, width, bgHeight);
    
    // Draw text lines
    ctx.fillStyle = '#FFFFFF';
    lines.forEach((line, i) => {
      ctx.fillText(line, width / 2, startY + 20 + (i * lineHeight));
    });
    
    cache.set(index, canvas);
  });
  
  return cache;
}

export function drawSubtitleAtTime(ctx, cache, segments, currentTime, width, height) {
  if (!segments || segments.length === 0) return;
  
  // Find which segment is active
  const activeIndex = segments.findIndex(s => currentTime >= s.start && currentTime <= s.end);
  
  if (activeIndex !== -1 && cache.has(activeIndex)) {
    const subCanvas = cache.get(activeIndex);
    // Draw 40px from the bottom
    ctx.drawImage(subCanvas, 0, height - 100 - 40);
  }
}
