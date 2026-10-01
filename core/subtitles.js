/**
 * subtitles.js - DocuForge Kinetic Subtitle Engine
 * 
 * Supports:
 * - Word-by-word active timing with bounce/scale animations
 * - Presets: 'bold-pop', 'classic', 'handwritten'
 * - Pre-computed word layout geometries for 60fps canvas blitting
 * - Zero ctx.filter or getImageData in the render loop
 */

export const SUBTITLE_PRESETS = {
  'bold-pop': {
    name: 'Bold Pop',
    fontFamily: '"Impact", "Arial Black", "Montserrat", sans-serif',
    fontWeight: '900',
    fontSize: 44,
    textTransform: 'uppercase',
    inactiveColor: '#FFFFFF',
    activeColor: '#FFE600',       // Electric yellow
    strokeColor: '#000000',
    strokeWidth: 8,
    activeScale: 1.15,
    pillBg: false
  },
  'classic': {
    name: 'Classic Pill',
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    fontWeight: '700',
    fontSize: 34,
    textTransform: 'none',
    inactiveColor: '#E2E8F0',
    activeColor: '#38BDF8',       // Sky blue
    strokeColor: 'rgba(0,0,0,0.5)',
    strokeWidth: 4,
    activeScale: 1.05,
    pillBg: true,
    pillColor: 'rgba(15, 23, 42, 0.78)'
  },
  'handwritten': {
    name: 'Handwritten',
    fontFamily: '"Caveat", "Dancing Script", "Brush Script MT", cursive',
    fontWeight: '700',
    fontSize: 48,
    textTransform: 'none',
    inactiveColor: '#FFFDF0',
    activeColor: '#F59E0B',       // Amber gold
    strokeColor: '#1E1B18',
    strokeWidth: 5,
    activeScale: 1.1,
    pillBg: false
  }
};

/**
 * Pre-computes line wraps and word bounding boxes for a set of words in a sentence
 */
export function layoutSubtitleWords(words, ctx, canvasWidth, presetConfig) {
  const maxLineWidth = canvasWidth * 0.88;
  const lines = [];
  let currentLine = [];
  let currentLineWidth = 0;

  const fontStr = `${presetConfig.fontWeight || '700'} ${presetConfig.fontSize || 38}px ${presetConfig.fontFamily}`;
  ctx.font = fontStr;

  for (const item of words) {
    const displayText = (presetConfig.textTransform === 'uppercase') 
      ? item.word.toUpperCase() 
      : item.word;
    
    const wordWidth = ctx.measureText(displayText + ' ').width;

    if (currentLineWidth + wordWidth > maxLineWidth && currentLine.length > 0) {
      lines.push({ words: currentLine, totalWidth: currentLineWidth });
      currentLine = [];
      currentLineWidth = 0;
    }

    currentLine.push({
      ...item,
      displayText,
      width: wordWidth
    });
    currentLineWidth += wordWidth;
  }

  if (currentLine.length > 0) {
    lines.push({ words: currentLine, totalWidth: currentLineWidth });
  }

  return lines;
}

/**
 * Draws kinetic word-by-word subtitles at the given timestamp
 */
export function drawKineticSubtitles(ctx, wordList, currentTime, width, height, options = {}) {
  if (!wordList || wordList.length === 0) return;

  const presetName = options.preset || 'bold-pop';
  const preset = SUBTITLE_PRESETS[presetName] || SUBTITLE_PRESETS['bold-pop'];
  const yRatio = options.yRatio ?? 0.75;
  const centerY = height * yRatio;

  // Find currently visible window of words (active sentence or grouping within ±2.5s)
  const activeWordIdx = wordList.findIndex(w => currentTime >= w.start && currentTime <= w.end);
  if (activeWordIdx === -1 && (currentTime < wordList[0].start || currentTime > wordList[wordList.length - 1].end + 0.3)) {
    return; // No active subtitles in this window
  }

  // Anchor window to 4-7 words around current speech
  const refIdx = activeWordIdx !== -1 ? activeWordIdx : wordList.findIndex(w => w.start > currentTime);
  const startIdx = Math.max(0, (refIdx !== -1 ? refIdx : wordList.length - 1) - 2);
  const endIdx = Math.min(wordList.length, startIdx + 6);
  const currentChunk = wordList.slice(startIdx, endIdx);

  if (currentChunk.length === 0) return;

  ctx.save();
  const fontStr = `${preset.fontWeight} ${preset.fontSize}px ${preset.fontFamily}`;
  ctx.font = fontStr;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.miterLimit = 2;

  const lines = layoutSubtitleWords(currentChunk, ctx, width, preset);
  const lineHeight = preset.fontSize * 1.35;
  const totalBlockHeight = lines.length * lineHeight;
  let lineStartY = centerY - (totalBlockHeight / 2);

  for (const line of lines) {
    let wordStartX = (width - line.totalWidth) / 2;

    // Optional background pill for classic preset
    if (preset.pillBg) {
      const paddingH = 20;
      const paddingV = 10;
      ctx.fillStyle = preset.pillColor;
      ctx.beginPath();
      ctx.roundRect(
        wordStartX - paddingH,
        lineStartY - (lineHeight / 2) - (paddingV / 2),
        line.totalWidth + (paddingH * 2),
        lineHeight + paddingV,
        14
      );
      ctx.fill();
    }

    for (const w of line.words) {
      const isActive = currentTime >= w.start && currentTime <= w.end;
      const hasPassed = currentTime > w.end;

      ctx.save();
      const wordCenterX = wordStartX + (w.width / 2);
      const wordCenterY = lineStartY;

      if (isActive) {
        // Elastic scale pop
        const progress = Math.min(1.0, (currentTime - w.start) / Math.max(0.01, w.end - w.start));
        const scale = 1.0 + (preset.activeScale - 1.0) * Math.sin(progress * Math.PI);

        ctx.translate(wordCenterX, wordCenterY);
        ctx.scale(scale, scale);
        ctx.translate(-wordCenterX, -wordCenterY);

        ctx.fillStyle = preset.activeColor;
      } else {
        ctx.fillStyle = hasPassed ? preset.inactiveColor : 'rgba(255,255,255,0.7)';
      }

      // Stroke outline
      if (preset.strokeWidth > 0) {
        ctx.strokeStyle = preset.strokeColor;
        ctx.lineWidth = preset.strokeWidth;
        ctx.strokeText(w.displayText, wordStartX, lineStartY);
      }

      // Fill text
      ctx.fillText(w.displayText, wordStartX, lineStartY);
      ctx.restore();

      wordStartX += w.width;
    }

    lineStartY += lineHeight;
  }

  ctx.restore();
}
