# ⚖️ DocuForge Would You Rather Mode

> Create viral 25–40s dilemma shorts featuring dual contrasting option cards, a center "VS" spring badge, and animated community vote percentage bars with ding SFX.

<p align="center">
  <img src="../../examples/would-you-rather/preview.gif" alt="Would You Rather Mode Demo" width="360" />
</p>

---

## 🎬 Visual Structure
1. **Dual Card Entrance (0:00 - 0:04)**:
   - **Option A (Top Card)**: Electric cyan card (`#06B6D4`) slides down from the upper viewport.
   - **Option B (Bottom Card)**: Crimson card (`#EF4444`) slides up from the lower viewport.
   - **Central "VS" Badge**: High-contrast circular "VS" badge pops into the exact center with elastic spring easing.
2. **Dilemma Narration**: The neural voiceover sequentially reads Option A, pauses briefly, and then presents Option B.
3. **Animated Vote Percentage Fill**: Smooth fill bars expand horizontally across both cards revealing community consensus (e.g., `58%` vs `42%`) accompanied by a ding sound effect.

---

## 📋 Input Format

### 1. Minimal JSON Input (`input.json`)
```json
{
  "mode": "would-you-rather",
  "optionA": "Speak and understand all 7,000 human languages fluently",
  "optionB": "Communicate effortlessly with every species of animal on Earth",
  "voteA": 58,
  "voteB": 42,
  "settings": {
    "subtitlePreset": "bold-pop",
    "voice": "bm_george",
    "music": "music/kevin-macleod-carefree.mp3",
    "quality": "hd"
  }
}
```

---

## 🎛️ Customization Knobs
- **Theme Colors**: Default Cyan vs Red or customizable (e.g. Purple vs Gold).
- **Vote Percentages**: Set community consensus percentages (`voteA` + `voteB` = 100).
- **Narration Cadence**: Configurable pause duration between options to encourage viewer comments.
- **Sound Effects**: Ding audio cue triggered on percentage bar animation.
- **Background**: Split-screen contrasting gradient or energetic live stock footage.

---

## 🚀 Run It Yourself
```bash
git clone https://github.com/docuforge/docuforge.git
cd docuforge
npx serve .
```
1. Select **Would You Rather** mode.
2. Enter Option A, Option B, and percentage split.
3. Click **Generate Video** — creates an engaging dilemma video in seconds!

---

## 🔄 Reproduce This Example
```bash
node tools/export-examples.js would-you-rather
```
Input definition: [examples/would-you-rather/input.json](../../examples/would-you-rather/input.json)

---

## 📜 Asset Credits & Licenses
- **Music**: *Carefree* by Kevin MacLeod (Incompetech, CC-BY 3.0).
- **TTS**: Kokoro Neural TTS (Apache-2.0).
- **SFX**: UI ding & whoosh sound effects (CC0).

See full details in [examples/would-you-rather/credits.md](../../examples/would-you-rather/credits.md).
