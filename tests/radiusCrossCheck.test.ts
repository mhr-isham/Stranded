import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { correctHorizon } from '../src/game/measurementEnvironment';
import { compareShadows, markedShadow, makeShadowCapture, nextShadowNoon } from '../src/game/shadowObservation';
import { keepRadiusFieldNote, prepareRadiusComparison, radiusComparisonCurrent, radiusSources, type RadiusRelation } from '../src/game/radiusCrossCheck';
import { currentWorld } from '../src/game/sim';
import { useGame, type Reading } from '../src/game/store';
import { saveSlot, loadSlot } from '../src/game/checkpoints';
import { practiceSnapshot, leaveFlightPractice } from '../src/ui/common/flightPractice';

const hillReading = (radius: number, id = 'hill'): Reading => {
  const height = 1001.7, angle = Math.acos(radius / (radius + height)), result = correctHorizon(height, angle)!;
  return { id, key: 'R1', value: result.radius, at: 1200, kept: true, note: 'Summit · manual horizon sight', environment: {
    instrument: 'horizon', at: 1200, rawValue: result.radius, horizon: { station: 'Summit', height, rawAngle: angle, usedAngle: angle, damp: false },
  } };
};
beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => storage.get(k) ?? null, setItem: (k: string, v: string) => storage.set(k, v), removeItem: (k: string) => storage.delete(k) });
  useGame.getState().newGame(316, { difficulty: 'navigator', survival: false, sound: false, formulas: true });
  const sys = currentWorld().system, t = nextShadowNoon(sys, 0)!, cap = makeShadowCapture(sys, t, 800000, 1000, 'pair')!;
  const shadows = [markedShadow(cap, 'camp', cap.camp.length, .01)!, markedShadow(cap, 'rover', cap.rover.length, .01)!];
  const radius = compareShadows(shadows).result!.radius;
  useGame.setState({ phase: 'play', radiusFieldNote: null, radiusDiscoveries: null, readings: [hillReading(radius * 1.05)], shadows, sheet: { R1: { value: 1234, sigma: 10 } } });
});
afterEach(() => vi.unstubAllGlobals());
const preview = (hillSigma = 500000, shadowSigma = 500000, relation: RadiusRelation = 'unknown') => prepareRadiusComparison(useGame.getState(), 'hill', 'pair', hillSigma, shadowSigma, relation)!;

it('uses separate observed methods and entered ranges without consulting the worksheet', () => {
  const c = preview(); expect(c.outcome).toBe('overlap');
  expect(c.hillRadius).toBe(useGame.getState().readings[0].value); expect(c.hillRadius).not.toBe(1234);
  useGame.setState({ sheet: { R1: { value: 9e99, sigma: 1 } } });
  expect(radiusComparisonCurrent(useGame.getState(), c)).toBe(true);
  const separate = preview(500000, 500000, 'separate'), linked = preview(500000, 500000, 'linked');
  expect(linked.outcome).toBe(separate.outcome); expect(linked.relation).toBe('linked');
  expect(linked.fingerprint).not.toBe(separate.fingerprint);
});

it('distinguishes overlapping, separated and touching physical ranges without a significance score', () => {
  expect(preview(1000, 1000).outcome).toBe('apart');
  const gap = preview().hillRadius - preview().shadowRadius;
  expect(preview(gap / 2, gap / 2).outcome).toBe('touch');
  const wide = preview(1e8, 1e8); expect(wide.hillRange[0]).toBe(0); expect(wide.shadowRange[0]).toBe(0);
  expect(wide.outcome).toBe('overlap'); expect(wide).not.toHaveProperty('zScore');
});

it('rejects invalid ranges and unsupported or inconsistent observation provenance', () => {
  for (const value of [0, -1, NaN, Infinity, Number.MIN_VALUE]) expect(preview(value)).toBeNull();
  expect(preview(500000, 500000, 'toString' as RadiusRelation)).toBeNull();
  const original = useGame.getState().readings[0];
  for (const bad of [{ ...original, kept: false }, { ...original, environment: undefined }, { ...original, value: original.value * 2 }]) {
    useGame.setState({ readings: [bad] }); expect(radiusSources(useGame.getState()).hills).toHaveLength(0);
  }
  useGame.setState({ readings: [original], shadows: [] }); expect(preview()).toBeNull();
});

it('offers distinct captures and invalidates previews when marks, keeping or observing conditions change', () => {
  const s = useGame.getState(), c = preview(); expect(radiusComparisonCurrent(s, c)).toBe(true);
  const second = s.shadows.map((r) => ({ ...r, capture: 'second', length: r.length! * 1.02 }));
  useGame.setState({ shadows: [...s.shadows, ...second] }); expect(radiusSources(useGame.getState()).shadows).toHaveLength(2);
  expect(radiusComparisonCurrent(useGame.getState(), c)).toBe(true);
  useGame.setState({ shadows: s.shadows.map((r) => r.site === 'camp' ? { ...r, sigmaLength: .02 } : r) });
  expect(radiusComparisonCurrent(useGame.getState(), c)).toBe(false);
  expect(keepRadiusFieldNote(c, 'conditions').ok).toBe(false);
  useGame.setState({ shadows: s.shadows, readings: [{ ...s.readings[0], kept: false }] });
  expect(radiusComparisonCurrent(useGame.getState(), c)).toBe(false);
});

it('recognizes either outcome once, preserves the first discovery and has no expedition advantage', () => {
  const before = useGame.getState(), c = preview(1000, 1000), first = keepRadiusFieldNote(c, 'more-evidence', '  My methods differ; investigate the atmosphere.  ');
  expect(first.ok && first.first).toBe(true); expect(c.outcome).toBe('apart');
  const after = useGame.getState(), original = after.radiusDiscoveries!.first;
  expect(after.radiusFieldNote!.text).toBe('My methods differ; investigate the atmosphere.');
  expect(after.sheet).toBe(before.sheet); expect(after.penaltyDv).toBe(before.penaltyDv); expect(after.checksUsed).toBe(before.checksUsed); expect(after.hintsUsed).toBe(before.hintsUsed);
  expect(after.schoolRewards).toBe(before.schoolRewards); expect(after.achievements).toBe(before.achievements);
  const same = keepRadiusFieldNote(c, 'more-evidence', after.radiusFieldNote!.text); expect(same.ok && same.unchanged).toBe(true);
  const update = keepRadiusFieldNote(preview(), 'ranges'); expect(update.ok && update.first).toBe(false);
  expect(useGame.getState().radiusDiscoveries!.first).toBe(original);
  expect(useGame.getState().radiusDiscoveries!.latest.comparison.outcome).toBe('overlap');
});

it('keeps immutable snapshots and reconstructs canonical values when saving', () => {
  const c = preview(), real = c.hillRadius;
  c.hillRadius = 1; expect(keepRadiusFieldNote(c, 'ranges').ok).toBe(true);
  const note = useGame.getState().radiusFieldNote!; expect(note.comparison.hillRadius).toBe(real);
  const keptLength = note.comparison.camp.length;
  useGame.setState({ shadows: useGame.getState().shadows.map((r) => ({ ...r, length: r.length! + .01 })) });
  expect(note.comparison.camp.length).toBe(keptLength); expect(radiusComparisonCurrent(useGame.getState(), note.comparison)).toBe(false);
  expect(JSON.parse(JSON.stringify(note))).toEqual(note);
});

it('preserves recognition through checkpoints and new expeditions without turning saved notes into current evidence', () => {
  saveSlot(0); keepRadiusFieldNote(preview(), 'conditions'); const note = useGame.getState().radiusFieldNote!;
  loadSlot(0); expect(useGame.getState().radiusFieldNote).toBe(note);
  expect(keepRadiusFieldNote(preview(), 'conditions').ok).toBe(true);
  const profile = useGame.getState().radiusDiscoveries;
  useGame.getState().newGame(99, useGame.getState().settings);
  expect(useGame.getState().radiusFieldNote).toBeNull(); expect(useGame.getState().radiusDiscoveries).toBe(profile);
  expect(radiusComparisonCurrent(useGame.getState(), note.comparison)).toBe(false);
});

it('restores the original expedition note after practice while retaining the profile souvenir', () => {
  keepRadiusFieldNote(preview(), 'ranges'); const original = useGame.getState().radiusFieldNote;
  const back = practiceSnapshot();
  useGame.setState({ runId: useGame.getState().runId + 1, radiusFieldNote: null, practiceReturn: back, schoolSession: { id: 'shadows', start: 0, end: 0, completedSteps: [], assisted: false } });
  expect(keepRadiusFieldNote(preview(), 'conditions').ok).toBe(true);
  const practice = useGame.getState().radiusDiscoveries!.latest; expect(practice.practice).toBe(true);
  leaveFlightPractice(); expect(useGame.getState().radiusFieldNote).toEqual(original);
  expect(useGame.getState().radiusDiscoveries!.latest).toBe(practice);
});
