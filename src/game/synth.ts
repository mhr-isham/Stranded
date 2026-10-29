// Bounded, disposable Web Audio voices; also usable with OfflineAudioContext.
import type { Note } from './score';
export type Cue = 'click' | 'tick' | 'good' | 'bad' | 'log' | 'launch' | 'unlock' | 'shutter' | 'measure' | 'radio' | 'chute' | 'touchdown';
export const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

export class Synth {
  private noise: AudioBuffer;
  private active = new Set<AudioScheduledSourceNode>();
  private tails = new Set<AudioNode>();
  readonly out: GainNode;
  constructor(
    readonly ctx: BaseAudioContext,
    destination: AudioNode,
    space = false,
  ) {
    this.out = ctx.createGain();
    this.out.connect(destination);
    this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    let seed = 0x51a7;
    for (let i = 0; i < data.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[i] = (seed / 4294967296) * 2 - 1;
    }
    if (space) {
      const delay = ctx.createDelay(1),
        feedback = ctx.createGain(),
        wet = ctx.createGain(),
        lowpass = ctx.createBiquadFilter();
      delay.delayTime.value = (60 / 112) * 0.75;
      feedback.gain.value = 0.24;
      wet.gain.value = 0.16;
      lowpass.frequency.value = 2600;
      this.out.connect(delay).connect(lowpass).connect(wet).connect(destination);
      lowpass.connect(feedback).connect(delay);
      [delay, feedback, wet, lowpass].forEach((n) => this.tails.add(n));
    }
  }
  private track(source: AudioScheduledSourceNode, end: number, nodes: AudioNode[]) {
    this.active.add(source);
    source.onended = () => {
      this.active.delete(source);
      source.disconnect();
      nodes.forEach((n) => n.disconnect());
    };
    source.stop(end);
  }
  tone(
    freq: number,
    at: number,
    duration: number,
    level: number,
    type: OscillatorType = 'sine',
    slide = 1,
    pan = 0,
    cutoff = 5000,
    attack = 0.004,
    hold = 0,
  ) {
    const c = this.ctx,
      o = c.createOscillator(),
      filter = c.createBiquadFilter(),
      env = c.createGain(),
      stereo = c.createStereoPanner();
    o.type = type;
    o.frequency.setValueAtTime(freq, at);
    if (slide !== 1) o.frequency.exponentialRampToValueAtTime(Math.max(15, freq * slide), at + duration);
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, at);
    filter.frequency.exponentialRampToValueAtTime(Math.max(160, cutoff * 0.35), at + duration);
    stereo.pan.value = pan;
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(level, at + Math.min(attack, duration / 3));
    if (hold) env.gain.linearRampToValueAtTime(level * 0.7, at + duration * hold);
    env.gain.exponentialRampToValueAtTime(0.00001, at + duration);
    o.connect(filter).connect(env).connect(stereo).connect(this.out);
    o.start(at);
    this.track(o, at + duration + 0.02, [filter, env, stereo]);
  }
  burst(at: number, duration: number, level: number, hz: number, type: BiquadFilterType = 'bandpass', pan = 0) {
    const source = this.ctx.createBufferSource(),
      f = this.ctx.createBiquadFilter(),
      g = this.ctx.createGain(),
      p = this.ctx.createStereoPanner();
    source.buffer = this.noise;
    f.type = type;
    f.frequency.value = hz;
    f.Q.value = 0.7;
    p.pan.value = pan;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(level, at + 0.003);
    g.gain.exponentialRampToValueAtTime(0.00001, at + duration);
    source.connect(f).connect(g).connect(p).connect(this.out);
    source.start(at);
    this.track(source, at + duration + 0.02, [f, g, p]);
  }
  note(n: Note, at: number) {
    const f = midiHz(n.midi),
      v = n.velocity;
    switch (n.instrument) {
      case 'kick':
        this.tone(145, at, 0.23, v * 0.38, 'sine', 0.28);
        this.burst(at, 0.018, v * 0.08, 2200);
        break;
      case 'snare':
        this.burst(at, 0.14, v * 0.23, 2200);
        this.tone(185, at, 0.09, v * 0.12, 'triangle', 0.65);
        break;
      case 'hat':
        this.burst(at, n.duration, v * 0.14, 7500, 'highpass', n.pan);
        break;
      case 'bass':
        this.tone(f, at, n.duration, v * 0.16, 'sawtooth', 1, 0, 650);
        this.tone(f / 2, at, n.duration, v * 0.16);
        break;
      case 'pad':
        this.tone(f * 0.998, at, n.duration + 1.2, v * 0.045, 'sawtooth', 1, n.pan, 1000, 0.45, 0.72);
        this.tone(f * 1.002, at, n.duration + 1.2, v * 0.045, 'triangle', 1, -(n.pan ?? 0), 1800, 0.45, 0.72);
        break;
      case 'arp':
        this.tone(f, at, n.duration, v * 0.1, 'triangle', 1, n.pan, 3600);
        this.tone(f * 2, at, n.duration * 0.55, v * 0.025, 'sine', 1, n.pan);
        break;
      case 'lead':
        this.tone(f, at, n.duration, v * 0.12, 'triangle', 1, n.pan, 4800, 0.012);
        this.tone(f * 1.004, at, n.duration * 0.75, v * 0.04, 'sine', 1, 0.2, 4000, 0.012);
        break;
    }
  }
  cue(kind: Cue, at = this.ctx.currentTime) {
    switch (kind) {
      case 'click':
        this.burst(at, 0.025, 0.15, 2700);
        this.tone(620, at, 0.045, 0.07, 'triangle', 0.72);
        break;
      case 'tick':
        this.burst(at, 0.015, 0.2, 4100);
        this.tone(1850, at, 0.035, 0.09, 'sine', 0.6);
        break;
      case 'measure':
        this.burst(at, 0.035, 0.12, 1200);
        this.tone(740, at, 0.12, 0.12, 'triangle', 1.5);
        break;
      case 'shutter':
        this.burst(at, 0.04, 0.2, 1600);
        this.burst(at + 0.055, 0.045, 0.13, 3200);
        this.tone(1480, at + 0.075, 0.1, 0.08, 'sine', 1.25);
        break;
      case 'radio':
        this.burst(at, 0.1, 0.1, 2400);
        [880, 1320, 1760].forEach((f, i) => this.tone(f, at + i * 0.045, 0.07, 0.09, 'triangle'));
        break;
      case 'log':
        [740, 1110, 1480].forEach((f, i) => this.tone(f, at + i * 0.045, 0.12, 0.1, 'triangle', 1, (i - 1) * 0.3));
        break;
      case 'good':
        [71, 78, 83].forEach((m, i) => this.tone(midiHz(m), at + i * 0.07, 0.3, 0.12, 'triangle'));
        break;
      case 'bad':
        this.tone(294, at, 0.18, 0.11, 'triangle', 0.8);
        this.tone(220, at + 0.14, 0.28, 0.09, 'triangle', 0.75);
        break;
      case 'unlock':
        [64, 71, 76, 79, 83].forEach((m, i) => {
          this.tone(midiHz(m), at + i * 0.065, 0.55, 0.11, 'triangle', 1, (i - 2) * 0.2);
          this.tone(midiHz(m + 12), at + i * 0.065, 0.3, 0.025);
        });
        break;
      case 'launch':
        this.burst(at, 1.8, 0.48, 210, 'lowpass');
        this.burst(at + 0.12, 1.3, 0.16, 1800);
        this.tone(46, at, 1.6, 0.28, 'sine', 1.8, 0, 800, 0.12);
        this.tone(130, at, 0.7, 0.09, 'sawtooth', 3, 0, 1100, 0.08);
        break;
      case 'chute':
        this.burst(at, 0.55, 0.32, 2700, 'lowpass');
        this.tone(85, at, 0.12, 0.24, 'sine', 0.5);
        break;
      case 'touchdown':
        this.burst(at, 0.3, 0.35, 350, 'lowpass');
        this.tone(90, at, 0.25, 0.25, 'sine', 0.4);
        this.cue('good', at + 0.25);
        break;
    }
  }
  engine(destination: AudioNode) {
    const c = this.ctx,
      body = c.createBufferSource(),
      filter = c.createBiquadFilter(),
      gain = c.createGain();
    body.buffer = this.noise;
    body.loop = true;
    filter.type = 'lowpass';
    filter.Q.value = 1.1;
    gain.gain.value = 0;
    body.connect(filter).connect(gain).connect(destination);
    const sub = c.createOscillator(),
      subGain = c.createGain();
    sub.type = 'triangle';
    subGain.gain.value = 0;
    sub.connect(subGain).connect(destination);
    const turbine = c.createOscillator(),
      turbineFilter = c.createBiquadFilter(),
      turbineGain = c.createGain();
    turbine.type = 'sawtooth';
    turbineFilter.frequency.value = 850;
    turbineGain.gain.value = 0;
    turbine.connect(turbineFilter).connect(turbineGain).connect(destination);
    body.start();
    sub.start();
    turbine.start();
    let stopped = false;
    return {
      set: (level: number, brightness: number) => {
        if (stopped) return;
        const t = c.currentTime;
        gain.gain.setTargetAtTime(level * 0.28, t, 0.08);
        filter.frequency.setTargetAtTime(180 + brightness * 2200 + level * 400, t, 0.12);
        sub.frequency.setTargetAtTime(38 + level * 32, t, 0.12);
        subGain.gain.setTargetAtTime(level * 0.12, t, 0.08);
        turbine.frequency.setTargetAtTime(90 + level * 180, t, 0.18);
        turbineGain.gain.setTargetAtTime(level * 0.02, t, 0.1);
      },
      stop: () => {
        if (stopped) return;
        stopped = true;
        const end = c.currentTime + 0.1;
        [gain, subGain, turbineGain].forEach((g) => g.gain.setTargetAtTime(0, c.currentTime, 0.015));
        [body, sub, turbine].forEach((s) => {
          s.onended = () => s.disconnect();
          s.stop(end);
        });
        body.onended = () => {
          body.disconnect();
          [filter, gain, subGain, turbineFilter, turbineGain].forEach((n) => n.disconnect());
        };
      },
    };
  }
  stop() {
    this.active.forEach((s) => {
      s.stop();
    });
    this.active.clear();
    this.out.disconnect();
    this.tails.forEach((n) => n.disconnect());
    this.tails.clear();
  }
}
