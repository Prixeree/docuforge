/**
 * reddit-story/mode.js - Dramatic Reddit Story Mode
 * 
 * Target: 60-180s, 9:16 vertical.
 * Features:
 * - Reddit-inspired post card (slide in, corner dock after 4s)
 * - Continuous unbroken gameplay background (Minecraft parkour / GTA ramps)
 * - Centered kinetic word-by-word subtitles
 * - Tense suspenseful music with riser SFX on dramatic twists
 */

import { createDefaultSceneGraph } from '../../core/scene-graph.js';
import { computeWordTimings } from '../../core/word-timing.js';
import { createRedditCardSprite } from '../../core/sprites.js';

export function parseRedditInput(rawInput) {
  if (typeof rawInput === 'object' && rawInput.story) {
    return rawInput;
  }

  return {
    subreddit: 'r/confession',
    username: 'u/throwaway_curious',
    title: 'I accidentally won an international trivia contest I never signed up for',
    upvotes: '34.2k',
    comments: '2.1k',
    story: rawInput || "It all started when I was waiting at an airport terminal during a six-hour delay. A random notification popped up on my phone asking for a quiz participant. Thinking it was a mobile game ad, I breezed through thirty impossible history questions in under two minutes. An hour later, two airport security guards approached me with a microphone and a giant cardboard check."
  };
}

export function buildRedditSceneGraph(redditData, audioData, clipWindow, options = {}) {
  const {
    subreddit,
    username,
    title,
    upvotes,
    comments,
    story
  } = redditData;

  const width = options.width || 720;
  const height = options.height || 1280;
  const quality = options.quality || 'hd';

  const graph = createDefaultSceneGraph({
    title: title.slice(0, 30),
    mode: 'reddit-story',
    aspectRatio: '9:16',
    width,
    height,
    quality
  });

  graph.audio.music = {
    src: options.musicUrl || 'music/kevin-macleod-the-descent.mp3',
    volume: options.musicVolume ?? 0.65,
    duckLevel: options.duckLevel ?? 0.15,
    duckRampDuration: 0.5,
    loop: true,
    loopCrossfade: 1.5,
    fadeOutDuration: 2.0
  };

  // Pre-render Reddit Card Sprite
  const cardWidth = Math.round(width * 0.9);
  const cardHeight = 160;
  const redditSprite = createRedditCardSprite(cardWidth, cardHeight, {
    subreddit,
    username,
    title,
    upvotes,
    comments
  });

  // Store in sprite cache map
  if (!options.sprites) options.sprites = {};
  options.sprites['reddit_card'] = redditSprite;

  const timings = audioData.sentenceTimings || [];
  let cumulativeTime = 0;

  timings.forEach((timing, idx) => {
    const duration = Math.max(2.0, timing.end - timing.start);
    const words = computeWordTimings(timing.text, 0, duration);
    const clipOffset = (clipWindow.startTime + cumulativeTime) % Math.max(10, clipWindow.duration || 180);

    const isFirstScene = idx === 0;

    const layers = [
      {
        type: 'video',
        id: `reddit_scene_${idx + 1}`,
        src: (quality === 'draft') ? clipWindow.draftUrl : clipWindow.url,
        startTime: clipOffset,
        duration: duration,
        kenBurns: { type: 'slow-drift', direction: 'in' }
      }
    ];

    // Scene 0: Card slides in and holds center
    // Subsequent scenes: Card shrinks to top corner
    if (isFirstScene) {
      layers.push({
        type: 'sprite',
        id: 'reddit_header_card',
        spriteId: 'reddit_card',
        x: width / 2,
        y: height * 0.35,
        width: cardWidth,
        height: cardHeight,
        animation: {
          type: 'slide-in',
          startTime: 0,
          duration: 0.8
        }
      });
    } else if (idx === 1) {
      layers.push({
        type: 'sprite',
        id: 'reddit_header_corner',
        spriteId: 'reddit_card',
        x: width / 2,
        y: height * 0.35,
        width: cardWidth,
        height: cardHeight,
        animation: {
          type: 'shrink-to-corner',
          startTime: 0,
          duration: 0.8
        }
      });
    }

    // Word-by-word kinetic subtitles centered
    layers.push({
      type: 'subtitles',
      preset: options.subtitlePreset || 'bold-pop',
      words: words,
      position: { yRatio: 0.68 }
    });

    graph.scenes.push({
      id: `reddit_scene_${idx + 1}`,
      duration: duration,
      subtitleYRatio: 0.68,
      transition: { type: 'none', duration: 0 }, // Continuous gameplay, no cut transitions
      layers
    });

    cumulativeTime += duration;
  });

  return graph;
}
