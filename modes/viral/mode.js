/**
 * viral/mode.js - Viral Facts & Hooks Pipeline Mode
 * 
 * Target: 15-60s, 9:16 vertical.
 * Features:
 * - High-energy hook + facts + CTA structure
 * - Rapid cuts between clip windows (alternating A/B windows)
 * - Whip-pan and glitch-cut transitions
 * - Ken Burns punch-in zooms
 * - Bold-Pop kinetic subtitles
 * - Upbeat music with whoosh SFX on scene cuts
 */

import { createDefaultSceneGraph } from '../../core/scene-graph.js';
import { extractKeywords } from '../../core/keywords.js';
import { computeWordTimings } from '../../core/word-timing.js';

export function parseViralInput(rawInput) {
  if (typeof rawInput === 'object' && rawInput.hook) {
    return rawInput;
  }

  const lines = rawInput.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length >= 3) {
    return {
      hook: lines[0],
      facts: lines.slice(1, -1),
      cta: lines[lines.length - 1]
    };
  }

  // Fallback defaults
  return {
    hook: lines[0] || 'Did you know this insane fact?',
    facts: [
      lines[1] || 'Scientists discovered that honey never ever spoils even after 3000 years.',
      lines[2] || 'Archaeologists in Egypt tasted ancient honey found in tombs and it was still edible.'
    ],
    cta: lines[lines.length - 1] || 'Hit subscribe if your mind is completely blown!'
  };
}

export function buildViralSceneGraph(viralData, audioData, clipWindow, options = {}) {
  const {
    hook,
    facts,
    cta
  } = viralData;

  const width = options.width || 720;
  const height = options.height || 1280;
  const quality = options.quality || 'hd';

  const graph = createDefaultSceneGraph({
    title: hook.slice(0, 30),
    mode: 'viral',
    aspectRatio: '9:16',
    width,
    height,
    quality
  });

  graph.audio.music = {
    src: options.musicUrl || 'music/kevin-macleod-sneaky-snitch.mp3',
    volume: options.musicVolume ?? 0.7,
    duckLevel: options.duckLevel ?? 0.18,
    duckRampDuration: 0.4,
    loop: true,
    loopCrossfade: 1.5,
    fadeOutDuration: 2.0
  };

  const allSections = [
    { type: 'hook', text: hook },
    ...facts.map((f, i) => ({ type: 'fact', index: i + 1, text: f })),
    { type: 'cta', text: cta }
  ];

  let cumulativeTime = 0;
  const timings = audioData.sentenceTimings || [];

  allSections.forEach((sec, idx) => {
    const timing = timings[idx] || {
      start: cumulativeTime,
      end: cumulativeTime + 4.5
    };
    const duration = Math.max(2.0, timing.end - timing.start);
    const words = computeWordTimings(sec.text, 0, duration);

    // Alternate transition between whip-pan and glitch-cut
    const transType = (idx % 2 === 0) ? 'whip-pan' : 'glitch-cut';
    const kbType = (idx === 0) ? 'punch-in' : (idx % 2 === 0 ? 'pan-left' : 'pan-right');

    // Stagger clip start offset by 3s per scene to simulate fast A/B cuts
    const clipStart = (clipWindow.startTime + (idx * 3.5)) % Math.max(10, clipWindow.duration || 120);

    const sceneNode = {
      id: `viral_scene_${idx + 1}`,
      duration: duration,
      subtitleYRatio: 0.72,
      transition: {
        type: (idx < allSections.length - 1) ? transType : 'none',
        duration: 0.45
      },
      kenBurns: {
        type: kbType,
        direction: (idx % 2 === 0) ? 'in' : 'out'
      },
      layers: [
        {
          type: 'video',
          id: `viral_scene_${idx + 1}`,
          src: (quality === 'draft') ? clipWindow.draftUrl : clipWindow.url,
          startTime: clipStart,
          duration: duration,
          kenBurns: {
            type: kbType,
            direction: (idx % 2 === 0) ? 'in' : 'out'
          }
        },
        {
          type: 'subtitles',
          preset: options.subtitlePreset || 'bold-pop',
          words: words,
          position: { yRatio: 0.72 }
        }
      ]
    };

    // Add whoosh SFX cue at start of each cut (except scene 0)
    if (idx > 0) {
      graph.audio.sfx.push({
        name: 'whoosh',
        src: 'sfx/whoosh.wav',
        time: cumulativeTime,
        volume: 0.8
      });
    }

    graph.scenes.push(sceneNode);
    cumulativeTime += duration;
  });

  return graph;
}
