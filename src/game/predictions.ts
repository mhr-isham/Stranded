// "Call your shot": the player predicts something they will see later, from
// their own data, with an honest ± range. Field trials use a kept reading.
// Scored forecasts use a simulated observable only after the event.

import { DAY, DEG } from '../engine/constants';
import { moonOffset, starLongitude, targetLongitude } from '../engine/measure';
import { sfx } from './audio';
import { useGame, type GameState, type Reading, type TimedValue } from './store';
import { world } from './world';
import type { StarSystem } from '../engine/types';

export type PredictionKind = 'star' | 'retro' | 'moon' | 'pendulum';

export interface Prediction {
  id: string;
  kind: PredictionKind;
  /** Game time it was made. */
  made: number;
  /** Game time it resolves (event predictions resolve shortly after the event). */
  due: number;
  value: number;
  sigma: number;
  /** For 'star': the forecast day. For 'pendulum': the trial knob setting (m). */
  at?: number;
  /** Instrument comparisons are completed by the next matching kept observation. */
  fieldTrial?: true;
  missed?: true;
  result?: { truth: number; points: number; z: number; observedAt?: number };
}

interface KindInfo {
  title: string;
  unit: string;
  /** A typical honest uncertainty; ranges are scored relative to it. */
  scale: number;
  digits: number;
}

export const PREDICTION_KINDS: Record<PredictionKind, KindInfo> = {
  star: { title: 'Where will the star be?', unit: '°', scale: 0.5, digits: 2 },
  retro: { title: 'When will it stop going backwards?', unit: 'day', scale: 3, digits: 1 },
  moon: { title: 'When will the moon be farthest east?', unit: 'day', scale: 0.3, digits: 2 },
  pendulum: { title: 'How long will one swing take?', unit: 's', scale: 0.05, digits: 3 },
};

/**
 * Log score, like the sheet, but against a typical uncertainty: an honest range
 * as tight as `scale` scores ~60, tighter and still right scores more, a
 * confident miss scores below zero.
 */
export function scorePrediction(value: number, sigma: number, truth: number, scale: number) {
  const z = Math.abs(value - truth) / Math.max(sigma, 1e-12);
  const s = -Math.log(Math.max(sigma, 1e-12) / scale) - (z * z) / 2;
  const points = Math.max(-60, Math.min(100, Math.round(60 + 20 * s)));
  return { z, points };
}

/** Day of the next end of retrograde (planet turns from backwards to forwards) after t. */
export function nextStationary(sys: StarSystem, t: number) {
  const rate = (tt: number) => {
    let d = targetLongitude(sys, tt + 0.1 * DAY, sys.site) - targetLongitude(sys, tt - 0.1 * DAY, sys.site);
    if (d > Math.PI) d -= 2 * Math.PI;
    if (d < -Math.PI) d += 2 * Math.PI;
    return d;
  };
  let prev = rate(t);
  for (let tt = t + 0.25 * DAY; tt < t + 500 * DAY; tt += 0.25 * DAY) {
    const r = rate(tt);
    if (prev < 0 && r >= 0) {
      // Refine by bisection.
      let a = tt - 0.25 * DAY;
      let b = tt;
      for (let i = 0; i < 30; i++) {
        const m = (a + b) / 2;
        if (rate(m) < 0) a = m;
        else b = m;
      }
      return (a + b) / 2;
    }
    prev = r;
  }
  return null;
}

/** Next time after t when the moon is at its greatest offset east of the planet. */
export function nextMoonEast(sys: StarSystem, t: number) {
  const step = sys.moon.period / 200;
  const f = (tt: number) => moonOffset(sys, tt, sys.site);
  let a = f(t);
  let b = f(t + step);
  for (let tt = t + step; tt < t + 2 * sys.moon.period; tt += step) {
    const c = f(tt + step);
    if (b > a && b >= c && b > 0) {
      // Golden-section refine around tt.
      let lo = tt - step;
      let hi = tt + step;
      for (let i = 0; i < 40; i++) {
        const m1 = hi - (hi - lo) * 0.618;
        const m2 = lo + (hi - lo) * 0.618;
        if (f(m1) > f(m2)) hi = m2;
        else lo = m1;
      }
      return (lo + hi) / 2;
    }
    a = b;
    b = c;
  }
  return null;
}

export function pendingOf(s: GameState, kind: PredictionKind) {
  return s.predictions.find((p) => p.kind === kind && !p.result && !p.missed) ?? null;
}

export function lastOf(s: GameState, kind: PredictionKind) {
  const done = s.predictions.filter((p) => p.kind === kind && p.result);
  return done[done.length - 1] ?? null;
}

/** Record a prediction. Event predictions get their resolve time from the event itself. */
export function makePrediction(p: Omit<Prediction, 'id'>) {
  const s = useGame.getState();
  const base = `${p.kind}-${Math.round(p.made)}`;
  let id = base, suffix = 1;
  while (s.predictions.some((prior) => prior.id === id)) id = `${base}-${suffix++}`;
  useGame.setState({ predictions: [...s.predictions, { ...p, id }] });
  sfx('log');
  return id;
}

function keepFieldComparison(s: GameState, p: Prediction, value: number, at: number) {
  const z = Math.abs(value - p.value) / p.sigma;
  if (!Number.isFinite(z)) return;
  useGame.setState({ predictions: s.predictions.map((entry) => entry.id === p.id ? {
    ...p, result: { truth: value, points: 0, z, observedAt: at },
  } : entry) });
  sfx('log');
}

export function comparePendulumTrial(reading: Pick<Reading, 'at' | 'pendulum'>) {
  const s = useGame.getState(), p = pendingOf(s, 'pendulum'), timing = reading.pendulum;
  if (!p?.fieldTrial || s.tutorial.active || p.at === undefined || !timing ||
      timing.technique?.source !== 'manual' || !timing.technique.releaseId ||
      !Number.isFinite(reading.at) || reading.at < p.made ||
      !Number.isFinite(timing.length) || Math.abs(timing.length - p.at) > .050001 ||
      !Number.isFinite(timing.period) || timing.period <= 0) return;
  keepFieldComparison(s, p, timing.period, reading.at);
}

export function compareStarTrial(observation: TimedValue) {
  const s = useGame.getState(), p = pendingOf(s, 'star');
  if (!p?.fieldTrial || s.tutorial.active || observation.source !== 'manual' ||
      !Number.isFinite(observation.at) || observation.at < p.due || observation.at >= p.due + DAY ||
      !Number.isFinite(observation.v)) return;
  const angle = observation.v / DEG;
  keepFieldComparison(s, p, angle + 360 * Math.round((p.value - angle) / 360), observation.at);
}

/** True value of the predicted observable. */
function truthOf(s: GameState, p: Prediction): number | null {
  const { system: sys } = world(s.seed, s.settings.difficulty, s.chapter);
  if (p.kind === 'star') {
    const deg = (starLongitude(sys, (p.at ?? 0) * DAY, sys.site) * 180) / Math.PI;
    // Unwrap to the turn closest to the guess.
    return deg + 360 * Math.round((p.value - deg) / 360);
  }
  if (p.kind === 'retro') {
    const t = nextStationary(sys, p.made);
    return t === null ? null : t / DAY;
  }
  if (p.kind === 'moon') {
    const t = nextMoonEast(sys, p.made);
    return t === null ? null : t / DAY;
  }
  return null;
}

/** Resolve a prediction with a known truth (used by immediate predictions like the pendulum). */
export function resolveNow(id: string, truth: number) {
  const s = useGame.getState();
  const p = s.predictions.find((q) => q.id === id);
  if (!p || p.result || p.fieldTrial) return null;
  const { z, points } = scorePrediction(p.value, p.sigma, truth, PREDICTION_KINDS[p.kind].scale);
  const done = { ...p, result: { truth, points, z } };
  useGame.setState({ predictions: s.predictions.map((q) => (q.id === id ? done : q)) });
  sfx(z <= 1 ? 'good' : 'bad');
  return done;
}

/** Called by the simulation as time passes. */
export function resolvePredictions(t: number) {
  const s = useGame.getState();
  if (s.predictions.some((p) => p.kind === 'star' && p.fieldTrial && !p.result && !p.missed && t >= p.due + DAY)) {
    useGame.setState({ predictions: s.predictions.map((p) => p.kind === 'star' && p.fieldTrial && !p.result && !p.missed && t >= p.due + DAY ? { ...p, missed: true } : p) });
  }
  const due = s.predictions.filter((p) => !p.fieldTrial && !p.result && p.kind !== 'pendulum' && p.due <= t);
  if (!due.length) return;
  for (const p of due) {
    const truth = truthOf(s, p);
    if (truth === null) {
      // The event never came (e.g. no loop left before the deadline): withdraw quietly.
      useGame.setState({ predictions: useGame.getState().predictions.filter((q) => q.id !== p.id) });
      continue;
    }
    const done = resolveNow(p.id, truth);
    if (!done?.result) continue;
    const inside = done.result.z <= 1;
    const tool = p.kind === 'moon' ? 'Moon tab' : p.kind === 'retro' ? 'blue planet tracker' : 'Year tab';
    useGame.getState().say({
      id: `pred-${p.id}`,
      text: `Forecast resolved ${inside ? 'inside' : 'outside'} your range. The comparison is in the ${tool} forecast log.`,
      mood: inside ? 'happy' : 'calm',
    });
  }
}

/** Sum of points over all revealed predictions. */
export const predictionPoints = (s: GameState) => s.predictions.reduce((a, p) => a + (p.result?.points ?? 0), 0);
