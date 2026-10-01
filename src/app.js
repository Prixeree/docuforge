/**
 * app.js - DocuForge Application Controller & Pipeline Orchestrator
 */

import { probeHardwareEncoding, loadSettings, saveSettings } from '../core/ui-kit.js';
import { loadManifest, filterClipsByMode, selectClipWindow, createRangeVideo, seekVideoFrame } from '../core/assets.js';
import { initTTS, generateAllScenes } from '../core/tts.js';
import { processVoiceChain, mixAudio, encodeAAC } from '../core/audio.js';
import { createMuxer, addVideoChunk, addAudioChunk, finalizeMuxer } from '../core/mux.js';

// Mode Generators
import { parseViralInput, buildViralSceneGraph } from '../modes/viral/mode.js';
import { parseRedditInput, buildRedditSceneGraph } from '../modes/reddit-story/mode.js';
import { parseExplainerInput, buildExplainerSceneGraph } from '../modes/explainer/mode.js';
import { parseMythInput, buildMythSceneGraph } from '../modes/myth-vs-fact/mode.js';
import { parseQuoteInput, buildQuoteSceneGraph } from '../modes/quote-motivational/mode.js';
import { parseQuizInput, buildQuizSceneGraph } from '../modes/quiz-trivia/mode.js';
import { parseWouldYouRatherInput, buildWouldYouRatherSceneGraph } from '../modes/would-you-rather/mode.js';

let currentMode = 'viral';
let manifest = null;
let selectedClipId = 'auto';

const MODE_CONFIGS = {
  'viral': {
    title: '⚡ Viral Facts & Hooks',
    hint: 'Target: 15-45s • 9:16 Vertical',
    defaultSubtitle: 'bold-pop',
    defaultMusic: 'music/kevin-macleod-sneaky-snitch.mp3',
    renderForm: () => `
      <div class="form-group">
        <label>Hook (Opening Line)</label>
        <input type="text" id="viral-hook" value="Did you know this insane fact about honey?">
      </div>
      <div class="form-group">
        <label>Facts (One per line)</label>
        <textarea id="viral-facts">Scientists discovered that raw honey never ever spoils even after 3,000 years.
Archaeologists in Egypt opened ancient pharaoh tombs and found still-edible honey pots.</textarea>
      </div>
      <div class="form-group">
        <label>Call to Action</label>
        <input type="text" id="viral-cta" value="Follow for more mind-blowing discoveries!">
      </div>
    `,
    getData: () => ({
      hook: document.getElementById('viral-hook').value,
      facts: document.getElementById('viral-facts').value.split('\n').filter(Boolean),
      cta: document.getElementById('viral-cta').value
    }),
    buildGraph: buildViralSceneGraph
  },
  'reddit-story': {
    title: '💬 Dramatic Reddit Story',
    hint: 'Target: 60-180s • 9:16 Vertical',
    defaultSubtitle: 'bold-pop',
    defaultMusic: 'music/kevin-macleod-the-descent.mp3',
    renderForm: () => `
      <div class="grid-2">
        <div class="form-group">
          <label>Subreddit</label>
          <input type="text" id="reddit-sub" value="r/tifu">
        </div>
        <div class="form-group">
          <label>Username</label>
          <input type="text" id="reddit-user" value="u/throwaway_curious">
        </div>
      </div>
      <div class="form-group">
        <label>Story Title</label>
        <input type="text" id="reddit-title" value="I accidentally won an international trivia contest I never signed up for">
      </div>
      <div class="form-group">
        <label>Story Text (Paragraphs become scenes)</label>
        <textarea id="reddit-story">It all started when I was waiting at an airport terminal during a six-hour delay. A random notification popped up on my phone asking for a quiz participant.
Thinking it was just a mobile game ad, I breezed through thirty impossible history questions in under two minutes.
An hour later, two airport security guards approached me with a microphone and a giant cardboard check.</textarea>
      </div>
    `,
    getData: () => ({
      subreddit: document.getElementById('reddit-sub').value,
      username: document.getElementById('reddit-user').value,
      title: document.getElementById('reddit-title').value,
      story: document.getElementById('reddit-story').value,
      upvotes: '28.4k',
      comments: '1.9k'
    }),
    buildGraph: buildRedditSceneGraph
  },
  'explainer': {
    title: '📚 Explainer / Top List',
    hint: 'Target: 20-60s • 9:16 Vertical',
    defaultSubtitle: 'classic',
    defaultMusic: 'music/nastelbom-documentary-documentary-music-606698.mp3',
    renderForm: () => `
      <div class="form-group">
        <label>List Title</label>
        <input type="text" id="exp-title" value="Top 3 Deadliest Natural Formations on Earth">
      </div>
      <div class="form-group">
        <label>Rank 3</label>
        <input type="text" id="exp-r3" value="The Danakil Depression in Ethiopia features boiling acid lakes and toxic sulfur vents.">
      </div>
      <div class="form-group">
        <label>Rank 2</label>
        <input type="text" id="exp-r2" value="Lake Natron in Tanzania has alkaline water so caustic it can calcify wildlife into stone.">
      </div>
      <div class="form-group">
        <label>Rank 1</label>
        <input type="text" id="exp-r1" value="Mount Nyiragongo houses the largest and fastest-moving molten lava lake in recorded history.">
      </div>
    `,
    getData: () => ({
      title: document.getElementById('exp-title').value,
      items: [
        { rank: 3, name: 'Danakil', line: document.getElementById('exp-r3').value },
        { rank: 2, name: 'Natron', line: document.getElementById('exp-r2').value },
        { rank: 1, name: 'Nyiragongo', line: document.getElementById('exp-r1').value }
      ]
    }),
    buildGraph: buildExplainerSceneGraph
  },
  'myth-vs-fact': {
    title: '⚔️ Myth vs Fact',
    hint: 'Target: 30-45s • 9:16 Vertical',
    defaultSubtitle: 'bold-pop',
    defaultMusic: 'music/leberch-atmosphere-documentary-603152.mp3',
    renderForm: () => `
      <div class="form-group">
        <label>Myth (Red Warning Phase)</label>
        <input type="text" id="mvf-myth" value="Humans only use ten percent of their brain capacity.">
      </div>
      <div class="form-group">
        <label>Fact (Emerald Checkmark Phase)</label>
        <input type="text" id="mvf-fact" value="Brain scans prove you use virtually one hundred percent of your brain throughout the day.">
      </div>
      <div class="form-group">
        <label>Explanation</label>
        <textarea id="mvf-exp">Neurological imaging shows that even while sleeping or resting, almost every region of the human brain remains actively firing.</textarea>
      </div>
    `,
    getData: () => ({
      myth: document.getElementById('mvf-myth').value,
      fact: document.getElementById('mvf-fact').value,
      explanation: document.getElementById('mvf-exp').value
    }),
    buildGraph: buildMythSceneGraph
  },
  'quote-motivational': {
    title: '📜 Quote & Stoic Wisdom',
    hint: 'Target: 20-40s • 9:16 Vertical',
    defaultSubtitle: 'handwritten',
    defaultMusic: 'music/leberch-documentary-calm-603945.mp3',
    renderForm: () => `
      <div class="form-group">
        <label>Quote Text</label>
        <textarea id="quote-text">You have power over your mind, not outside events. Realize this, and you will find strength.</textarea>
      </div>
      <div class="form-group">
        <label>Author</label>
        <input type="text" id="quote-author" value="Marcus Aurelius">
      </div>
    `,
    getData: () => ({
      quote: document.getElementById('quote-text').value,
      author: document.getElementById('quote-author').value
    }),
    buildGraph: buildQuoteSceneGraph
  },
  'quiz-trivia': {
    title: '❓ Quiz & Interactive Trivia',
    hint: 'Target: 25-40s • 9:16 Vertical',
    defaultSubtitle: 'bold-pop',
    defaultMusic: 'music/kevin-macleod-faster-does-it.mp3',
    renderForm: () => `
      <div class="form-group">
        <label>Question</label>
        <input type="text" id="quiz-q" value="Which planet in our solar system has the shortest day?">
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Option A</label>
          <input type="text" id="quiz-opt-0" value="Earth">
        </div>
        <div class="form-group">
          <label>Option B</label>
          <input type="text" id="quiz-opt-1" value="Mars">
        </div>
        <div class="form-group">
          <label>Option C (Correct)</label>
          <input type="text" id="quiz-opt-2" value="Jupiter">
        </div>
        <div class="form-group">
          <label>Option D</label>
          <input type="text" id="quiz-opt-3" value="Venus">
        </div>
      </div>
      <div class="form-group">
        <label>Fun Fact (Reveal Explanation)</label>
        <input type="text" id="quiz-fact" value="Jupiter rotates so rapidly that one complete day lasts just under 10 hours!">
      </div>
    `,
    getData: () => ({
      question: document.getElementById('quiz-q').value,
      options: [
        document.getElementById('quiz-opt-0').value,
        document.getElementById('quiz-opt-1').value,
        document.getElementById('quiz-opt-2').value,
        document.getElementById('quiz-opt-3').value
      ],
      correctIndex: 2,
      funFact: document.getElementById('quiz-fact').value
    }),
    buildGraph: buildQuizSceneGraph
  },
  'would-you-rather': {
    title: '⚖️ Would You Rather',
    hint: 'Target: 25-40s • 9:16 Vertical',
    defaultSubtitle: 'bold-pop',
    defaultMusic: 'music/kevin-macleod-carefree.mp3',
    renderForm: () => `
      <div class="form-group">
        <label>Option A (Top Cyan Card)</label>
        <input type="text" id="wyr-a" value="Travel 100 years into the future with no return ticket">
      </div>
      <div class="form-group">
        <label>Option B (Bottom Red Card)</label>
        <input type="text" id="wyr-b" value="Travel 100 years into the past with all your modern memories">
      </div>
      <div class="grid-2">
        <div class="form-group">
          <label>Community Vote % for A</label>
          <input type="number" id="wyr-vote-a" value="64" min="0" max="100">
        </div>
        <div class="form-group">
          <label>Community Vote % for B</label>
          <input type="number" id="wyr-vote-b" value="36" min="0" max="100">
        </div>
      </div>
    `,
    getData: () => ({
      optionA: document.getElementById('wyr-a').value,
      optionB: document.getElementById('wyr-b').value,
      voteA: parseInt(document.getElementById('wyr-vote-a').value, 10) || 50,
      voteB: parseInt(document.getElementById('wyr-vote-b').value, 10) || 50
    }),
    buildGraph: buildWouldYouRatherSceneGraph
  }
};

async function initApp() {
  // Probe Hardware
  const hw = await probeHardwareEncoding();
  const banner = document.getElementById('hw-banner');
  if (hw.supported) {
    banner.style.display = 'none';
  } else {
    banner.textContent = hw.message || 'WebCodecs hardware acceleration probe reported limited support.';
  }

  // Load Manifest
  try {
    manifest = await loadManifest('../docuforge-assets/manifest.json');
    renderGallery(manifest.clips || []);
  } catch (err) {
    console.warn('Manifest load failed:', err.message);
  }

  // Set up Tabs
  const tabs = document.querySelectorAll('.mode-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      switchMode(tab.dataset.mode);
    });
  });

  switchMode('viral');

  // Wire Generate Button
  document.getElementById('btn-generate-main').addEventListener('click', handleGenerate);
}

function switchMode(mode) {
  currentMode = mode;
  const cfg = MODE_CONFIGS[mode];
  if (!cfg) return;

  document.getElementById('mode-title').textContent = cfg.title;
  document.getElementById('mode-duration-hint').textContent = cfg.hint;
  document.getElementById('mode-fields').innerHTML = cfg.renderForm();
  document.getElementById('sub-preset').value = cfg.defaultSubtitle;
  document.getElementById('music-select').value = cfg.defaultMusic;
}

function renderGallery(clips) {
  const container = document.getElementById('clip-gallery');
  if (!container) return;

  let html = `
    <div class="clip-card selected" data-id="auto">
      <div style="height:120px;display:flex;align-items:center;justify-content:center;background:#1E293B;color:#38BDF8;font-weight:700;font-size:0.85rem;">
        ✨ AUTO (Mode Best)
      </div>
      <div class="clip-info">Auto Selection</div>
    </div>
  `;

  for (const c of clips) {
    html += `
      <div class="clip-card" data-id="${c.id}">
        <img src="../docuforge-assets/${c.thumbnail}" alt="${c.id}" loading="lazy">
        <div class="clip-info">${c.id} (${Math.round(c.duration)}s)</div>
      </div>
    `;
  }

  container.innerHTML = html;

  container.querySelectorAll('.clip-card').forEach(card => {
    card.addEventListener('click', () => {
      container.querySelectorAll('.clip-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      selectedClipId = card.dataset.id;
    });
  });
}

function updateProgress(percent, statusText) {
  const box = document.getElementById('progress-box');
  const bar = document.getElementById('progress-bar-fill');
  const text = document.getElementById('progress-status-text');

  box.style.display = 'block';
  bar.style.width = `${Math.round(percent * 100)}%`;
  if (statusText) text.textContent = statusText;
}

async function handleGenerate() {
  const btn = document.getElementById('btn-generate-main');
  btn.disabled = true;

  try {
    const cfg = MODE_CONFIGS[currentMode];
    const data = cfg.getData();

    updateProgress(0.1, 'Step 1/5: Synthesizing Neural Voiceover...');

    // 1. Text-to-Speech
    await initTTS();
    let textToVoice = '';
    if (currentMode === 'viral') textToVoice = `${data.hook}. ${data.facts.join('. ')}. ${data.cta}`;
    else if (currentMode === 'reddit-story') textToVoice = data.story;
    else if (currentMode === 'explainer') textToVoice = data.items.map(i => i.line).join('. ');
    else if (currentMode === 'myth-vs-fact') textToVoice = `Myth: ${data.myth}. Fact: ${data.fact}. ${data.explanation}`;
    else if (currentMode === 'quote-motivational') textToVoice = `"${data.quote}" said by ${data.author}`;
    else if (currentMode === 'quiz-trivia') textToVoice = `${data.question}. ${data.funFact}`;
    else if (currentMode === 'would-you-rather') textToVoice = `Would you rather ${data.optionA}, or would you rather ${data.optionB}?`;

    const voice = document.getElementById('voice-select').value;
    const sceneParts = [{ text: textToVoice }];
    const ttsResults = await generateAllScenes(sceneParts, { voice });
    const audioData = ttsResults[0];

    updateProgress(0.35, 'Step 2/5: Processing Voice DSP & Background Music...');

    // 2. Select Clip
    const clips = filterClipsByMode(manifest, currentMode);
    const chosenClip = (selectedClipId !== 'auto') 
      ? (manifest.clips.find(c => c.id === selectedClipId) || clips[0])
      : clips[Math.floor(Math.random() * clips.length)];

    const clipWindow = selectClipWindow(chosenClip, audioData.duration + 2.0);

    // 3. Audio Mix & Ducking
    const processedVoice = await processVoiceChain(audioData.samples, audioData.sampleRate);
    
    let musicBuf = null;
    const musicChoice = document.getElementById('music-select').value;
    if (musicChoice !== 'none') {
      const musicPath = (musicChoice === 'auto') ? cfg.defaultMusic : musicChoice;
      try {
        const musicResp = await fetch(`../docuforge-assets/${musicPath}`);
        const musicArray = await musicResp.arrayBuffer();
        const actx = new (window.AudioContext || window.webkitAudioContext)();
        musicBuf = await actx.decodeAudioData(musicArray);
      } catch (e) {
        console.warn('Music load failed, continuing without music:', e.message);
      }
    }

    const { mixedBuffer } = await mixAudio([processedVoice], musicBuf, [], {
      duckLevel: 0.2,
      sceneGap: 0.4
    });

    const audioChunks = await encodeAAC(mixedBuffer);

    updateProgress(0.55, 'Step 3/5: Building Declarative Scene Graph...');

    // 4. Build Scene Graph
    const quality = document.getElementById('quality-select').value;
    const width = quality === 'draft' ? 540 : 720;
    const height = quality === 'draft' ? 960 : 1280;

    const graph = cfg.buildGraph(data, audioData, clipWindow, {
      width,
      height,
      quality,
      subtitlePreset: document.getElementById('sub-preset').value
    });

    updateProgress(0.70, 'Step 4/5: Offline Video Encoding (WebCodecs)...');

    // 5. Video Rendering Worker
    const videoChunks = [];
    const renderWorker = new Worker(new URL('../core/render.worker.js', import.meta.url), { type: 'module' });

    await new Promise((resolve, reject) => {
      renderWorker.onmessage = async (e) => {
        if (e.data.type === 'ready') {
          // Prepare background video element
          const videoEl = createRangeVideo(`../docuforge-assets/${graph.scenes[0].layers[0].src}`);
          await new Promise(r => videoEl.onloadedmetadata = r);

          for (let i = 0; i < graph.scenes.length; i++) {
            const sc = graph.scenes[i];
            await seekVideoFrame(videoEl, sc.layers[0].startTime);
            const bitmap = await createImageBitmap(videoEl);

            renderWorker.postMessage({
              type: 'render-scene',
              sceneIndex: i,
              totalScenes: graph.scenes.length,
              scene: sc,
              bitmap,
              subtitleWords: sc.layers.find(l => l.type === 'subtitles')?.words || [],
              subtitlePreset: document.getElementById('sub-preset').value
            }, [bitmap]);
          }

          renderWorker.postMessage({ type: 'finalize' });
        } else if (e.data.type === 'video-chunk') {
          videoChunks.push(e.data);
        } else if (e.data.type === 'progress') {
          const frac = 0.70 + (e.data.sceneIndex / graph.scenes.length) * 0.25;
          updateProgress(frac, `Encoding Scene ${e.data.sceneIndex + 1}/${graph.scenes.length}...`);
        } else if (e.data.type === 'finalized') {
          resolve();
        } else if (e.data.type === 'error') {
          reject(new Error(e.data.message));
        }
      };

      renderWorker.postMessage({
        type: 'init',
        width,
        height,
        fps: 24,
        bitrate: (quality === 'draft') ? 1_500_000 : 3_500_000
      });
    });

    updateProgress(0.95, 'Step 5/5: Multiplexing Final MP4...');

    // 6. MP4 Multiplexing
    const muxerData = await createMuxer({
      width,
      height,
      sampleRate: 48000,
      numberOfChannels: 2
    });

    videoChunks.forEach(({ chunk, meta }) => addVideoChunk(muxerData.muxer, chunk, meta));
    audioChunks.forEach(({ chunk, meta }) => addAudioChunk(muxerData.muxer, chunk, meta));

    const finalBlob = await finalizeMuxer(muxerData);

    updateProgress(1.0, '🎉 Done!');

    // 7. Show Output Player
    const videoUrl = finalBlob ? URL.createObjectURL(finalBlob) : null;
    const outputBox = document.getElementById('output-box');
    const outputVideo = document.getElementById('output-video');
    const dlLink = document.getElementById('download-link');

    if (videoUrl) {
      outputVideo.src = videoUrl;
      dlLink.href = videoUrl;
      outputBox.style.display = 'block';
      outputVideo.play();
    }
  } catch (err) {
    alert(`Render failed: ${err.message}`);
    console.error(err);
  } finally {
    btn.disabled = false;
  }
}

document.addEventListener('DOMContentLoaded', initApp);
