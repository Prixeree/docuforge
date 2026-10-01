# 💬 DocuForge Reddit Story Mode

> Turn any dramatic confession or story into a high-retention 60–180s vertical video with an authentic animated Reddit post card, continuous gameplay background, and centered kinetic captions — rendered 100% in-browser.

<p align="center">
  <img src="../../examples/reddit-story/preview.gif" alt="Reddit Story Mode Demo" width="360" />
</p>

---

## 🎬 Visual Structure
1. **Reddit Post Card Header (0:00 - 0:04)**: Authentic Reddit-styled post card featuring subreddit icon, author username, upvote tally, comment count, and the story title. Slides smoothly from the top, pulses, and gracefully docks into the corner.
2. **Continuous Gameplay Background (Unbroken)**: Features continuous, mesmerizing CC-BY gameplay (Minecraft parkour, GTA 5 stunt ramps) streaming without disruptive scene cuts.
3. **Centered Kinetic Subtitles**: Word-by-word active scaling and highlight centered on screen, ensuring effortless readability at rapid reading speeds.
4. **Suspenseful Audio**: Tension-building background score with dynamic voice ducking (lowered by 85% during voiceover) and subtle riser SFX on story turning points.

---

## 📋 Input Format

### 1. Minimal JSON Input (`input.json`)
```json
{
  "mode": "reddit-story",
  "subreddit": "r/confession",
  "username": "u/midnight_wanderer",
  "title": "I accidentally convinced my entire town that a mythical phantom cat was stalking our village",
  "upvotes": "42.5k",
  "comments": "3.8k",
  "story": "It started three winters ago when I bought a high-powered green laser pointer from an electronics flea market. Late one foggy night, I projected a pair of luminous reflective green dots onto the edge of the dark pine woods behind the village hall...",
  "settings": {
    "subtitlePreset": "bold-pop",
    "voice": "bm_george",
    "music": "music/kevin-macleod-the-descent.mp3",
    "quality": "hd",
    "clip": "XBIaqOm0RKQ_00"
  }
}
```

### 2. Raw Text Input (Auto-parsed)
You can paste raw text or paragraphs directly; the engine will parse the first line as the post title and subsequent paragraphs into voiceover scenes.

---

## 🎛️ Customization Knobs
- **Gameplay Clip**: Pick from the 13 pre-cut vertical CC-BY gameplay library segments (Minecraft parkour, GTA 5 ramps) or let the engine select an optimal segment automatically based on audio duration.
- **Voiceover**: Choose between natural voices (`bm_george` for dramatic storytelling, `am_adam` for fast-paced reading, or `bf_alice`).
- **Post Header Details**: Customize subreddit name, author username, upvotes (`42.5k`), and comments (`3.8k`).
- **Subtitle Typography**: Switch between `bold-pop`, `classic`, or `karaoke`.
- **Music Ducking**: Automatic voice-activated ducking ensures narration is always crystal-clear over background music.

---

## 🚀 Run It Yourself
```bash
git clone https://github.com/docuforge/docuforge.git
cd docuforge
npx serve .
```
1. Select **Dramatic Reddit Story** mode.
2. Enter your title and story text.
3. Click **Generate Video** — watch the video synthesize and export locally with zero server upload!

---

## 🔄 Reproduce This Example
To generate the exact video shown in the preview:
```bash
node tools/export-examples.js reddit-story
```
Input definition: [examples/reddit-story/input.json](../../examples/reddit-story/input.json)

---

## 📜 Asset Credits & Licenses
- **Gameplay**: *Minecraft Parkour 7 Min* (CC-BY by raw meat) & *Minecraft Parkour Gameplay* (CC-BY by No Copyright Gameplay).
- **Music**: *The Descent* by Kevin MacLeod (Incompetech, CC-BY 3.0).
- **TTS**: Kokoro Neural TTS (Apache-2.0).

See full details in [examples/reddit-story/credits.md](../../examples/reddit-story/credits.md).
