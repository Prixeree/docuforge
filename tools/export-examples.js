#!/usr/bin/env node

/**
 * export-examples.js
 * 
 * Headless automation pipeline to export real finished MP4 videos,
 * preview GIFs, and poster images for all 7 DocuForge modes.
 * 
 * Usage:
 *   node tools/export-examples.js [mode]
 * If [mode] is omitted, exports all 7 modes sequentially.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';

const ROOT_DIR = '/Volumes/SSD 500gb/Project/docuforge';
const DEV_SERVER_URL = 'http://localhost:3000/docuforge/';
const CDP_HTTP = 'http://127.0.0.1:9222';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const CHROME_PROFILE = '/Volumes/SSD 500gb/scratch/chrome-profile';
const FFMPEG_BIN = '/Volumes/SSD 500gb/Developer/bin/ffmpeg';

const ALL_MODES = [
  'viral',
  'reddit-story',
  'explainer',
  'myth-vs-fact',
  'quote-motivational',
  'quiz-trivia',
  'would-you-rather'
];

// Per-mode poster timestamps (seconds) to capture the best visual hook/reveal
const POSTER_TIMES = {
  'viral': 2.0,
  'reddit-story': 2.5,
  'explainer': 2.0,
  'myth-vs-fact': 3.0,
  'quote-motivational': 2.0,
  'quiz-trivia': 3.5,
  'would-you-rather': 3.0
};

// Per-mode GIF start timestamps (seconds)
const GIF_START_TIMES = {
  'viral': 1.5,
  'reddit-story': 2.0,
  'explainer': 1.0,
  'myth-vs-fact': 2.0,
  'quote-motivational': 1.0,
  'quiz-trivia': 2.0,
  'would-you-rather': 2.0
};

// Credits metadata templates for each mode
const CREDITS_INFO = {
  'viral': {
    music: {
      title: 'Sneaky Snitch',
      artist: 'Kevin MacLeod',
      source: 'https://incompetech.com',
      license: 'CC-BY 3.0',
      timestamp: '0:00 - End'
    },
    voice: 'bm_george (Kokoro TTS Neural Voice)',
    footage: 'Dynamic Procedural Canvas Shader / Live Stock Footage (Pixabay/Pexels CC0/Content License)',
    sfx: 'CC0 Essential UI Sound Kit'
  },
  'reddit-story': {
    music: {
      title: 'The Descent',
      artist: 'Kevin MacLeod',
      source: 'https://incompetech.com',
      license: 'CC-BY 3.0',
      timestamp: '0:00 - End'
    },
    voice: 'bm_george (Kokoro TTS Neural Voice)',
    footage: 'Minecraft Parkour Gameplay (Segment XBIaqOm0RKQ_00, CC-BY)',
    sfx: 'Whoosh & Riser Transition SFX (CC0)'
  },
  'explainer': {
    music: {
      title: 'Documentary Documentary Music',
      artist: 'Nastelbom',
      source: 'https://pixabay.com/music/',
      license: 'Pixabay Content License (Free for commercial use)',
      timestamp: '0:00 - End'
    },
    voice: 'bm_george (Kokoro TTS Neural Voice)',
    footage: 'Dynamic Deep Emerald Motion / Live Stock Footage',
    sfx: 'Rank pop & whoosh transitions (CC0)'
  },
  'myth-vs-fact': {
    music: {
      title: 'Atmosphere Documentary',
      artist: 'Leberch',
      source: 'https://pixabay.com/music/',
      license: 'Pixabay Content License (Free for commercial use)',
      timestamp: '0:00 - End'
    },
    voice: 'bm_george (Kokoro TTS Neural Voice)',
    footage: 'Moody Atmospheric Nebula / Smoke Motion',
    sfx: 'Buzzer hit, riser, chime reveal (CC0)'
  },
  'quote-motivational': {
    music: {
      title: 'Documentary Calm',
      artist: 'Leberch',
      source: 'https://pixabay.com/music/',
      license: 'Pixabay Content License (Free for commercial use)',
      timestamp: '0:00 - End'
    },
    voice: 'bm_george (Kokoro TTS Neural Voice)',
    footage: 'Dawn Horizon Golden Gradient Motion / Nature B-Roll',
    sfx: 'Subtle ambient hum (CC0)'
  },
  'quiz-trivia': {
    music: {
      title: 'Faster Does It',
      artist: 'Kevin MacLeod',
      source: 'https://incompetech.com',
      license: 'CC-BY 3.0',
      timestamp: '0:00 - End'
    },
    voice: 'bm_george (Kokoro TTS Neural Voice)',
    footage: 'Neon Purple Particle Gradient Motion',
    sfx: 'Clock countdown tick & chime reveal (CC0)'
  },
  'would-you-rather': {
    music: {
      title: 'Carefree',
      artist: 'Kevin MacLeod',
      source: 'https://incompetech.com',
      license: 'CC-BY 3.0',
      timestamp: '0:00 - End'
    },
    voice: 'bm_george (Kokoro TTS Neural Voice)',
    footage: 'Dual Split Cyan/Crimson Gradient Motion',
    sfx: 'Ding & Whoosh reveal SFX (CC0)'
  }
};

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function isPortOpen(url) {
  try {
    const res = await fetch(url);
    return res.ok;
  } catch {
    return false;
  }
}

async function ensureChrome() {
  const isRunning = await isPortOpen(`${CDP_HTTP}/json/version`);
  if (isRunning) {
    console.log('[export] Chrome CDP already available on port 9222.');
    return null;
  }

  console.log('[export] Launching headless Chrome on port 9222...');
  fs.mkdirSync(CHROME_PROFILE, { recursive: true });

  const proc = spawn(CHROME_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    `--user-data-dir=${CHROME_PROFILE}`,
    '--autoplay-policy=no-user-gesture-required',
    '--disable-background-timer-throttling',
    '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding'
  ], {
    stdio: 'ignore',
    detached: true
  });
  proc.unref();

  for (let i = 0; i < 20; i++) {
    await sleep(500);
    if (await isPortOpen(`${CDP_HTTP}/json/version`)) {
      console.log('[export] Chrome launched successfully.');
      return proc;
    }
  }

  throw new Error('Failed to launch headless Chrome within 10 seconds.');
}

async function openPage() {
  console.log(`[export] Creating page target for ${DEV_SERVER_URL}...`);
  const res = await fetch(`${CDP_HTTP}/json/new?${encodeURIComponent(DEV_SERVER_URL)}`, { method: 'PUT' });
  const data = await res.json();
  const wsUrl = data.webSocketDebuggerUrl;
  const targetId = data.id;

  console.log(`[export] Connecting WebSocket to ${wsUrl}...`);
  const ws = new WebSocket(wsUrl);

  let msgId = 1;
  const pending = new Map();

  ws.onmessage = (event) => {
    try {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);
        if (msg.error) {
          reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        } else {
          resolve(msg.result);
        }
      }
    } catch (e) {
      console.error('[export] WS parse error:', e);
    }
  };

  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });

  const send = (method, params = {}) => {
    const id = msgId++;
    return new Promise((resolve, reject) => {
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  };

  // Enable domains
  await send('Page.enable');
  await send('Runtime.enable');

  // Wait for window.runDocuforgePipeline to become available
  console.log('[export] Waiting for DocuForge UI to initialize...');
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try {
      const evalRes = await send('Runtime.evaluate', {
        expression: 'typeof window.runDocuforgePipeline === "function"',
        returnByValue: true
      });
      if (evalRes?.result?.value === true) {
        ready = true;
        break;
      }
    } catch {}
    await sleep(500);
  }

  if (!ready) {
    throw new Error('Timed out waiting for window.runDocuforgePipeline in page.');
  }

  console.log('[export] DocuForge pipeline initialized in browser.');

  return {
    send,
    targetId,
    close: async () => {
      try {
        ws.close();
      } catch {}
      try {
        await fetch(`${CDP_HTTP}/json/close/${targetId}`);
      } catch {}
    }
  };
}

function generatePostProcessing(mode, mp4Path, outDir) {
  const posterPath = path.join(outDir, 'poster.jpg');
  const gifPath = path.join(outDir, 'preview.gif');
  const posterTime = POSTER_TIMES[mode] || 2.0;
  const gifStart = GIF_START_TIMES[mode] || 1.5;

  console.log(`[export] Generating poster.jpg at t=${posterTime}s...`);
  // Extract high-quality frame
  execSync(`"${FFMPEG_BIN}" -y -ss ${posterTime} -i "${mp4Path}" -frames:v 1 -update 1 -q:v 2 "${posterPath}"`, { stdio: 'inherit' });

  console.log(`[export] Generating preview.gif (360px, 12fps, 6s) at t=${gifStart}s...`);
  // Generate crisp 2-pass palette preview GIF (< 3MB)
  const gifFilter = '[0:v] fps=12,scale=360:-1:flags=lanczos,split [a][b];[a] palettegen=max_colors=128:stats_mode=diff [p];[b][p] paletteuse=dither=bayer:bayer_scale=3';
  execSync(`"${FFMPEG_BIN}" -y -ss ${gifStart} -t 6 -i "${mp4Path}" -filter_complex "${gifFilter}" "${gifPath}"`, { stdio: 'inherit' });

  let mp4Stats = fs.statSync(mp4Path);
  if (mp4Stats.size > 8 * 1024 * 1024) {
    console.log(`[export] MP4 size ${(mp4Stats.size / (1024 * 1024)).toFixed(2)} MB > 8MB target. Optimizing with libx264...`);
    const optPath = path.join(outDir, 'example_opt.mp4');
    execSync(`"${FFMPEG_BIN}" -y -i "${mp4Path}" -c:v libx264 -crf 26 -preset fast -c:a copy "${optPath}"`, { stdio: 'inherit' });
    fs.renameSync(optPath, mp4Path);
    mp4Stats = fs.statSync(mp4Path);
    console.log(`[export] Optimized MP4 size: ${(mp4Stats.size / (1024 * 1024)).toFixed(2)} MB`);
  }

  const gifStats = fs.statSync(gifPath);
  const posterStats = fs.statSync(posterPath);

  console.log(`[export] Artifacts generated for ${mode}:`);
  console.log(`  - example.mp4: ${(mp4Stats.size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`  - preview.gif: ${(gifStats.size / (1024 * 1024)).toFixed(2)} MB`);
  console.log(`  - poster.jpg:  ${(posterStats.size / 1024).toFixed(1)} KB`);

  return {
    mp4Size: mp4Stats.size,
    gifSize: gifStats.size,
    posterSize: posterStats.size
  };
}

function writeCredits(mode, outDir, inputData) {
  const creditsFile = path.join(outDir, 'credits.md');
  const info = CREDITS_INFO[mode] || {};

  const content = `# Asset Credits & Attribution: ${mode.toUpperCase()} Mode

All media assets in this demonstration were generated and multiplexed 100% inside the browser using DocuForge.

## Audio & Music
- **Track**: ${info.music?.title || 'Original Background Music'}
- **Artist / Composer**: ${info.music?.artist || 'Unknown'}
- **Source**: [${info.music?.source || 'Public Archive'}](${info.music?.source || '#'})
- **License**: ${info.music?.license || 'CC-BY'}
- **Timeline**: ${info.music?.timestamp || 'Full Video'}

## Neural Voice Synthesis
- **Voice Model**: ${info.voice || 'bm_george'}
- **Engine**: Kokoro ONNX Neural Text-To-Speech (quantized WebAssembly / WebGPU)
- **License**: Apache-2.0 / Open Weights

## Visuals & Footage
- **Visual Source**: ${info.footage || 'Procedural Motion'}
- **Resolution**: 720x1280 (HD 9:16 Vertical)
- **Framerate**: 24 fps
- **Codec**: H.264 (AVC Baseline/Main via WebCodecs)

## Sound Effects (SFX)
- **SFX Kit**: ${info.sfx || 'CC0 Sound Library'}
- **License**: Creative Commons 0 (Public Domain)

---
*Generated automatically by DocuForge Pipeline Runner on ${new Date().toISOString().split('T')[0]}*.
`;

  fs.writeFileSync(creditsFile, content, 'utf8');
  console.log(`[export] Wrote credits to ${creditsFile}`);
}

async function runExport() {
  const requestedMode = process.argv[2];
  const modesToRun = requestedMode ? [requestedMode] : ALL_MODES;

  console.log(`=== DocuForge Example Video Export ===`);
  console.log(`Modes to export: ${modesToRun.join(', ')}`);

  const chromeProc = await ensureChrome();
  const page = await openPage();

  const results = [];

  for (const mode of modesToRun) {
    console.log(`\n========================================`);
    console.log(`▶ Starting Mode: ${mode.toUpperCase()}`);
    console.log(`========================================`);

    const modeDir = path.join(ROOT_DIR, 'examples', mode);
    const inputPath = path.join(modeDir, 'input.json');
    if (!fs.existsSync(inputPath)) {
      console.error(`[export] Input file not found: ${inputPath}`);
      continue;
    }

    const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));

    // Execute in page context
    const execExpression = `
      (async () => {
        try {
          const mode = "${mode}";
          const input = ${JSON.stringify(inputData)};
          const t0 = performance.now();
          
          console.log('[runner] Invoking pipeline for ' + mode + '...');
          const result = await window.runDocuforgePipeline(mode, input, {
            quality: 'hd',
            voice: input.settings?.voice || 'bm_george',
            clip: input.settings?.clip || undefined,
            music: input.settings?.music || 'auto',
            subtitlePreset: input.settings?.subtitlePreset || undefined
          });
          const t1 = performance.now();
          const renderTimeSec = ((t1 - t0) / 1000).toFixed(2);
          
          console.log('[runner] Pipeline finished in ' + renderTimeSec + 's. Posting to dev-server...');
          const resp = await fetch('/api/save-example?mode=' + encodeURIComponent(mode), {
            method: 'POST',
            body: result.blob
          });
          const saveRes = await resp.json();
          
          return {
            success: true,
            duration: result.duration,
            scenesCount: result.scenesCount,
            renderTimeSec,
            blobSize: result.blob.size,
            saveRes
          };
        } catch (err) {
          console.error('[runner] Pipeline error in browser:', err);
          return {
            success: false,
            error: err.message,
            stack: err.stack
          };
        }
      })()
    `;

    const evalResult = await page.send('Runtime.evaluate', {
      expression: execExpression,
      awaitPromise: true,
      returnByValue: true
    });

    const runData = evalResult?.result?.value;
    if (!runData || !runData.success) {
      console.error(`[export] ❌ Error exporting ${mode}:`, runData?.error || evalResult);
      continue;
    }

    console.log(`[export] ✅ Pipeline complete for ${mode}:`);
    console.log(`  - Video Duration: ${runData.duration.toFixed(1)}s`);
    console.log(`  - Scenes: ${runData.scenesCount}`);
    console.log(`  - Render Time: ${runData.renderTimeSec}s`);
    console.log(`  - Raw Blob Size: ${(runData.blobSize / (1024 * 1024)).toFixed(2)} MB`);

    const mp4Path = path.join(modeDir, 'example.mp4');
    if (!fs.existsSync(mp4Path)) {
      console.error(`[export] ❌ Expected saved MP4 not found at ${mp4Path}`);
      continue;
    }

    // Generate poster and GIF with FFmpeg
    const sizes = generatePostProcessing(mode, mp4Path, modeDir);
    writeCredits(mode, modeDir, inputData);

    results.push({
      mode,
      duration: runData.duration,
      renderTime: runData.renderTimeSec,
      scenes: runData.scenesCount,
      ...sizes
    });
  }

  await page.close();

  console.log(`\n======================================================`);
  console.log(`🎉 ALL REQUESTED EXPORTS COMPLETE`);
  console.log(`======================================================`);
  console.table(results.map(r => ({
    Mode: r.mode,
    Duration: `${r.duration.toFixed(1)}s`,
    RenderTime: `${r.renderTime}s`,
    Scenes: r.scenes,
    'MP4 (MB)': (r.mp4Size / (1024 * 1024)).toFixed(2),
    'GIF (MB)': (r.gifSize / (1024 * 1024)).toFixed(2),
    'Poster (KB)': (r.posterSize / 1024).toFixed(1)
  })));
}

runExport().catch(err => {
  console.error('[export] Fatal error:', err);
  process.exit(1);
});
