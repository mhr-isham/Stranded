import { describe, expect, it } from 'vitest';
import { DERIVED_KEYS, PRIMARY_KEYS, deriveAll, truthValues } from '../src/engine/chain';
import { DEG } from '../src/engine/constants';
import { horizonDip, pendulumPeriod } from '../src/engine/measure';
import { scoreQuantity } from '../src/engine/scoring';
import { botMeasure, botPlay, COMPETENT, PERFECT, generateSolvableSystem } from '../src/engine/solver';
import { makeRng } from '../src/engine/rng';
import { generateSystem } from '../src/engine/system';

describe('tool physics', () => {
  it('pendulum period tends to 2pi sqrt(L/g) at small amplitude and grows with amplitude', () => {
    const T0 = 2 * Math.PI * Math.sqrt(1 / 9.81);
    expect(pendulumPeriod(9.81, 1, 1e-6)).toBeCloseTo(T0, 9);
    // Known value: at 90 degrees the period is 1.18034 T0.
    expect(pendulumPeriod(9.81, 1, 90 * DEG) / T0).toBeCloseTo(1.18034, 4);
  });

  it('horizon dip matches the small-angle rule R = 2h/theta^2', () => {
    const R = 6.371e6;
    const th = horizonDip(R, 1000);
    expect((2 * 1000) / th ** 2 / R).toBeCloseTo(1, 3);
  });
});

describe('solve chain', () => {
  it('recovers every quantity from noise-free measurements', () => {
    for (let seed = 1; seed <= 10; seed++) {
      const sys = generateSystem(seed);
      const { primaries } = botMeasure(sys, PERFECT, makeRng(seed));
      const est = { ...primaries, ...deriveAll(primaries) };
      const truth = truthValues(sys, primaries);
      for (const k of [...PRIMARY_KEYS, ...DERIVED_KEYS]) {
        if (k === 'tOpp') continue;
        // g carries a real 0.06% bias from the 4 degree pendulum release.
        expect(Math.abs(est[k]!.value / truth[k] - 1), k).toBeLessThan(1.5e-3);
      }
    }
  });

  it('propagates errors (star mass ~3x the relative error of distance)', () => {
    const sys = generateSystem(3);
    const { primaries } = botMeasure(sys, PERFECT, makeRng(3));
    const p = { ...primaries, dPar: { ...primaries.dPar!, sigma: primaries.dPar!.value * 0.01 } };
    const d = deriveAll(p);
    expect(d.Mstar!.sigma / d.Mstar!.value).toBeCloseTo(0.03, 3);
  });
});

describe('scoring', () => {
  it('rewards honest error bars over confident misses', () => {
    const honestWide = scoreQuantity(105, 10, 100); // inside, wide
    const confidentMiss = scoreQuantity(105, 0.5, 100); // tight, misses
    const honestTight = scoreQuantity(100.5, 1, 100);
    expect(honestWide.points).toBeGreaterThan(confidentMiss.points);
    expect(honestTight.points).toBeGreaterThan(honestWide.points);
  });
});

describe('solver', () => {
  it('a competent bot lands on cadet systems', () => {
    for (let seed = 1; seed <= 8; seed++) {
      const run = botPlay(generateSystem(seed, 'cadet'), COMPETENT, seed);
      expect(run.result?.outcome).toBe('success');
    }
  });

  it('generateSolvableSystem returns a system the bot can solve', () => {
    const { system } = generateSolvableSystem(12345, 'astronomer');
    expect(botPlay(system, COMPETENT, 1).result).toBeDefined();
  });
});
