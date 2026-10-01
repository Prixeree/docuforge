/**
 * sfx.js - Procedural WebAudio SFX Fallback Engine
 * 
 * Used only when an external SFX audio asset fails to load.
 * Generates: 'whoosh', 'ding', 'tick', 'chime', 'riser', 'hit'.
 */

export function generateProceduralSFX(type, sampleRate = 48000) {
  switch (type) {
    case 'whoosh':
      return generateWhoosh(sampleRate);
    case 'ding':
      return generateDing(sampleRate);
    case 'tick':
      return generateTick(sampleRate);
    case 'chime':
      return generateChime(sampleRate);
    case 'riser':
      return generateRiser(sampleRate);
    case 'hit':
    default:
      return generateHit(sampleRate);
  }
}

function generateWhoosh(sr) {
  const duration = 0.45;
  const frames = Math.floor(duration * sr);
  const ctx = new OfflineAudioContext(1, frames, sr);

  // Filtered white noise sweep
  const buffer = ctx.createBuffer(1, frames, sr);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.sin((i / frames) * Math.PI);
  }

  const src = ctx.createBufferSource();
  src.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.setValueAtTime(300, 0);
  filter.frequency.exponentialRampToValueAtTime(2400, duration * 0.5);
  filter.frequency.exponentialRampToValueAtTime(400, duration);
  filter.Q.value = 3.0;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, 0);
  gain.gain.linearRampToValueAtTime(0.8, duration * 0.4);
  gain.gain.exponentialRampToValueAtTime(0.001, duration);

  src.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  src.start();

  return ctx.startRendering();
}

function generateDing(sr) {
  const duration = 1.2;
  const frames = Math.floor(duration * sr);
  const ctx = new OfflineAudioContext(1, frames, sr);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(1760, 0); // A6 bell

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.8, 0);
  gain.gain.exponentialRampToValueAtTime(0.0001, duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();

  return ctx.startRendering();
}

function generateTick(sr) {
  const duration = 0.05;
  const frames = Math.floor(duration * sr);
  const ctx = new OfflineAudioContext(1, frames, sr);

  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(800, 0);
  osc.frequency.exponentialRampToValueAtTime(200, duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.6, 0);
  gain.gain.exponentialRampToValueAtTime(0.001, duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();

  return ctx.startRendering();
}

function generateChime(sr) {
  const duration = 1.6;
  const frames = Math.floor(duration * sr);
  const ctx = new OfflineAudioContext(1, frames, sr);

  const freqs = [523.25, 659.25, 783.99, 1046.50]; // C E G C
  freqs.forEach((f, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = f;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, 0);
    gain.gain.setValueAtTime(0.25, i * 0.08);
    gain.gain.exponentialRampToValueAtTime(0.0001, duration);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(i * 0.08);
  });

  return ctx.startRendering();
}

function generateRiser(sr) {
  const duration = 2.0;
  const frames = Math.floor(duration * sr);
  const ctx = new OfflineAudioContext(1, frames, sr);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(80, 0);
  osc.frequency.exponentialRampToValueAtTime(880, duration);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(200, 0);
  filter.frequency.exponentialRampToValueAtTime(4000, duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.05, 0);
  gain.gain.linearRampToValueAtTime(0.5, duration * 0.9);
  gain.gain.exponentialRampToValueAtTime(0.001, duration);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);
  osc.start();

  return ctx.startRendering();
}

function generateHit(sr) {
  const duration = 1.0;
  const frames = Math.floor(duration * sr);
  const ctx = new OfflineAudioContext(1, frames, sr);

  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(120, 0);
  osc.frequency.exponentialRampToValueAtTime(30, duration);

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.9, 0);
  gain.gain.exponentialRampToValueAtTime(0.001, duration);

  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();

  return ctx.startRendering();
}
