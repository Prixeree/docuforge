/**
 * ambient.js - Procedural WebAudio Ambient Music Bed Fallback
 * 
 * Generates smooth cinematic drone chords when no background music track is available.
 */

export function generateProceduralAmbient(durationSeconds = 60, sampleRate = 48000) {
  const frames = Math.floor(durationSeconds * sampleRate);
  const ctx = new OfflineAudioContext(2, frames, sampleRate);

  // Cinematic D Minor chord: D2 (73.4Hz), A2 (110Hz), F3 (174.6Hz), C4 (261.6Hz)
  const rootFreqs = [73.42, 110.00, 174.61, 261.63];

  rootFreqs.forEach((freq, idx) => {
    const osc = ctx.createOscillator();
    osc.type = (idx % 2 === 0) ? 'sine' : 'triangle';
    osc.frequency.setValueAtTime(freq, 0);

    // Subtle detune for warmth
    osc.detune.setValueAtTime((Math.random() - 0.5) * 8, 0);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(400 + idx * 100, 0);

    const gain = ctx.createGain();
    const targetGain = 0.12 / rootFreqs.length;
    
    // Slow gentle fade in and out
    gain.gain.setValueAtTime(0, 0);
    gain.gain.linearRampToValueAtTime(targetGain, 3.0);
    gain.gain.setValueAtTime(targetGain, Math.max(3.0, durationSeconds - 3.0));
    gain.gain.linearRampToValueAtTime(0, durationSeconds);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start(0);
  });

  return ctx.startRendering();
}
