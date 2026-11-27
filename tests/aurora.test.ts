import { expect, it } from 'vitest';
import { auroraRibbons, auroraStorm } from '../src/engine/aurora';
import { DAY, DEG, HOUR } from '../src/engine/constants';
import { generateSystem } from '../src/engine/system';
import { norm } from '../src/engine/vec';
import { auroraInFrame, auroraView } from '../src/game/auroraWatch';
import { isCloudy } from '../src/game/survival';
import { altAzFromDir } from '../src/render/projection';
import { makeLandscape } from '../src/render/terrain';

const system = generateSystem(316, 'navigator', 1);
const clear = { seed: system.seed, settings: { difficulty: 'navigator' as const, survival: false, formulas: true, sound: false } };
const land = makeLandscape(system.seed, system.hillHeight);

it('produces bounded, repeatable geomagnetic pulses, excluding the Mars chapter', () => {
  const samples = Array.from({ length: 216 }, (_, i) => auroraStorm(system, i * HOUR));
  const strengths = samples.flatMap((storm) => storm?.strength ?? []);
  expect(strengths.length).toBeGreaterThan(12);
  expect(strengths.length).toBeLessThan(35);
  expect(Math.max(...strengths)).toBeLessThanOrEqual(1);
  expect(auroraStorm(system, 0)).toBeNull();
  const mars = generateSystem(316, 'navigator', 9);
  for (let t = 0; t < 18 * DAY; t += HOUR) expect(auroraStorm(mars, t)).toBeNull();
});

it('places the atmospheric curtains in local unit directions and ripples gradually', () => {
  const storm = { strength: .98, seed: 3 };
  const rays = auroraRibbons(system, storm, 3, .8);
  expect(auroraRibbons(system, storm, 3, .8)).toEqual(rays);
  expect(auroraRibbons(system, storm, 3.5, .8)).not.toEqual(rays);
  for (const ray of rays.flat()) {
    for (const vector of [ray.lower, ray.middle, ray.upper]) expect(norm(vector)).toBeCloseTo(1, 10);
    expect(ray.brightness).toBeGreaterThanOrEqual(0);
    expect(ray.brightness).toBeLessThanOrEqual(.8);
  }
});

it('requires a dark clear view and keeps the silhouette and framing constraints', () => {
  let at = 0, view = auroraView(system, clear, land, at, 0);
  for (; at < 180 * DAY; at += HOUR) {
    view = auroraView(system, clear, land, at, 0);
    if (view.direction && isCloudy(clear.seed, at)) break;
  }
  expect(view.direction).not.toBeNull();
  expect(at).toBeLessThan(180 * DAY);
  const { az, alt } = altAzFromDir(view.direction!);
  const camera = { az, alt, fov: 85 * DEG, w: 680, h: 460 };
  expect(auroraInFrame(view, camera, land)).toBe(true);
  expect(auroraInFrame(view, { ...camera, az: az + Math.PI, alt: -60 * DEG, fov: 20 * DEG }, land)).toBe(false);
  const blocked = auroraView(system, { ...clear, settings: { ...clear.settings, survival: true } }, land, at, 0);
  expect(blocked.direction).toBeNull();
  expect(blocked.reason).toContain('Clouds');
  expect(auroraView(system, clear, land, 0, 0).direction).toBeNull();
});
