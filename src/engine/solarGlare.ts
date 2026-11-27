import { AU, DEG, L_SUN } from './constants';
import { angleBetween, norm, type Vec3 } from './vec';

export interface SolarGlareSource {
  direction: Vec3;
  radius: number;
  exposure: number;
}

/** Direct stellar light incident on the instrument, in Earth-solar units.
 * The geometric horizon can cut across the star's disk. Twilight is modeled
 * separately as diffuse sky brightness. */
export function solarGlareSource(direction: Vec3, radius: number, luminosity: number, altitude: number): SolarGlareSource {
  const distance = norm(direction);
  if (!(distance > 0 && radius > 0 && luminosity > 0)) return { direction, radius, exposure: 0 };
  const h = Math.max(-1, Math.min(1, altitude / radius));
  const visible = (Math.acos(-h) + h * Math.sqrt(1 - h * h)) / Math.PI;
  return { direction, radius, exposure: visible * luminosity / L_SUN * (AU / distance) ** 2 };
}

// The falloff and usable-contrast threshold describe the game's unfiltered
// telescope, not a universal exclusion angle or a calibrated optical model.
export const GLARE_NOTICE = .16;
export const GLARE_LIMIT = .72;
export function solarGlare(source: SolarGlareSource, direction: Vec3) {
  if (!(source.exposure > 0)) return 0;
  const limb = Math.max(0, angleBetween(source.direction, direction) - source.radius);
  const scatter = source.exposure / (1 + (limb / (.65 * DEG)) ** 2);
  return -Math.expm1(-3.4 * scatter);
}
