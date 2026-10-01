/**
 * myth-vs-fact/mode.js - Myth vs Fact Pipeline Mode
 * 
 * Target: 30-45s, 9:16 vertical.
 * Features:
 * - Phase 1: Red "MYTH" card with shake + "X" stamp
 * - Phase 2: Whoosh to emerald "FACT" card with checkmark
 * - Phase 3: Detailed scientific explanation
 * - Mysterious dramatic music with riser + hit reveal SFX
 */

import { createDefaultSceneGraph } from '../../core/scene-graph.js';
import { computeWordTimings } from '../../core/word-timing.js';
import { createMythCardSprite, createFactCardSprite } from '../../core/sprites.js';

export function parseMythInput(rawInput) {
  if (typeof rawInput === 'object' && rawInput.myth) {
    return rawInput;
  }

  return {
    myth: 'Humans only use ten percent of their brain capacity.',
    fact: 'Brain scans show you use virtually one hundred percent of your brain throughout the day.',
    explanation: 'Neurological imaging proves that even while sleeping or resting, almost every region of the human brain remains actively firing.'
  };
}

export function buildMythSceneGraph(mythData, audioData, clipWindow, options = {}) {
  const { myth, fact, explanation } = mythData;
  const width = options.width || 720;
  const height = options.height || 1280;
  const quality = options.quality || 'hd';

  const graph = createDefaultSceneGraph({
    title: 'Myth vs Fact',
    mode: 'myth-vs-fact',
    aspectRatio: '9:16',
    width,
    height,
    quality
  });

  graph.audio.music = {
    src: options.musicUrl || 'music/leberch-atmosphere-documentary-603152.mp3',
    volume: options.musicVolume ?? 0.7,
    duckLevel: options.duckLevel ?? 0.16,
    duckRampDuration: 0.5,
    loop: true,
    loopCrossfade: 1.5,
    fadeOutDuration: 2.0
  };

  const cardW = Math.round(width * 0.88);
  const cardH = 180;

  if (!options.sprites) options.sprites = {};
  options.sprites['myth_card'] = createMythCardSprite(cardW, cardH, myth);
  options.sprites['fact_card'] = createFactCardSprite(cardW, cardH, fact);

  const sections = [
    { type: 'myth', text: `Myth: ${myth}`, spriteId: 'myth_card' },
    { type: 'fact', text: `Fact: ${fact}`, spriteId: 'fact_card' },
    { type: 'explanation', text: explanation, spriteId: null }
  ];

  const timings = audioData.sentenceTimings || [];
  let cumulativeTime = 0;

  sections.forEach((sec, idx) => {
    const timing = timings[idx] || {
      start: cumulativeTime,
      end: cumulativeTime + 4.5
    };
    const duration = Math.max(2.5, timing.end - timing.start);
    const words = computeWordTimings(sec.text, 0, duration);
    const clipOffset = (clipWindow.startTime + (idx * 4.0)) % Math.max(10, clipWindow.duration || 180);

    const layers = [
      {
        type: 'video',
        id: `myth_scene_${idx + 1}`,
        src: (quality === 'draft') ? clipWindow.draftUrl : clipWindow.url,
        startTime: clipOffset,
        duration: duration,
        kenBurns: { type: 'slow-drift', direction: (idx % 2 === 0) ? 'in' : 'out' }
      }
    ];

    if (sec.spriteId) {
      layers.push({
        type: 'sprite',
        id: `sprite_${sec.type}`,
        spriteId: sec.spriteId,
        x: width / 2,
        y: height * 0.35,
        width: cardW,
        height: cardH,
        animation: {
          type: (sec.type === 'myth') ? 'spring-pop' : 'slide-in',
          startTime: 0,
          duration: 0.6
        }
      });
    }

    layers.push({
      type: 'subtitles',
      preset: options.subtitlePreset || 'bold-pop',
      words: words,
      position: { yRatio: 0.72 }
    });

    // SFX cues
    if (idx === 1) {
      // Riser before fact reveal + hit on impact
      graph.audio.sfx.push({
        name: 'riser',
        src: 'sfx/riser.wav',
        time: Math.max(0, cumulativeTime - 1.5),
        volume: 0.7
      });
      graph.audio.sfx.push({
        name: 'hit',
        src: 'sfx/hit.wav',
        time: cumulativeTime,
        volume: 0.9
      });
    }

    graph.scenes.push({
      id: `myth_scene_${idx + 1}`,
      duration: duration,
      subtitleYRatio: 0.72,
      transition: {
        type: (idx === 0) ? 'whip-pan' : 'crossfade',
        duration: 0.5
      },
      layers
    });

    cumulativeTime += duration;
  });

  return graph;
}
