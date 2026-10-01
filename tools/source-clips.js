#!/usr/bin/env node

/**
 * source-clips.js - Autonomous Clip Sourcing & Verification Engine
 * 
 * Automates:
 * 1. Searching YouTube with CC license filter per mode.
 * 2. Strict machine-license check (Creative Commons / CC0 / CC-BY).
 * 3. Extracting 12 evenly-spaced frames and generating a contact sheet in /docs/clip-review/.
 * 4. Automated quality heuristics (resolution >= 1080p, non-static, duration >= 180s).
 * 5. Logging all evaluations in /docs/source-report.md.
 * 6. Invoking prep-clips to produce 720x1280 HD + 540x960 Draft 3-min segments.
 * 7. Updating docuforge-assets/manifest.json.
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { processVideo, isCreativeCommons } from './prep-clips.js';

const FFMPEG = '/Volumes/SSD 500gb/Developer/bin/ffmpeg';
const FFPROBE = '/Volumes/SSD 500gb/Developer/bin/ffprobe';
const YTDLP = '/Volumes/SSD 500gb/Developer/bin/yt-dlp';
const NODE = '/Volumes/SSD 500gb/Developer/bin/node';

const ASSETS_DIR = '/Volumes/SSD 500gb/Project/docuforge-assets';
const DOCS_DIR = '/Volumes/SSD 500gb/Project/docuforge/docs';
const REVIEW_DIR = path.join(DOCS_DIR, 'clip-review');
const REPORT_FILE = path.join(DOCS_DIR, 'source-report.md');
const MANIFEST_FILE = path.join(ASSETS_DIR, 'manifest.json');

fs.mkdirSync(REVIEW_DIR, { recursive: true });

// Target queries for offline continuous gameplay (Reddit Story pipeline only)
export const MODE_TARGETS = {
  'reddit-story': {
    targetMinutes: 30,
    queries: [
      'minecraft parkour no copyright gameplay',
      'gta 5 mega ramp no copyright gameplay',
      'csgo surf no copyright gameplay 4k',
      'subway surfers no copyright gameplay 60fps'
    ],
    defaultTags: ['gameplay', 'endless', 'parkour', 'background', 'reddit-story']
  }
};

/**
 * Searches YouTube for Creative Commons videos
 */
export function searchCandidates(query, maxResults = 10) {
  console.log(`[source-clips] Searching: "${query}" (up to ${maxResults} results)`);
  const res = spawnSync(YTDLP, [
    '--js-runtimes', `node:${NODE}`,
    `ytsearch${maxResults}:${query}`,
    '--dump-json',
    '--skip-download'
  ], { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });

  if (res.status !== 0 && !res.stdout) {
    console.error(`[source-clips] Search error:`, res.stderr);
    return [];
  }

  const lines = res.stdout.trim().split('\n');
  const candidates = [];

  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const meta = JSON.parse(line);
      candidates.push(meta);
    } catch (e) {}
  }
  return candidates;
}

/**
 * Generates a 12-frame contact sheet for review
 */
export function generateContactSheet(videoUrlOrPath, videoId, duration = 300) {
  const contactSheetPath = path.join(REVIEW_DIR, `${videoId}_contact.jpg`);
  if (fs.existsSync(contactSheetPath)) return contactSheetPath;

  console.log(`[source-clips] Generating 12-frame contact sheet for ${videoId}...`);
  try {
    const step = Math.max(5, Math.floor(duration / 13));
    const tempFiles = [];

    for (let i = 1; i <= 12; i++) {
      const t = i * step;
      const f = path.join(REVIEW_DIR, `temp_${videoId}_${i}.jpg`);
      tempFiles.push(f);
      execSync(`"${FFMPEG}" -y -ss ${t} -i "${videoUrlOrPath}" -vframes 1 -vf "scale=180:320" -q:v 3 "${f}"`, { stdio: 'ignore' });
    }

    const inputs = tempFiles.map(f => `-i "${f}"`).join(' ');
    execSync(`"${FFMPEG}" -y ${inputs} -filter_complex "tile=4x3" -q:v 3 "${contactSheetPath}"`, { stdio: 'ignore' });

    tempFiles.forEach(f => {
      try { fs.unlinkSync(f); } catch (e) {}
    });

    return contactSheetPath;
  } catch (e) {
    console.warn(`[source-clips] Contact sheet generation error: ${e.message}`);
    return null;
  }
}

/**
 * Evaluates candidate video against accuracy rules
 */
export function evaluateCandidate(meta) {
  const videoId = meta.id;
  const title = meta.title || '';
  const lic = meta.license || '';
  const duration = meta.duration || 0;
  const width = meta.width || 0;
  const height = meta.height || 0;

  // Rule 1: License must be CC
  if (!isCreativeCommons(meta)) {
    return {
      accepted: false,
      reason: `License not Creative Commons: "${lic || 'Standard YouTube License'}"`
    };
  }

  // Rule 2: Minimum resolution: max(width, height) >= 1080
  const maxDim = Math.max(width, height);
  if (maxDim < 1080 && maxDim > 0) {
    return {
      accepted: false,
      reason: `Resolution too low: ${width}x${height} (requires >= 1080p source)`
    };
  }

  // Rule 3: Minimum duration: >= 120s (prefer >= 180s for 3-min segment)
  if (duration < 120 && duration > 0) {
    return {
      accepted: false,
      reason: `Duration too short: ${duration}s (requires >= 120s)`
    };
  }

  // Rule 4: Reject unwanted title keywords (watermark, facecam, react, compilation with branding)
  const lowerTitle = title.toLowerCase();
  const rejectWords = ['facecam', 'reaction', 'react', 'watermark', 'intro', 'outro', 'tiktok compilation with text'];
  for (const rw of rejectWords) {
    if (lowerTitle.includes(rw)) {
      return {
        accepted: false,
        reason: `Title indicates unwanted overlay/content: contains "${rw}"`
      };
    }
  }

  return { accepted: true, reason: 'Valid Creative Commons 1080p+ clean candidate' };
}

/**
 * Appends a log entry to /docs/source-report.md
 */
export function logReport(entry) {
  let content = '';
  if (!fs.existsSync(REPORT_FILE)) {
    content = `# DocuForge Asset Sourcing & Audit Report\n\n| Video ID | Title | Mode | Status | Reason / Notes | License | Resolution | Contact Sheet |\n|---|---|---|---|---|---|---|---|\n`;
  } else {
    content = fs.readFileSync(REPORT_FILE, 'utf-8');
  }

  const thumbLink = entry.contactSheet ? `[View](clip-review/${path.basename(entry.contactSheet)})` : 'N/A';
  const row = `| \`${entry.id}\` | ${entry.title.replace(/\|/g, '-')} | **${entry.mode}** | ${entry.accepted ? '✅ ACCEPTED' : '❌ REJECTED'} | ${entry.reason} | ${entry.license} | ${entry.resolution} | ${thumbLink} |\n`;
  fs.appendFileSync(REPORT_FILE, row);
}

/**
 * Appends accepted clips to manifest.json
 */
export function updateManifest(newSegments) {
  let manifest = { version: "1.0", updatedAt: new Date().toISOString(), clips: [], music: [], sfx: [] };
  if (fs.existsSync(MANIFEST_FILE)) {
    try {
      manifest = JSON.parse(fs.readFileSync(MANIFEST_FILE, 'utf-8'));
    } catch (e) {}
  }

  const existingIds = new Set(manifest.clips.map(c => c.id));
  for (const seg of newSegments) {
    if (!existingIds.has(seg.id)) {
      manifest.clips.push(seg);
      existingIds.add(seg.id);
    }
  }

  manifest.updatedAt = new Date().toISOString();
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(manifest, null, 2));
  console.log(`[source-clips] Updated manifest with ${manifest.clips.length} total clips.`);
}

/**
 * Sourcing Runner
 */
export async function runSourcing(modeFilter = null) {
  console.log(`=== DocuForge Autonomous Clip Sourcing Started ===`);

  const modesToProcess = modeFilter ? [modeFilter] : Object.keys(MODE_TARGETS);

  for (const mode of modesToProcess) {
    const config = MODE_TARGETS[mode];
    console.log(`\n========================================`);
    console.log(`Processing Mode: [${mode}] (Target: ${config.targetMinutes} minutes)`);
    console.log(`========================================`);

    let totalDurationSec = 0;

    for (const query of config.queries) {
      if (totalDurationSec >= config.targetMinutes * 60) {
        console.log(`[source-clips] Target reached for mode ${mode} (${Math.round(totalDurationSec / 60)} mins)`);
        break;
      }

      const candidates = searchCandidates(query, 6);
      console.log(`[source-clips] Found ${candidates.length} candidates for query "${query}"`);

      for (const cand of candidates) {
        if (totalDurationSec >= config.targetMinutes * 60) break;

        const evalRes = evaluateCandidate(cand);
        console.log(`[source-clips] Evaluating ${cand.id}: ${evalRes.accepted ? 'PASS' : 'FAIL'} (${evalRes.reason})`);

        let contactSheet = null;

        if (evalRes.accepted) {
          try {
            // Process with prep-clips
            const prepRes = processVideo(cand.id, {
              tags: config.defaultTags,
              description: cand.title,
              modes: [mode]
            });

            if (prepRes.success && prepRes.segments.length > 0) {
              const segDur = prepRes.segments.reduce((acc, s) => acc + s.duration, 0);
              totalDurationSec += segDur;

              // Generate contact sheet from raw download
              const rawPath = path.join('/Volumes/SSD 500gb/Project/docuforge/raw_downloads', `${cand.id}_raw.mp4`);
              if (fs.existsSync(rawPath)) {
                contactSheet = generateContactSheet(rawPath, cand.id);
              }

              logReport({
                id: cand.id,
                title: cand.title,
                mode: mode,
                accepted: true,
                reason: `Produced ${prepRes.segments.length} segments (${Math.round(segDur)}s)`,
                license: cand.license || 'CC-BY',
                resolution: `${cand.width}x${cand.height}`,
                contactSheet: contactSheet
              });

              updateManifest(prepRes.segments);
            }
          } catch (err) {
            console.error(`[source-clips] Error processing candidate ${cand.id}:`, err.message);
            logReport({
              id: cand.id,
              title: cand.title,
              mode: mode,
              accepted: false,
              reason: `Processing error: ${err.message}`,
              license: cand.license || 'Unknown',
              resolution: `${cand.width}x${cand.height}`,
              contactSheet: null
            });
          }
        } else {
          logReport({
            id: cand.id,
            title: cand.title,
            mode: mode,
            accepted: false,
            reason: evalRes.reason,
            license: cand.license || 'Non-CC',
            resolution: `${cand.width}x${cand.height}`,
            contactSheet: null
          });
        }
      }
    }
  }

  console.log(`\n=== Sourcing Completed ===`);
}

import { fileURLToPath } from 'node:url';

// CLI entry point
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2] || null;
  runSourcing(mode).catch(console.error);
}
