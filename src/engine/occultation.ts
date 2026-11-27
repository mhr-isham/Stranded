import { diskVisibleFraction } from './eclipse';
import { topocentric } from './sky';
import type { StarSystem } from './types';
import { angleBetween, norm, type Vec3 } from './vec';

/** Fraction of the moon's apparent disk visible past the planet's limb. */
export function moonLight(planet: Vec3, moon: Vec3, planetRadius: number, moonRadius: number) {
  if (norm(moon) <= norm(planet)) return 1;
  return diskVisibleFraction(angleBetween(planet, moon), planetRadius, moonRadius);
}

export function apparentMoonDisks(sys: StarSystem, at: number) {
  const planet = topocentric(sys, 'target', at, sys.site);
  const moon = topocentric(sys, 'moon', at, sys.site);
  const planetRadius = Math.asin(sys.target.radius / norm(planet));
  const moonRadius = Math.asin(sys.moon.radius / norm(moon));
  return { planet, moon, planetRadius, moonRadius, light: moonLight(planet, moon, planetRadius, moonRadius) };
}
