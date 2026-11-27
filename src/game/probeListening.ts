import { HOUR } from '../engine/constants';
import { flybySpeedAt } from '../engine/probe';
import { hash32 } from '../engine/rng';
import type { StarSystem } from '../engine/types';
import type { ProbeState } from './probeState';

export const PROBE_NOISE = 0.0015;
export const PROBE_INTERVALS = [120, 1200, 2 * HOUR, 12 * HOUR] as const;
export const MAX_LISTENING_WINDOWS = 10;
export const MAX_SAMPLES_PER_WINDOW = 200;
export const MANUAL_HOURS_LIMIT = 720;

export interface ProbeWindow {
  start: number;
  end: number;
  interval: number;
  label?: string;
}

export const probeWindowKey = (w: ProbeWindow) => `${w.start}:${w.end}:${w.interval}`;

export function presetProbeWindows(launchedAt: number, plannedAt: number): ProbeWindow[] {
  const blocks = [
    { start: -720, end: -48, interval: 12 * HOUR, label: 'Cruise baseline' },
    { start: -36, end: -4, interval: 2 * HOUR, label: 'Inbound approach' },
    { start: -3, end: 3, interval: 120, label: 'Close pass' },
  ];
  return blocks.flatMap((w) => {
    const start = Math.max(launchedAt, plannedAt + w.start * HOUR), end = plannedAt + w.end * HOUR;
    return start <= end ? [{ ...w, start, end }] : [];
  });
}

export function createProbeWindow(p: ProbeState, now: number, startHours: number, endHours: number, interval: number) {
  if (!p.windows || p.windows.length >= MAX_LISTENING_WINDOWS) return { error: 'The schedule is full.' };
  if (![startHours, endHours].every((h) => Number.isFinite(h) && Math.abs(h) <= MANUAL_HOURS_LIMIT)
    || !(PROBE_INTERVALS as readonly number[]).includes(interval)) return { error: 'Choose offsets between −720 and +720 hours and a listed cadence.' };
  const start = p.arriveAt + Math.round(startHours * HOUR), end = p.arriveAt + Math.round(endHours * HOUR);
  if (end < start + interval) return { error: 'Leave room for at least two readings between start and end.' };
  if (start <= Math.max(now, p.launchedAt)) return { error: 'Start after the current expedition time. Past readings can’t be added.' };
  if (Math.floor((end - start) / interval) >= MAX_SAMPLES_PER_WINDOW) return { error: 'Shorten the window or choose a slower cadence.' };
  const window = { start, end, interval };
  if (p.windows.some((w) => probeWindowKey(w) === probeWindowKey(window))) return { error: 'That window is already scheduled.' };
  return { window };
}

function gauss(seed: number, i: number) {
  const u1 = (hash32(seed, i, 0xd1) + 1) / 4294967297;
  const u2 = hash32(seed, i, 0xd2) / 4294967296;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

const far = Array.from({ length: 57 }, (_, i) => 720 - 12 * i);
const legacyHours = [
  ...far.map((h) => -h),
  ...Array.from({ length: 100 }, (_, i) => -36 + i / 3),
  ...Array.from({ length: 181 }, (_, i) => -3 + i / 30),
  ...Array.from({ length: 100 }, (_, i) => 3 + (i + 1) / 3),
  ...far.slice().reverse(),
];

/** Stable receiver reconstruction. The timestamp gate precedes every physical
 * sample. A late visit or a large warp receives the same scheduled data.
 */
export function receivedProbeSamples(sys: StarSystem, p: ProbeState, now: number) {
  const flyby = { vInf: p.vInf, rPeri: p.rPeri, vPeak: p.vPeak, deflection: 0, crashed: p.crashed };
  const seed = Math.round(p.launchedAt);
  const sample = (offset: number, index: number) => ({
    hours: offset / HOUR,
    speed: flybySpeedAt(sys, flyby, offset) * (1 + PROBE_NOISE * gauss(seed, index)),
  });
  if (!p.windows) return now >= p.arriveAt && !p.crashed ? legacyHours.map((hours, i) => sample(hours * HOUR, i)) : [];

  const offsets = new Set<number>();
  for (const w of p.windows) {
    const end = Math.min(now, w.end);
    if (!(w.interval > 0 && Number.isFinite(w.start) && Number.isFinite(w.end))) continue;
    for (let i = 0; i < MAX_SAMPLES_PER_WINDOW; i++) {
      const at = w.start + i * w.interval;
      if (at > end || (p.crashed && at >= p.arriveAt)) break;
      if (at >= p.launchedAt) offsets.add(Math.round(at - p.arriveAt));
    }
  }
  return [...offsets].sort((a, b) => a - b).map((offset) => sample(offset, offset));
}

export function receivedProbeAltitude(sys: StarSystem, p: ProbeState, now: number) {
  return now >= p.arriveAt && !p.crashed ? (p.rPeri - sys.target.radius) + 10_000 * gauss(Math.round(p.launchedAt), 999) : null;
}
