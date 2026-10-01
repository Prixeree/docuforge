# ⚔️ DocuForge Myth vs Fact Mode

> Debunk viral misconceptions and urban legends with dramatic high-contrast "MYTH" vs "FACT" visual reveals, animated stamp badges, and cinematic tension cues in 30–45s.

<p align="center">
  <img src="../../examples/myth-vs-fact/preview.gif" alt="Myth vs Fact Mode Demo" width="360" />
</p>

---

## 🎬 Visual Structure
1. **Phase 1: The Myth (Crimson Warning)**:
   - Deep crimson card with subtle screen shake effect.
   - Bold "MYTH" badge with an animated red "X" stamp.
   - Low-pass tension riser sound effect.
2. **Phase 2: The Fact (Emerald Reveal)**:
   - High-speed whoosh transition into a vibrant emerald green card.
   - Glowing "FACT" stamp with animated checkmark.
   - Resonant chime sound effect marking the truth reveal.
3. **Phase 3: The Scientific Explanation**:
   - Deep dive into the empirical evidence and neurology/physics behind the debunking.
   - Moody, atmospheric space/smoke visual background.
   - High-contrast kinetic subtitles ensuring full comprehension.

---

## 📋 Input Format

### 1. Minimal JSON Input (`input.json`)
```json
{
  "mode": "myth-vs-fact",
  "title": "Do Humans Only Use 10% of Their Brains?",
  "myth": "Humans only use 10% of their total brain power, leaving 90% dormant.",
  "fact": "Brain imaging proves that humans utilize virtually 100% of their brain throughout every day.",
  "explanation": "Even during sleep, complex neural networks across all lobes remain metabolically active, firing billions of synaptic transmissions every second.",
  "settings": {
    "subtitlePreset": "classic",
    "voice": "bm_george",
    "music": "music/leberch-atmosphere-documentary-603152.mp3",
    "quality": "hd"
  }
}
```

---

## 🎛️ Customization Knobs
- **Visual Contrast**: Customize the Myth warning red (`#DC2626`) and Fact truth emerald (`#059669`).
- **Sound Effects**: Automatically synchronizes buzzer/impact SFX at myth reveal and chime SFX at fact reveal.
- **Narrative Voice**: British/American neural voices calibrated for investigative tone (`bm_george`).
- **Backdrop**: Searches mysterious stock footage or renders dark cosmic nebulae via procedural canvas shaders.

---

## 🚀 Run It Yourself
```bash
git clone https://github.com/docuforge/docuforge.git
cd docuforge
npx serve .
```
1. Select **Myth vs Fact** mode.
2. Fill in the Myth, Fact, and Scientific Explanation fields.
3. Click **Generate Video** — the full 720p HD MP4 compiles client-side in seconds!

---

## 🔄 Reproduce This Example
```bash
node tools/export-examples.js myth-vs-fact
```
Input definition: [examples/myth-vs-fact/input.json](../../examples/myth-vs-fact/input.json)

---

## 📜 Asset Credits & Licenses
- **Music**: *Atmosphere Documentary* by Leberch (Pixabay Content License).
- **TTS**: Kokoro Neural TTS (Apache-2.0).
- **SFX**: UI impact and chime effects (CC0).

See full details in [examples/myth-vs-fact/credits.md](../../examples/myth-vs-fact/credits.md).
