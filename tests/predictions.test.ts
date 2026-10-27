import { describe, expect, it } from 'vitest';
import { DAY } from '../src/engine/constants';
import { moonOffset, targetLongitude } from '../src/engine/measure';
import { nextMoonEast, nextStationary, scorePrediction } from '../src/game/predictions';
import { world } from '../src/game/world';

describe('predictions', () => {
  const seed = 316;
  const { system: sys } = world(seed, 'cadet');

  it('finds the end of retrograde', () => {
    const t = sys.firstOpposition - 5 * DAY;
    const st = nextStationary(seed, 'cadet', t)!;
    expect(st).toBeGreaterThan(sys.firstOpposition);
    const lon = (tt: number) => targetLongitude(sys, tt, sys.site);
    // Backwards just before, forwards just after.
    expect(lon(st - DAY) - lon(st - 2 * DAY)).toBeLessThan(0);
    expect(lon(st + 2 * DAY) - lon(st + DAY)).toBeGreaterThan(0);
  });

  it('finds the moon at greatest east offset', () => {
    const e = nextMoonEast(seed, 'cadet', 10 * DAY)!;
    const f = (tt: number) => moonOffset(sys, tt, sys.site);
    expect(f(e)).toBeGreaterThan(0);
    expect(f(e)).toBeGreaterThanOrEqual(f(e - 0.01 * DAY));
    expect(f(e)).toBeGreaterThanOrEqual(f(e + 0.01 * DAY));
  });

  it('rewards honest, tight ranges', () => {
    const tight = scorePrediction(10.1, 0.2, 10, 0.5).points;
    const wide = scorePrediction(10.1, 5, 10, 0.5).points;
    const miss = scorePrediction(12, 0.2, 10, 0.5).points;
    expect(tight).toBeGreaterThan(wide);
    expect(wide).toBeGreaterThan(miss);
    expect(miss).toBeLessThan(0);
  });
});
