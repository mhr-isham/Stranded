import { DAY, DEG } from '../engine/constants';
import type { TimedValue } from './store';
import { yearPoints } from './yearObservations';

export interface MotionPoint { at: number; x: number; y: number; gap: boolean }
/** Saved positions only; no ephemeris, interpolation, or inferred future samples. */
export function observedMotion(observations: TimedValue[], cadence: number): MotionPoint[] {
  const unique = yearPoints(observations).filter((p, i, all) => i === 0 || p.observation.at !== all[i - 1].observation.at);
  return unique.map((p, i) => ({ at: p.observation.at, x: p.x, y: p.y, gap: i > 0 && p.observation.at - unique[i - 1].observation.at > (Number.isFinite(cadence) && cadence > 0 ? cadence : DAY) * 1.75 }));
}
export type MotionDirection = 'east' | 'west' | 'unresolved';
export const motionDirection = (delta: number): MotionDirection => Math.abs(delta) <= .01 + 1e-9 ? 'unresolved' : delta > 0 ? 'east' : 'west';
export interface RetroStudy {
  anchorAt: number; anchorValue: number; prediction: MotionDirection;
  result?: { at: number; delta: number; direction: MotionDirection };
}
export function resolveMotionPrediction(study: RetroStudy, observations: TimedValue[]): RetroStudy {
  if (study.result || !Number.isFinite(study.anchorAt) || !Number.isFinite(study.anchorValue)) return study;
  const next = observations.filter((o) => Number.isFinite(o.at) && Number.isFinite(o.v) && o.at > study.anchorAt).sort((a, b) => a.at - b.at)[0];
  if (!next) return study;
  const raw = (next.v - study.anchorValue) / DEG;
  const delta = ((raw + 180) % 360 + 360) % 360 - 180;
  return { ...study, result: { at: next.at, delta, direction: motionDirection(delta) } };
}
export const replayDay = (at: number) => at / DAY;

/** Reconstruct a recorded two-coordinate pointing, never a missing latitude. */
export function savedSkyDirection(observation: TimedValue): [number, number, number] | null {
  const lat = observation.skyLatitude;
  if (!Number.isFinite(observation.v) || lat === undefined || !Number.isFinite(lat) || Math.abs(lat) > Math.PI / 2) return null;
  return [Math.cos(lat) * Math.cos(observation.v), Math.cos(lat) * Math.sin(observation.v), Math.sin(lat)];
}
