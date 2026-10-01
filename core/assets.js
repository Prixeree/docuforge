/**
 * assets.js - Asset Loading, Caching & Clip Window Slicing
 * 
 * Features:
 * - Manifest retrieval with offline Cache API fallback
 * - Smart clip window selection (random or scrub-slider offset)
 * - HTTP Range request aware HTMLVideoElement pool
 * - Local file override picker
 * - Fallback to alternative clip on fetch failure
 */

const CACHE_NAME = 'docuforge-assets-v1';

export async function loadManifest(manifestUrl = 'assets/manifest.json') {
  try {
    const res = await fetch(manifestUrl, { cache: 'no-cache' });
    if (!res.ok) throw new Error(`HTTP ${res.status} loading manifest`);
    const data = await res.json();
    
    // Cache in Cache API for offline capability
    if ('caches' in globalThis) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(manifestUrl, new Response(JSON.stringify(data)));
    }
    return data;
  } catch (err) {
    console.warn(`[assets] Network manifest load failed, attempting Cache API fallback:`, err.message);
    if ('caches' in globalThis) {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(manifestUrl);
      if (cached) return await cached.json();
    }
    throw err;
  }
}

/**
 * Filters clips by mode, tag, or returns fallback
 */
export function filterClipsByMode(manifest, mode, tags = []) {
  if (!manifest || !manifest.clips) return [];
  
  let matched = manifest.clips.filter(c => c.modes && c.modes.includes(mode));
  
  if (tags && tags.length > 0) {
    const tagSet = new Set(tags.map(t => t.toLowerCase()));
    const tagMatches = matched.filter(c => c.tags && c.tags.some(t => tagSet.has(t.toLowerCase())));
    if (tagMatches.length > 0) return tagMatches;
  }

  return matched.length > 0 ? matched : manifest.clips;
}

/**
 * Computes a playable sub-window inside a 3-minute clip segment
 */
export function selectClipWindow(clip, durationNeeded, explicitOffset = null) {
  const clipDur = clip.duration || 180.0;
  
  if (explicitOffset !== null && !isNaN(explicitOffset)) {
    const start = Math.max(0, Math.min(clipDur - 0.5, explicitOffset));
    return {
      clipId: clip.id,
      url: clip.url,
      draftUrl: clip.draft_url || clip.url,
      startTime: start,
      duration: Math.min(durationNeeded, clipDur - start),
      needsChain: (start + durationNeeded) > clipDur
    };
  }

  // Random offset with 2s margin from tail
  const maxStart = Math.max(0, clipDur - durationNeeded - 2.0);
  const randomStart = Math.random() * maxStart;

  return {
    clipId: clip.id,
    url: clip.url,
    draftUrl: clip.draft_url || clip.url,
    startTime: Math.round(randomStart * 10) / 10,
    duration: durationNeeded,
    needsChain: (randomStart + durationNeeded) > clipDur
  };
}

/**
 * Creates and loads an HTMLVideoElement configured for fast range streaming
 */
export function createRangeVideo(url) {
  const video = document.createElement('video');
  video.crossOrigin = 'anonymous';
  video.preload = 'metadata'; // Load only headers and duration first
  video.playsInline = true;
  video.muted = true;
  video.src = url;
  return video;
}

/**
 * Seeks a video element to a specific timestamp and resolves when frame is ready
 */
export function seekVideoFrame(video, timestamp) {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      resolve(video);
    };
    const onError = (e) => {
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      reject(new Error(`Failed to seek video to ${timestamp}: ${e.message}`));
    };

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError, { once: true });
    video.currentTime = timestamp;
  });
}
