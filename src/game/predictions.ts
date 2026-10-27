// "Call your shot": the player predicts something they will see later, from
// their own data, with an honest ± range. When the moment comes, ECHO shows
// what really happened and explains the miss. Only observables are revealed
// (what an instrument would show), never the hidden numbers on the sheet.

import { DAY } from '../engine/constants';
import { moonOffset, starLongitude, targetLongitude } from '../engine/measure';
import { sfx } from './audio';
import { modeOf } from './modes';
import { useGame, type GameState } from './store';
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
  /** For 'star': the day the player predicted for. For 'pendulum': the new length (m). */
  at?: number;
  result?: { truth: number; points: number; z: number };
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
  return s.predictions.find((p) => p.kind === kind && !p.result) ?? null;
}

export function lastOf(s: GameState, kind: PredictionKind) {
  const done = s.predictions.filter((p) => p.kind === kind && p.result);
  return done[done.length - 1] ?? null;
}

/** Record a prediction. Event predictions get their resolve time from the event itself. */
export function makePrediction(p: Omit<Prediction, 'id'>) {
  const s = useGame.getState();
  const id = `${p.kind}-${Math.round(p.made)}`;
  useGame.setState({ predictions: [...s.predictions, { ...p, id }] });
  sfx('log');
  return id;
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

/** ECHO's explanation of a revealed prediction: what happened and why, never a quiz. */
export function explain(p: Prediction, coaching: boolean): string {
  const r = p.result!;
  const info = PREDICTION_KINDS[p.kind];
  const f = (v: number) => v.toFixed(info.digits);
  const off = p.value - r.truth;
  const head =
    p.kind === 'star'
      ? `The star stood at ${f(r.truth)}°. You said ${f(p.value)} ± ${f(p.sigma)}°.`
      : p.kind === 'pendulum'
        ? `One swing took ${f(r.truth)} s. You said ${f(p.value)} ± ${f(p.sigma)} s.`
        : `It happened on day ${f(r.truth)}. You said day ${f(p.value)} ± ${f(p.sigma)}.`;
  const verdict = r.z <= 1 ? 'Inside your range.' : r.z <= 2 ? 'Just outside your range.' : 'Well outside your range.';
  if (!coaching) return `${head} ${verdict} (${r.points > 0 ? '+' : ''}${r.points} pts)`;
  let why = '';
  if (r.z > 1) {
    if (p.kind === 'star')
      why =
        off < 0
          ? ' The star drifted further than you expected — your drift rate was a little slow, which would also make your year too long.'
          : ' The star drifted less than you expected — your drift rate was a little fast, which would make your year too short.';
    else if (p.kind === 'retro')
      why = off < 0 ? ' You expected it too early. The loop is symmetric around opposition: count the days from when it turned backwards to opposition, then add the same again.' : ' You expected it too late. A retrograde loop is symmetric around opposition — use the turn-around you already saw as a mirror.';
    else if (p.kind === 'moon')
      why = off < 0 ? ' Too early. One full swing — east, west, east — is one moon period; measure it peak to peak on your chart.' : ' Too late. Peak to peak on your chart is one moon period; add it to the last peak you saw.';
    else why = ' Period grows with the square root of length: four times the length is twice the swing time.';
  } else if (p.sigma > 3 * info.scale) why = ' Right — and you could afford a tighter range next time.';
  else why = ' A good call, with an honest range.';
  return `${head} ${verdict}${why} (${r.points > 0 ? '+' : ''}${r.points} pts)`;
}

/** Resolve a prediction with a known truth (used by immediate predictions like the pendulum). */
export function resolveNow(id: string, truth: number) {
  const s = useGame.getState();
  const p = s.predictions.find((q) => q.id === id);
  if (!p || p.result) return null;
  const { z, points } = scorePrediction(p.value, p.sigma, truth, PREDICTION_KINDS[p.kind].scale);
  const done = { ...p, result: { truth, points, z } };
  useGame.setState({ predictions: s.predictions.map((q) => (q.id === id ? done : q)) });
  sfx(z <= 1 ? 'good' : 'bad');
  return done;
}

/** Called by the simulation as time passes. */
export function resolvePredictions(t: number) {
  const s = useGame.getState();
  const due = s.predictions.filter((p) => !p.result && p.kind !== 'pendulum' && p.due <= t);
  if (!due.length) return;
  const coaching = modeOf(s.settings.difficulty).coaching;
  for (const p of due) {
    const truth = truthOf(s, p);
    if (truth === null) {
      // The event never came (e.g. no loop left before the deadline): withdraw quietly.
      useGame.setState({ predictions: useGame.getState().predictions.filter((q) => q.id !== p.id) });
      continue;
    }
    const done = resolveNow(p.id, truth);
    if (done) useGame.getState().say({ id: `pred-${p.id}`, text: explain(done, coaching), mood: done.result!.z <= 1 ? 'happy' : 'calm' });
  }
}

/** Sum of points over all revealed predictions. */
export const predictionPoints = (s: GameState) => s.predictions.reduce((a, p) => a + (p.result?.points ?? 0), 0);
