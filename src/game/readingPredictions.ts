import { DAY, DEG } from '../engine/constants';
import { linearFit } from '../engine/solver';
import { recordTraining } from './training';
import { useGame, type GameState } from './store';
import { validEstimate } from './estimation';

export type ReadingPredictionKind = 'pendulum' | 'star';
export interface ReadingPrediction {
  value: number; range: number; beforeIds: string[]; due?: number; length?: number;
  reference?: number; comparison?: number; comparisonAt?: number; assisted?: boolean;
  baseline?: { length: number; period: number };
}
export type ReadingPredictions = Partial<Record<ReadingPredictionKind, ReadingPrediction>>;
export const readingPracticeAllowed = (s: GameState) => !!s.schoolSession && s.tutorial.active && !!s.settings.freeRoam;

export function unwrapPositions(observations: GameState['starObs']) {
  const sorted = [...observations].sort((a, b) => a.at - b.at);
  const points: { x: number; y: number }[] = [];
  for (const observation of sorted) {
    const raw = observation.v / DEG;
    const previous = points.at(-1)?.y ?? raw;
    points.push({ x: observation.at / DAY, y: raw + 360 * Math.round((previous - raw) / 360) });
  }
  return points;
}

export function commitReadingPrediction(kind: ReadingPredictionKind, value: number, range: number, target: number) {
  const s = useGame.getState();
  if (!readingPracticeAllowed(s) || !validEstimate(value, range) || !Number.isFinite(target) || s.readingPredictions?.[kind]) return false;
  let prediction: ReadingPrediction;
  if (kind === 'pendulum') {
    const baseline = s.readings.filter((r) => r.kept && r.pendulum).at(-1)?.pendulum;
    if (!baseline || !(baseline.length > 0) || !Number.isFinite(baseline.length) || !(baseline.period > 0) || !Number.isFinite(baseline.period) || target <= 0 || Math.abs(target / baseline.length - 1) < .2) return false;
    prediction = { value, range, length: target, baseline, beforeIds: s.readings.map((r) => r.id), assisted: !!s.schoolSession?.assisted };
  } else {
    const points = unwrapPositions(s.starObs);
    if (points.length < 2 || points.at(-1)!.x <= points[0].x || target / DAY <= points.at(-1)!.x) return false;
    const fit = linearFit(points.map((p) => p.x), points.map((p) => p.y));
    if (!Number.isFinite(fit.intercept + fit.slope * target / DAY)) return false;
    prediction = { value, range, due: target, reference: fit.intercept + fit.slope * target / DAY, beforeIds: s.starObs.map((o) => String(o.at)), assisted: !!s.schoolSession?.assisted };
  }
  useGame.setState({ readingPredictions: { ...s.readingPredictions, [kind]: prediction } });
  return true;
}

/** Resolve from a new observation only, never a hidden system value. */
export function resolveReadingPredictions() {
  const s = useGame.getState();
  if (!readingPracticeAllowed(s)) return;
  for (const kind of ['pendulum', 'star'] as const) {
    const p = useGame.getState().readingPredictions?.[kind];
    if (!p || p.comparison !== undefined) continue;
    let comparison: number | undefined, at: number | undefined;
    if (kind === 'pendulum') {
      const reading = s.readings.find((r) => r.kept && r.pendulum && r.pendulum.period > 0 && Number.isFinite(r.pendulum.period) && !p.beforeIds.includes(r.id) && Math.abs(r.pendulum.length - p.length!) <= Math.max(.01, p.length! * .01));
      comparison = reading?.pendulum?.period; at = reading?.at;
    } else {
      const observation = s.starObs.find((o) => !p.beforeIds.includes(String(o.at)) && Math.abs(o.at - p.due!) <= 600);
      if (observation) { comparison = observation.v / DEG + 360 * Math.round((p.reference! - observation.v / DEG) / 360); at = observation.at; }
    }
    if (comparison === undefined || !Number.isFinite(comparison)) continue;
    useGame.setState({ readingPredictions: { ...useGame.getState().readingPredictions, [kind]: { ...p, comparison, comparisonAt: at } } });
    recordTraining(`exercise:estimate-${kind}`, 'completed', p.assisted);
  }
}
