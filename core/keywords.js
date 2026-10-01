/**
 * keywords.js - Zero-Dependency Keyword & Noun Extractor
 * 
 * Works completely offline without API keys.
 * Uses a curated stopword set and term frequency to determine dominant concepts.
 */

const STOPWORDS = new Set([
  'the', 'is', 'are', 'was', 'were', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'can', 'may', 'might', 'shall', 'a', 'an',
  'this', 'that', 'these', 'those', 'it', 'its', 'i', 'you', 'he', 'she', 'we',
  'they', 'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'our', 'their',
  'not', 'no', 'but', 'or', 'and', 'if', 'then', 'so', 'as', 'at', 'by', 'for',
  'from', 'in', 'of', 'on', 'to', 'with', 'about', 'into', 'through', 'during',
  'before', 'after', 'above', 'below', 'between', 'under', 'over', 'out', 'up',
  'down', 'off', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other',
  'some', 'such', 'only', 'very', 'just', 'also', 'than', 'too', 'much', 'many',
  'here', 'there', 'when', 'where', 'while', 'how', 'what', 'which', 'who', 'whom',
  'why', 'been', 'being', 'be', 'am', 'get', 'got', 'go', 'went', 'make', 'made',
  'take', 'took', 'see', 'saw', 'know', 'think', 'say', 'said', 'tell', 'told',
  'find', 'found', 'let', 'put', 'still', 'even', 'well', 'back', 'now', 'way',
  'like', 'time', 'one', 'two', 'look', 'people', 'day', 'thing', 'man', 'world',
  'life', 'hand', 'part', 'again', 'new', 'first', 'last', 'great', 'good', 'old'
]);

export function extractKeywords(text, count = 2) {
  if (!text || typeof text !== 'string') return ['footage', 'visual'];

  const words = text.toLowerCase().match(/\b[\p{L}]{4,}\b/gu) || [];
  const filtered = words.filter(w => !STOPWORDS.has(w));

  const freq = new Map();
  for (const w of filtered) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  const sorted = Array.from(freq.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0].length - a[0].length;
  });

  const top = sorted.slice(0, count).map(e => e[0]);
  return top.length > 0 ? top : ['documentary', 'background'];
}

export function parseParagraphScenes(text) {
  if (!text) return [];
  const paras = text.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  return paras.map((p, idx) => ({
    id: `scene_${idx + 1}`,
    index: idx,
    text: p,
    keywords: extractKeywords(p, 2)
  }));
}
