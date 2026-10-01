# ⚡ DocuForge Viral Facts & Hooks Mode

> Turn any topic into a 15–45s high-retention viral short with kinetic pop-in typography, dynamic scene transitions, and energetic background music — generated 100% in your browser.

<p align="center">
  <img src="../../examples/viral/preview.gif" alt="Viral Mode Demo" width="360" />
</p>

---

## 🎬 Visual Structure
1. **Hook Scene (0:00 - 0:04)**: High-contrast opening statement designed to maximize initial viewer retention. Centered punchy text with `bold-pop` spring scaling.
2. **Fact Scenes (0:04 - 0:25)**: Sequential reveals with Ken Burns zoom/pan motion over relevant 9:16 portrait stock footage or vibrant procedural gradient shaders. Smooth crossfade or wipe transitions between points.
3. **Call-To-Action (0:25 - End)**: Engaging prompt urging comments, likes, and follows before seamless looping.

---

## 📋 Input Format

### 1. Minimal JSON Input (`input.json`)
```json
{
  "mode": "viral",
  "title": "5 Terrifying Facts About the Deep Ocean",
  "hook": "Here are 5 terrifying facts about the deep ocean that will give you chills.",
  "facts": [
    "Over 80 percent of the entire ocean remains completely unexplored by mankind.",
    "The Mariana Trench plunges nearly 36,000 feet deep, deep enough to submerge Mount Everest.",
    "At the bottom, water pressure exceeds 1,000 atmospheres, easily crushing a steel submarine."
  ],
  "cta": "Which deep ocean secret shocked you the most? Follow for more discoveries!",
  "settings": {
    "subtitlePreset": "bold-pop",
    "voice": "bm_george",
    "music": "music/kevin-macleod-sneaky-snitch.mp3",
    "quality": "hd"
  }
}
```

### 2. Raw Text / Topic Input (Auto-parsed)
You can also feed raw text directly:
```text
Did you know this insane fact about honey?
Scientists discovered that raw honey never spoils even after 3,000 years.
Archaeologists in Egypt opened ancient tombs and found still-edible honey pots.
Follow for more mind-blowing discoveries!
```

---

## 🎛️ Customization Knobs
- **Voiceover**: Select from built-in neural Kokoro ONNX voices (`bm_george`, `bf_alice`, `af_bella`, `am_adam`).
- **Subtitle Preset**:
  - `bold-pop`: Chunky high-contrast yellow/white lettering with active word scaling (default).
  - `classic`: Semi-transparent dark pill container with crisp white text.
  - `karaoke`: Word-by-word active glow color highlight.
  - `minimal`: Elegant bottom-anchored clean sans-serif.
- **Stock Footage vs Procedural**: Integrates live Pexels and Pixabay vertical video APIs. When offline or without API keys, automatically falls back to an offline high-contrast canvas gradient shader.
- **Background Music**: Auto-ducked by 80% during active speech, with customizable loop crossfades and riser drops.
- **Resolution**: `draft` (540x960 @ 24fps), `hd` (720x1280 @ 24fps), or `full-hd` (1080x1920 @ 30fps).

---

## 🚀 Run It Yourself (30 Seconds)
```bash
git clone https://github.com/docuforge/docuforge.git
cd docuforge
# Open index.html in Chrome, Edge, or Brave (or serve via any static web server)
npx serve .
```
1. Select **Viral Facts & Hooks** mode in the top navigation.
2. Paste your facts or click **Load Demo**.
3. Hit **Generate Video** — your MP4 will download in seconds!

---

## 🔄 Reproduce This Example
To reproduce the exact demonstration shown in the preview above:
```bash
node tools/export-examples.js viral
```
Input definition: [examples/viral/input.json](../../examples/viral/input.json)

---

## 📜 Asset Credits & Licenses
All background music, voiceover models, and visual assets used in this mode are strictly open source and royalty-free.
See full attributions in [examples/viral/credits.md](../../examples/viral/credits.md).
