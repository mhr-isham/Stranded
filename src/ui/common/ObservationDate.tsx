import { observationDay } from '../../game/distanceScale';

export function ObservationDate({ at, label = 'Observed' }: { at?: number; label?: string }) {
  return <div className="observation-date" aria-label={`${label} date`}>{label} · {observationDay(at)}</div>;
}
