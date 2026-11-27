import { expect, it } from 'vitest';
import { AU, DAY } from '../src/engine/constants';
import { directMoonlight, lunarExposure, lunarLight, lunarShadow, lunarSurfaceLight, type LunarLight } from '../src/engine/eclipse';
import { generateSystem } from '../src/engine/system';
import type { Vec3 } from '../src/engine/vec';

const target: Vec3 = [AU, 0, 0];
const starRadius = 696e6, planetRadius = 6.37e6, moonRadius = 1.74e6;
const classify = (depth: number, offset: number) =>
  lunarShadow(target, [AU + depth, offset, 0], starRadius, planetRadius, moonRadius);

it('distinguishes sunward or distant passages from penetration into the two shadow cones', () => {
  expect(classify(-384e6, 0)).toBe('sunlit');
  expect(classify(384e6, 13e6)).toBe('sunlit');
  expect(classify(384e6, 8e6)).toBe('penumbral');
  expect(classify(384e6, 5e6)).toBe('partial');
  expect(classify(384e6, 0)).toBe('total');
  expect(classify(1.6e9, 0)).toBe('penumbral');
  expect(classify(384e6, -5e6)).toBe(classify(384e6, 5e6));
});

it('gives different direct illumination across the moon, and no light in the total shadow', () => {
  const depth = 384e6, offset = 5e6;
  const light: LunarLight = {
    shadow: classify(depth, offset), toPlanet: [-depth, -offset, 0], toStar: [-(AU + depth), -offset, 0],
    starRadius, planetRadius, moonRadius,
  };
  const inside = directMoonlight(light, [0, -moonRadius, 0]);
  const outside = directMoonlight(light, [0, moonRadius, 0]);
  expect(inside).toBeLessThan(outside);
  expect(outside).toBeGreaterThan(0);
  expect(lunarSurfaceLight(light, [1, 0, 0], [-1, 0, 0])).toBe(0);
  expect(lunarExposure(light, [1, 0, 0]).fraction).toBeGreaterThan(0);
  expect(lunarExposure(light, [1, 0, 0]).fraction).toBeLessThan(1);
  expect(directMoonlight({ ...light, shadow: 'total' }, [0, 0, 0])).toBe(0);
});

it('produces recurring full shadows in the game’s coplanar system', () => {
  const system = generateSystem(316, 'navigator', 1);
  const found = new Set<string>();
  for (let t = 0; t <= 30 * DAY; t += 300) found.add(lunarLight(system, t).shadow);
  expect([...found].sort()).toEqual(['partial', 'penumbral', 'sunlit', 'total']);
});
