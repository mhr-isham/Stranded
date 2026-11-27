import { expect, it } from 'vitest';
import { DAY, DEG } from '../src/engine/constants';
import { generateSystem } from '../src/engine/system';
import { beaconSolarFrame, beaconSunVisible, campSolarDiscs, nextBeaconEclipse, solarOverlap } from '../src/engine/solarEclipse';
import { topocentric } from '../src/engine/sky';
import type { Vec3 } from '../src/engine/vec';

const star: Vec3 = [100, 0, 0];
const near = (degrees: number): Vec3 => [10 * Math.cos(degrees * DEG), 10 * Math.sin(degrees * DEG), 0];

it('uses true apparent angular overlap and line-of-sight ordering', () => {
  expect(solarOverlap(star, 1, [150, 0, 0], 2)).toBeNull();
  expect(solarOverlap(star, 1, near(2), .13, true)).toBeNull();
  expect(solarOverlap(star, 1, near(0), .04)?.kind).toBe('transit');
  expect(solarOverlap(star, 1, near(0), .08, true)?.kind).toBe('annular');
  expect(solarOverlap(star, 1, near(.53), .08, true)?.kind).toBe('partial');
  expect(solarOverlap(star, 1, near(0), .13, true)).toEqual({ kind: 'total', covered: 1 });
});

it('shows a camp transit in the real-system chapter without inventing a nearby moon', () => {
  const sys = generateSystem(316, 'navigator', 9);
  const at = sys.firstOpposition;
  const sun = topocentric(sys, 'star', at, sys.site), earth = topocentric(sys, 'target', at, sys.site);
  const moon = topocentric(sys, 'moon', at, sys.site);
  const overlap = solarOverlap(sun, sys.star.radius, earth, sys.target.radius);
  expect(overlap?.kind).toBe('transit');
  expect(overlap!.covered).toBeLessThan(.001);
  expect(campSolarDiscs(sys, at, sun, earth, moon).some((disc) => disc.direction === earth)).toBe(true);
});

it('finds only post-arrival daytime passages and supports the moonless destination', () => {
  expect(nextBeaconEclipse(generateSystem(316, 'navigator', 2), 70 * DAY)).toBeNull();
  const Earth = generateSystem(316, 'navigator', 9);
  const arrival = 220 * DAY;
  const window = nextBeaconEclipse(Earth, arrival)!;
  expect(window).not.toBeNull();
  expect(window.from).toBeGreaterThanOrEqual(arrival);
  let annular = false;
  for (let t = window.from; t <= window.to; t += 60) {
    const frame = beaconSolarFrame(Earth, t);
    if (!frame.overlap) continue;
    expect(beaconSunVisible(frame)).toBe(true);
    expect(frame.overlap.kind).not.toBe('total');
    annular ||= frame.overlap.kind === 'annular';
  }
  expect(annular).toBe(true);
  const next = nextBeaconEclipse(Earth, window.to + 300)!;
  expect(next.from).toBeGreaterThan(window.to);
});
