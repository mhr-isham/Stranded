import type { Reading } from './store';
import { deriveAll, ellipsePositions, type ChainVariant, type Primaries, type PrimaryKey } from '../engine/chain';
import { DAY, TAU } from '../engine/constants';
import { norm, sub, type Vec3 } from '../engine/vec';

export const DATED_QUANTITIES: readonly PrimaryKey[] = ['dPar', 'alpha2', 'thetaM', 'thetaMg'];
export const observationDay = (at?: number) => at !== undefined && Number.isFinite(at) ? `day ${(at / DAY).toFixed(4)}` : 'date not recorded';
export function distanceReadings(readings: Reading[]) {
  return readings.filter((r) => r.key === 'dPar' && r.kept && Number.isFinite(r.value) && r.value > 0);
}
export function selectedDistanceReading(readings: Reading[], id?: string | null) {
  const kept = distanceReadings(readings);
  return kept.find((r) => r.id === id) ?? kept.at(-1);
}
export function distanceReference(p: Primaries, variant: ChainVariant = 'standard') {
  const at = p.dPar?.at, recorded = at !== undefined && Number.isFinite(at);
  const fallback = variant === 'slingshot' ? p.tOppG?.value : p.tOpp?.value;
  return { at: recorded ? at : Number.isFinite(fallback) ? fallback! : undefined, recorded };
}

/** Positions derived exclusively from the player's numbers, never world truth. */
export function distanceGeometry(p: Primaries, variant: ChainVariant = 'standard', when?: number) {
  const ref = distanceReference(p, variant), at = when ?? ref.at;
  const d = deriveAll(p, variant), a1 = d.a1?.value, a2 = variant === 'slingshot' ? d.aG?.value : d.a2?.value;
  const P1 = p.P1?.value, P2 = variant === 'slingshot' && a1 && a2 && P1 ? P1 * (a2 / a1) ** 1.5 : d.P2?.value;
  const t0 = p.tOpp?.value;
  if (![at, a1, a2, P1, P2, t0].every((v) => v !== undefined && Number.isFinite(v)) || !(a1! > 0 && a2! > 0 && P1! > 0 && P2! > 0)) return null;
  const angle1 = TAU * (at! - t0!) / P1!;
  const home: Vec3 = [a1! * Math.cos(angle1), a1! * Math.sin(angle1), 0];
  let target: Vec3;
  const eccentricity = variant === 'ellipse' ? p.ecc?.value : 0, peri = variant === 'ellipse' ? p.wPeri?.value : 0;
  if (eccentricity === undefined || peri === undefined || !Number.isFinite(eccentricity) || !Number.isFinite(peri) || eccentricity < 0 || eccentricity >= 1) return null;
  if (variant === 'ellipse') {
    const positions = ellipsePositions({ P1: P1!, Porb: P2!, ecc: eccentricity, wPeri: peri, tOpp: t0! }, at!);
    target = positions.target.map((x) => x * a1!) as Vec3;
  } else {
    const event = variant === 'slingshot' ? p.tOppG?.value : t0;
    if (event === undefined || !Number.isFinite(event)) return null;
    const phase = TAU * (event - t0!) / P1! + TAU * (at! - event) / P2!;
    target = [a2! * Math.cos(phase), a2! * Math.sin(phase), 0];
  }
  const separation = norm(sub(home, target));
  if (![...home, ...target, separation].every(Number.isFinite)) return null;
  return { at: at!, home, target, a1: a1!, a2: a2!, separation, eccentricity, peri, body: variant === 'slingshot' ? 'giant' : 'target', reference: ref };
}
export type DistanceGeometry = NonNullable<ReturnType<typeof distanceGeometry>>;

/** An explicit circular teaching system, independent of the saved expedition. */
export function distanceTeachingObservation(day: number, inner = false, offsetPercent = 0) {
  const a1 = 100e9, a2 = (inner ? 60 : 160) * 1e9, P1 = 320 * DAY, P2 = P1 * (a2 / a1) ** 1.5;
  const S = 1 / Math.abs(1 / P1 - 1 / P2), at = day * DAY;
  if (![day, offsetPercent].every(Number.isFinite) || Math.abs(offsetPercent) > 20) return null;
  const phase = TAU * at / S;
  const separation = Math.hypot(a2 * Math.cos(phase) - a1, a2 * Math.sin(phase));
  const p: Primaries = { P1: { value: P1, sigma: 0 }, S2: { value: S, sigma: 0 }, tOpp: { value: 0, sigma: 0 }, dPar: { value: separation * (1 + offsetPercent / 100), sigma: separation * .02, at } };
  const variant: ChainVariant = inner ? 'inner' : 'standard';
  return { p, variant, day, synodicDays: S / DAY, actualSeparation: separation, geometry: distanceGeometry(p, variant)! };
}
