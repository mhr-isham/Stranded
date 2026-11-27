import { describe, expect, it } from 'vitest';
import { ARCSEC } from '../src/engine/constants';
import { phaseIncidence, phaseReadable, planetPhase } from '../src/engine/planetPhase';
import type { Vec3 } from '../src/engine/vec';

const star: Vec3 = [1, 0, 0];

describe('inner planet illumination', () => {
  it('gives new and full limits on opposite sides of conjunction', () => {
    const near = planetPhase([0.4, 0, 0], star), far = planetPhase([1.6, 0, 0], star);
    expect(near.cosine).toBeCloseTo(-1);
    expect(near.flux).toBeCloseTo(0);
    expect(far.cosine).toBeCloseTo(1);
    expect(far.flux).toBeCloseTo(1);
  });

  it('lights the limb toward the star and reverses it on the other elongation', () => {
    const north = Math.sqrt(0.1875);
    const first = planetPhase([0.75, north, 0], star), other = planetPhase([0.75, -north, 0], star);
    expect(first.cosine).toBeCloseTo(0);
    expect(first.limbX).toBeCloseTo(1);
    expect(other.limbX).toBeCloseTo(-1);
    expect(phaseIncidence(first, 0.4, 0)).toBeGreaterThan(0);
    expect(phaseIncidence(first, -0.4, 0)).toBe(0);
    expect(phaseIncidence(other, -0.4, 0)).toBeGreaterThan(0);
  });

  it('matches the illuminated projected area of a sphere', () => {
    for (const cosine of [-0.7, -0.3, 0, 0.35, 0.8]) {
      let disk = 0, lit = 0;
      for (let i = -60; i <= 60; i++) for (let j = -60; j <= 60; j++) {
        const x = i / 60, y = j / 60;
        if (Math.hypot(x, y) >= 1) continue;
        disk++;
        if (phaseIncidence({ cosine, limbX: 1, limbY: 0 }, x, y) > 0) lit++;
      }
      expect(Math.abs(lit / disk - (1 + cosine) / 2)).toBeLessThan(0.01);
    }
  });

  it('keeps a thin crescent unavailable when magnification exceeds optical resolution', () => {
    const near = planetPhase([0.4, 0.01, 0], star);
    const half = planetPhase([0.75, Math.sqrt(0.1875), 0], star);
    expect(phaseReadable(near, 40 * ARCSEC, 1.2 * ARCSEC, 250)).toBe(false);
    expect(phaseReadable(half, 20 * ARCSEC, 1.2 * ARCSEC, 6)).toBe(false);
    expect(phaseReadable(half, 20 * ARCSEC, 1.2 * ARCSEC, 250)).toBe(true);
  });
});
