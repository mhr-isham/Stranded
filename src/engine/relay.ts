// The Halcyon's dead relay satellite: a real circular orbit around the home
// planet. It shines by reflected starlight, so it is seen only when the sky is
// dark at the site but the satellite itself is still in sunlight — the
// evening and morning hours, like real satellites.

import { G, TAU } from './constants';
import { planetPos } from './ephemeris';
import { hash32 } from './rng';
import { observerPos } from './sky';
import type { Site, StarSystem } from './types';
import { add, dot, norm, scale, sub, type Vec3 } from './vec';

export function relayOrbit(sys: StarSystem) {
  const r = 2.4 * sys.home.radius;
  const period = TAU * Math.sqrt(r ** 3 / (G * sys.home.mass));
  const inc = (35 + (hash32(sys.seed, 77) / 4294967296) * 30) * (Math.PI / 180);
  const node = (hash32(sys.seed, 78) / 4294967296) * TAU;
  const phase0 = (hash32(sys.seed, 79) / 4294967296) * TAU;
  return { r, period, inc, node, phase0 };
}

/** Heliocentric ecliptic position of the relay. */
export function relayPos(sys: StarSystem, t: number): Vec3 {
  const o = relayOrbit(sys);
  const u = o.phase0 + (TAU * t) / o.period;
  // Orbit in a plane tilted by inc about the line of nodes.
  const x = Math.cos(u);
  const y = Math.sin(u) * Math.cos(o.inc);
  const z = Math.sin(u) * Math.sin(o.inc);
  const cn = Math.cos(o.node);
  const sn = Math.sin(o.node);
  const rel: Vec3 = [o.r * (x * cn - y * sn), o.r * (x * sn + y * cn), o.r * z];
  return add(planetPos(sys.home, t), rel);
}

export const relayTopocentric = (sys: StarSystem, t: number, site: Site) => sub(relayPos(sys, t), observerPos(sys, t, site));

/** Is the relay in sunlight (not inside the planet's shadow cylinder)? */
export function relaySunlit(sys: StarSystem, t: number) {
  const p = relayPos(sys, t);
  const c = planetPos(sys.home, t);
  const toSun = scale(c, -1 / norm(c)); // unit vector planet -> star
  const rel = sub(p, c);
  const along = dot(rel, toSun);
  if (along > 0) return true; // on the day side
  const perp = norm(sub(rel, scale(toSun, along)));
  return perp > sys.home.radius;
}
