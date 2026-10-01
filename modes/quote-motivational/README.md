# 📜 DocuForge Quote & Motivational Mode

> Create contemplative, atmospheric 20–30s shorts for Stoic philosophy, timeless literature, and daily wisdom with elegant typography and serene golden-hour visuals.

<p align="center">
  <img src="../../examples/quote-motivational/preview.gif" alt="Quote Mode Demo" width="360" />
</p>

---

## 🎬 Visual Structure
1. **Atmospheric Opening (0:00 - 0:02)**: Serene dawn sunrise or oceanic horizon with ultra-smooth Ken Burns slow drift motion.
2. **Measured Typography Reveal**: Spoken with a deliberate, calming cadence (0.88x speed). Words reveal gracefully using the `handwritten` or `minimal` typography preset with subtle soft drop shadows.
3. **Author Attribution**: Elegant small-caps author signature enters with a soft fade and golden accent line.
4. **Calming Soundscape**: Warm ambient documentary music that ducks seamlessly during speech, leaving a gentle resonant trail.

---

## 📋 Input Format

### 1. Minimal JSON Input (`input.json`)
```json
{
  "mode": "quote-motivational",
  "quote": "You have power over your mind, not outside events. Realize this, and you will find strength.",
  "author": "Marcus Aurelius",
  "settings": {
    "subtitlePreset": "handwritten",
    "voice": "bm_george",
    "music": "music/leberch-documentary-calm-603945.mp3",
    "quality": "hd"
  }
}
```

---

## 🎛️ Customization Knobs
- **Typography Preset**:
  - `handwritten`: Organic italicized serif font with warm parchment tone.
  - `minimal`: Thin modern geometric typography for contemporary quotes.
  - `classic`: Bold boxed presentation.
- **Pacing & Cadence**: Fine-tune speech rate from 0.80x (deep meditative) to 1.0x (standard).
- **Background Atmosphere**: Connects to live nature footage APIs (clouds, mountains, oceans) or renders golden sunrise gradients offline.
- **Ambient Audio**: Built-in royalty-free ambient piano and nature soundscapes.

---

## 🚀 Run It Yourself
```bash
git clone https://github.com/docuforge/docuforge.git
cd docuforge
npx serve .
```
1. Select **Quote & Stoic Wisdom** mode.
2. Enter your quote and author.
3. Click **Generate Video** — finished MP4 is created entirely client-side without any server costs!

---

## 🔄 Reproduce This Example
```bash
node tools/export-examples.js quote-motivational
```
Input definition: [examples/quote-motivational/input.json](../../examples/quote-motivational/input.json)

---

## 📜 Asset Credits & Licenses
- **Music**: *Documentary Calm* by Leberch (Pixabay Content License).
- **Quote Text**: Marcus Aurelius, *Meditations* (Public Domain).
- **TTS**: Kokoro Neural TTS (Apache-2.0).

See full details in [examples/quote-motivational/credits.md](../../examples/quote-motivational/credits.md).
