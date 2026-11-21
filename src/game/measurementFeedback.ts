import type { Reading } from './store';

/** Identity of one exposure/release, not an assertion of independent errors. */
function source(r: Reading) {
  return r.micrometer?.sightingId ? `image:${r.micrometer.sightingId}`
    : r.parallax?.captureId ? `pair:${r.parallax.captureId}`
    : r.pendulum?.technique?.releaseId ? `release:${r.pendulum.technique.releaseId}` : `reading:${r.id}`;
}
export const readingFingerprint = (r: Reading) => JSON.stringify([r.value, r.at, r.environment, r.pendulum, r.micrometer, r.parallax]);

/** Inclusion, deletion, notes and reordering are not new observations. */
export function observationChange(before: Reading[], after: Reading[]) {
  const ids = new Map(before.map((r) => [r.id, r]));
  const sources = new Set(before.map(source));
  for (const r of after.slice().reverse()) {
    const previous = ids.get(r.id);
    if (!Number.isFinite(r.value) || !Number.isFinite(r.at) || r.at < 0) continue;
    if (!previous || readingFingerprint(previous) !== readingFingerprint(r)) {
      return { reading: r, revised: !!previous || sources.has(source(r)), fingerprint: readingFingerprint(r) };
    }
  }
  return null;
}

export type ObservationNotice = NonNullable<ReturnType<typeof observationChange>> & { runId: number };
const recordingListeners = new Set<(notice: ObservationNotice) => void>();
export function subscribeObservationRecord(listener: (notice: ObservationNotice) => void) {
  recordingListeners.add(listener);
  return () => { recordingListeners.delete(listener); };
}
/** Native save/re-mark actions emit this transient cue. Save hydration and
 * checkpoints do not emit it, and no receipt or timer enters persistent state. */
export function acknowledgeObservation(before: Reading[], after: Reading[], runId: number) {
  const change = observationChange(before, after);
  if (change) for (const listener of recordingListeners) listener({ ...change, runId });
}

/** Observed minus fitted, using selected records only. No truth or error grade. */
export function fitResiduals(points: { x: number; y: number }[], model: (x: number) => number) {
  return points.flatMap((p) => {
    if (![p.x, p.y].every(Number.isFinite)) return [];
    const fitted = model(p.x), residual = p.y - fitted;
    return [fitted, residual].every(Number.isFinite) ? [{ x: p.x, y: residual, observed: p.y, fitted }] : [];
  });
}
