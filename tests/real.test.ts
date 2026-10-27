import { describe, expect, it } from 'vitest';
import { DAY } from '../src/engine/constants';
import { generateSystem } from '../src/engine/system';
import { generateSolvableSystem } from '../src/engine/solver';

describe('chapter 9: the real Solar System', () => {
  const sys = generateSystem(11, 'navigator', 9);
  it('uses the real Mars and Earth', () => {
    expect(sys.home.period / DAY).toBeCloseTo(687, 0);
    expect(sys.target.period / DAY).toBeCloseTo(365.25, 0);
    expect(sys.synodic / DAY).toBeCloseTo(780, 0);
    expect(sys.hohmann.tof / DAY).toBeCloseTo(259, 0);
    expect(sys.features.inner).toBe(true);
  });
  it('is solvable in every mode', () => {
    for (const d of ['stargazer', 'cadet', 'navigator', 'astronomer', 'legend'] as const) expect(generateSolvableSystem(11, d, 9)).toBeTruthy();
  });
});
