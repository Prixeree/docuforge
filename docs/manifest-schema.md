# DocuForge Asset Manifest Schema (v1.0)

This document specifies the JSON schema for `manifest.json` hosted in the `docuforge-assets` repository.
All pipeline modes and the engine core load this manifest at startup.

---

## 1. Top-Level Structure

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "version": "1.0",
  "updatedAt": "2026-10-01T08:00:00Z",
  "clips": [],
  "music": [],
  "sfx": []
}
```

---

## 2. Clip Entity Schema

Every video segment in `clips` must satisfy:

```typescript
interface ManifestClip {
  id: string;                     // Unique ID: {sourceVideoId}_{segmentIndex} (e.g. "BXUA2FncVPI_01")
  type: "clip";
  url: string;                    // Relative path: "clips/hd/BXUA2FncVPI_01.mp4" (720x1280)
  draft_url: string;              // Relative path: "clips/draft/BXUA2FncVPI_01.mp4" (540x960)
  thumbnail: string;              // Relative path: "clips/thumbs/BXUA2FncVPI_01.jpg"
  source_video_url: string;       // Original YouTube/Archive URL
  uploader: string;               // Original creator / channel
  license: string;                // "Creative Commons Attribution license" | "CC0" | "CC-BY 4.0"
  license_verified: true;         // Hard invariant: MUST BE TRUE. Unverified assets are NEVER published.
  attribution: string;            // Standard attribution string (e.g. "Footage by Orbital via YouTube (CC-BY)")
  tags: string[];                 // Mode-relevant keywords (e.g. ["minecraft", "parkour", "gameplay", "endless"])
  description: string;            // Human/AI verified visual description
  duration: number;               // Segment duration in seconds (typically ~180.0s)
  resolution: {
    width: number;                // 720
    height: number;               // 1280
  };
  orientation: "vertical";        // All pipeline segments are vertical 9:16
  modes: Array<"viral" | "reddit-story" | "explainer" | "myth-vs-fact" | "quote-motivational" | "quiz-trivia" | "would-you-rather">;
}
```

---

## 3. Music Entity Schema

```typescript
interface ManifestMusic {
  id: string;                     // E.g. "nastelbom_documentary_606698"
  type: "music";
  url: string;                    // Relative path: "music/nastelbom-documentary-documentary-music-606698.mp3"
  title: string;                  // Track title
  artist: string;                 // Artist name
  source: string;                 // "Pixabay", "incompetech.com", "Free Music Archive"
  license: string;                // "Pixabay Content License" | "CC-BY 4.0" | "CC0"
  license_verified: true;         // Hard invariant: MUST BE TRUE
  attribution: string;            // E.g. "Music: Dmitrii Spis (NastelBom), via Pixabay"
  mood: "calm" | "upbeat" | "tense" | "game-show" | "ambient" | "urgent" | "nature";
  duration: number;               // Original track duration in seconds
  loopable: true;                 // Compatible with engine crossfade loop
  modes: Array<"viral" | "reddit-story" | "explainer" | "myth-vs-fact" | "quote-motivational" | "quiz-trivia" | "would-you-rather">;
}
```

---

## 4. SFX Entity Schema

```typescript
interface ManifestSFX {
  id: string;                     // E.g. "sfx_whoosh_01"
  type: "sfx";
  name: "whoosh" | "ding" | "tick" | "chime" | "riser" | "hit";
  url: string;                    // Relative path: "sfx/whoosh-fast.mp3"
  duration: number;               // Seconds
  source: string;                 // E.g. "Freesound"
  license: "CC0" | "Public Domain" | "CC-BY 4.0";
  license_verified: true;
  attribution: string;
}
```

---

## 5. Validation Rules
- **No Null Licenses**: If license verification cannot confirm CC0, CC-BY, or Pixabay Content License, the item is rejected.
- **Exact File Resolution**: All HD clips must be exactly `720x1280` at 24fps with H.264 Baseline/Main profile, yuv420p, keyframe interval $\le 24$ (1 sec), faststart enabled.
- **Draft Parity**: Every HD clip must have an exact 1:1 `draft_url` counterpart scaled to `540x960`.
