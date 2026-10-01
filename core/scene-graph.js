/**
 * scene-graph.js - Declarative Scene Graph Compiler & Frame Renderer
 * 
 * Renders declarative scenes on an OffscreenCanvas without DOM dependencies.
 * Layers are rendered bottom-to-top with animations, kinetic subtitles, and transitions.
 */

import { getTransition } from './transitions.js';
import { applyKenBurns, createKenBurnsEffect } from './kenburns.js';
import { drawKineticSubtitles } from './subtitles.js';

export function createDefaultSceneGraph(options = {}) {
  const {
    title = 'DocuForge Video',
    mode = 'viral',
    aspectRatio = '9:16',
    width = 720,
    height = 1280,
    quality = 'hd'
  } = options;

  return {
    version: '1.0',
    meta: {
      title,
      mode,
      createdAt: new Date().toISOString(),
      aspectRatio
    },
    output: {
      width,
      height,
      fps: 24,
      quality
    },
    audio: {
      music: {
        src: '',
        volume: 0.7,
        duckLevel: 0.2,
        duckRampDuration: 0.5,
        loop: true,
        loopCrossfade: 1.5,
        fadeOutDuration: 2.0
      },
      sfx: []
    },
    scenes: []
  };
}

/**
 * Validates scene graph structure
 */
export function validateSceneGraph(graph) {
  if (!graph || !Array.isArray(graph.scenes)) {
    throw new Error("Invalid SceneGraph: missing 'scenes' array.");
  }
  let totalDur = 0;
  for (let i = 0; i < graph.scenes.length; i++) {
    const sc = graph.scenes[i];
    if (!sc.id || typeof sc.duration !== 'number') {
      throw new Error(`Invalid Scene at index ${i}: missing id or duration.`);
    }
    totalDur += sc.duration;
  }
  return { valid: true, totalDuration: totalDur };
}

/**
 * Finds active scene and transition state for a given timestamp
 */
export function getSceneAtTimestamp(scenes, time) {
  let elapsed = 0;
  for (let i = 0; i < scenes.length; i++) {
    const sc = scenes[i];
    const start = elapsed;
    const end = elapsed + sc.duration;
    
    if (time >= start && time < end) {
      const sceneTime = time - start;
      const transDur = sc.transition ? (sc.transition.duration || 0.6) : 0;
      const inTransition = (sc.transition && sc.transition.type !== 'none' && i < scenes.length - 1 && sceneTime >= (sc.duration - transDur));
      
      return {
        scene: sc,
        index: i,
        startTime: start,
        sceneTime,
        inTransition,
        transitionProgress: inTransition ? ((sceneTime - (sc.duration - transDur)) / transDur) : 0,
        nextScene: inTransition ? scenes[i + 1] : null
      };
    }
    elapsed = end;
  }
  
  // Clamped to final scene
  if (scenes.length > 0) {
    const last = scenes[scenes.length - 1];
    return {
      scene: last,
      index: scenes.length - 1,
      startTime: elapsed - last.duration,
      sceneTime: last.duration,
      inTransition: false,
      transitionProgress: 0,
      nextScene: null
    };
  }
  return null;
}

/**
 * Renders a single scene layer onto target 2D context
 */
export function renderLayer(ctx, layer, sceneTime, width, height, assets = {}) {
  switch (layer.type) {
    case 'video': {
      const frameSource = assets.videoFrames && assets.videoFrames[layer.id];
      if (frameSource) {
        ctx.save();
        if (layer.opacity !== undefined) ctx.globalAlpha = layer.opacity;

        if (layer.kenBurns) {
          const progress = Math.min(1.0, sceneTime / Math.max(1.0, layer.duration || 5.0));
          const effect = createKenBurnsEffect(layer.kenBurns.type || 'slow-drift', layer.kenBurns.direction || 'in');
          applyKenBurns(ctx, frameSource, progress, width, height, effect);
        } else {
          ctx.drawImage(frameSource, 0, 0, width, height);
        }
        ctx.restore();
      }
      break;
    }

    case 'sprite': {
      const spriteCanvas = assets.sprites && assets.sprites[layer.spriteId];
      if (spriteCanvas) {
        ctx.save();
        let scale = 1.0;
        let alpha = layer.opacity ?? 1.0;
        let curX = layer.x;
        let curY = layer.y;

        // Animations
        if (layer.animation) {
          const a = layer.animation;
          const aProg = Math.max(0, Math.min(1, (sceneTime - (a.startTime || 0)) / Math.max(0.01, a.duration)));
          
          if (a.type === 'slide-in') {
            const ease = 1 - Math.pow(1 - aProg, 3);
            curY = layer.y + (1 - ease) * (height * 0.4);
            alpha *= ease;
          } else if (a.type === 'spring-pop') {
            // Damped harmonic oscillator
            scale = 1 + Math.sin(aProg * Math.PI * 2) * Math.exp(-aProg * 4) * 0.3;
          } else if (a.type === 'shrink-to-corner') {
            const ease = aProg * aProg;
            scale = 1.0 - (0.6 * ease);
            curX = layer.x - (width * 0.3 * ease);
            curY = layer.y - (height * 0.35 * ease);
          }
        }

        ctx.globalAlpha = alpha;
        ctx.translate(curX, curY);
        ctx.scale(scale, scale);
        ctx.drawImage(spriteCanvas, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
        ctx.restore();
      }
      break;
    }

    case 'subtitles': {
      drawKineticSubtitles(ctx, layer.words, sceneTime + (layer.sceneStartTime || 0), width, height, {
        preset: layer.preset || 'bold-pop',
        yRatio: layer.position ? layer.position.yRatio : 0.75
      });
      break;
    }

    case 'shape': {
      ctx.save();
      if (layer.shape === 'radial-timer') {
        const radius = layer.radius || 48;
        const progress = Math.max(0, Math.min(1, layer.progress ?? 0));
        
        // Background track
        ctx.beginPath();
        ctx.arc(layer.x, layer.y, radius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = layer.strokeWidth || 8;
        ctx.stroke();

        // Active sweep arc
        ctx.beginPath();
        ctx.arc(layer.x, layer.y, radius, -Math.PI / 2, (-Math.PI / 2) + (Math.PI * 2 * (1 - progress)), false);
        ctx.strokeStyle = layer.stroke || '#00F0FF';
        ctx.lineCap = 'round';
        ctx.stroke();

        // Center timer number
        const remainingSec = Math.ceil((1 - progress) * 3);
        ctx.font = `900 42px "Arial Black", sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(remainingSec > 0 ? remainingSec.toString() : '!', layer.x, layer.y);
      } else if (layer.shape === 'progress-bar') {
        const w = layer.width || 300;
        const h = layer.height || 18;
        const p = Math.max(0, Math.min(1, layer.progress || 0));
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.roundRect(layer.x - w / 2, layer.y - h / 2, w, h, h / 2);
        ctx.fill();

        ctx.fillStyle = layer.fill || '#10B981';
        ctx.beginPath();
        ctx.roundRect(layer.x - w / 2, layer.y - h / 2, w * p, h, h / 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }
  }
}
