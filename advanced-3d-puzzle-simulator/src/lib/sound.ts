// Tiny WebAudio synth for tactile feedback. No assets, fully offline.

let ctx: AudioContext | null = null;
let muted = false;

export function setMuted(m: boolean) {
  muted = m;
}

function ac(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
    } catch {
      return null;
    }
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function blip(freq: number, dur: number, type: OscillatorType, gain = 0.05, when = 0) {
  const c = ac();
  if (!c) return;
  const t0 = c.currentTime + when;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g).connect(c.destination);
  o.start(t0);
  o.stop(t0 + dur + 0.02);
}

export const sfx = {
  move() {
    blip(210 + Math.random() * 40, 0.09, "triangle", 0.06);
  },
  click() {
    blip(520, 0.05, "sine", 0.04);
  },
  scramble() {
    for (let i = 0; i < 5; i++) blip(180 + i * 60, 0.05, "square", 0.02, i * 0.04);
  },
  solved() {
    [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.22, "sine", 0.05, i * 0.09));
  },
  error() {
    blip(140, 0.25, "sawtooth", 0.05);
  },
  tick() {
    blip(880, 0.03, "sine", 0.025);
  },
};
