/**
 * word-timing.js - Character-weighted per-word timestamp engine
 * 
 * Synthesizes per-word timestamps from sentence-level duration timings.
 * Longer words receive proportionally more duration, with punctuation pause weighting.
 */

export function computeWordTimings(sentence, startSeconds, durationSeconds) {
  if (!sentence || typeof sentence !== 'string') return [];
  
  const rawWords = sentence.trim().split(/\s+/).filter(w => w.length > 0);
  if (rawWords.length === 0) return [];
  
  if (rawWords.length === 1) {
    return [{
      word: rawWords[0],
      start: startSeconds,
      end: startSeconds + durationSeconds
    }];
  }

  // Calculate character-based weights
  // Punctuation at end of word gives a small pause weight bonus
  const weights = rawWords.map(word => {
    const cleanLen = word.replace(/[^\p{L}\p{N}]/gu, '').length;
    let weight = Math.max(1, cleanLen);
    
    // Slight pause bonus if word ends with comma, semicolon, dash, or period
    if (/[,\-;:]$/.test(word)) {
      weight += 1.5;
    } else if (/[.!?]$/.test(word)) {
      weight += 2.0;
    }
    return weight;
  });

  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const wordTimings = [];
  let currentStart = startSeconds;

  for (let i = 0; i < rawWords.length; i++) {
    const wordDur = (weights[i] / totalWeight) * durationSeconds;
    const wordEnd = (i === rawWords.length - 1) 
      ? startSeconds + durationSeconds 
      : currentStart + wordDur;

    wordTimings.push({
      word: rawWords[i],
      start: Math.round(currentStart * 1000) / 1000,
      end: Math.round(wordEnd * 1000) / 1000
    });

    currentStart = wordEnd;
  }

  return wordTimings;
}

export function computeAllWordTimings(sentenceTimings) {
  const allWords = [];
  for (const st of sentenceTimings) {
    const words = computeWordTimings(st.text, st.start, st.end - st.start);
    allWords.push(...words);
  }
  return allWords;
}
