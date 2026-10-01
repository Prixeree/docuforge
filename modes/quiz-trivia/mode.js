/**
 * quiz-trivia/mode.js - Quiz & Interactive Trivia Pipeline Mode
 * 
 * Target: 25-40s, 9:16 vertical.
 * Features:
 * - Phase 1: Question narration with 4 staggered glassmorphic option cards
 * - Phase 2: Pulsing 3-2-1 radial countdown timer with clock-ticking SFX
 * - Phase 3: Green pulse reveal of correct answer + chime SFX
 * - Phase 4: Brief reveal explanation
 */

import { createDefaultSceneGraph } from '../../core/scene-graph.js';
import { computeWordTimings } from '../../core/word-timing.js';
import { createTriviaOptionSprite } from '../../core/sprites.js';

export function parseQuizInput(rawInput) {
  if (typeof rawInput === 'object' && rawInput.question) {
    return rawInput;
  }

  return {
    question: 'Which planet in our solar system has the shortest day?',
    options: ['Earth', 'Mars', 'Jupiter', 'Venus'],
    correctIndex: 2,
    funFact: 'Jupiter rotates so rapidly that one complete day lasts just under 10 hours!'
  };
}

export function buildQuizSceneGraph(quizData, audioData, clipWindow, options = {}) {
  const { question, options: choices, correctIndex, funFact } = quizData;
  const width = options.width || 720;
  const height = options.height || 1280;
  const quality = options.quality || 'hd';

  const graph = createDefaultSceneGraph({
    title: 'Trivia Quiz',
    mode: 'quiz-trivia',
    aspectRatio: '9:16',
    width,
    height,
    quality
  });

  graph.audio.music = {
    src: options.musicUrl || 'music/kevin-macleod-faster-does-it.mp3',
    volume: options.musicVolume ?? 0.7,
    duckLevel: options.duckLevel ?? 0.2,
    duckRampDuration: 0.4,
    loop: true,
    loopCrossfade: 1.5,
    fadeOutDuration: 2.0
  };

  const cardW = Math.round(width * 0.88);
  const cardH = 74;
  const letters = ['A', 'B', 'C', 'D'];

  if (!options.sprites) options.sprites = {};

  // Pre-render normal, correct, and faded sprites for each option
  choices.forEach((opt, idx) => {
    options.sprites[`opt_${idx}_normal`] = createTriviaOptionSprite(cardW, cardH, letters[idx], opt, 'normal');
    options.sprites[`opt_${idx}_correct`] = createTriviaOptionSprite(cardW, cardH, letters[idx], opt, 'correct');
    options.sprites[`opt_${idx}_faded`] = createTriviaOptionSprite(cardW, cardH, letters[idx], opt, 'faded');
  });

  const timings = audioData.sentenceTimings || [];
  let cumulativeTime = 0;

  // Scene 1: Question & Options Stagger
  const qTiming = timings[0] || { start: 0, end: 5.0 };
  const qDuration = Math.max(3.0, qTiming.end - qTiming.start);
  const qWords = computeWordTimings(question, 0, qDuration);

  const scene1Layers = [
    {
      type: 'video',
      id: 'quiz_scene_1',
      src: (quality === 'draft') ? clipWindow.draftUrl : clipWindow.url,
      startTime: clipWindow.startTime,
      duration: qDuration,
      kenBurns: { type: 'slow-drift', direction: 'in' }
    }
  ];

  // 4 Option cards positioned below question
  choices.forEach((_, idx) => {
    scene1Layers.push({
      type: 'sprite',
      id: `opt_card_${idx}`,
      spriteId: `opt_${idx}_normal`,
      x: width / 2,
      y: (height * 0.42) + (idx * (cardH + 16)),
      width: cardW,
      height: cardH,
      animation: {
        type: 'slide-in',
        startTime: idx * 0.3,
        duration: 0.5
      }
    });
  });

  scene1Layers.push({
    type: 'subtitles',
    preset: 'bold-pop',
    words: qWords,
    position: { yRatio: 0.24 }
  });

  graph.scenes.push({
    id: 'quiz_scene_question',
    duration: qDuration,
    subtitleYRatio: 0.24,
    transition: { type: 'none', duration: 0 },
    layers: scene1Layers
  });
  cumulativeTime += qDuration;

  // Scene 2: 3-Second Radial Countdown Timer
  const timerDuration = 3.0;
  const scene2Layers = [
    {
      type: 'video',
      id: 'quiz_scene_timer',
      src: (quality === 'draft') ? clipWindow.draftUrl : clipWindow.url,
      startTime: clipWindow.startTime + cumulativeTime,
      duration: timerDuration,
      kenBurns: { type: 'punch-in', direction: 'in' }
    }
  ];

  choices.forEach((_, idx) => {
    scene2Layers.push({
      type: 'sprite',
      id: `opt_timer_${idx}`,
      spriteId: `opt_${idx}_normal`,
      x: width / 2,
      y: (height * 0.42) + (idx * (cardH + 16)),
      width: cardW,
      height: cardH
    });
  });

  // Radial Timer Shape
  scene2Layers.push({
    type: 'shape',
    shape: 'radial-timer',
    x: width / 2,
    y: height * 0.22,
    radius: 46,
    stroke: '#38BDF8',
    strokeWidth: 8,
    animation: {
      property: 'progress',
      from: 0,
      to: 1,
      startTime: 0,
      duration: 3.0
    }
  });

  // Ticking SFX cues each second
  for (let s = 0; s < 3; s++) {
    graph.audio.sfx.push({
      name: 'tick',
      src: 'sfx/tick.wav',
      time: cumulativeTime + s,
      volume: 0.8
    });
  }

  graph.scenes.push({
    id: 'quiz_scene_timer',
    duration: timerDuration,
    transition: { type: 'none', duration: 0 },
    layers: scene2Layers
  });
  cumulativeTime += timerDuration;

  // Scene 3: Reveal Correct Answer & Fun Fact
  const revealTiming = timings[1] || { start: cumulativeTime, end: cumulativeTime + 4.5 };
  const revealDuration = Math.max(3.0, revealTiming.end - revealTiming.start);
  const revealWords = computeWordTimings(funFact, 0, revealDuration);

  const scene3Layers = [
    {
      type: 'video',
      id: 'quiz_scene_reveal',
      src: (quality === 'draft') ? clipWindow.draftUrl : clipWindow.url,
      startTime: clipWindow.startTime + cumulativeTime,
      duration: revealDuration,
      kenBurns: { type: 'slow-drift', direction: 'out' }
    }
  ];

  choices.forEach((_, idx) => {
    const isCorrect = (idx === correctIndex);
    scene3Layers.push({
      type: 'sprite',
      id: `opt_reveal_${idx}`,
      spriteId: isCorrect ? `opt_${idx}_correct` : `opt_${idx}_faded`,
      x: width / 2,
      y: (height * 0.42) + (idx * (cardH + 16)),
      width: cardW,
      height: cardH,
      animation: isCorrect ? { type: 'spring-pop', startTime: 0, duration: 0.6 } : undefined
    });
  });

  scene3Layers.push({
    type: 'subtitles',
    preset: 'bold-pop',
    words: revealWords,
    position: { yRatio: 0.24 }
  });

  // Chime SFX on reveal
  graph.audio.sfx.push({
    name: 'chime',
    src: 'sfx/chime.wav',
    time: cumulativeTime,
    volume: 0.9
  });

  graph.scenes.push({
    id: 'quiz_scene_reveal',
    duration: revealDuration,
    subtitleYRatio: 0.24,
    transition: { type: 'none', duration: 0 },
    layers: scene3Layers
  });

  return graph;
}
