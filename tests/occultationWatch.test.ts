import { describe, expect, it } from 'vitest';
import { DAY, HOUR } from '../src/engine/constants';
import { moonLight } from '../src/engine/occultation';
import { alignmentWindow, contactBounds, recordOccultation, repeatInterval, type MoonFrame } from '../src/game/occultationWatch';
import type { Vec3 } from '../src/engine/vec';

describe('moonlight at the limb', () => {
  const target: Vec3 = [10, 0, 0];
  const moonAt = (angle: number, range = 11): Vec3 => [range * Math.cos(angle), range * Math.sin(angle), 0];
  it('hides a background moon and leaves an aligned foreground moon visible', () => {
    expect(moonLight(target, moonAt(0), .01, .002)).toBe(0);
    expect(moonLight(target, moonAt(0, 9), .01, .002)).toBe(1);
    expect(moonLight(target, moonAt(.013), .01, .002)).toBe(1);
  });
  it('fades the unresolved moon continuously across partial overlap', () => {
    const fractions = [.0081, .01, .0119].map((angle) => moonLight(target, moonAt(angle), .01, .002));
    expect(fractions[0]).toBeGreaterThan(0);
    expect(fractions[1]).toBeGreaterThan(fractions[0]);
    expect(fractions[2]).toBeGreaterThan(fractions[1]);
    expect(fractions[2]).toBeLessThan(1);
    expect(moonLight(target, moonAt(0), .002, .004)).toBeCloseTo(.75);
  });
});

const frames: MoonFrame[] = [
  { at: 60, image: 'visible' },
  { at: 120, image: 'dark' },
  { at: 300, image: 'dark' },
  { at: 420, image: 'visible' },
];

describe('keeping a watch', () => {
  it('requires ordered visible and hidden frames close to each transition', () => {
    const record = recordOccultation(frames);
    expect(record).toEqual({ visible: 60, hidden: 120, stillHidden: 300, returned: 420 });
    expect(recordOccultation([frames[0], frames[2], frames[1], frames[3]])).toBeNull();
    expect(recordOccultation([...frames.slice(0, 3), { at: HOUR + 400, image: 'visible' }])).toBeNull();
    expect(recordOccultation([...frames.slice(0, 3), { at: 400, image: 'fading' }])).toBeNull();
  });
  it('compares the kept brackets and the chosen number of cycles', () => {
    const first = recordOccultation(frames)!;
    const later = recordOccultation(frames.map((f) => ({ ...f, at: f.at + 6 * DAY })))!;
    expect(contactBounds(first)).toEqual({ midpoint: 225, uncertainty: 45 });
    expect(repeatInterval(first, later, 2)).toEqual({ seconds: 3 * DAY, timing: 45 });
    expect(repeatInterval(first, later, 1.5)).toBeNull();
    expect(repeatInterval(later, first, 1)).toBeNull();
  });
  it('forecasts a wide alignment window using only a recent logged crossing and the entered period', () => {
    const track = [{ at: DAY, v: 1 }, { at: DAY + HOUR, v: -1 }];
    const now = 2 * DAY + 2 * HOUR;
    expect(alignmentWindow(track, 2 * DAY, now)).toEqual({ from: 2 * DAY - 3 * HOUR, to: 2 * DAY + 4 * HOUR });
    expect(alignmentWindow(track, 3 * DAY, now)).not.toEqual(alignmentWindow(track, 2 * DAY, now));
    expect(alignmentWindow(track, 2 * DAY, 9 * DAY)).toBeNull();
    expect(alignmentWindow(track.slice(0, 1), 2 * DAY, now)).toBeNull();
  });
});
