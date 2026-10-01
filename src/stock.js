// /Volumes/SSD 500gb/Project/voicestudio-browser/docuforge/src/stock.js

const clipCache = new Map();
const requestTimestamps = [];

export function clearCache() {
  clipCache.clear();
}

/**
 * Rate limit requests: max 200 per hour, wait 300ms between requests.
 */
async function enforceRateLimit() {
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;
  
  // Remove timestamps older than 1 hour
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - ONE_HOUR) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= 200) {
    const oldest = requestTimestamps[0];
    const waitTime = oldest + ONE_HOUR - now;
    if (waitTime > 0) {
      console.warn(`Rate limit reached. Waiting ${waitTime}ms`);
      await new Promise(r => setTimeout(r, waitTime));
    }
  }

  // 300ms delay between requests
  if (requestTimestamps.length > 0) {
    const lastReq = requestTimestamps[requestTimestamps.length - 1];
    const timeSinceLast = now - lastReq;
    if (timeSinceLast < 300) {
      await new Promise(r => setTimeout(r, 300 - timeSinceLast));
    }
  }

  requestTimestamps.push(Date.now());
}

/**
 * Fetch a stock video clip based on keywords.
 * @param {string[]} keywords 
 * @param {Object} apiKeys 
 * @param {string} [apiKeys.pexels]
 * @param {string} [apiKeys.pixabay]
 * @param {string} [quality='hd']
 * @returns {Promise<{url: string, source: string, id: string, preview: string, width: number, height: number} | null>}
 */
export async function fetchClip(keywords, apiKeys = {}, quality = 'hd') {
  if (!keywords || keywords.length === 0) return null;
  
  const query = keywords.join(' ');
  const cacheKey = keywords.join(',') + quality;

  if (clipCache.has(cacheKey)) {
    return clipCache.get(cacheKey);
  }

  if (!apiKeys.pexels && !apiKeys.pixabay) {
    console.warn('No stock API keys provided');
    return null;
  }

  try {
    let result = null;

    if (apiKeys.pexels) {
      await enforceRateLimit();
      result = await fetchFromPexels(query, apiKeys.pexels, quality);
    }

    if (!result && apiKeys.pixabay) {
      await enforceRateLimit();
      result = await fetchFromPixabay(query, apiKeys.pixabay, quality);
    }

    if (result) {
      clipCache.set(cacheKey, result);
    }

    return result;
  } catch (err) {
    console.warn('Error fetching clip:', err);
    return null;
  }
}

function selectPexelsFile(videoFiles, quality) {
  const mp4s = videoFiles.filter(f => f.file_type === 'video/mp4' && f.width && f.height);
  const maxW = quality === 'fullhd' ? 1920 : quality === 'hd' ? 1280 : 960;
  // Sort by width descending, pick the largest that's <= maxW
  const candidates = mp4s.filter(f => f.width <= maxW).sort((a, b) => b.width - a.width);
  return candidates[0] || mp4s.sort((a, b) => a.width - b.width)[0]; // fallback to smallest if none fit
}

async function fetchFromPexels(query, apiKey, quality) {
  try {
    const url = `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=5`;
    const response = await fetch(url, {
      headers: { Authorization: apiKey }
    });
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const videos = data.videos || [];
    
    if (videos.length === 0) return null;

    for (const video of videos) {
      const files = video.video_files || [];
      const match = selectPexelsFile(files, quality);
      
      if (match) {
        return {
          url: match.link,
          source: 'pexels',
          id: String(video.id),
          preview: video.image || '',
          width: match.width,
          height: match.height
        };
      }
    }
    
    return null;
  } catch (err) {
    console.warn('Pexels API error:', err);
    return null;
  }
}

function selectPixabayVideo(videos, quality) {
  if (quality === 'fullhd') return videos.large || videos.medium || videos.small;
  if (quality === 'hd') return videos.medium || videos.small;
  return videos.small || videos.tiny;
}

async function fetchFromPixabay(query, apiKey, quality) {
  try {
    const url = `https://pixabay.com/api/videos/?key=${apiKey}&q=${encodeURIComponent(query)}&per_page=5&video_type=film`;
    const response = await fetch(url);
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const hits = data.hits || [];
    
    if (hits.length === 0) return null;

    const hit = hits[0];
    const videos = hit.videos || {};
    const vid = selectPixabayVideo(videos, quality);

    if (vid && vid.url) {
      return {
        url: vid.url,
        source: 'pixabay',
        id: String(hit.id),
        preview: hit.userImageURL || '',
        width: vid.width,
        height: vid.height
      };
    }
    return null;
  } catch (err) {
    console.warn('Pixabay API error:', err);
    return null;
  }
}
