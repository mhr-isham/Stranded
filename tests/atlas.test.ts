import { describe, expect, it } from 'vitest';
import { calibration, type AtlasCard } from '../src/game/atlas';

const card = (zs: number[]): AtlasCard => ({
  id: 1, seed: 1, mode: 'cadet', survival: false, date: 0, names: {}, outcome: 'success', grade: 'A', score: 0, camp: null,
  predictions: { made: 0, inside: 0 },
  rows: zs.map((z, i) => ({ k: (['g', 'R1', 'P1', 'dPar', 'alpha2', 'thetaM', 'Pm', 'S2', 'tOpp'] as const)[i % 9], value: 1, sigma: 1, truth: 1, z })),
});

describe('calibration', () => {
  it('judges honest, over- and underconfident players', () => {
    expect(calibration([card([0.2, 0.5, 1.5, 0.7, 0.3, 2, 0.9, 0.4, 1.2])]).verdict).toBe('honest');
    expect(calibration([card([3, 4, 2, 5, 0.5, 6, 3, 2, 4])]).verdict).toBe('overconfident');
    expect(calibration([card([0.1, 0.1, 0.2, 0.1, 0.05, 0.2, 0.1, 0.1, 0.1])]).verdict).toBe('underconfident');
  });
  it('ignores derived quantities', () => {
    const c = card([0.1]);
    c.rows.push({ k: 'Mstar', value: 1, sigma: 1, truth: 1, z: 9 });
    expect(calibration([c]).n).toBe(1);
  });
});
