// Tiny sound effects made with the Web Audio API (no audio files needed).
let ctx;
let muted = localStorage.getItem('sumo-bump:muted') === '1';

function audio() {
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

export const isMuted = () => muted;
export function toggleMute() {
  muted = !muted;
  localStorage.setItem('sumo-bump:muted', muted ? '1' : '0');
  return muted;
}

function tone(freq, duration, type = 'sine', volume = 0.2, slideTo = null) {
  if (muted) return;
  const a = audio();
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, a.currentTime);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + duration);
  gain.gain.setValueAtTime(volume, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + duration);
  osc.connect(gain).connect(a.destination);
  osc.start();
  osc.stop(a.currentTime + duration);
}

function noise(duration, volume = 0.25, filterFreq = 1200) {
  if (muted) return;
  const a = audio();
  const buffer = a.createBuffer(1, Math.floor(a.sampleRate * duration), a.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filter = a.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = a.createGain();
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(a.destination);
  src.start();
}

export const sfx = {
  dash: (big = false) => {
    if (big) { noise(0.35, 0.3, 1200); tone(180, 0.3, 'sawtooth', 0.08, 70); }
    else noise(0.18, 0.18, 2500);
  },
  bump: (strength = 1) => tone(140, 0.15, 'triangle', Math.min(0.15 + strength * 0.05, 0.4), 60),
  splash: () => { noise(0.5, 0.3, 900); tone(500, 0.3, 'sine', 0.08, 120); },
  win: () => [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => tone(f, 0.18, 'square', 0.08), i * 110)),
  lose: () => [392, 330, 262].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'square', 0.08), i * 160)),
  click: () => tone(660, 0.06, 'square', 0.05),
};
