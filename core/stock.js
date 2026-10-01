/**
 * stock.js - Live Stock Video Search & Filtering (Pexels + Pixabay)
 * 
 * Features:
 * - Runtime search for vertical (9:16 portrait) videos across Pexels and Pixabay.
 * - Mode-specific query building combining script keywords and curated visual hints.
 * - Accuracy scoring: keyword matching, duration >= scene length, text/logo rejection.
 * - Resolution selection: HD 720p / 1080p without upscaling.
 * - Cloudflare Worker proxy first, with direct API keys fallback.
 * - Persistent caching in IndexedDB.
 * - Procedural canvas gradient animation fallback when offline, rate-limited, or keys missing.
 * - Attribution metadata collection for legal compliance.
 */

import { dbGet, dbPut } from './storage.js';

export const MODE_STYLE_HINTS = {
  'viral': ['fast', 'dynamic', 'satisfying', 'modern'],
  'explainer': ['geology', 'minerals', 'machinery', 'technology', 'microscope'],
  'myth-vs-fact': ['dark smoke', 'fog', 'storm clouds', 'space', 'mysterious'],
  'quote-motivational': ['nature timelapse', 'clouds', 'forest', 'ocean', 'sunrise', 'slow motion'],
  'quiz-trivia': ['colorful abstract loop', 'neon', 'particles', 'gradient motion'],
  'would-you-rather': ['colorful motion', 'city', 'energetic abstract']
};

/**
 * Stopwords to ignore when extracting keywords
 */
const STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few',
  'for', 'from', 'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself',
  'him', 'himself', 'his', 'how', 'i', 'if', 'in', 'into', 'is', 'isn\'t', 'it', 'its', 'itself',
  'just', 'me', 'more', 'most', 'my', 'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only',
  'or', 'other', 'ought', 'our', 'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should',
  'so', 'some', 'such', 'than', 'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there',
  'these', 'they', 'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was',
  'we', 'were', 'what', 'when', 'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you'
]);

/**
 * Extracts top relevant keywords from raw sentence or topic
 */
export function extractKeywords(text, maxCount = 4) {
  if (!text) return [];
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2 && !STOPWORDS.has(w));

  const freq = new Map();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  return Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxCount)
    .map(e => e[0]);
}

/**
 * Builds optimized search queries for a mode and input text
 */
export function buildModeQuery(mode, textOrKeywords) {
  const hints = MODE_STYLE_HINTS[mode] || ['abstract motion'];
  const keywords = Array.isArray(textOrKeywords) ? textOrKeywords : extractKeywords(textOrKeywords);
  
  // Pick primary keyword + 1-2 mode style terms
  const primary = keywords.slice(0, 2);
  const hintTerm = hints[Math.floor(Math.random() * hints.length)];
  
  const queryParts = [...primary, hintTerm].filter(Boolean);
  return {
    query: queryParts.join(' ').trim() || hintTerm,
    keywords,
    hintTerm
  };
}

/**
 * Evaluates candidate clip accuracy & appropriateness
 */
function scoreClip(clip, keywords = [], minDuration = 5) {
  let score = 0;
  const lowerTitle = (clip.title || '').toLowerCase();
  const lowerTags = (clip.tags || []).map(t => t.toLowerCase()).join(' ');

  // Reject overlays, watermarks, text in video
  const rejectPatterns = ['logo', 'watermark', 'text overlay', 'intro', 'outro', 'subscribe'];
  for (const pat of rejectPatterns) {
    if (lowerTitle.includes(pat) || lowerTags.includes(pat)) {
      return -100; // Disqualify
    }
  }

  // Duration check
  if (clip.duration && clip.duration >= minDuration) {
    score += 30;
  } else if (clip.duration && clip.duration >= (minDuration * 0.7)) {
    score += 10;
  }

  // Keyword overlap
  for (const kw of keywords) {
    if (lowerTitle.includes(kw)) score += 20;
    if (lowerTags.includes(kw)) score += 15;
  }

  // Orientation preference
  if (clip.height > clip.width) {
    score += 40; // True vertical
  }

  return score;
}

/**
 * Selects best video file URL matching target quality without upscaling
 */
function pickPexelsFile(videoFiles, quality = 'hd') {
  if (!videoFiles || videoFiles.length === 0) return null;
  // Filter for MP4
  const mp4s = videoFiles.filter(f => f.file_type === 'video/mp4' && f.link);
  if (mp4s.length === 0) return videoFiles[0];

  // Target dimensions
  const targetH = quality === 'full-hd' ? 1920 : quality === 'draft' ? 960 : 1280;

  // Prefer portrait files where height >= targetH, sorted by closest height
  const portraits = mp4s.filter(f => f.height >= f.width);
  if (portraits.length > 0) {
    portraits.sort((a, b) => Math.abs(a.height - targetH) - Math.abs(b.height - targetH));
    return portraits[0];
  }

  // Fallback to highest quality available
  mp4s.sort((a, b) => (b.height || 0) - (a.height || 0));
  return mp4s[0];
}

export const DEFAULT_PEXELS_KEY = 'D00l45nGUuI75vKZIXCksLpu2hiOJZtFkZ1XADrgLMBykTzTbLqJ57UQ';

/**
 * Fetches from Pexels API (via proxy or direct key)
 */
async function fetchPexels(query, { proxyUrl, apiKey, quality = 'hd' }) {
  try {
    let url = '';
    const headers = {};
    const activeKey = apiKey || DEFAULT_PEXELS_KEY;

    if (proxyUrl) {
      url = `${proxyUrl.replace(/\/+$/, '')}/search?service=pexels&query=${encodeURIComponent(query)}&orientation=portrait&per_page=10`;
    } else if (activeKey) {
      url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&orientation=portrait&per_page=10`;
      headers['Authorization'] = activeKey;
    } else {
      return [];
    }

    const res = await fetch(url, { headers });
    if (!res.ok) return [];

    const data = await res.json();
    const videos = data.videos || [];

    return videos.map(v => {
      const bestFile = pickPexelsFile(v.video_files, quality);
      return {
        id: `pexels-${v.id}`,
        source: 'pexels',
        title: v.url ? v.url.split('/').filter(Boolean).pop() : 'Pexels Video',
        url: bestFile?.link || '',
        thumbnail: v.image || '',
        duration: v.duration || 10,
        width: bestFile?.width || v.width,
        height: bestFile?.height || v.height,
        author: v.user?.name || 'Pexels Creator',
        authorUrl: v.user?.url || 'https://www.pexels.com',
        pageUrl: v.url || 'https://www.pexels.com',
        attribution: `Video by ${v.user?.name || 'Creator'} from Pexels`
      };
    }).filter(c => c.url);
  } catch (err) {
    console.warn('[stock] Pexels fetch error:', err.message);
    return [];
  }
}

/**
 * Fetches from Pixabay API (via proxy or direct key)
 */
async function fetchPixabay(query, { proxyUrl, apiKey, quality = 'hd' }) {
  try {
    let url = '';

    if (proxyUrl) {
      url = `${proxyUrl.replace(/\/+$/, '')}/search?service=pixabay&query=${encodeURIComponent(query)}&orientation=portrait&per_page=10`;
    } else if (apiKey) {
      url = `https://pixabay.com/api/videos/?key=${encodeURIComponent(apiKey)}&q=${encodeURIComponent(query)}&orientation=vertical&video_type=all&per_page=10`;
    } else {
      return [];
    }

    const res = await fetch(url);
    if (!res.ok) return [];

    const data = await res.json();
    const hits = data.hits || [];

    return hits.map(h => {
      const vids = h.videos || {};
      const chosen = (quality === 'full-hd')
        ? (vids.large || vids.medium || vids.small)
        : (quality === 'draft')
        ? (vids.small || vids.tiny || vids.medium)
        : (vids.medium || vids.large || vids.small);

      return {
        id: `pixabay-${h.id}`,
        source: 'pixabay',
        title: h.tags || 'Pixabay Video',
        tags: (h.tags || '').split(',').map(t => t.trim()),
        url: chosen?.url || '',
        thumbnail: h.userImageURL || '',
        duration: h.duration || 10,
        width: chosen?.width || 720,
        height: chosen?.height || 1280,
        author: h.user || 'Pixabay Creator',
        authorUrl: `https://pixabay.com/users/${h.user}-${h.user_id}/`,
        pageUrl: h.pageURL || 'https://pixabay.com',
        attribution: `Video by ${h.user || 'Creator'} from Pixabay`
      };
    }).filter(c => c.url);
  } catch (err) {
    console.warn('[stock] Pixabay fetch error:', err.message);
    return [];
  }
}

/**
 * Main Stock Clip Search Engine
 * 
 * Searches Pexels and Pixabay, applies accuracy scoring, caches in IndexedDB,
 * and returns ranked candidates with procedural fallback if both fail.
 */
export async function searchStockClips(options = {}) {
  const {
    mode = 'viral',
    text = '',
    minDuration = 5,
    quality = 'hd',
    proxyUrl = null,
    apiKeys = {}
  } = options;

  const { query, keywords } = buildModeQuery(mode, text);
  const cacheKey = `stock_${mode}_${query}_${quality}`.replace(/\s+/g, '_');

  // 1. Check IndexedDB
  try {
    const cached = await dbGet('clips', cacheKey);
    if (cached && Array.isArray(cached) && cached.length > 0) {
      return {
        query,
        candidates: cached,
        selected: cached[0],
        isFallback: false
      };
    }
  } catch (e) {
    console.warn('[stock] Cache read error:', e.message);
  }

  // 2. Fetch candidates from Pexels & Pixabay
  let rawCandidates = [];

  // Pexels
  const pexelsResults = await fetchPexels(query, {
    proxyUrl,
    apiKey: apiKeys.pexels,
    quality
  });
  rawCandidates.push(...pexelsResults);

  // Pixabay
  const pixabayResults = await fetchPixabay(query, {
    proxyUrl,
    apiKey: apiKeys.pixabay,
    quality
  });
  rawCandidates.push(...pixabayResults);

  // 3. Score & filter candidates
  const scored = rawCandidates
    .map(c => ({ clip: c, score: scoreClip(c, keywords, minDuration) }))
    .filter(item => item.score >= 0)
    .sort((a, b) => b.score - a.score)
    .map(item => item.clip);

  if (scored.length > 0) {
    // Save in IndexedDB
    try {
      await dbPut('clips', cacheKey, scored);
    } catch (e) {}

    return {
      query,
      candidates: scored,
      selected: scored[0],
      isFallback: false
    };
  }

  // 4. Fallback: Procedural animated gradient backgrounds
  console.warn(`[stock] No stock clips found for query "${query}". Using procedural gradient fallback.`);
  return {
    query,
    candidates: [],
    selected: {
      id: `procedural-${mode}`,
      source: 'procedural',
      title: `${mode} Procedural Motion`,
      isProcedural: true,
      mode: mode,
      duration: minDuration + 5,
      attribution: 'Procedural Canvas Shader (Offline Fallback)'
    },
    isFallback: true,
    warning: 'Stock footage unavailable or rate-limited. Rendered with high-contrast procedural gradient motion.'
  };
}

/**
 * Procedural Canvas Background Renderer (Zero Network Fallback)
 * Generates dynamic animated gradients, color waves, or particle drifts
 */
export function drawProceduralBackground(ctx, mode, time, width, height) {
  const t = time * 0.5;

  let grad;
  if (mode === 'myth-vs-fact') {
    // Dark moody smoke / space
    grad = ctx.createRadialGradient(
      width * (0.5 + 0.2 * Math.sin(t)),
      height * (0.5 + 0.2 * Math.cos(t * 0.7)),
      10,
      width * 0.5,
      height * 0.5,
      height * 0.8
    );
    grad.addColorStop(0, '#1E1B4B');
    grad.addColorStop(0.5, '#0F172A');
    grad.addColorStop(1, '#030712');
  } else if (mode === 'quiz-trivia') {
    // Neon purple-cyan grid vibe
    grad = ctx.createLinearGradient(
      width * Math.sin(t * 0.8),
      0,
      width,
      height * Math.cos(t * 0.8)
    );
    grad.addColorStop(0, '#4C1D95');
    grad.addColorStop(0.5, '#1E1B4B');
    grad.addColorStop(1, '#065F46');
  } else if (mode === 'quote-motivational') {
    // Dawn sunrise / ocean golden hour
    grad = ctx.createLinearGradient(0, height * 0.2, 0, height);
    grad.addColorStop(0, '#0284C7');
    grad.addColorStop(0.4, '#F59E0B');
    grad.addColorStop(0.8, '#D97706');
    grad.addColorStop(1, '#451A03');
  } else if (mode === 'would-you-rather') {
    // Dual contrasting color split
    grad = ctx.createLinearGradient(0, 0, width, height);
    grad.addColorStop(0, '#065F46');
    grad.addColorStop(0.5, '#0F172A');
    grad.addColorStop(1, '#991B1B');
  } else {
    // Viral / Explainer dynamic deep indigo-emerald
    grad = ctx.createLinearGradient(
      width * (0.5 + 0.3 * Math.sin(t)),
      0,
      width * (0.5 - 0.3 * Math.sin(t)),
      height
    );
    grad.addColorStop(0, '#1E293B');
    grad.addColorStop(0.5, '#0F766E');
    grad.addColorStop(1, '#0F172A');
  }

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Subtle floating ambient bokeh circles
  ctx.save();
  ctx.globalAlpha = 0.08;
  for (let i = 0; i < 5; i++) {
    const cx = (width * 0.2) + ((width * 0.6) * ((Math.sin(t * 0.6 + i * 1.5) + 1) / 2));
    const cy = (height * 0.2) + ((height * 0.6) * ((Math.cos(t * 0.4 + i * 2.1) + 1) / 2));
    const r = 80 + i * 40;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
  }
  ctx.restore();
}
