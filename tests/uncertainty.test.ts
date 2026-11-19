import { afterEach, expect, it, vi } from 'vitest';
import { DERIVED_KEYS, deriveAll, keysFor, uncertaintyBudget, type Primaries } from '../src/engine/chain';
import { variantOf } from '../src/engine/chapters';
import { DAY, G } from '../src/engine/constants';
import { modelFromPrimaries, sampleModel } from '../src/engine/planner';
import { makeRng } from '../src/engine/rng';
import { botMeasure, PERFECT } from '../src/engine/solver';
import { generateSystem } from '../src/engine/system';
import { assessableModel, summarizeForecast } from '../src/game/forecast';
import { conditionUncertainty } from '../src/game/measurementEnvironment';
import { readingStats, useGame, type Reading } from '../src/game/store';
import { sendFromReadings } from '../src/game/tutorial';

afterEach(() => vi.unstubAllGlobals());
const e = (value: number, sigma = 0) => ({ value, sigma, at: 0 });
const reading = (id: string, value: number, patch: Partial<Reading> = {}): Reading => ({ id, key: 'g', value, at: 0, kept: true, note: '', ...patch });
const timing = (releaseId: string) => ({ length: 2, period: 3, technique: { source: 'manual' as const, releaseId, angle: .05, turns: 20 } });
const fixture = (chapter = 1) => {
  const sys = generateSystem(316, 'navigator', chapter), variant = variantOf(sys.features);
  const p = botMeasure(sys, PERFECT, makeRng(812)).primaries;
  return { p, variant };
};

it('matches analytical gR²/G sensitivities and variance shares, counting R once with its squared sensitivity', () => {
  const p = { g: e(10, .1), R1: e(6e6, 1.2e5) }, b = uncertaintyBudget(p, 'M1')!;
  const mass = 10 * (6e6) ** 2 / G;
  expect(b.value).toBe(mass);
  expect(b.sigma / mass).toBeCloseTo(Math.hypot(.01, .04), 8);
  expect(b.contributions.find((c) => c.input === 'R1')!.share).toBeCloseTo(16 / 17, 7);
  expect(b.contributions.find((c) => c.input === 'g')!.effect / mass).toBeCloseTo(.01, 8);
  expect(b.contributions.reduce((s, c) => s + c.share, 0)).toBeCloseTo(1, 12);
});
it('exposes the dominant distance contribution to R2 and keeps a hypothetical improvement pure', () => {
  const p: Primaries = { P1: e(100 * DAY), S2: e(200 * DAY), tOpp: e(0), dPar: e(1e11, 5e9), alpha2: e(.001, .00001) };
  const before = JSON.stringify(p), b = uncertaintyBudget(p, 'R2')!;
  const fromAngle = .5 * p.dPar!.value / Math.cos(.001 / 2) ** 2 * .00001;
  expect(b.sigma / Math.hypot(b.value * .05, fromAngle)).toBeCloseTo(1, 7);
  expect(b.contributions.find((c) => c.input === 'dPar')!.share).toBeCloseTo(25 / 26, 6);
  const preview = uncertaintyBudget({ ...p, dPar: { ...p.dPar!, sigma: 2.5e9 } }, 'R2')!;
  expect(preview.value).toBe(b.value);
  expect(preview.sigma / Math.hypot(b.value * .025, fromAngle)).toBeCloseTo(1, 7);
  expect(JSON.stringify(p)).toBe(before);
});
it('fixes duplicate giant-orbit inputs rather than treating a repeated Sg as independent evidence', () => {
  const P1 = 100 * DAY, Sg = 150 * DAY, d = 1e11, sigma = DAY;
  const p: Primaries = { P1: e(P1), Porb: e(210 * DAY), tOpp: e(0), Sg: e(Sg, sigma), tOppG: e(0), dPar: e(d) };
  const r = (1 - P1 / Sg) ** (-2 / 3);
  const dr = -(2 / 3) * (1 - P1 / Sg) ** (-5 / 3) * P1 / Sg ** 2;
  const expected = Math.abs(-d / (r - 1) ** 2 * dr * sigma);
  const b = uncertaintyBudget(p, 'aG', 'slingshot')!;
  expect(b.contributions.filter((c) => c.input === 'Sg')).toHaveLength(1);
  expect(b.sigma / expected).toBeCloseTo(1, 7);
  expect(deriveAll(p, 'slingshot').aG!.sigma / expected).toBeCloseTo(1, 7);
});
it('uses the same budgets for worksheet results in all chapter variants', () => {
  for (const chapter of [1, 2, 4, 5, 7, 8]) {
    const { p, variant } = fixture(chapter), derived = deriveAll(p, variant);
    for (const key of DERIVED_KEYS) {
      const b = uncertaintyBudget(p, key, variant);
      if (!b) { expect(derived[key]).toBeUndefined(); continue; }
      expect(derived[key]).toEqual({ value: b.value, sigma: b.sigma });
      expect(new Set(b.contributions.map((c) => c.input)).size).toBe(b.contributions.length);
      expect(b.invalid).toEqual([]);
    }
  }
});
it('distinguishes missing values, zero allowances and invalid or overflowing uncertainties', () => {
  expect(uncertaintyBudget({}, 'M1')).toBeNull();
  const p = { g: e(10), R1: e(6e6) };
  expect(uncertaintyBudget(p, 'M1')!.sigma).toBe(0);
  for (const sigma of [NaN, Infinity, -1, 1e300]) {
    const b = uncertaintyBudget({ ...p, R1: e(6e6, sigma) }, 'M1')!;
    expect(Number.isNaN(b.sigma)).toBe(true);
    expect(b.invalid).toContain('R1');
  }
  expect(uncertaintyBudget({ ...p, R1: e(Infinity) }, 'M1')).toBeNull();
});
it('keeps latest kept versions of one source, retaining independent releases even at the same time', () => {
  const log = [reading('a', 8, { pendulum: timing('one') }), reading('b', 10, { pendulum: timing('one') }), reading('c', 12, { pendulum: timing('two') })];
  const st = readingStats(log, 'g')!;
  expect(st).toMatchObject({ n: 2, raw: 3, revisions: 1, mean: 11, at: 0 });
  expect(st.se).toBeCloseTo(1, 12);
  expect(readingStats(log.map((r) => r.id === 'b' ? { ...r, kept: false } : r), 'g')!.mean).toBe(10);
  expect(log).toHaveLength(3);
});
it('does not mistake revised wires or a repeated parallax pair for independent exposures', () => {
  const micrometer = { sightingId: 'A', wireA: 0, wireB: .01, field: .1, stepArcsec: 1, realSampleMs: 0, revisions: 0 };
  const log = [reading('a', .01, { key: 'alpha2', micrometer }), reading('b', .012, { key: 'alpha2', micrometer: { ...micrometer, revisions: 1 } }), reading('c', .014, { key: 'alpha2', micrometer: { ...micrometer, sightingId: 'B' } })];
  expect(readingStats(log, 'alpha2')).toMatchObject({ n: 2, revisions: 1 });
  expect(readingStats(log, 'alpha2')!.mean).toBeCloseTo(.013, 12);
  const pair = { captureId: 'pair', baseline: 1000, projectedBaseline: 900, shift: .01, markA: { x: 0, y: 0 }, markB: { x: .01, y: 0 } };
  expect(readingStats([reading('a', 10, { key: 'dPar', parallax: pair }), reading('b', 20, { key: 'dPar', parallax: pair })], 'dPar')).toMatchObject({ n: 1, revisions: 1, mean: 20 });
});
it('retains legacy provenance without inferring independence or duplicates from matching times or values', () => {
  const log = [reading('a', 10), reading('b', 10), reading('c', NaN), reading('d', 12, { at: NaN })];
  expect(readingStats(log, 'g')).toMatchObject({ n: 3, revisions: 0, invalid: 1, at: undefined });
  expect(readingStats([reading('a', NaN)], 'g')).toBeNull();
});
it('retains the shared correction floor when Flight School sends an average', () => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  const environment = { instrument: 'horizon' as const, at: 0, rawValue: 6e6, horizon: { height: 800, station: 'Summit', rawAngle: .01, usedAngle: .012, damp: true, correction: { source: 'player' as const, k: .2, sigmaK: .02, sigmaValue: 120e3 } } };
  useGame.getState().newGame(316, { difficulty: 'cadet', survival: false, sound: false, formulas: true });
  for (const count of [1, 25]) {
    const log = Array.from({ length: count }, (_, i) => reading(String(i), 6e6, { key: 'R1', environment }));
    useGame.setState({ readings: log }); sendFromReadings('R1', .001);
    expect(conditionUncertainty(log)).toBe(120e3);
    expect(useGame.getState().sheet.R1!.sigma).toBe(120e3);
  }
});
it('counts actual simulator outcomes and retains unassessable trials in the attempted total', () => {
  expect(summarizeForecast([
    { outcome: 'success', fuelLeft: 10 }, { outcome: 'success', fuelLeft: 0 },
    { outcome: 'expired', fuelLeft: 1000 }, { outcome: 'flyby', fuelLeft: 10 },
    { outcome: 'lost', fuelLeft: -Infinity }, { outcome: 'no-escape', fuelLeft: -5 },
    null, { outcome: 'success', fuelLeft: NaN }, { outcome: 'success', fuelLeft: Infinity }, { outcome: 'success', fuelLeft: -1 },
    { outcome: 'flyby', fuelLeft: Infinity },
  ])).toEqual({ attempted: 11, succeeded: 2, unsuccessful: 4, unassessable: 5 });
  expect(summarizeForecast([null, null])).toEqual({ attempted: 2, succeeded: 0, unsuccessful: 0, unassessable: 2 });
  expect(summarizeForecast([]).attempted).toBe(0);
});
it('rejects nonphysical sampled models and invalid error bars without silently redrawing them', () => {
  const { p, variant } = fixture();
  const model = modelFromPrimaries(p, variant)!;
  expect(assessableModel(model)).toBe(true);
  for (const patch of [{ R1: 0 }, { P2: -1 }, { Mstar: Infinity }, { ecc: 1, peri: 0 }, { ecc: .2, peri: NaN }, { giant: { a: 1, P: -1, M: 1, tOpp: 0 } }]) expect(assessableModel({ ...model, ...patch })).toBe(false);
  for (const sigma of [-1, NaN, Infinity]) expect(sampleModel({ ...p, g: { ...p.g!, sigma } }, makeRng(42), variant)).toBeNull();
  for (const key of ['Pm', 'dPar', 'alpha2'] as const) expect(sampleModel({ ...p, [key]: e(-1) }, { ...makeRng(42), normal: (mean = 0) => mean }, variant)).toBeNull();
  const rng = makeRng(42), normal = vi.spyOn(rng, 'normal').mockImplementation((mean = 0) => mean);
  expect(assessableModel(sampleModel(p, rng, variant))).toBe(true);
  expect(normal).toHaveBeenCalledTimes(keysFor(variant).length);
});
