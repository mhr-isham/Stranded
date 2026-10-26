// Tiny synthesised sound effects (no audio files), plus a soft ambient pad.

import { useGame } from './store';

let ctx: AudioContext | null = null;
let ambient: { stop: () => void } | null = null;

function ac() {
  if (!useGame.getState().settings.sound) return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType = 'sine', gain = 0.08, slide = 0) {
  const a = ac();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, a.currentTime);
  if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, a.currentTime + dur);
  g.gain.setValueAtTime(gain, a.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + dur);
  o.connect(g).connect(a.destination);
  o.start();
  o.stop(a.currentTime + dur);
}

export type Sfx = 'click' | 'tick' | 'good' | 'bad' | 'log' | 'launch' | 'unlock';

export function sfx(kind: Sfx) {
  switch (kind) {
    case 'click':
      return tone(880, 0.06, 'square', 0.04);
    case 'tick':
      return tone(1400, 0.03, 'sine', 0.05);
    case 'good':
      tone(660, 0.12, 'sine', 0.07);
      setTimeout(() => tone(990, 0.18, 'sine', 0.06), 90);
      return;
    case 'bad':
      return tone(220, 0.3, 'sawtooth', 0.04, 0.6);
    case 'log':
      return tone(1200, 0.08, 'triangle', 0.05, 1.3);
    case 'unlock':
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tone(f, 0.25, 'sine', 0.05), i * 90));
      return;
    case 'launch': {
      const a = ac();
      if (!a) return;
      const len = 4;
      const buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.min(1, i / (a.sampleRate * 0.5)) * (1 - i / d.length);
      const src = a.createBufferSource();
      src.buffer = buf;
      const f = a.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 300;
      const g = a.createGain();
      g.gain.value = 0.35;
      src.connect(f).connect(g).connect(a.destination);
      src.start();
      return;
    }
  }
}

/** Gentle wind + drone. Starts on first user gesture. */
export function startAmbient() {
  const a = ac();
  if (!a || ambient) return;
  const master = a.createGain();
  master.gain.value = 0.0;
  master.gain.linearRampToValueAtTime(0.05, a.currentTime + 4);
  master.connect(a.destination);
  const oscs = [55, 82.4, 110.2].map((f, i) => {
    const o = a.createOscillator();
    o.type = 'sine';
    o.frequency.value = f;
    o.detune.value = i * 4;
    const g = a.createGain();
    g.gain.value = 0.35 / (i + 1);
    o.connect(g).connect(master);
    o.start();
    return o;
  });
  const len = 3;
  const buf = a.createBuffer(1, a.sampleRate * len, a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const noise = a.createBufferSource();
  noise.buffer = buf;
  noise.loop = true;
  const bp = a.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = 500;
  bp.Q.value = 0.6;
  const ng = a.createGain();
  ng.gain.value = 0.25;
  noise.connect(bp).connect(ng).connect(master);
  noise.start();
  ambient = {
    stop: () => {
      oscs.forEach((o) => o.stop());
      noise.stop();
      ambient = null;
    },
  };
}

export function stopAmbient() {
  ambient?.stop();
}
