import { DAY, HOUR } from '../engine/constants';
import type { TimedValue } from './store';

export type MoonImage = 'visible' | 'fading' | 'dark';
export interface MoonFrame { at: number; image: MoonImage }
export interface OccultationRecord {
  visible: number;
  hidden: number;
  stillHidden: number;
  returned: number;
}

/** Only the player's four timestamps go into the log. */
export function recordOccultation(frames: readonly MoonFrame[]): OccultationRecord | null {
  if (frames.length !== 4 || frames.some(({ at }) => !Number.isFinite(at) || at < 0)) return null;
  const [a, b, c, d] = frames;
  if (a.image !== 'visible' || b.image !== 'dark' || c.image !== 'dark' || d.image !== 'visible') return null;
  if (b.at <= a.at || c.at < b.at || d.at <= c.at || b.at - a.at > HOUR || d.at - c.at > HOUR || d.at - a.at > DAY) return null;
  return { visible: a.at, hidden: b.at, stillHidden: c.at, returned: d.at };
}

export const contactBounds = (r: OccultationRecord) => ({
  midpoint: (r.visible + r.hidden + r.stillHidden + r.returned) / 4,
  uncertainty: (r.hidden - r.visible + r.returned - r.stillHidden) / 4,
});

export function repeatInterval(first: OccultationRecord, second: OccultationRecord, cycles: number) {
  if (!Number.isSafeInteger(cycles) || cycles < 1 || second.visible <= first.returned) return null;
  const a = contactBounds(first), b = contactBounds(second);
  return { seconds: (b.midpoint - a.midpoint) / cycles, timing: (a.uncertainty + b.uncertainty) / cycles };
}

/** A coarse alignment watch based on the player's recorded offsets and
 * their sheet period. A zero crossing can be in front of or behind the planet. */
export function alignmentWindow(log: readonly TimedValue[], period: number, now: number) {
  if (!Number.isFinite(period) || period < 4 * HOUR || period > 100 * DAY) return null;
  const points = log.filter(({ at, v }) => Number.isFinite(at) && Number.isFinite(v) && at >= 0 && at <= now).sort((a, b) => a.at - b.at);
  const halfCycle = period / 2;
  for (let i = points.length - 1; i > 0; i--) {
    const a = points[i - 1], b = points[i], gap = b.at - a.at;
    if (gap <= 0 || gap > period / 5 || a.v === b.v || a.v * b.v > 0) continue;
    const crossing = a.at + gap * Math.abs(a.v) / (Math.abs(a.v) + Math.abs(b.v));
    if (now - crossing > period * 2) return null;
    const margin = Math.max(3 * HOUR, gap / 2);
    const next = crossing + Math.max(1, Math.ceil((now - margin - crossing) / halfCycle)) * halfCycle;
    return { from: Math.max(0, Math.floor((next - margin) / HOUR) * HOUR), to: Math.ceil((next + margin) / HOUR) * HOUR };
  }
  return null;
}
