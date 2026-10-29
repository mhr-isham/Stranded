import { useGame, type Settings } from './store';
import { sceneFor, scoreStep, STEP_SECONDS } from './score';
import { Synth, type Cue } from './synth';

export type Sfx = Cue;
export const AUDIO_DEFAULTS = { musicVolume: 0.65, effectsVolume: 0.8 };
const volume = (value: number | undefined, fallback: number) => (Number.isFinite(value) ? Math.max(0, Math.min(1, value!)) : fallback);

let ctx: AudioContext | null = null;
let master: GainNode;
let musicGain: GainNode;
let effectsGain: GainNode;
let music: Synth;
let effects: Synth;
let timer: ReturnType<typeof setInterval> | null = null;
let next = 0;
let step = 0;
let wanted = false;
let engine: ReturnType<Synth['engine']> | null = null;
let unsubscribe: (() => void) | null = null;
const lastCue = new Map<Cue, number>();

function sync(settings: Settings) {
  if (!ctx) return;
  const audible = settings.sound && !document.hidden;
  if (!audible) stopRumble();
  // Mute the shared bus, including already scheduled notes and engine tails.
  master.gain.setTargetAtTime(audible ? 0.8 : 0, ctx.currentTime, 0.015);
  musicGain.gain.setTargetAtTime(volume(settings.musicVolume, AUDIO_DEFAULTS.musicVolume), ctx.currentTime, 0.1);
  effectsGain.gain.setTargetAtTime(volume(settings.effectsVolume, AUDIO_DEFAULTS.effectsVolume), ctx.currentTime, 0.03);
  if (audible && wanted) schedule();
  else if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function ac() {
  if (!useGame.getState().settings.sound || document.hidden) return null;
  if (!ctx) {
    const C = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!C) return null;
    ctx = new C();
    master = ctx.createGain();
    master.gain.value = 0;
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 12;
    limiter.ratio.value = 5;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.18;
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.value = 28;
    master.connect(highpass).connect(limiter).connect(ctx.destination);
    musicGain = ctx.createGain();
    effectsGain = ctx.createGain();
    musicGain.connect(master);
    effectsGain.connect(master);
    music = new Synth(ctx, musicGain, true);
    effects = new Synth(ctx, effectsGain);
    next = ctx.currentTime + 0.04;
    unsubscribe = useGame.subscribe((s, prev) => {
      if (s.settings !== prev.settings) sync(s.settings);
    });
    document.addEventListener('visibilitychange', onVisibility);
    sync(useGame.getState().settings);
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  return ctx;
}

function schedule() {
  if (timer || !ctx) return;
  next = Math.max(next, ctx.currentTime + 0.03);
  const pump = () => {
    if (!ctx || ctx.state !== 'running') return;
    // A throttled tab must not replay a backlog of notes when it returns.
    if (next < ctx.currentTime) next = ctx.currentTime + 0.02;
    const s = useGame.getState();
    const scene = sceneFor(s);
    music.out.gain.setTargetAtTime(1.8 * (s.storyQueue.length ? 0.38 : scene === 'focus' ? 0.7 : 1), ctx.currentTime, 0.25);
    while (next < ctx.currentTime + 0.15) {
      scoreStep(scene, step++).forEach((n) => music.note(n, next));
      next += STEP_SECONDS;
    }
  };
  pump();
  timer = setInterval(pump, 35);
}

function onVisibility() {
  if (!ctx) return;
  sync(useGame.getState().settings);
  if (document.hidden) {
    stopRumble();
    void ctx.suspend().catch(() => {});
  } else if (useGame.getState().settings.sound) {
    next = ctx.currentTime + 0.04;
    void ctx.resume().catch(() => {});
  }
}

export function sfx(kind: Sfx) {
  const a = ac();
  if (!a) return;
  // Mission batches may award several unlocks together. Keep the reward clear.
  if (a.currentTime - (lastCue.get(kind) ?? -Infinity) < (kind === 'unlock' ? 0.45 : 0.035)) return;
  lastCue.set(kind, a.currentTime);
  effects.cue(kind, a.currentTime + 0.002);
}

/** Gesture-unlocked original music, arranged live for the current game scene. */
export function startAmbient() {
  wanted = true;
  if (ac()) schedule();
}
export function stopAmbient() {
  wanted = false;
  if (timer) clearInterval(timer);
  timer = null;
  if (ctx) musicGain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
}
export function setRumble(level: number, tone = 0.3) {
  if (!ac()) return;
  const l = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
  const t = Number.isFinite(tone) ? Math.max(0, Math.min(1, tone)) : 0.3;
  if (!engine && l > 0.001) engine = effects.engine(effectsGain);
  engine?.set(l, t);
}
export function stopRumble() {
  engine?.stop();
  engine = null;
}

/** Release timers, subscriptions and voices on app teardown / hot replacement. */
export function disposeAudio() {
  stopAmbient();
  stopRumble();
  unsubscribe?.();
  unsubscribe = null;
  document.removeEventListener('visibilitychange', onVisibility);
  if (ctx) {
    music.stop();
    effects.stop();
    void ctx.close().catch(() => {});
  }
  ctx = null;
  step = 0;
  next = 0;
  lastCue.clear();
}
if (import.meta.hot) import.meta.hot.dispose(disposeAudio);
