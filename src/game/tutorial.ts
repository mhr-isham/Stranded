// Flight School: the hands-on tutorial. This module holds the tutorial's
// runtime helpers: signals the UI raises when the player does something,
// screen anchors for things drawn on canvases, time jumps, and the
// "do it for me" actions that keep beginners from getting stuck.

import { ARCSEC, DAY, DEG } from '../engine/constants';
import { oppositions } from '../engine/ephemeris';
import { horizonDip, moonOffset, parallaxShift, siteEastOf, starLongitude, surfaceGravity, targetAngularDiameter } from '../engine/measure';
import { makeRng } from '../engine/rng';
import { localFrame, observerPos, starAltitude, toHorizontal, topocentric } from '../engine/sky';
import { norm, sub } from '../engine/vec';
import { QUANTITY_INFO, keysFor, truthValues, type PrimaryKey } from '../engine/chain';
import { variantOf } from '../engine/chapters';
import { clock } from './clock';
import { currentWorld, fastForward } from './sim';
import { readingStats, useGame, type Settings } from './store';

export const TUTORIAL_SEED = 316;
export const TUTORIAL_SETTINGS: Settings = { difficulty: 'cadet', survival: false, formulas: true, sound: true };

const rng = makeRng(2024);

/** Start Flight School: a fixed, friendly system with the tutorial switched on. */
export function startTutorial() {
  const g = useGame.getState();
  g.newGame(TUTORIAL_SEED, { ...TUTORIAL_SETTINGS, sound: g.settings.sound });
  useGame.setState({ tutorial: { active: true, step: 0, flags: [], lessons: useGame.getState().tutorial.lessons } });
}

export function exitTutorial() {
  useGame.setState((s) => ({ tutorial: { ...s.tutorial, active: false } }));
}

/** Tell the tutorial the player just did something. Cheap no-op outside the tutorial. */
export function flag(id: string) {
  const s = useGame.getState();
  if (!s.tutorial.active || s.tutorial.flags.includes(id)) return;
  useGame.setState({ tutorial: { ...s.tutorial, flags: [...s.tutorial.flags, id] } });
}

export const hasFlag = (id: string) => useGame.getState().tutorial.flags.includes(id);

/** Commands the tutorial sends to screens that keep local state (e.g. select the planet). */
type TutEvent = 'select-target' | 'select-star' | 'scope-target' | 'scope-star' | 'micro-ready';
const listeners = new Set<(e: TutEvent) => void>();
export function onTutEvent(fn: (e: TutEvent) => void) {
  listeners.add(fn);
  return () => void listeners.delete(fn);
}
export const emitTut = (e: TutEvent) => listeners.forEach((fn) => fn(e));

/**
 * Screen positions (CSS pixels) of things drawn on canvases, such as the blue
 * planet in the sky, so the tutorial can point an arrow at them.
 */
export const anchors = new Map<string, { x: number; y: number; at: number }>();
export function setAnchor(id: string, xCss: number, yCss: number) {
  anchors.set(id, { x: xCss, y: yCss, at: performance.now() });
}

// ---------------------------------------------------------------------------
// Finding good moments in the sky.

const sysNow = () => currentWorld().system;

/** Next time after t when the star sits ~3 degrees above the horizon in the evening. */
export function nextDusk(t: number) {
  const sys = sysNow();
  let prev = starAltitude(sys, t, sys.site);
  for (let tt = t + 300; tt < t + 3 * DAY; tt += 300) {
    const a = starAltitude(sys, tt, sys.site);
    if (prev > 3 * DEG && a <= 3 * DEG) return tt;
    prev = a;
  }
  return t;
}

/**
 * The moment after t0 (within three nights) when the blue planet is highest
 * while the sky is properly dark (star more than 15 degrees below the horizon).
 */
export function darkNightNear(t0: number) {
  const sys = sysNow();
  let best = t0;
  let bestAlt = -Infinity;
  const start = Math.max(t0, clock.t + 600);
  for (let t = start; t < start + 3 * DAY; t += 900) {
    const f = localFrame(sys, t, sys.site);
    const sun = toHorizontal(topocentric(sys, 'star', t, sys.site), f).alt;
    if (sun > -15 * DEG) continue;
    const alt = toHorizontal(topocentric(sys, 'target', t, sys.site), f).alt;
    if (alt > bestAlt + 0.5 * DEG) [bestAlt, best] = [alt, t];
  }
  return best;
}

export const tutorialOppositions = () => {
  const sys = sysNow();
  return oppositions(sys, 0, sys.lifeSupport + sys.synodic);
};

/** Jump forward (never backward), processing everything on the way. */
export function jumpTo(t: number) {
  if (t > clock.t) fastForward(t);
  clock.paused = true;
  clock.emit();
}

// ---------------------------------------------------------------------------
// "Do it for me": what a careful beginner would have measured.

const noisy = (v: number, rel: number) => v * (1 + rng.normal(0, rel));

export function doPendulum() {
  const sys = sysNow();
  useGame.getState().addReading({ key: 'g', value: noisy(surfaceGravity(sys), 0.003), at: clock.t, note: 'ECHO · 20 swings' });
}

export function doHill() {
  const sys = sysNow();
  const h = sys.hillHeight + 1.7;
  const th = horizonDip(sys.home.radius, h) * (1 + rng.normal(0, 0.003));
  useGame.getState().addReading({ key: 'R1', value: (h * Math.cos(th)) / (1 - Math.cos(th)), at: clock.t, note: 'ECHO · summit' });
}

export function doStarLog() {
  const sys = sysNow();
  useGame.setState((s) => ({ starObs: [...s.starObs, { at: clock.t, v: starLongitude(sys, clock.t, sys.site) + rng.normal(0, 0.02 * DEG) }] }));
}

export function doOpposition(index: number) {
  const opp = tutorialOppositions()[index];
  if (opp === undefined) return;
  useGame.setState((s) => ({ oppPicks: [...s.oppPicks.filter((p) => Math.abs(p - opp) > 20 * DAY), opp + rng.normal(0, 0.8 * DAY)] }));
}

export function doParallax() {
  const s = useGame.getState();
  const sys = sysNow();
  const dist = s.rover.dist || 3000e3;
  const rover = siteEastOf(sys, sys.site, dist);
  const t = clock.t;
  const B = norm(sub(observerPos(sys, t, sys.site), observerPos(sys, t, rover)));
  const p = parallaxShift(sys, t, sys.site, rover) + rng.normal(0, 0.15 * ARCSEC);
  s.addReading({ key: 'dPar', value: B / p, at: t, note: 'ECHO · blink comparator' });
}

export function doMicrometer() {
  const sys = sysNow();
  const a = targetAngularDiameter(sys, clock.t, sys.site) + rng.normal(0, 0.25 * ARCSEC);
  useGame.getState().addReading({ key: 'alpha2', value: a, at: clock.t, note: 'ECHO · micrometer' });
}

export function doMoonFit() {
  const sys = sysNow();
  const opp = tutorialOppositions()[0];
  let max = 0;
  let tMax = opp;
  for (let i = -100; i <= 100; i++) {
    const t = opp + (i / 400) * sys.moon.period;
    const off = Math.abs(moonOffset(sys, t, sys.site));
    if (off > max) [max, tMax] = [off, t];
  }
  const g = useGame.getState();
  g.setSheet('thetaM', { value: max * (1 + rng.normal(0, 0.003)), sigma: max * 0.006, at: tMax });
  g.setSheet('Pm', { value: sys.moon.period * (1 + rng.normal(0, 0.001)), sigma: sys.moon.period * 0.002 });
}

/** Copy the average of the kept readings to the sheet with an honest error bar. */
export function sendFromReadings(k: PrimaryKey, minRel = 0.004) {
  const s = useGame.getState();
  const st = readingStats(s.readings, k);
  if (!st) return;
  const se = Number.isFinite(st.se) ? st.se : 0;
  s.setSheet(k, { value: st.mean, sigma: Math.max(1.5 * se, Math.abs(st.mean) * minRel), at: st.at });
}

export function sendYearFromLogs() {
  const s = useGame.getState();
  const obs = s.starObs;
  if (obs.length < 2) return;
  const a = obs[0];
  const b = obs[obs.length - 1];
  let d = b.v - a.v;
  while (d < 0) d += 2 * Math.PI;
  const P1 = ((b.at - a.at) * 2 * Math.PI) / d;
  s.setSheet('P1', { value: P1, sigma: P1 * 0.002 });
}

export function sendOppositions() {
  const s = useGame.getState();
  const picks = [...s.oppPicks].sort((x, y) => x - y);
  if (!picks.length) return;
  s.setSheet('tOpp', { value: picks[picks.length - 1], sigma: 1.5 * DAY });
  if (picks.length >= 2) s.setSheet('S2', { value: (picks[picks.length - 1] - picks[0]) / (picks.length - 1), sigma: 2 * DAY });
}

/**
 * Flight School pre-flight check. In the tutorial, ECHO compares each entry
 * with its (damaged but working) sensors and re-measures anything that would
 * wreck the flight: badly wrong values, or error bars that miss the truth by a
 * lot. It explains each fix, so mistakes become lessons instead of a failed run.
 */
export function preflightCheck(): string[] {
  const s = useGame.getState();
  const sys = sysNow();
  const truth = truthValues(sys, s.sheet);
  const sheet = { ...s.sheet };
  const report: string[] = [];
  // Only what this system's chain needs (other chapters' quantities don't apply here).
  for (const k of keysFor(variantOf(sys.features))) {
    const e = sheet[k];
    const tv = truth[k];
    const info = QUANTITY_INFO[k];
    const scale = k === 'tOpp' ? sys.synodic : Math.abs(tv);
    const rel = e ? Math.abs(e.value - tv) / scale : Infinity;
    const z = e ? Math.abs(e.value - tv) / Math.max(e.sigma, 1e-30) : Infinity;
    const limit = k === 'tOpp' ? 0.01 : k === 'P1' || k === 'S2' || k === 'Pm' ? 0.01 : 0.04;
    if (!e || rel > limit || z > 4) {
      const goodRel = k === 'tOpp' ? 0.002 : 0.004;
      const value = k === 'tOpp' ? tv + rng.normal(0, 0.5 * DAY) : tv * (1 + rng.normal(0, goodRel / 2));
      sheet[k] = { value, sigma: k === 'tOpp' ? DAY : Math.abs(tv) * goodRel, at: e?.at ?? (k === 'tOpp' ? undefined : clock.t) };
      if (!e) report.push(`${info.label} (${info.symbol}) was missing — ECHO measured it.`);
      else if (rel > limit) report.push(`${info.label} (${info.symbol}) was ${k === 'tOpp' ? `${(Math.abs(e.value - tv) / DAY).toFixed(1)} days` : `${(rel * 100).toFixed(rel > 0.1 ? 0 : 1)}%`} off — re-measured.`);
      else report.push(`${info.label} (${info.symbol}): close, but your ± was far too small (truth ${z.toFixed(0)}σ away) — error bar widened.`);
    }
  }
  useGame.setState({ sheet, tutorial: { ...useGame.getState().tutorial, note: report.length ? report : ['Every number passed. Your measurements are good enough to fly on. 🎉'] } });
  flag('preflight');
  return report;
}
