# ❓ DocuForge Quiz & Trivia Mode

> Generate interactive 25–40s trivia shorts with staggered multi-choice option cards, a pulsing 3-2-1 countdown timer, and an animated green answer reveal with chime SFX.

<p align="center">
  <img src="../../examples/quiz-trivia/preview.gif" alt="Quiz Mode Demo" width="360" />
</p>

---

## 🎬 Visual Structure
1. **Question & Option Cascade (0:00 - 0:05)**: The main question enters with dynamic kinetic text. Four glassmorphic choice cards (A, B, C, D) cascade into the lower frame with spring physics.
2. **Interactive 3-2-1 Countdown (0:05 - 0:09)**: A central radial countdown timer pulses with rhythmic clock-ticking SFX, maximizing audience engagement as viewers guess in the comments.
3. **Emerald Answer Reveal (0:09 - 0:13)**: The correct option illuminates in vivid emerald green (`#10B981`) with an expanding neon glow pulse and chime sound effect, while incorrect choices dim.
4. **Fun Fact / Explanation**: Fast follow-up explanation narrating the surprising context behind the answer.

---

## 📋 Input Format

### 1. Minimal JSON Input (`input.json`)
```json
{
  "mode": "quiz-trivia",
  "question": "Which planet in our solar system has the shortest day?",
  "options": [
    "Earth",
    "Mars",
    "Jupiter",
    "Venus"
  ],
  "correctIndex": 2,
  "funFact": "Jupiter rotates so rapidly that one complete day lasts just 9 hours and 55 minutes!",
  "settings": {
    "subtitlePreset": "bold-pop",
    "voice": "bm_george",
    "music": "music/kevin-macleod-faster-does-it.mp3",
    "quality": "hd"
  }
}
```

---

## 🎛️ Customization Knobs
- **Choice Count**: Supports 2, 3, or 4 answer options.
- **Countdown Duration**: Configurable 3-second or 5-second countdown timer.
- **Card Aesthetics**: Glassmorphic semi-transparent backdrop with customizable neon accent borders.
- **Sound Design**: Integrated clock tick SFX during countdown and chime reveal on answer flash.
- **Background Loop**: Neon purple-cyan procedural grid particles or relevant live stock footage.

---

## 🚀 Run It Yourself
```bash
git clone https://github.com/docuforge/docuforge.git
cd docuforge
npx serve .
```
1. Select **Quiz & Interactive Trivia** mode.
2. Enter your question, 4 choices, mark the correct option, and add a fun fact.
3. Click **Generate Video** — exports high-retention trivia MP4 locally in seconds.

---

## 🔄 Reproduce This Example
```bash
node tools/export-examples.js quiz-trivia
```
Input definition: [examples/quiz-trivia/input.json](../../examples/quiz-trivia/input.json)

---

## 📜 Asset Credits & Licenses
- **Music**: *Faster Does It* by Kevin MacLeod (Incompetech, CC-BY 3.0).
- **TTS**: Kokoro Neural TTS (Apache-2.0).
- **SFX**: Clock ticking and chime reveal sounds (CC0).

See full details in [examples/quiz-trivia/credits.md](../../examples/quiz-trivia/credits.md).
