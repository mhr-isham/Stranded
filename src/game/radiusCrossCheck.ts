import { compareShadows, type ShadowReading } from './shadowObservation';
import { correctHorizon } from './measurementEnvironment';
import { useGame, type GameState, type Reading } from './store';

export type RadiusRelation = 'unknown' | 'separate' | 'linked';
export type RadiusTakeaway = 'ranges' | 'conditions' | 'more-evidence';
export const RADIUS_RELATIONS: Record<RadiusRelation, string> = {
  unknown: 'Shared calibration is not established', separate: 'I used separate observations and calibrations', linked: 'One result helped calibrate the other',
};
export interface RadiusComparison {
  runId: number; hill: Reading; camp: ShadowReading; rover: ShadowReading;
  hillRadius: number; shadowRadius: number; hillSigma: number; shadowSigma: number;
  shadowWorkingError: number; relation: RadiusRelation; sourceStamp: string;
  hillRange: [number, number]; shadowRange: [number, number];
  outcome: 'overlap' | 'touch' | 'apart'; fingerprint: string;
}
export interface RadiusFieldNote {
  runId: number; seed: number; chapter: number; practice: boolean; difficulty: string;
  earnedAt: number; updatedAt: number; comparison: RadiusComparison; takeaway: RadiusTakeaway; text: string;
}
export interface RadiusDiscoveries { first: RadiusFieldNote; latest: RadiusFieldNote }
type Evidence = Pick<GameState, 'readings' | 'shadows' | 'runId'>;
const copy = <T,>(value: T): T => JSON.parse(JSON.stringify(value));

function supportedHill(r: Reading) {
  const h = r.environment?.horizon;
  if (!r.kept || r.key !== 'R1' || !Number.isFinite(r.value) || r.value <= 0 || !Number.isFinite(r.at) || r.environment?.instrument !== 'horizon' || !h || ![h.height, h.usedAngle, h.rawAngle, r.environment.at, r.environment.rawValue].every(Number.isFinite) || h.rawAngle <= 0) return false;
  if (h.correction && (![h.correction.k, h.correction.sigmaK, h.correction.sigmaValue].every(Number.isFinite) || h.correction.k < 0 || h.correction.k > .85 || h.correction.sigmaK <= 0 || h.correction.sigmaValue < 0)) return false;
  const rebuilt = correctHorizon(h.height, h.usedAngle);
  return !!rebuilt && Math.abs(rebuilt.radius / r.value - 1) < 1e-6;
}
/** Only identifiable observations are offered; a worksheet number alone cannot
 * tell us which method produced it. No hidden world values enter this path. */
export function radiusSources(s: Pick<GameState, 'readings' | 'shadows'>) {
  const hills = s.readings.filter(supportedHill).slice().reverse().sort((a, b) => b.at - a.at);
  const captures = [...new Set(s.shadows.map((r) => r.capture).filter((id): id is string => !!id))].reverse();
  const shadows = captures.map((id) => compareShadows(s.shadows.filter((r) => r.capture === id)))
    .filter((a): a is typeof a & { pair: NonNullable<typeof a.pair>; result: NonNullable<typeof a.result> } => !!a.pair && !!a.result)
    .sort((a, b) => b.pair.rover.at - a.pair.rover.at);
  return { hills, shadows };
}
export function prepareRadiusComparison(s: Evidence, hillId: string, capture: string, hillSigma: number, shadowSigma: number, relation: RadiusRelation): RadiusComparison | null {
  if (![hillSigma, shadowSigma].every((v) => Number.isFinite(v) && v > 0) || !Object.hasOwn(RADIUS_RELATIONS, relation)) return null;
  const sources = radiusSources(s), hill = sources.hills.find((r) => r.id === hillId), shadow = sources.shadows.find((a) => a.pair.rover.capture === capture);
  if (!hill || !shadow) return null;
  const { camp, rover } = shadow.pair, shadowRadius = shadow.result.radius;
  const hillRange: [number, number] = [Math.max(0, hill.value - hillSigma), hill.value + hillSigma];
  const shadowRange: [number, number] = [Math.max(0, shadowRadius - shadowSigma), shadowRadius + shadowSigma];
  if (![...hillRange, ...shadowRange].every(Number.isFinite) || hillRange[1] <= hillRange[0] || shadowRange[1] <= shadowRange[0]) return null;
  const gap = Math.max(hillRange[0], shadowRange[0]) - Math.min(hillRange[1], shadowRange[1]);
  const tolerance = Math.max(hill.value, shadowRadius) * 1e-12;
  const outcome = gap > tolerance ? 'apart' : Math.abs(gap) <= tolerance ? 'touch' : 'overlap';
  const sourceStamp = JSON.stringify([hill, camp, rover]);
  const fingerprint = JSON.stringify([s.runId, sourceStamp, hillSigma, shadowSigma, relation]);
  return { runId: s.runId, hill: copy(hill), camp: copy(camp), rover: copy(rover), hillRadius: hill.value, shadowRadius, hillSigma, shadowSigma,
    shadowWorkingError: shadow.result.sigma, relation, sourceStamp, hillRange, shadowRange, outcome, fingerprint };
}
export function radiusComparisonCurrent(s: Evidence, c: RadiusComparison) {
  if (s.runId !== c.runId) return false;
  const rebuilt = prepareRadiusComparison(s, c.hill.id, c.rover.capture!, c.hillSigma, c.shadowSigma, c.relation);
  return !!rebuilt && rebuilt.fingerprint === c.fingerprint;
}
export const radiusOutcome = (c: RadiusComparison) => c.outcome === 'apart' ? 'Your stated ranges are separated' : c.outcome === 'touch' ? 'Your stated ranges meet at the edge' : 'Your stated ranges overlap';

/** Saving recognizes the process once per expedition, for any outcome.
 * It cannot spend resources, grade against truth, merge estimates or change R1. */
export function keepRadiusFieldNote(c: RadiusComparison, takeaway: RadiusTakeaway, text = '') {
  const s = useGame.getState();
  if (s.phase !== 'play' || !radiusComparisonCurrent(s, c)) return { ok: false, reason: 'The source observations changed. Compare the current records before keeping a note.' } as const;
  const canonical = prepareRadiusComparison(s, c.hill.id, c.rover.capture!, c.hillSigma, c.shadowSigma, c.relation)!;
  if (!['ranges', 'conditions', 'more-evidence'].includes(takeaway)) return { ok: false, reason: 'Choose the takeaway you want to keep.' } as const;
  const previous = s.radiusFieldNote?.runId === s.runId ? s.radiusFieldNote : null;
  const trimmed = text.trim().slice(0, 600);
  if (previous?.comparison.fingerprint === c.fingerprint && previous.takeaway === takeaway && previous.text === trimmed) return { ok: true, first: false, unchanged: true, note: previous } as const;
  const now = Date.now();
  const note: RadiusFieldNote = { runId: s.runId, seed: s.seed, chapter: s.chapter, difficulty: s.settings.difficulty, practice: !!s.schoolSession,
    earnedAt: previous?.earnedAt ?? now, updatedAt: now, comparison: canonical, takeaway, text: trimmed };
  s.set({ radiusFieldNote: note, radiusDiscoveries: { first: s.radiusDiscoveries?.first ?? note, latest: note } });
  return { ok: true, first: !previous, unchanged: false, note } as const;
}
