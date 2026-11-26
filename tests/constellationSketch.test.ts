import { expect, it } from 'vitest';
import { connectStars, sketchStars } from '../src/game/constellationSketch';
import type { SkyLight } from '../src/game/skyObservation';

it('keeps only in-field background stars and strips object identity', () => {
  const star: SkyLight = { ref: { kind: 'catalog', i: 1 }, key: 'catalog:1', code: 'Light 1', dir: [1, 0, 0],
    x: 50, y: 20, alt: 1, az: 0, variation: 'steadier', tint: 'pale tint' };
  expect(sketchStars([star, { ...star, ref: { kind: 'target' } }, { ...star, x: 120 }], 100, 40))
    .toEqual([{ x: .5, y: .5, tint: 'pale tint' }]);
});

it('records a line once and rejects self-links and out-of-field endpoints', () => {
  const line = connectStars([], 2, 0, 3);
  expect(line).toEqual([[0, 2]]);
  expect(connectStars(line, 0, 2, 3)).toBe(line);
  expect(connectStars(line, 1, 1, 3)).toBe(line);
  expect(connectStars(line, 1, 6, 3)).toBe(line);
});
