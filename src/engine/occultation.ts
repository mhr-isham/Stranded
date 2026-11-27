import { topocentric } from './sky';
import type { StarSystem } from './types';
import { angleBetween, norm, type Vec3 } from './vec';

/** Fraction of the moon's apparent disk visible past the planet's limb. */
export function moonLight(planet: Vec3, moon: Vec3, planetRadius: number, moonRadius: number) {
  if (norm(moon) <= norm(planet)) return 1;
  const d = angleBetween(planet, moon);
  if (d >= planetRadius + moonRadius) return 1;
  if (d <= Math.abs(planetRadius - moonRadius)) return Math.max(0, 1 - (planetRadius / moonRadius) ** 2);
  const arc = (r: number, s: number) => r ** 2 * Math.acos(Math.max(-1, Math.min(1, (d ** 2 + r ** 2 - s ** 2) / (2 * d * r))));
  const cross = Math.sqrt(Math.max(0, (-d + planetRadius + moonRadius) * (d + planetRadius - moonRadius) *
    (d - planetRadius + moonRadius) * (d + planetRadius + moonRadius)));
  const overlap = arc(planetRadius, moonRadius) + arc(moonRadius, planetRadius) - cross / 2;
  return Math.max(0, Math.min(1, 1 - overlap / (Math.PI * moonRadius ** 2)));
}

export function apparentMoonDisks(sys: StarSystem, at: number) {
  const planet = topocentric(sys, 'target', at, sys.site);
  const moon = topocentric(sys, 'moon', at, sys.site);
  const planetRadius = Math.asin(sys.target.radius / norm(planet));
  const moonRadius = Math.asin(sys.moon.radius / norm(moon));
  return { planet, moon, planetRadius, moonRadius, light: moonLight(planet, moon, planetRadius, moonRadius) };
}
