/**
 * explainer/mode.js - Explainer / Top List Pipeline Mode
 * 
 * Target: 20-90s, 9:16 or 16:9.
 * Features:
 * - Animated ranking ladder (#N badge with spring pop-in)
 * - Numbered badges and highlight overlays
 * - Inquisitive documentary music with soft tick/whoosh per item
 * - Classic pill subtitles
 */

import { createDefaultSceneGraph } from '../../core/scene-graph.js';
import { computeWordTimings } from '../../core/word-timing.js';
import { createRankBadgeSprite } from '../../core/sprites.js';

export function parseExplainerInput(rawInput) {
  if (typeof rawInput === 'object' && rawInput.items) {
    return rawInput;
  }

  return {
    title: 'Top 3 Deadliest Natural Formations on Earth',
    items: [
      {
        rank: 3,
        name: 'The Danakil Depression',
        line: 'Located in Ethiopia, this otherworldly landscape features boiling acid lakes and toxic sulfur vents.'
      },
      {
        rank: 2,
        name: 'Lake Natron',
        line: 'A Tanzanian soda lake with alkaline water so caustic it can calcify wildlife into stone.'
      },
      {
        rank: 1,
        name: 'Mount Nyiragongo',
        line: 'An active stratovolcano housing the largest and fastest-moving molten lava lake in recorded history.'
      }
    ]
  };
}

export function buildExplainerSceneGraph(explainerData, audioData, clipWindow, options = {}) {
  const { title, items } = explainerData;
  const width = options.width || 720;
  const height = options.height || 1280;
  const quality = options.quality || 'hd';

  const graph = createDefaultSceneGraph({
    title,
    mode: 'explainer',
    aspectRatio: options.aspectRatio || '9:16',
    width,
    height,
    quality
  });

  graph.audio.music = {
    src: options.musicUrl || 'music/nastelbom-documentary-documentary-music-606698.mp3',
    volume: options.musicVolume ?? 0.7,
    duckLevel: options.duckLevel ?? 0.2,
    duckRampDuration: 0.5,
    loop: true,
    loopCrossfade: 1.5,
    fadeOutDuration: 2.0
  };

  if (!options.sprites) options.sprites = {};

  // Pre-render badges for all ranks
  items.forEach(item => {
    const badgeKey = `badge_rank_${item.rank}`;
    options.sprites[badgeKey] = createRankBadgeSprite(item.rank, 110, '#38BDF8');
  });

  const timings = audioData.sentenceTimings || [];
  let cumulativeTime = 0;

  items.forEach((item, idx) => {
    const timing = timings[idx] || {
      start: cumulativeTime,
      end: cumulativeTime + 5.0
    };
    const duration = Math.max(2.5, timing.end - timing.start);
    const words = computeWordTimings(item.line, 0, duration);
    const clipOffset = (clipWindow.startTime + (idx * 5.0)) % Math.max(10, clipWindow.duration || 180);

    const badgeKey = `badge_rank_${item.rank}`;

    const sceneNode = {
      id: `explainer_rank_${item.rank}`,
      duration: duration,
      subtitleYRatio: 0.78,
      transition: {
        type: (idx < items.length - 1) ? 'wipe' : 'none',
        duration: 0.6
      },
      kenBurns: {
        type: 'slow-drift',
        direction: (idx % 2 === 0) ? 'in' : 'out'
      },
      layers: [
        {
          type: 'video',
          id: `explainer_rank_${item.rank}`,
          src: (quality === 'draft') ? clipWindow.draftUrl : clipWindow.url,
          startTime: clipOffset,
          duration: duration,
          kenBurns: { type: 'slow-drift', direction: (idx % 2 === 0) ? 'in' : 'out' }
        },
        {
          type: 'sprite',
          id: `badge_layer_${item.rank}`,
          spriteId: badgeKey,
          x: width / 2,
          y: height * 0.28,
          width: 110,
          height: 110,
          animation: {
            type: 'spring-pop',
            startTime: 0,
            duration: 0.6
          }
        },
        {
          type: 'subtitles',
          preset: options.subtitlePreset || 'classic',
          words: words,
          position: { yRatio: 0.78 }
        }
      ]
    };

    // Add tick sound on rank reveal
    graph.audio.sfx.push({
      name: 'tick',
      src: 'sfx/tick.wav',
      time: cumulativeTime + 0.1,
      volume: 0.7
    });

    graph.scenes.push(sceneNode);
    cumulativeTime += duration;
  });

  return graph;
}
