import { afterEach, expect, it, vi } from 'vitest';
import { ARCSEC, DAY } from '../src/engine/constants';
import * as fits from '../src/game/fits';
import { analyzeMoon, moonStudy } from '../src/game/moonObservations';

const observations = (count = 81, step = .25, period = 3.3, phase = .02) => Array.from({ length: count }, (_, i) => {
  const x = i * step;
  return { at: x * DAY, v: (1 + .1 * (x - 10) / 10) * 30 * Math.sin(2 * Math.PI * x / period - phase * x + .4) * ARCSEC };
});
const planet = (count = 21, step = 1, phase = .02) => Array.from({ length: count }, (_, i) => ({ at: i * step * DAY, v: i * step * phase }));
afterEach(() => vi.restoreAllMocks());

it('fits a changing swing using recorded viewing direction and retains excluded sightings', () => {
  const a = analyzeMoon(observations(), planet(), [3, 17]);
  expect(a.fit).not.toBeNull(); expect(a.fit!.period).toBeCloseTo(3.3, 2);
  expect(a.fit!.amplitude).toBeCloseTo(30, 1);
  expect(a.points).toHaveLength(81); expect(a.used).toHaveLength(57);
  expect(a.mid).toBe(10); expect(a.from).toBe(3); expect(a.to).toBe(17);
});

it('never solves or reveals a period in manual-fit mode, even with good data', () => {
  const solver = vi.spyOn(fits, 'moonFit');
  const a = analyzeMoon(observations(), planet(), null, true);
  expect(solver).not.toHaveBeenCalled(); expect(a.fit).toBeNull(); expect(a.alternative).toBeNull(); expect(moonStudy(a, 'A')).toBeNull();
  expect(a.points).toHaveLength(81);
});

it('rejects missing planet coverage, unsupported gaps and unresolved swings before solving', () => {
  const solver = vi.spyOn(fits, 'moonFit');
  expect(analyzeMoon(observations(), []).fit).toBeNull();
  expect(analyzeMoon(observations(), [{ at: 0, v: 0 }, { at: 20 * DAY, v: .4 }]).fit).toBeNull();
  expect(analyzeMoon(observations().map((p) => ({ ...p, v: .1 * ARCSEC })), planet()).status).toMatch(/no resolved swing/);
  expect(analyzeMoon(observations(), planet(6), [10, 20]).coverage).toBe(false);
  expect(solver).not.toHaveBeenCalled();
});

it('enforces distinct finite observations, ascending intervals and the local approximation limit', () => {
  const solver = vi.spyOn(fits, 'moonFit');
  const raw = [...observations(5), { at: NaN, v: 0 }, { at: 0, v: 4 }].reverse();
  const a = analyzeMoon(raw, planet()); expect(a.points).toHaveLength(5); expect(a.invalid).toBe(2);
  expect(a.points.map((p) => p.x)).toEqual([0, .25, .5, .75, 1]);
  expect(analyzeMoon(observations(), planet(), [9, 1]).status).toMatch(/start date/);
  expect(analyzeMoon(observations(81, 1), planet(81)).status).toMatch(/50-day/);
  expect(solver).not.toHaveBeenCalled();
});

it('discloses limited edge extrapolation and refuses larger unsupported edges', () => {
  const a = analyzeMoon(observations(), planet(19).map((p) => ({ ...p, at: p.at + DAY })));
  expect(a.coverage).toBe(true); expect(a.edgeDays).toBe(1); expect(a.fit).not.toBeNull();
  expect(analyzeMoon(observations(), planet(16).map((p) => ({ ...p, at: p.at + 3 * DAY }))).coverage).toBe(false);
});

it('refits ambiguous daily candidates with their own errors and archives only real selected dots', () => {
  const a = analyzeMoon(observations(20, 1, .8, 0), planet(21, 1, 0));
  expect(a.alternative).not.toBeNull();
  expect(Math.abs(Math.log(a.fit!.period / a.alternative!.period))).toBeGreaterThan(.15);
  const b = moonStudy(a, 'B')!;
  expect(b.sigmaPeriod).toBe(a.alternative!.sigmaPeriod); expect(b.sigmaAmplitude).toBe(a.alternative!.sigmaAmplitude);
  expect(b.plot).toEqual(a.used.map(({ x, y }) => ({ x, y })));
  expect(JSON.parse(JSON.stringify(b))).toEqual(b);
});

it('bounds snapshot size while preserving actual dates, endpoints and numerical provenance', () => {
  const a = analyzeMoon(observations(241, 1 / 12), planet());
  const study = moonStudy(a, 'A')!; expect(study.plot).toHaveLength(180); expect(study.count).toBe(241);
  expect(study.plot[0]).toEqual({ x: a.used[0].x, y: a.used[0].y });
  expect(study.plot.at(-1)).toEqual({ x: a.used.at(-1)!.x, y: a.used.at(-1)!.y });
  for (const p of study.plot) expect(a.used.some((o) => o.x === p.x && o.y === p.y)).toBe(true);
});
