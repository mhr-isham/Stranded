import type { Estimate, Primaries, ChainVariant } from '../engine/chain';
import { deriveAll } from '../engine/chain';
import { ARCSEC } from '../engine/constants';
import { distanceReference } from './distanceScale';

export type WireChoice = 'A' | 'B' | 'pan';
export interface SizeInterpretation {
  radius: number; sigma: number; distance: number; sigmaModel: number; sigmaAngle: number;
  alpha: number; sigmaAlpha: number; at: number; anchorAt?: number; assumedAnchor: boolean;
}
export interface MicrometerObservation {
  sightingId: string; wireA: number; wireB: number; field: number; stepArcsec: number;
  realSampleMs: number; revisions: number; interpretation?: SizeInterpretation;
}

/** Wires are tangent-plane coordinates, so convert each position to an angle. */
export function wireDiameter(a: number, b: number) {
  return [a, b].every(Number.isFinite) ? Math.abs(Math.atan(b) - Math.atan(a)) : null;
}
export function nudgeWire(position: number, arcseconds: number, field: number) {
  if (![position, arcseconds, field].every(Number.isFinite) || field <= 0 || field >= Math.PI) return position;
  const angle = Math.max(-field / 2, Math.min(field / 2, Math.atan(position) + arcseconds * ARCSEC));
  return Math.tan(angle);
}
/** All pixel coordinates are device pixels; hit targets retain their CSS size. */
export function pickWire(px: number, a: number, b: number, dpr: number, active: WireChoice): WireChoice {
  if (![px, a, b, dpr].every(Number.isFinite) || dpr <= 0) return 'pan';
  const da = Math.abs(px - a), db = Math.abs(px - b), radius = 24 * dpr;
  if (Math.min(da, db) > radius) return 'pan';
  if (Math.abs(da - db) < .01 && active !== 'pan') return active;
  return da <= db ? 'A' : 'B';
}
export function radiusFromAngle(distance: number, sigmaDistance: number, alpha: number, sigmaAlpha: number) {
  if (![distance, sigmaDistance, alpha, sigmaAlpha].every(Number.isFinite) || distance <= 0 || sigmaDistance < 0 || alpha <= 0 || alpha >= Math.PI || sigmaAlpha < 0 || sigmaAlpha >= alpha || alpha + sigmaAlpha >= Math.PI) return null;
  const radius = distance * Math.tan(alpha / 2), sigmaModel = Math.tan(alpha / 2) * sigmaDistance;
  const sigmaAngle = distance / (2 * Math.cos(alpha / 2) ** 2) * sigmaAlpha;
  const sigma = Math.hypot(sigmaModel, sigmaAngle);
  return [radius, sigma].every(Number.isFinite) ? { radius, sigma, sigmaModel, sigmaAngle } : null;
}

/** Only the player's orbital inputs and stated angular uncertainty are used. */
export function interpretAngularSize(p: Primaries, variant: ChainVariant, observation: Estimate): SizeInterpretation | null {
  if (observation.at === undefined || !Number.isFinite(observation.at) || observation.value <= 0 || observation.value >= Math.PI || !Number.isFinite(observation.sigma) || observation.sigma < 0 || observation.sigma >= observation.value) return null;
  const inputs: Primaries = { ...p, alpha2: observation };
  const result = deriveAll(inputs, variant).R2;
  if (!result || ![result.value, result.sigma].every(Number.isFinite) || result.value <= 0) return null;
  const modelOnly = deriveAll({ ...inputs, alpha2: { ...observation, sigma: 0 } }, variant).R2;
  if (!modelOnly || !Number.isFinite(modelOnly.sigma)) return null;
  const distance = result.value / Math.tan(observation.value / 2);
  const angleOnly = radiusFromAngle(distance, 0, observation.value, observation.sigma);
  if (!angleOnly) return null;
  const ref = distanceReference(p, variant);
  return { radius: result.value, sigma: result.sigma, distance, sigmaModel: modelOnly.sigma, sigmaAngle: angleOnly.sigmaAngle, alpha: observation.value, sigmaAlpha: observation.sigma, at: observation.at, anchorAt: ref.at, assumedAnchor: !ref.recorded };
}
