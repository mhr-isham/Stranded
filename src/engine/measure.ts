// The true physics behind each tool. Tools never add random noise: the player's
// error comes from how they aim, read and time. These functions give the exact
// quantity the instrument is pointed at.

import { G } from './constants';
import { eclLon, topocentric } from './sky';
import type { Site, StarSystem } from './types';
import { angleBetween, norm } from './vec';

/** Arithmetic-geometric mean, used for the exact pendulum period. */
function agm(a: number, b: number) {
  for (let i = 0; i < 30 && Math.abs(a - b) > 1e-15 * a; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  return a;
}

/** Exact period of a simple pendulum released from amplitude amp (rad). */
export const pendulumPeriod = (g: number, L: number, amp: number) =>
  (2 * Math.PI * Math.sqrt(L / g)) / agm(1, Math.cos(amp / 2));

export const surfaceGravity = (sys: StarSystem) => (G * sys.home.mass) / sys.home.radius ** 2;

/** Dip of the true horizon below level for an eye at height h (no refraction). */
export const horizonDip = (R: number, h: number) => Math.acos(R / (R + h));

/** Ecliptic longitude of the star against the background stars, seen from the site. */
export const starLongitude = (sys: StarSystem, t: number, site: Site) => eclLon(topocentric(sys, 'star', t, site));

/** Ecliptic longitude of planet 2 against the background stars. */
export const targetLongitude = (sys: StarSystem, t: number, site: Site) =>
  eclLon(topocentric(sys, 'target', t, site));

/** Angular shift of planet 2 between two sites observing at the same instant. */
export const parallaxShift = (sys: StarSystem, t: number, a: Site, b: Site) =>
  angleBetween(topocentric(sys, 'target', t, a), topocentric(sys, 'target', t, b));

export const targetDistance = (sys: StarSystem, t: number, site: Site) => norm(topocentric(sys, 'target', t, site));

/** Angular diameter of planet 2's disk. */
export const targetAngularDiameter = (sys: StarSystem, t: number, site: Site) =>
  2 * Math.asin(sys.target.radius / targetDistance(sys, t, site));

/** Angular diameter of the star's disk. */
export const starAngularDiameter = (sys: StarSystem, t: number, site: Site) =>
  2 * Math.asin(sys.star.radius / norm(topocentric(sys, 'star', t, site)));

/**
 * Moon offset from planet 2 along the ecliptic (rad, + = east). Orbits are
 * coplanar, so the moon swings back and forth along a line through the planet.
 */
export function moonOffset(sys: StarSystem, t: number, site: Site) {
  const p = topocentric(sys, 'target', t, site);
  const m = topocentric(sys, 'moon', t, site);
  let d = eclLon(m) - eclLon(p);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/**
 * Where the rover goes for parallax. East normally; on a locked planet the
 * planet near opposition lies low in the east, almost along an east–west
 * baseline, so the rover drives south (toward the equator, where the sky is darker).
 */
export const parallaxSite = (sys: StarSystem, site: Site, dist: number): Site =>
  sys.features.locked ? { lat: site.lat - dist / sys.home.radius, lon: site.lon } : siteEastOf(sys, site, dist);

/** Point on the home planet reached by travelling `dist` metres due east. */
export const siteEastOf = (sys: StarSystem, site: Site, dist: number): Site => ({
  lat: site.lat,
  lon: site.lon + dist / (sys.home.radius * Math.cos(site.lat)),
});
