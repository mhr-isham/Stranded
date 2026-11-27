import { angleBetween, cross, dot, scale, sub, unit, type Vec3 } from './vec';

export interface PlanetPhase {
  /** Cosine of the phase angle at the planet. */
  cosine: number;
  limbX: number;
  limbY: number;
  flux: number;
  elongation: number;
}

/** Vectors from the actual observer, expressed in the ecliptic frame.
 * The telescope places east left and north up. The limb vector is in screen
 * coordinates, so a positive Y component points down. */
export function planetPhase(planet: Vec3, star: Vec3): PlanetPhase {
  const view = unit(planet);
  const towardStar = unit(sub(star, planet));
  const facing = scale(view, -1);
  const axis = Math.abs(view[2]) < 0.9999 ? [0, 0, 1] as Vec3 : [0, 1, 0] as Vec3;
  const right = unit(cross(view, axis)), up = unit(cross(right, view));
  const cosine = Math.max(-1, Math.min(1, dot(facing, towardStar)));
  const x = dot(towardStar, right), y = -dot(towardStar, up);
  const limb = Math.hypot(x, y);
  const alpha = Math.acos(cosine);
  const flux = Math.max(0, (Math.sin(alpha) + (Math.PI - alpha) * cosine) / Math.PI);
  return { cosine, limbX: limb > 1e-10 ? x / limb : 1, limbY: limb > 1e-10 ? y / limb : 0,
    flux, elongation: angleBetween(planet, star) };
}

/** Cosine of local incidence on the visible sphere, from its image plane.
 * x and y are measured in apparent radii. */
export function phaseIncidence(phase: Pick<PlanetPhase, 'cosine' | 'limbX' | 'limbY'>, x: number, y: number) {
  const forward = Math.sqrt(Math.max(0, 1 - x * x - y * y));
  return Math.max(0, (x * phase.limbX + y * phase.limbY) * Math.sqrt(Math.max(0, 1 - phase.cosine ** 2)) + forward * phase.cosine);
}

export function phaseResolved(diameter: number, seeing: number, pixels: number) {
  return diameter >= 2.5 * seeing && pixels >= 8;
}

/** A narrow crescent can remain unresolved even when the disk spans many pixels. */
export function phaseReadable(phase: PlanetPhase, diameter: number, seeing: number, pixels: number) {
  return phaseResolved(diameter, seeing, pixels) && diameter * (1 + phase.cosine) / 2 >= 0.7 * seeing;
}

export function phaseCaption(cosine: number) {
  if (cosine < -0.12) return 'Crescent';
  if (cosine > 0.88) return 'Nearly full';
  return cosine > 0.12 ? 'Gibbous' : 'Nearly half-lit';
}
