/**
 * quote-motivational/mode.js - Quote / Stoic Wisdom Pipeline Mode
 * 
 * Target: 20-45s, 9:16 vertical.
 * Features:
 * - Handwritten typography preset with smooth reveal
 * - Atmospheric nature B-roll
 * - Calming ambient documentary music
 * - Deep measured cadence (speed 0.88, voice bm_george)
 */

import { createDefaultSceneGraph } from '../../core/scene-graph.js';
import { computeWordTimings } from '../../core/word-timing.js';

export function parseQuoteInput(rawInput) {
  if (typeof rawInput === 'object' && rawInput.quote) {
    return rawInput;
  }

  return {
    quote: 'You have power over your mind, not outside events. Realize this, and you will find strength.',
    author: 'Marcus Aurelius',
    context: 'The ancient stoic reminder to focus entirely on your own thoughts and actions.'
  };
}

export function buildQuoteSceneGraph(quoteData, audioData, clipWindow, options = {}) {
  const { quote, author } = quoteData;
  const width = options.width || 720;
  const height = options.height || 1280;
  const quality = options.quality || 'hd';

  const graph = createDefaultSceneGraph({
    title: `${author} - Quote`,
    mode: 'quote-motivational',
    aspectRatio: '9:16',
    width,
    height,
    quality
  });

  graph.audio.music = {
    src: options.musicUrl || 'music/leberch-documentary-calm-603945.mp3',
    volume: options.musicVolume ?? 0.65,
    duckLevel: options.duckLevel ?? 0.15,
    duckRampDuration: 0.6,
    loop: true,
    loopCrossfade: 2.0,
    fadeOutDuration: 2.5
  };

  const timings = audioData.sentenceTimings || [];
  let cumulativeTime = 0;

  // Split quote into 2-3 calm lines
  const sections = [
    { text: `"${quote}"`, isAuthor: false },
    { text: `— ${author}`, isAuthor: true }
  ];

  sections.forEach((sec, idx) => {
    const timing = timings[idx] || {
      start: cumulativeTime,
      end: cumulativeTime + 5.0
    };
    const duration = Math.max(3.0, timing.end - timing.start);
    const words = computeWordTimings(sec.text, 0, duration);
    const clipOffset = (clipWindow.startTime + (idx * 3.0)) % Math.max(10, clipWindow.duration || 180);

    const sceneNode = {
      id: `quote_scene_${idx + 1}`,
      duration: duration,
      subtitleYRatio: sec.isAuthor ? 0.65 : 0.50,
      transition: {
        type: 'crossfade',
        duration: 0.8
      },
      kenBurns: {
        type: 'slow-drift',
        direction: 'in'
      },
      layers: [
        {
          type: 'video',
          id: `quote_scene_${idx + 1}`,
          src: (quality === 'draft') ? clipWindow.draftUrl : clipWindow.url,
          startTime: clipOffset,
          duration: duration,
          playbackRate: 0.75, // Smooth slow-mo atmospheric drift
          kenBurns: { type: 'slow-drift', direction: 'in' }
        },
        {
          type: 'subtitles',
          preset: 'handwritten',
          words: words,
          position: { yRatio: sec.isAuthor ? 0.65 : 0.50 }
        }
      ]
    };

    graph.scenes.push(sceneNode);
    cumulativeTime += duration;
  });

  return graph;
}
