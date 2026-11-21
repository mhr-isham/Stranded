import { motionMatchesCount } from './pendulumTechnique';
import { correctHorizon } from './measurementEnvironment';
import { compareShadows, type ShadowReading } from './shadowObservation';
import type { GameState, Reading } from './store';

export const SHARP_EYE_POINTS = 15;
export const SHARP_EYE_POLICY = 'investigation-v1' as const;
export const SHARP_EYE_CONDITIONS = ['wind', 'refraction'] as const;
export type SharpEyeCondition = typeof SHARP_EYE_CONDITIONS[number];
export type SharpEyeMethod = 'windscreen' | 'damp-dry' | 'shadows';
export interface SharpEyeAward {
  runId: number; condition: SharpEyeCondition; method: SharpEyeMethod; earnedAt: number;
  /** A bounded evidence archive survives rewinds/deletion without consulting truth. */
  readings: Reading[]; shadows: ShadowReading[];
}
export type SharpEyeAwards = Partial<Record<SharpEyeCondition, SharpEyeAward>>;
type Evidence = Pick<GameState, 'readings' | 'shadows'>;
type State = Pick<GameState, 'runId' | 'settings' | 'tutorial' | 'schoolSession' | 'sharpEyeAwards' | 'piloting'>;
export const SHARP_EYE_REASONS: Record<SharpEyeMethod, string> = {
  windscreen: 'Compared separate exposed and screened pendulum releases in similar recorded wind and at the same measured length.',
  'damp-dry': 'Compared apparent horizon sights in damp and drier conditions with the same recorded station, height and aiming setup.',
  shadows: 'Recorded an apparent-horizon sight and a complete paired noon-shadow measurement: two methods for investigating atmospheric and calibration assumptions.',
};

export const sharpEyeScoredContext = (s: Pick<State, 'settings' | 'tutorial' | 'schoolSession' | 'piloting'>) =>
  !s.settings.freeRoam && !s.settings.flightPractice && !s.tutorial.active && !s.schoolSession && !s.piloting?.assisted?.length;
const close = (a: number, b: number, rel: number) => Math.abs(a - b) <= Math.max(Math.abs(a), Math.abs(b)) * rel;

function manualTiming(r: Reading) {
  const e = r.environment, p = r.pendulum, t = p?.technique, w = e?.wind;
  return r.key === 'g' && !!r.id && Number.isFinite(r.at) && r.at >= 0 && e?.at === r.at && e.instrument === 'pendulum' &&
    !!p && !!t && !!w && motionMatchesCount(r) && t.angle >= 1 && t.angle <= 10 && p.swings! >= 5 &&
    Number.isFinite(w.speed) && Number.isFinite(w.endSpeed) && w.speed > 6 && w.endSpeed! > 6 && w.changed === false &&
    close(e.rawValue, r.value, 1e-6) && close(4 * Math.PI ** 2 * p.length / p.period ** 2, r.value, 1e-6);
}
function windInvestigation(readings: Reading[]) {
  const manual = readings.filter(manualTiming);
  for (const screened of manual.filter((r) => r.environment!.wind!.protection === 'windscreen').reverse()) {
    const a = screened.pendulum!, w = screened.environment!.wind!;
    const exposed = manual.find((r) => r.id !== screened.id && r.pendulum!.technique!.releaseId !== a.technique!.releaseId &&
      r.environment!.wind!.protection === 'none' && close(r.pendulum!.length, a.length, .01) &&
      Math.abs(r.pendulum!.technique!.angle - a.technique!.angle) <= 2 &&
      Math.abs(r.environment!.wind!.speed - w.speed) <= Math.max(1, w.speed * .2) &&
      Math.abs(r.environment!.wind!.endSpeed! - w.endSpeed!) <= Math.max(1, w.endSpeed! * .2));
    if (exposed) return { method: 'windscreen' as const, readings: [exposed, screened], shadows: [] };
  }
  return null;
}
function horizon(r: Reading) {
  const e = r.environment, h = e?.horizon;
  if (r.key !== 'R1' || !r.id || !Number.isFinite(r.at) || r.at < 0 || e?.at !== r.at || e.instrument !== 'horizon' || !h || h.aim?.adjusted !== true || typeof h.damp !== 'boolean' || h.legacyCompensated || !h.station ||
    ![r.value, e.rawValue, h.height, h.rawAngle, h.usedAngle].every((v) => Number.isFinite(v) && v > 0)) return false;
  const raw = correctHorizon(h.height, h.rawAngle), used = correctHorizon(h.height, h.usedAngle);
  if (!raw || !used || !close(raw.radius, e.rawValue, 1e-6) || !close(used.radius, r.value, 1e-6)) return false;
  if (!h.correction) return close(h.rawAngle, h.usedAngle, 1e-6);
  const c = h.correction, rebuilt = correctHorizon(h.height, h.rawAngle, c.k, c.sigmaK);
  return c.sigmaK > 0 && !!rebuilt && close(rebuilt.angle, h.usedAngle, 1e-6) && Number.isFinite(c.sigmaValue) && close(rebuilt.sigmaValue, c.sigmaValue, 1e-6);
}
function knownAim(r: Reading) {
  const a = r.environment?.horizon?.aim;
  return a && typeof a.braced === 'boolean' && typeof a.tripod === 'boolean' && [a.stepDeg, a.zoom].every((v) => Number.isFinite(v) && v > 0);
}
function refractionInvestigation(readings: Reading[], shadows: ShadowReading[]) {
  const hills = readings.filter(horizon), damp = hills.filter((r) => r.environment!.horizon!.damp).reverse();
  for (const wet of damp) {
    const h = wet.environment!.horizon!;
    const dry = hills.find((r) => {
      const other = r.environment!.horizon!;
      return r.id !== wet.id && r.at !== wet.at && !other.damp && h.station === other.station && close(h.height, other.height, .01) &&
        knownAim(r) && knownAim(wet) && h.aim!.braced === other.aim!.braced && h.aim!.tripod === other.aim!.tripod &&
        close(h.aim!.stepDeg, other.aim!.stepDeg, .01) && close(h.aim!.zoom, other.aim!.zoom, .01);
    });
    if (dry) return { method: 'damp-dry' as const, readings: [wet, dry], shadows: [] };
  }
  // A negative finding is still an investigation. Do not require a hidden
  // refraction episode, a declared calibration relationship or separated ranges.
  const hill = hills.at(-1);
  if (hill) for (const id of new Set(shadows.map((r) => r.capture).filter(Boolean))) {
    const comparison = compareShadows(shadows.filter((r) => r.capture === id));
    if (comparison.result && comparison.pair) return { method: 'shadows' as const, readings: [hill], shadows: [comparison.pair.camp, comparison.pair.rover] };
  }
  return null;
}

/** Kept/excluded flags are deliberately irrelevant: the investigation, not a
 * rejection or an expected numerical outcome, earns credit. No generated world,
 * seed, true radius/gravity, or paid verification result enters this function. */
export function sharpEyeEvidence(s: Evidence, condition: SharpEyeCondition) {
  return condition === 'wind' ? windInvestigation(s.readings) : refractionInvestigation(s.readings, s.shadows);
}
function validAward(award: SharpEyeAward | undefined, condition: SharpEyeCondition, runId: number): award is SharpEyeAward {
  if (!award || award.runId !== runId || award.condition !== condition || !Number.isFinite(award.earnedAt) || !Array.isArray(award.readings) || !Array.isArray(award.shadows)) return false;
  try { return sharpEyeEvidence(award, condition)?.method === award.method; } catch { return false; }
}
export function sharpEyeAwardList(s: Pick<State, 'runId' | 'sharpEyeAwards'>) {
  return SHARP_EYE_CONDITIONS.flatMap((condition) => {
    const a = s.sharpEyeAwards?.[condition];return validAward(a, condition, s.runId) ? [a] : [];
  });
}
export function earnedSharpEyeAwards(s: State & Evidence): SharpEyeAwards | null {
  if (!sharpEyeScoredContext(s)) return null;
  const awards = { ...s.sharpEyeAwards };let changed = false;
  for (const condition of SHARP_EYE_CONDITIONS) {
    if (validAward(awards[condition], condition, s.runId)) continue;
    const evidence = sharpEyeEvidence(s, condition);
    if (evidence) {
      awards[condition] = JSON.parse(JSON.stringify({ ...evidence, runId: s.runId, condition, earnedAt: Math.max(...evidence.readings.map((r) => r.at), ...evidence.shadows.map((r) => r.at)) }));
      changed = true;
    }
  }
  return changed ? awards : null;
}
export const sharpEyePoints = (s: State) => sharpEyeScoredContext(s) ? sharpEyeAwardList(s).length * SHARP_EYE_POINTS : 0;
