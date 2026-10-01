/**
 * would-you-rather/mode.js - Would You Rather Pipeline Mode
 * 
 * Target: 25-40s, 9:16 vertical.
 * Features:
 * - Option A on top (cyan card), Option B on bottom (red card)
 * - "VS" badge pop in center
 * - Sequential narration (Option A enters and narrated, then Option B enters)
 * - Animated percentage vote fill bars with ding SFX
 */

import { createDefaultSceneGraph } from '../../core/scene-graph.js';
import { computeWordTimings } from '../../core/word-timing.js';
import { createVsBadgeSprite } from '../../core/sprites.js';

export function parseWouldYouRatherInput(rawInput) {
  if (typeof rawInput === 'object' && rawInput.optionA) {
    return rawInput;
  }

  return {
    optionA: 'Travel 100 years into the future with no return ticket',
    optionB: 'Travel 100 years into the past with all your modern memories',
    voteA: 64,
    voteB: 36
  };
}

export function buildWouldYouRatherSceneGraph(wyrData, audioData, clipWindow, options = {}) {
  const { optionA, optionB, voteA, voteB } = wyrData;
  const width = options.width || 720;
  const height = options.height || 1280;
  const quality = options.quality || 'hd';

  const graph = createDefaultSceneGraph({
    title: 'Would You Rather',
    mode: 'would-you-rather',
    aspectRatio: '9:16',
    width,
    height,
    quality
  });

  graph.audio.music = {
    src: options.musicUrl || 'music/kevin-macleod-carefree.mp3',
    volume: options.musicVolume ?? 0.7,
    duckLevel: options.duckLevel ?? 0.18,
    duckRampDuration: 0.4,
    loop: true,
    loopCrossfade: 1.5,
    fadeOutDuration: 2.0
  };

  if (!options.sprites) options.sprites = {};
  options.sprites['vs_badge'] = createVsBadgeSprite(96);

  const timings = audioData.sentenceTimings || [];
  let cumulativeTime = 0;

  // Scene 1: Option A narration
  const durA = Math.max(3.0, (timings[0]?.end - timings[0]?.start) || 4.5);
  const wordsA = computeWordTimings(`Would you rather: ${optionA}?`, 0, durA);

  const scene1Layers = [
    {
      type: 'video',
      id: 'wyr_scene_1',
      src: (quality === 'draft') ? clipWindow.draftUrl : clipWindow.url,
      startTime: clipWindow.startTime,
      duration: durA,
      kenBurns: { type: 'slow-drift', direction: 'in' }
    },
    {
      type: 'subtitles',
      preset: 'bold-pop',
      words: wordsA,
      position: { yRatio: 0.35 }
    }
  ];

  graph.scenes.push({
    id: 'wyr_scene_a',
    duration: durA,
    subtitleYRatio: 0.35,
    transition: { type: 'none', duration: 0 },
    layers: scene1Layers
  });
  cumulativeTime += durA;

  // Scene 2: Option B narration + VS badge
  const durB = Math.max(3.0, (timings[1]?.end - timings[1]?.start) || 4.5);
  const wordsB = computeWordTimings(`Or would you rather: ${optionB}?`, 0, durB);

  const scene2Layers = [
    {
      type: 'video',
      id: 'wyr_scene_2',
      src: (quality === 'draft') ? clipWindow.draftUrl : clipWindow.url,
      startTime: clipWindow.startTime + cumulativeTime,
      duration: durB,
      kenBurns: { type: 'slow-drift', direction: 'out' }
    },
    {
      type: 'sprite',
      id: 'vs_badge_pop',
      spriteId: 'vs_badge',
      x: width / 2,
      y: height / 2,
      width: 96,
      height: 96,
      animation: {
        type: 'spring-pop',
        startTime: 0,
        duration: 0.5
      }
    },
    {
      type: 'subtitles',
      preset: 'bold-pop',
      words: wordsB,
      position: { yRatio: 0.65 }
    }
  ];

  graph.scenes.push({
    id: 'wyr_scene_b',
    duration: durB,
    subtitleYRatio: 0.65,
    transition: { type: 'none', duration: 0 },
    layers: scene2Layers
  });
  cumulativeTime += durB;

  // Scene 3: Percentage vote fill reveal
  const durReveal = 3.5;
  const scene3Layers = [
    {
      type: 'video',
      id: 'wyr_scene_3',
      src: (quality === 'draft') ? clipWindow.draftUrl : clipWindow.url,
      startTime: clipWindow.startTime + cumulativeTime,
      duration: durReveal,
      kenBurns: { type: 'punch-in', direction: 'in' }
    },
    {
      type: 'sprite',
      id: 'vs_badge_static',
      spriteId: 'vs_badge',
      x: width / 2,
      y: height / 2,
      width: 96,
      height: 96
    },
    // Vote Bar A (Cyan)
    {
      type: 'shape',
      shape: 'progress-bar',
      x: width / 2,
      y: height * 0.38,
      width: Math.round(width * 0.8),
      height: 24,
      fill: '#00F0FF',
      progress: voteA / 100
    },
    // Vote Bar B (Red)
    {
      type: 'shape',
      shape: 'progress-bar',
      x: width / 2,
      y: height * 0.62,
      width: Math.round(width * 0.8),
      height: 24,
      fill: '#EF4444',
      progress: voteB / 100
    }
  ];

  // Ding SFX when vote reveals
  graph.audio.sfx.push({
    name: 'ding',
    src: 'sfx/ding.wav',
    time: cumulativeTime + 0.3,
    volume: 0.85
  });

  graph.scenes.push({
    id: 'wyr_scene_reveal',
    duration: durReveal,
    transition: { type: 'none', duration: 0 },
    layers: scene3Layers
  });

  return graph;
}
