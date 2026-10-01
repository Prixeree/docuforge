/**
 * ui-kit.js - Shared UI Components, Pickers & Hardware Probing
 * 
 * Features:
 * - Hardware probe banner: VideoEncoder.isConfigSupported()
 * - Clip gallery with thumbnail cards, tag chips, scrub slider & "Random" toggle
 * - Subtitle style selector with live offscreen canvas preview
 * - Audio & music picker (auto/shuffle, tracks, volume, ducking, voices)
 * - LocalStorage preference persistence
 * - Zero-friction default flow (controls collapsed by default)
 */

const STORAGE_KEY = 'docuforge_user_settings';

export const DEFAULT_SETTINGS = {
  quality: 'hd',
  aspectRatio: '9:16',
  clipMode: 'auto', // 'auto' or clip id
  clipOffset: 0,
  subtitlePreset: 'bold-pop',
  subtitleYRatio: 0.75,
  voice: 'bm_george',
  speed: 1.0,
  musicMode: 'auto', // 'auto' or music id or 'none'
  musicVolume: 0.7,
  duckLevel: 0.2,
  transition: 'auto'
};

export function loadSettings() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch (e) {}
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (e) {}
}

/**
 * Hardware Acceleration Probe
 */
export async function probeHardwareEncoding() {
  const tiers = [
    { name: 'Draft (540x960)', width: 540, height: 960, bitrate: 1_500_000, codec: 'avc1.42001f' },
    { name: 'HD (720x1280)', width: 720, height: 1280, bitrate: 3_500_000, codec: 'avc1.4d001f' },
    { name: 'Full HD (1080x1920)', width: 1080, height: 1920, bitrate: 8_000_000, codec: 'avc1.640028' }
  ];

  const results = {};
  if (typeof globalThis.VideoEncoder !== 'function') {
    return { supported: false, message: 'WebCodecs VideoEncoder not available in this browser.' };
  }

  for (const tier of tiers) {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec: tier.codec,
        width: tier.width,
        height: tier.height,
        bitrate: tier.bitrate,
        framerate: 24,
        hardwareAcceleration: 'prefer-hardware',
        avc: { format: 'avc' }
      });
      results[tier.name] = support.supported;
    } catch (e) {
      results[tier.name] = false;
    }
  }

  return { supported: true, tiers: results };
}

/**
 * Creates live preview canvas for subtitle presets
 */
export function renderSubtitlePreview(canvas, presetName) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  // Dark background with gradient
  ctx.fillStyle = '#0F172A';
  ctx.fillRect(0, 0, w, h);

  // Subtitle mock words
  const words = [
    { word: 'CREATE', start: 0, end: 0.4 },
    { word: 'VIRAL', start: 0.4, end: 1.0 },
    { word: 'VIDEOS', start: 1.0, end: 1.5 }
  ];

  // Draw simulation at t = 0.6s (active word: 'VIRAL')
  import('./subtitles.js').then(({ drawKineticSubtitles }) => {
    drawKineticSubtitles(ctx, words, 0.6, w, h, { preset: presetName, yRatio: 0.5 });
  });
}
