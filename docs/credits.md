# Media Credits & Third-Party API Attributions

DocuForge respects open licensing, creator rights, and platform terms of service. This document outlines the licenses, attribution requirements, and terms for all media used within DocuForge.

---

## 1. Stock Video Footage (Modes 1–6)

Stock video footage for `viral`, `explainer`, `myth-vs-fact`, `quote-motivational`, `quiz-trivia`, and `would-you-rather` modes is fetched dynamically at runtime via official public APIs.

### Pexels
- **Source**: [Pexels Video API](https://www.pexels.com/api/)
- **License**: [Pexels License](https://www.pexels.com/license/) (Free to use, commercial and non-commercial, no modification required, attribution appreciated and prominently provided).
- **Attribution Policy**:
  - All videos display creator credits: `"Video by [Creator] on Pexels"` with direct links to the creator's Pexels profile.
  - Pexels badge and link are permanently embedded in the application footer:
    > Photos and videos provided by [Pexels](https://www.pexels.com).
- **Hotlinking & Caching Rules**:
  - Hotlinking original MP4 URLs directly from Pexels CDNs is permitted for web video creation.
  - Responses are cached in IndexedDB and Cloudflare Edge Cache exclusively to optimize user performance and respect rate limits (200 requests/hour, 20,000 requests/month).
  - No stock video files are redistributed or stored in DocuForge git repositories.

### Pixabay
- **Source**: [Pixabay Video API](https://pixabay.com/api/docs/)
- **License**: [Pixabay Content License](https://pixabay.com/service/license-summary/) (Free for commercial and non-commercial use across print and digital).
- **Attribution Policy**:
  - Credited as `"Video by [Creator] from Pixabay"`.
  - Permanent attribution in application footer and documentation:
    > Videos provided by [Pixabay](https://pixabay.com).
- **Rate Limits & Caching**:
  - 100 requests per minute.
  - Video URLs are consumed at runtime and cached client-side in IndexedDB.

---

## 2. Gameplay Library (Reddit Story Mode Only)

Gameplay footage in `docuforge-assets/clips` is distributed under strict Creative Commons Attribution licenses verified directly via YouTube machine metadata:

1. **Minecraft Parkour Gameplay 4K**
   - **Video ID**: `BXUA2FncVPI`
   - **Creator**: Orbital - No Copyright Gameplay
   - **License**: Creative Commons Attribution license (reuse allowed)
   - **Attribution**: Footage by Orbital - No Copyright Gameplay via YouTube (CC-BY)

2. **GTA 5 Mega Ramp Gameplay 4K 60FPS**
   - **Video ID**: `weAUrmRLpnk`
   - **Creator**: No Copyright Gameplay 4K
   - **License**: Creative Commons Attribution license (reuse allowed)
   - **Attribution**: Footage by No Copyright Gameplay 4K via YouTube (CC-BY)

3. **Minecraft Parkour 7 Minutes Free To Use**
   - **Video ID**: `XBIaqOm0RKQ`
   - **Creator**: Free To Use Gameplay
   - **License**: Creative Commons Attribution license (reuse allowed)
   - **Attribution**: Footage by Free To Use Gameplay via YouTube (CC-BY)

---

## 3. Background Music

All background music tracks are Creative Commons Attribution or Pixabay Content License:

1. **Sneaky Snitch** - Kevin MacLeod ([incompetech.com](https://incompetech.com))
   - License: Creative Commons: By Attribution 4.0 International (CC-BY 4.0)
2. **The Descent** - Kevin MacLeod ([incompetech.com](https://incompetech.com))
   - License: Creative Commons: By Attribution 4.0 International (CC-BY 4.0)
3. **Faster Does It** - Kevin MacLeod ([incompetech.com](https://incompetech.com))
   - License: Creative Commons: By Attribution 4.0 International (CC-BY 4.0)
4. **Carefree** - Kevin MacLeod ([incompetech.com](https://incompetech.com))
   - License: Creative Commons: By Attribution 4.0 International (CC-BY 4.0)
5. **Documentary Music** - NastelBom via Pixabay (Pixabay Content License)
6. **Atmosphere Documentary** - Leberch via Pixabay (Pixabay Content License)
7. **Documentary Calm** - Leberch via Pixabay (Pixabay Content License)
8. **History Documentary** - Leberch via Pixabay (Pixabay Content License)

---

## 4. Sound Effects

All sound effects in `docuforge-assets/sfx/` (`whoosh.wav`, `ding.wav`, `tick.wav`, `chime.wav`, `riser.wav`, `hit.wav`) were procedurally synthesized and released into the **Public Domain (CC0 1.0 Universal)**.
