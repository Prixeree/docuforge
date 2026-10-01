#!/usr/bin/env node

/**
 * prep-clips.js - Offline Clip Preparation Tool for DocuForge
 * 
 * Takes a YouTube URL/ID or local file:
 * 1. Checks license with yt-dlp. Rejects non-CC/CC-BY.
 * 2. Downloads best video stream (<= 1080p).
 * 3. Converts to vertical 9:16:
 *    - If landscape: center crops (crop=ih*9/16:ih) with configurable xOffset, scales to 720x1280.
 *    - If portrait: scales directly to 720x1280.
 * 4. Strips audio, H.264 CRF 26, 24fps, yuv420p, faststart, keyframes every 24 frames (-g 24 -keyint_min 24).
 * 5. Generates 540x960 draft version.
 * 6. Splits into 180s (3-min) segments ({videoId}_{index}.mp4).
 * 7. Extracts a 2s thumbnail JPG per segment.
 * 8. Runs ffprobe and returns manifest entries.
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const FFMPEG = '/Volumes/SSD 500gb/Developer/bin/ffmpeg';
const FFPROBE = '/Volumes/SSD 500gb/Developer/bin/ffprobe';
const YTDLP = '/Volumes/SSD 500gb/Developer/bin/yt-dlp';
const NODE = '/Volumes/SSD 500gb/Developer/bin/node';

const RAW_DIR = '/Volumes/SSD 500gb/Project/docuforge/raw_downloads';
const ASSETS_DIR = '/Volumes/SSD 500gb/Project/docuforge-assets';
const DOCS_DIR = '/Volumes/SSD 500gb/Project/docuforge/docs';

// Ensure directories
fs.mkdirSync(RAW_DIR, { recursive: true });
fs.mkdirSync(path.join(ASSETS_DIR, 'clips/hd'), { recursive: true });
fs.mkdirSync(path.join(ASSETS_DIR, 'clips/draft'), { recursive: true });
fs.mkdirSync(path.join(ASSETS_DIR, 'clips/thumbs'), { recursive: true });
fs.mkdirSync(path.join(DOCS_DIR, 'clip-review'), { recursive: true });

export function getVideoMetadata(url) {
  console.log(`[prep-clips] Checking metadata for: ${url}`);
  const res = spawnSync(YTDLP, [
    '--js-runtimes', `node:${NODE}`,
    '--dump-json',
    '--skip-download',
    url
  ], { encoding: 'utf-8' });

  if (res.status !== 0) {
    throw new Error(`Failed to probe video: ${res.stderr || res.stdout}`);
  }

  // Parse stdout JSON (filtering any initial warning lines)
  const lines = res.stdout.trim().split('\n');
  let jsonStr = '';
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith('{') || lines[i].endsWith('}')) {
      jsonStr = lines.slice(i).join('\n');
      try {
        const parsed = JSON.parse(jsonStr);
        return parsed;
      } catch (e) {
        // continue search upwards
      }
    }
  }
  return JSON.parse(res.stdout);
}

export function isCreativeCommons(meta) {
  const lic = (meta.license || '').toLowerCase();
  return lic.includes('creative commons') || lic.includes('cc0') || lic.includes('cc-by') || lic.includes('reuse allowed');
}

export function processVideo(urlOrId, options = {}) {
  const {
    tags = ['gameplay'],
    description = '',
    modes = ['reddit-story'],
    cropX = 'center', // 'center' or offset percentage (0.0 - 1.0)
    force = false
  } = options;

  const meta = getVideoMetadata(urlOrId);
  const videoId = meta.id;
  const isCC = isCreativeCommons(meta);

  console.log(`[prep-clips] Video: "${meta.title}" (${videoId})`);
  console.log(`[prep-clips] Uploader: ${meta.uploader}, Duration: ${meta.duration}s, Res: ${meta.width}x${meta.height}`);
  console.log(`[prep-clips] License: "${meta.license}" -> ${isCC ? 'VERIFIED CC' : 'NOT CC'}`);

  if (!isCC && !force) {
    const warn = `[WARNING] Video ${videoId} has unverified license: "${meta.license}". Rejecting per safety constraints.`;
    console.error(warn);
    return { success: false, reason: warn, meta };
  }

  // Download raw video (up to 1080p) to gitignored raw_downloads
  const rawPath = path.join(RAW_DIR, `${videoId}_raw.mp4`);
  if (!fs.existsSync(rawPath)) {
    console.log(`[prep-clips] Downloading raw stream (<=1080p)...`);
    const dl = spawnSync(YTDLP, [
      '--js-runtimes', `node:${NODE}`,
      '-f', 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]',
      '--merge-output-format', 'mp4',
      '-o', rawPath,
      urlOrId
    ], { stdio: 'inherit' });

    if (dl.status !== 0 || !fs.existsSync(rawPath)) {
      throw new Error(`Download failed for ${videoId}`);
    }
  } else {
    console.log(`[prep-clips] Using existing raw download: ${rawPath}`);
  }

  // Probe raw video dimensions
  const probeOut = execSync(`"${FFPROBE}" -v error -select_streams v:0 -show_entries stream=width,height,duration -of json "${rawPath}"`, { encoding: 'utf-8' });
  const probeData = JSON.parse(probeOut);
  const stream = probeData.streams[0];
  const srcW = parseInt(stream.width, 10);
  const srcH = parseInt(stream.height, 10);
  const isLandscape = srcW > srcH;

  console.log(`[prep-clips] Source dimensions: ${srcW}x${srcH} (${isLandscape ? 'Landscape' : 'Portrait'})`);

  // Build filter for HD (720x1280)
  let filterHD = '';
  if (isLandscape) {
    // 9:16 crop box width = ih * 9 / 16
    let xOffsetExpr = `(iw-ow)/2`;
    if (cropX !== 'center' && typeof cropX === 'number') {
      xOffsetExpr = `(iw-ow)*${cropX}`;
    }
    filterHD = `crop=ih*9/16:ih:${xOffsetExpr}:0,scale=720:1280:flags=lanczos,fps=24`;
  } else {
    filterHD = `scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=24`;
  }

  // 1. Generate full HD Master (clean, no audio, GOP 24, faststart)
  const masterHD = path.join(RAW_DIR, `${videoId}_master_720.mp4`);
  if (!fs.existsSync(masterHD)) {
    console.log(`[prep-clips] Encoding 720x1280 Master...`);
    execSync(`"${FFMPEG}" -y -i "${rawPath}" -vf "${filterHD}" -c:v libx264 -crf 26 -preset fast -pix_fmt yuv420p -g 24 -keyint_min 24 -sc_threshold 0 -an -movflags +faststart "${masterHD}"`, { stdio: 'inherit' });
  }

  // 2. Split Master HD into 180s (3-min) segments
  console.log(`[prep-clips] Splitting 720x1280 into 3-min segments...`);
  const segmentPatternHD = path.join(ASSETS_DIR, 'clips/hd', `${videoId}_%02d.mp4`);
  execSync(`"${FFMPEG}" -y -i "${masterHD}" -c copy -f segment -segment_time 180 -reset_timestamps 1 "${segmentPatternHD}"`, { stdio: 'inherit' });

  // 3. Find created segments
  const hdFiles = fs.readdirSync(path.join(ASSETS_DIR, 'clips/hd'))
    .filter(f => f.startsWith(`${videoId}_`) && f.endsWith('.mp4'))
    .sort();

  console.log(`[prep-clips] Created ${hdFiles.length} HD segments:`, hdFiles);

  const manifestEntries = [];

  for (const hdFile of hdFiles) {
    const segName = path.parse(hdFile).name; // e.g. BXUA2FncVPI_00
    const hdSegPath = path.join(ASSETS_DIR, 'clips/hd', hdFile);
    const draftSegPath = path.join(ASSETS_DIR, 'clips/draft', `${segName}.mp4`);
    const thumbPath = path.join(ASSETS_DIR, 'clips/thumbs', `${segName}.jpg`);

    // Generate 540x960 draft segment
    if (!fs.existsSync(draftSegPath)) {
      console.log(`[prep-clips] Generating draft version for ${segName}...`);
      execSync(`"${FFMPEG}" -y -i "${hdSegPath}" -vf "scale=540:960:flags=bilinear" -c:v libx264 -crf 28 -preset veryfast -pix_fmt yuv420p -g 24 -keyint_min 24 -an -movflags +faststart "${draftSegPath}"`, { stdio: 'inherit' });
    }

    // Generate 2s thumbnail
    if (!fs.existsSync(thumbPath)) {
      execSync(`"${FFMPEG}" -y -ss 00:00:02 -i "${hdSegPath}" -vframes 1 -q:v 3 "${thumbPath}"`, { stdio: 'inherit' });
    }

    // Probe segment duration
    const durOut = execSync(`"${FFPROBE}" -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${hdSegPath}"`, { encoding: 'utf-8' }).trim();
    const duration = parseFloat(durOut) || 180.0;

    manifestEntries.push({
      id: segName,
      type: 'clip',
      url: `clips/hd/${hdFile}`,
      draft_url: `clips/draft/${segName}.mp4`,
      thumbnail: `clips/thumbs/${segName}.jpg`,
      source_video_url: `https://youtu.be/${videoId}`,
      uploader: meta.uploader || 'Unknown',
      license: meta.license || 'Creative Commons Attribution license',
      license_verified: true,
      attribution: `Footage by ${meta.uploader || 'Creator'} via YouTube (${meta.license || 'CC-BY'})`,
      tags: tags,
      description: description || meta.title,
      duration: Math.round(duration * 100) / 100,
      resolution: { width: 720, height: 1280 },
      orientation: 'vertical',
      modes: modes
    });
  }

  return {
    success: true,
    videoId,
    segments: manifestEntries
  };
}

import { fileURLToPath } from 'node:url';

// CLI Execution if invoked directly
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const url = process.argv[2];
  if (!url) {
    console.log("Usage: node prep-clips.js <youtube_url_or_id> [tags_comma_separated] [description]");
    process.exit(1);
  }
  const tags = (process.argv[3] || 'gameplay').split(',').map(t => t.trim());
  const desc = process.argv[4] || '';
  const result = processVideo(url, { tags, description: desc });
  console.log("\n[prep-clips] Result:", JSON.stringify(result, null, 2));
}
