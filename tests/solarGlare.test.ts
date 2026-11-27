import { expect, it } from 'vitest';
import { AU, DEG, L_SUN } from '../src/engine/constants';
import { GLARE_LIMIT, GLARE_NOTICE, solarGlare, solarGlareSource } from '../src/engine/solarGlare';
import type { Vec3 } from '../src/engine/vec';
import { generateSystem } from '../src/engine/system';
import { assessOpticalConditions, opticalLimits, type OpticalConditions } from '../src/game/observing';

const star: Vec3 = [AU, 0, 0];
const radius = .27 * DEG;
const ray = (degrees: number): Vec3 => [Math.cos(degrees * DEG), Math.sin(degrees * DEG), 0];

it('uses the apparent stellar limb, with the strongest glare near the disk', () => {
  const source = solarGlareSource(star, radius, L_SUN, 20 * DEG);
  expect(source.exposure).toBeCloseTo(1);
  expect(solarGlare(source, ray(.27))).toBeGreaterThan(GLARE_LIMIT);
  expect(solarGlare(source, ray(2))).toBeGreaterThan(GLARE_NOTICE);
  expect(solarGlare(source, ray(2))).toBeLessThan(GLARE_LIMIT);
  expect(solarGlare(source, ray(30))).toBeLessThan(.005);
  expect(solarGlare(source, ray(180))).toBeLessThan(solarGlare(source, ray(30)));
});

it('accounts for stellar flux and the part of the disk above the horizon', () => {
  expect(solarGlareSource(star, radius, L_SUN, -2 * radius).exposure).toBe(0);
  expect(solarGlareSource(star, radius, L_SUN, 0).exposure).toBeCloseTo(.5);
  expect(solarGlareSource([2 * AU, 0, 0], radius / 2, L_SUN, 20 * DEG).exposure).toBeCloseTo(.25);
  const rising = solarGlareSource(star, radius, L_SUN, -radius * .9);
  expect(rising.exposure).toBeGreaterThan(0);
  expect(rising.exposure).toBeLessThan(.03);
});

it('blocks a washed-out measurement, preserves its filtered counterpart, and keeps weather priority', () => {
  const system = generateSystem(316, 'navigator', 5);
  const conditions: OpticalConditions = {
    at: 60, alt: 30 * DEG, sunAlt: 30 * DEG, seeing: 1, cloudy: false, flare: false,
    solarGlare: .9, referenceVisible: true, inField: true,
  };
  const check = (glare: number) => assessOpticalConditions('diameter', { ...conditions, solarGlare: glare }, opticalLimits(system, 'diameter'));
  expect(check(.9).code).toBe('solar-glare');
  expect(check(.3)).toMatchObject({ ok: true, reason: 'Solar glare lowers contrast near the star.' });
  expect(check(.05).reason).toBe('View usable.');
  expect(assessOpticalConditions('solar-camera', conditions, opticalLimits(system, 'solar-camera')).ok).toBe(true);
  expect(assessOpticalConditions('diameter', { ...conditions, cloudy: true }, opticalLimits(system, 'diameter')).code).toBe('clouds');
});
