import { expect, it, vi } from 'vitest';
import { fitResiduals, observationChange } from '../src/game/measurementFeedback';
import { analyzeYear, yearLineAt } from '../src/game/yearObservations';
import { DAY, DEG } from '../src/engine/constants';
import type { Reading } from '../src/game/store';

const reading = (id = '1'): Reading => ({ id, key: 'g', value: 9.8, at: 100, kept: true, note: '' });

it('recognizes recording and revision without treating either as an accuracy judgment', () => {
  const r = reading();
  expect(observationChange([], [r])).toMatchObject({ reading: r, revised: false });
  const revised = { ...r, value: 1000 };
  expect(observationChange([r], [revised])).toMatchObject({ reading: revised, revised: true });
});
it('does not replay a recording for inclusion, notes, deletion or reordering', () => {
  const a = reading('a'), b = reading('b');
  expect(observationChange([a], [{ ...a, kept: false, note: 'excluded' }])).toBeNull();
  expect(observationChange([a, b], [a])).toBeNull();
  expect(observationChange([a, b], [b, a])).toBeNull();
  expect(observationChange([a], [a])).toBeNull();
});
it('recognizes another mark of the same exposure as a revision even with another log ID', () => {
  const a = { ...reading('a'), key: 'dPar' as const, parallax: { captureId: 'pair', baseline: 100, projectedBaseline: 80, shift: .01, markA: { x: 0, y: 0 }, markB: { x: .01, y: 0 } } };
  expect(observationChange([a], [a, { ...a, id: 'b', value: 11 }])?.revised).toBe(true);
  expect(observationChange([a], [a, { ...a, id: 'c', parallax: { ...a.parallax, captureId: 'fresh' } }])?.revised).toBe(false);
});
it('ignores nonfinite values and unsupported dates when identifying a fresh action', () => {
  expect(observationChange([], [reading(), { ...reading('bad'), value: Infinity }])?.reading.id).toBe('1');
  expect(observationChange([], [{ ...reading(), at: NaN }])).toBeNull();
  expect(observationChange([], [{ ...reading(), at: -1 }])).toBeNull();
});
it('shows signed observed-minus-fitted residuals without modifying selected data', () => {
  const points = [{ x: 0, y: 3 }, { x: 1, y: 3 }, { x: 2, y: 5 }], original = JSON.stringify(points);
  expect(fitResiduals(points, x => 2 * x + 2)).toEqual([
    { x: 0, y: 1, observed: 3, fitted: 2 },
    { x: 1, y: -1, observed: 3, fitted: 4 },
    { x: 2, y: -1, observed: 5, fitted: 6 },
  ]);
  expect(JSON.stringify(points)).toBe(original);
  expect(fitResiduals(points.slice(1, 2), x => 2 * x + 2)).toHaveLength(1);
});
it('rejects nonfinite inputs, projections and overflowing residuals', () => {
  const model = vi.fn((x: number) => x === 1 ? Infinity : -Number.MAX_VALUE);
  expect(fitResiduals([{ x: NaN, y: 0 }, { x: 0, y: Infinity }, { x: 1, y: 0 }, { x: 2, y: Number.MAX_VALUE }], model)).toEqual([]);
  expect(model).toHaveBeenCalledTimes(2);
});
it('uses the selected year model at its centered epoch, including large observing dates', () => {
  const observations = [0, 2, 5, 9].map((offset, i) => ({ at: (1e7 + offset) * DAY, v: (20 + offset * .7 + [0, .02, -.01, .03][i]) * DEG }));
  const a = analyzeYear(observations, [1e7 + 2, 1e7 + 9]);
  expect(a.used).toHaveLength(3);expect(a.fit).not.toBeNull();
  const rows = fitResiduals(a.used, day => yearLineAt(a.fit!, day));
  expect(rows).toHaveLength(3);expect(rows.every(r => Math.abs(r.y) < .1)).toBe(true);
  expect(rows.reduce((n, r) => n + r.y, 0)).toBeCloseTo(0, 6);
});
