import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { correctHorizon } from '../src/game/measurementEnvironment';
import { SHARP_EYE_POLICY, sharpEyeAwardList, sharpEyeEvidence, sharpEyePoints } from '../src/game/sharpEye';
import { useGame, type Reading, type GameState } from '../src/game/store';
import { loadSlot, rewindToLaunch, savePrelaunch, saveSlot } from '../src/game/checkpoints';
import { currentWorld } from '../src/game/sim';
import { makeShadowCapture, markedShadow, nextShadowNoon } from '../src/game/shadowObservation';
import { keepRadiusFieldNote, prepareRadiusComparison } from '../src/game/radiusCrossCheck';
import { gradeRun } from '../src/engine/scoring';

const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value));
const timing = (id: string, protection: 'none' | 'windscreen' = 'none'): Reading => {
  const length = 1, period = 2, value = 4 * Math.PI ** 2 * length / period ** 2;
  return { id, key: 'g', value, at: 0, kept: true, note: '', pendulum: { length, period, swings: 5, time: 10, technique: { source: 'manual', releaseId: id, angle: 6, turns: 11 } }, environment: { instrument: 'pendulum', at: 0, rawValue: value, wind: { speed: 9, endSpeed: 9, changed: false, protection } } };
};
const hill = (id: string, damp: boolean, at: number, corrected = false): Reading => {
  const height = 1001.7, angle = .02, raw = correctHorizon(height, angle)!, used = corrected ? correctHorizon(height, angle, .2, .02)! : raw;
  return { id, key: 'R1', value: used.radius, at, kept: true, note: '', environment: { instrument: 'horizon', at, rawValue: raw.radius, horizon: {
    height, station: 'Summit', rawAngle: angle, usedAngle: used.angle, damp, aim: { braced: true, tripod: false, stepDeg: .001, zoom: 4, adjusted: true },
    ...(corrected ? { correction: { source: 'echo-humidity' as const, k: .2, sigmaK: .02, sigmaValue: used.sigmaValue } } : {}),
  } } };
};
const wind = () => [timing('exposed'), timing('screened', 'windscreen')];
const refraction = () => [hill('damp', true, 100), hill('dry', false, 50000)];
let storage: Map<string, string>;
beforeEach(() => {
  storage = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) });
  useGame.getState().newGame(316, { difficulty: 'navigator', survival: false, sound: false, formulas: true });
  useGame.setState({ phase: 'play', readings: [], shadows: [] });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('gives no points for collecting, rejecting or repeatedly toggling affected readings alone', () => {
  const readings = Array.from({ length: 100 }, (_, i) => ({ ...timing(String(i)), kept: false }));
  useGame.setState({ readings });expect(sharpEyePoints(useGame.getState())).toBe(0);
  for (let i = 0; i < 10; i++) useGame.getState().toggleReading('0');
  expect(sharpEyePoints(useGame.getState())).toBe(0);
});
it('recognizes a controlled wind comparison, including an honestly null numerical result', () => {
  const readings = wind();expect(readings[0].value).toBe(readings[1].value);
  useGame.setState({ readings });expect(sharpEyePoints(useGame.getState())).toBe(15);
  const a = sharpEyeAwardList(useGame.getState())[0];expect(a.method).toBe('windscreen');
  expect(a.readings).not.toBe(readings);expect(a.readings[0]).not.toBe(readings[0]);
});
it('does not use hidden truth, a worksheet answer or paid verification to choose credit', () => {
  const readings = wind(), evidence = { readings, shadows: [] };
  const result = sharpEyeEvidence(evidence, 'wind');expect(result).not.toBeNull();
  useGame.setState({ readings, sheet: { g: { value: 1e20, sigma: 1 } }, checksUsed: 99 });
  const s = useGame.getState();expect(sharpEyePoints(s)).toBe(15);
  expect(sharpEyeEvidence({ ...evidence, seed: 999, settings: { difficulty: 'stargazer' } } as typeof evidence, 'wind')).toEqual(result);
});
it('requires different manual releases, consistent arithmetic and comparable recorded setup/conditions', () => {
  const changes: ((r: Reading) => void)[] = [
    r => { r.pendulum!.technique!.releaseId = 'exposed'; },
    r => { r.pendulum!.technique!.source = 'echo'; },
    r => { r.pendulum!.technique!.angle = 30; },
    r => { r.pendulum!.swings = 1; },
    r => { r.pendulum!.time = 1; },
    r => { r.pendulum!.technique!.turns = 3; },
    r => { r.pendulum!.length *= 1.2; },
    r => { r.environment!.wind!.changed = true; },
    r => { r.environment!.wind!.endSpeed = undefined; },
    r => { r.environment!.wind!.speed = 3; },
    r => { r.environment!.wind!.speed = 14; },
    r => { r.environment!.wind!.protection = 'echo'; },
    r => { r.value *= 2; r.environment!.rawValue = r.value; },
    r => { r.environment = undefined; },
  ];
  for (const change of changes) {
    const readings = wind();change(readings[1]);expect(sharpEyeEvidence({ readings, shadows: [] }, 'wind')).toBeNull();
  }
});
it('recognizes a comparable damp/dry experiment using preserved apparent angles, even with labelled assistance', () => {
  useGame.setState({ readings: [hill('damp', true, 100, true), hill('dry', false, 50000)] });
  expect(sharpEyePoints(useGame.getState())).toBe(15);
  expect(sharpEyeAwardList(useGame.getState())[0].method).toBe('damp-dry');
});
it('does not turn a correction/revision of one sight or incomplete legacy metadata into another experiment', () => {
  const changes: ((r: Reading) => void)[] = [
    r => { r.at = 100; r.environment!.at = 100; },
    r => { r.environment!.horizon!.station = 'Ridge'; },
    r => { r.environment!.horizon!.height *= 1.2; },
    r => { r.environment!.horizon!.aim!.braced = false; },
    r => { r.environment!.horizon!.aim = undefined; },
    r => { r.environment!.horizon!.legacyCompensated = true; },
    r => { r.environment!.rawValue *= 2; },
    r => { r.value *= 2; },
    r => { r.environment = undefined; },
  ];
  for (const change of changes) {
    const readings = refraction();change(readings[1]);expect(sharpEyeEvidence({ readings, shadows: [] }, 'refraction')).toBeNull();
  }
  expect(sharpEyeEvidence({ readings: [hill('raw', true, 100), hill('corrected', true, 100, true)], shadows: [] }, 'refraction')).toBeNull();
});
it('supports the shadow-method investigation without requiring a particular numerical comparison outcome', () => {
  const sys = currentWorld().system, at = nextShadowNoon(sys, 0)!, cap = makeShadowCapture(sys, at, 800000, 1000, 'pair')!;
  const shadows = [markedShadow(cap, 'camp', cap.camp.length, .01)!, markedShadow(cap, 'rover', cap.rover.length, .01)!];
  const reading = hill('ordinary-horizon', false, 100);
  useGame.setState({ readings: [reading], shadows: shadows.slice(0, 1) });expect(sharpEyePoints(useGame.getState())).toBe(0);
  useGame.setState({ shadows });expect(sharpEyePoints(useGame.getState())).toBe(15);
  expect(sharpEyeAwardList(useGame.getState())[0].method).toBe('shadows');
  const comparison = prepareRadiusComparison(useGame.getState(), 'ordinary-horizon', 'pair', 1e5, 1e5, 'unknown')!;
  expect(keepRadiusFieldNote(comparison, 'conditions').ok).toBe(true);
  expect(sharpEyePoints(useGame.getState())).toBe(15); // field-note saving adds no score
});
it('caps both refraction routes together, and all earned types at 30 base points', () => {
  useGame.setState({ readings: [...wind(), ...refraction()] });
  expect(sharpEyePoints(useGame.getState())).toBe(30);
  for (let i = 0; i < 10; i++) useGame.setState(s => ({ readings: [...s.readings, ...wind().map(r => ({ ...r, id: `${i}:${r.id}` }))] }));
  expect(sharpEyePoints(useGame.getState())).toBe(30);expect(sharpEyeAwardList(useGame.getState())).toHaveLength(2);
});
it('keeps the immutable evidence credit when readings are excluded, edited or removed', () => {
  useGame.setState({ readings: wind() });const archive = JSON.stringify(useGame.getState().sharpEyeAwards);
  useGame.getState().toggleReading('exposed');useGame.getState().removeReading('screened');
  expect(sharpEyePoints(useGame.getState())).toBe(15);expect(JSON.stringify(useGame.getState().sharpEyeAwards)).toBe(archive);
  useGame.setState({ readings: [] });expect(sharpEyePoints(useGame.getState())).toBe(15);
});
it('preserves credit and notice state through older checkpoint loads and prelaunch rewinds', () => {
  expect(saveSlot(0)).toBe(true);savePrelaunch();
  useGame.setState({ readings: wind(), sharpEyeNotified: ['wind'] });const archive = JSON.stringify(useGame.getState().sharpEyeAwards);
  expect(loadSlot(0)).toBe(true);expect(useGame.getState().readings).toHaveLength(0);
  expect(sharpEyePoints(useGame.getState())).toBe(15);expect(useGame.getState().sharpEyeNotified).toEqual(['wind']);
  expect(rewindToLaunch()).toBe(true);expect(sharpEyePoints(useGame.getState())).toBe(15);
  useGame.setState({ readings: wind() });expect(JSON.stringify(useGame.getState().sharpEyeAwards)).toBe(archive);
});
it('starts each new expedition without old investigation credit', () => {
  useGame.setState({ readings: wind(), sharpEyeNotified: ['wind'] });
  useGame.getState().newGame(17, { difficulty: 'navigator', survival: false, sound: false, formulas: true });
  expect(sharpEyePoints(useGame.getState())).toBe(0);expect(useGame.getState().sharpEyeNotified).toEqual([]);
  expect(useGame.getState().settings.rulesetVersion).toBe(4);expect(SHARP_EYE_POLICY).toBe('investigation-v1');
});
it('does not award in unscored practice, tutorials, Free Roam or assisted journeys', () => {
  for (const patch of [
    { settings: { ...useGame.getState().settings, freeRoam: true } },
    { tutorial: { ...useGame.getState().tutorial, active: true } },
    { schoolSession: { id: 'gravity' } as GameState['schoolSession'] },
    { settings: { ...useGame.getState().settings, flightPractice: 'ascent' as const } },
    { piloting: { assisted: ['ascent' as const] } },
  ]) {
    useGame.getState().newGame(316, { difficulty: 'navigator', survival: false, sound: false, formulas: true });
    useGame.setState({ phase: 'play', ...patch, readings: wind() });expect(sharpEyePoints(useGame.getState())).toBe(0);
    expect(sharpEyeAwardList(useGame.getState())).toHaveLength(0);
  }
});
it('rejects stale-run, malformed and mismatched archives without crashing or inventing points', () => {
  useGame.setState({ readings: wind() });const a = clone(useGame.getState().sharpEyeAwards!.wind!);
  for (const patch of [{ runId: a.runId + 1 }, { method: 'damp-dry' }, { readings: [null] }, { condition: 'refraction' }, { earnedAt: NaN }]) {
    useGame.setState({ sharpEyeAwards: { wind: { ...a, ...patch } as typeof a } });expect(sharpEyePoints(useGame.getState())).toBe(0);
  }
});
it('adds base credit through the existing grade multiplier without changing fuel, hints or measurements', () => {
  const before = useGame.getState();useGame.setState({ readings: wind() });const after = useGame.getState();
  expect(after.penaltyDv).toBe(before.penaltyDv);expect(after.checksUsed).toBe(before.checksUsed);expect(after.hintsUsed).toBe(before.hintsUsed);expect(after.sheet).toBe(before.sheet);
  const opts = { measurementPoints: 1000, fuelLeftFraction: .2, daysLeftFraction: .1, hintsUsed: 0, success: true, multiplier: 1.2 };
  expect(gradeRun({ ...opts, penalty: -sharpEyePoints(after) }).total - gradeRun(opts).total).toBe(18);
});
it('keeps legacy physical rules and historical Atlas scores intact', () => {
  const s = useGame.getState();
  const old = { id: 1, seed: 9, mode: 'navigator', survival: false, date: 1, names: {}, outcome: 'success', grade: 'A', score: 1234, camp: null, predictions: { made: 0, inside: 0 }, rows: [] } as GameState['atlas'][number];
  useGame.setState({ atlas: [old], settings: { ...s.settings, rulesetVersion: 2 }, readings: wind() });
  expect(sharpEyePoints(useGame.getState())).toBe(15);expect(useGame.getState().settings.rulesetVersion).toBe(2);
  useGame.getState().newGame(17, { difficulty: 'navigator', survival: false, sound: false, formulas: true });
  expect(useGame.getState().atlas[0]).toEqual(old);expect(useGame.getState().atlas[0].sharpEyePolicy).toBeUndefined();
});
it('requires synchronized, fully measured shadow evidence rather than legacy or incomplete pairs', () => {
  const sys = currentWorld().system, cap = makeShadowCapture(sys, nextShadowNoon(sys, 0)!, 800000, 1000, 'pair')!;
  const original = [markedShadow(cap, 'camp', cap.camp.length, .01)!, markedShadow(cap, 'rover', cap.rover.length, .01)!];
  for (const change of [
    (r: typeof original[number]) => { r.capture = 'other'; },
    (r: typeof original[number]) => { r.capture = undefined; },
    (r: typeof original[number]) => { r.at += 1; },
    (r: typeof original[number]) => { r.sigmaLength = 0; },
  ]) {
    const shadows = clone(original);change(shadows[1]);
    expect(sharpEyeEvidence({ readings: [hill('ordinary', false, 100)], shadows }, 'refraction')).toBeNull();
  }
});
it('does not infer deliberate horizon aiming from absent historical metadata', () => {
  const readings = refraction();delete readings[1].environment!.horizon!.aim!.adjusted;
  expect(sharpEyeEvidence({ readings, shadows: [] }, 'refraction')).toBeNull();
});
