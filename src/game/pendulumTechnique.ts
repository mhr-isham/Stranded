import type { Reading } from './store';

export interface PendulumTechnique {
  source: 'manual' | 'echo';
  releaseId: string;
  angle: number;
  /** Turning points observed while the watch runs, supporting recorded technique. */
  turns: number;
}
export interface SwingMotion { sign: number; turns: number }
export const swingMotion = (omega = 0): SwingMotion => ({ sign: Math.sign(omega), turns: 0 });
/** Observe motion at the integration step, independently of frame rate and gravity truth. */
export function observeSwingMotion(motion: SwingMotion, omega: number) {
  if (!Number.isFinite(omega) || omega === 0) return;
  const sign = Math.sign(omega);
  if (motion.sign && sign !== motion.sign) motion.turns++;
  motion.sign = sign;
}

/** Conservative whole cycles between recorded endpoints; arbitrary start phase costs <=1 cycle. */
export function motionMatchesCount(reading: Reading) {
  const p = reading.pendulum, t = p?.technique;
  if (!p || !t || t.source !== 'manual' || !t.releaseId || !Number.isSafeInteger(t.turns) || t.turns < 3 || !Number.isSafeInteger(p.swings) || p.swings! < 1) return false;
  if (![p.length, p.period, p.time, reading.value, t.angle].every((v) => typeof v === 'number' && Number.isFinite(v) && v > 0)) return false;
  const cycles = Math.floor((t.turns - 1) / 2);
  return Math.abs(p.swings! - cycles) <= 1 && Math.abs(p.time! / p.swings! - p.period) <= Math.max(1e-9, p.period * 1e-6);
}

export function controlledTiming(reading: Reading) {
  const t = reading.pendulum?.technique;
  return reading.key === 'g' && reading.kept && motionMatchesCount(reading) && t!.angle >= 1 && t!.angle <= 10 && reading.pendulum!.swings! >= 5;
}

export function earnsTwentySwings(reading: Reading) {
  return controlledTiming(reading) && reading.pendulum!.swings! >= 20;
}

/** Comparable fresh releases support repeatability, not independent systematic errors. */
export function comparableTimings(readings: Reading[]) {
  const eligible = readings.filter(controlledTiming), anchor = eligible.at(-1);
  if (!anchor) return [];
  const protection = (r: Reading) => r.environment?.wind?.protection ?? 'unrecorded';
  const used = new Set<string>();
  return eligible.filter((r) => {
    const p = r.pendulum!;
    if (Math.abs(p.length / anchor.pendulum!.length - 1) > .01 || protection(r) !== protection(anchor) || used.has(p.technique!.releaseId)) return false;
    used.add(p.technique!.releaseId);
    return true;
  });
}
