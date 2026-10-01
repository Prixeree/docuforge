# DocuForge Scene Graph Specification (v1.0)

The DocuForge Scene Graph is a declarative, serializable representation of a documentary or short-form video.
Pipeline modes **only construct and emit this Scene Graph**. The core engine (`docuforge-core`) parses, animates, and renders the graph frame-by-frame on an `OffscreenCanvas` in a Web Worker.

---

## 1. Top-Level Specification

```typescript
interface SceneGraph {
  version: "1.0";
  meta: {
    title: string;
    mode: "viral" | "reddit-story" | "explainer" | "myth-vs-fact" | "quote-motivational" | "quiz-trivia" | "would-you-rather";
    createdAt: string;
    aspectRatio: "9:16" | "16:9";
  };
  output: {
    width: number;       // e.g. 720 (HD) or 540 (Draft) or 1080 (FHD)
    height: number;      // e.g. 1280 (HD) or 960 (Draft) or 1920 (FHD)
    fps: 24;             // Hard constraint: 24fps
    quality: "draft" | "hd" | "full-hd";
  };
  audio: SceneGraphAudio;
  scenes: SceneNode[];
}
```

---

## 2. Audio Track Definition

```typescript
interface SceneGraphAudio {
  voice?: {
    src?: string;                 // URL to pre-synthesized audio WAV/MP3
    samples?: Float32Array;       // Raw PCM buffer (transferred to AudioEncoder)
    sampleRate: number;           // Usually 24000 (Kokoro) or 48000
    duration: number;             // Duration in seconds
    timings?: SentenceTiming[];   // Sentence & word timings for subtitle sync
  };
  music: {
    src: string;                  // URL to background music track (from manifest)
    volume: number;               // 0.0 - 1.0 (default 0.7)
    duckLevel: number;            // 0.0 - 1.0 (default 0.2 during speech)
    duckRampDuration: number;     // Linear ramp time in seconds (default 0.5s)
    loop: boolean;                // Seamless loop flag (default true)
    loopCrossfade: number;        // Tail-head crossfade duration (default 1.5s)
    fadeOutDuration: number;      // Outro fade out (default 2.0s)
  };
  sfx: Array<{
    name: "whoosh" | "ding" | "tick" | "chime" | "riser" | "hit";
    src?: string;                 // URL or procedural fallback
    time: number;                 // Timestamp relative to video start (seconds)
    volume?: number;              // 0.0 - 1.0
  }>;
}
```

---

## 3. Scene Node Definition

Each scene represents a discrete segment of the video (e.g. one narration sentence or paragraph, or one question phase).

```typescript
interface SceneNode {
  id: string;
  duration: number;               // Duration in seconds
  transition?: {
    type: "none" | "crossfade" | "slide" | "wipe" | "dip-to-black" | "whip-pan" | "glitch-cut";
    duration: number;             // Transition duration in seconds (typically 0.4s - 0.8s)
    direction?: "left" | "right" | "up" | "down";
  };
  layers: SceneLayer[];
}
```

---

## 4. Layer Types

All visual elements are layers stacked bottom-to-top (painter's algorithm).

### 4.1 Video Layer (`type: "video"`)
```typescript
interface VideoLayer {
  type: "video";
  id: string;
  src: string;                    // URL to segment MP4 (HTTP range request)
  startTime: number;              // Scrub offset within the clip segment (seconds)
  playbackRate?: number;          // Default 1.0 (e.g. 0.5 for quote slow-mo)
  kenBurns?: {
    panDirection: "in" | "out" | "left" | "right" | "none";
    zoomIntensity: number;        // E.g. 1.05 to 1.15
    easing: "linear" | "ease-in-out";
  };
  opacity?: number;               // 0.0 - 1.0
  layout?: "full" | "top-half" | "bottom-half" | "split";
}
```

### 4.2 Sprite Layer (`type: "sprite"`)
Pre-rendered static or pseudo-glassmorphic gradient badges drawn once to an offscreen canvas and blitted per frame.
```typescript
interface SpriteLayer {
  type: "sprite";
  id: string;
  spriteId: string;               // Key in SpriteCache (e.g. 'reddit_card', 'badge_rank1', 'myth_card')
  x: number;                      // Center or top-left coordinate
  y: number;
  width: number;
  height: number;
  opacity?: number;
  animation?: {
    type: "slide-in" | "spring-pop" | "fade" | "shake" | "shrink-to-corner";
    startTime: number;            // Relative to scene start
    duration: number;
    delay?: number;
  };
}
```

### 4.3 Subtitle Layer (`type: "subtitles"`)
Kinetic word-by-word subtitles synchronized to audio word timestamps.
```typescript
interface SubtitleLayer {
  type: "subtitles";
  preset: "bold-pop" | "classic" | "handwritten";
  words: Array<{
    word: string;
    start: number;                // Absolute video seconds
    end: number;
  }>;
  position: {
    yRatio: number;               // 0.0 (top) to 1.0 (bottom), default ~0.75
  };
  style?: {
    primaryColor: string;         // E.g. "#FFFFFF"
    accentColor: string;          // E.g. "#FFDD00" (highlighted word)
    strokeColor: string;          // E.g. "#000000"
    strokeWidth: number;          // E.g. 6
    fontSize: number;             // E.g. 48
  };
}
```

### 4.4 Shape Layer (`type: "shape"`)
Lightweight vector elements (e.g. countdown radial timer, poll percentage bar).
```typescript
interface ShapeLayer {
  type: "shape";
  shape: "radial-timer" | "progress-bar" | "rect" | "circle";
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  progress?: number;              // 0.0 - 1.0 (or dynamic expression)
  animation?: {
    property: "progress" | "opacity" | "scale";
    from: number;
    to: number;
    startTime: number;
    duration: number;
  };
}
```

---

## 5. Execution Contract
1. **Purity**: A scene graph is pure JSON data. It contains no DOM references or direct canvas calls.
2. **Deterministic**: Given the exact same SceneGraph and random seed, the renderer produces bit-for-bit identical frames.
3. **No Heavy Filters in Loop**: No `ctx.filter = 'blur(10px)'` or `getImageData()` inside the render loop. All cards and badges must be registered as pre-rendered sprites.
