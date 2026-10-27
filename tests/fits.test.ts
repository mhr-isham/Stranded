import { describe, expect, it } from 'vitest';
import { sineFit } from '../src/game/fits';

describe('sine fit', () => {
  it('finds the period of dense data and reports no rival', () => {
    const t = Array.from({ length: 80 }, (_, i) => i * 0.125);
    const y = t.map((x) => 30 * Math.sin((2 * Math.PI * x) / 3.3 + 0.4) + 0.5 * Math.sin(i3(x)));
    const f = sineFit(t, y, 0.4, 60)!;
    expect(Math.abs(f.period / 3.3 - 1)).toBeLessThan(0.01);
    expect(f.alternative).toBeUndefined();
  });

  it('flags a rival period when the data are sampled once a day (aliasing)', () => {
    // A 0.8-day period sampled once per day is indistinguishable from a 4-day one.
    const t = Array.from({ length: 10 }, (_, i) => i * 1.0);
    const y = t.map((x) => 20 * Math.sin((2 * Math.PI * x) / 0.8));
    const f = sineFit(t, y, 0.4, 60)!;
    const periods = [f.period, f.alternative?.period ?? 0].map((p) => Math.round(p * 10) / 10);
    expect(f.alternative).toBeDefined();
    expect(periods.some((p) => Math.abs(p - 0.8) < 0.05 || Math.abs(p - 4) < 0.1)).toBe(true);
  });
});

function i3(x: number) {
  return x * 7.1;
}
