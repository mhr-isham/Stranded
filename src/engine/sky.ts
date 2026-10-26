// Observer geometry: where every body appears in the sky of the crash site.
// Frames: heliocentric ecliptic (orbits), planet equatorial (tilted by the
// obliquity about the x axis), and the local horizon (alt/az).

import { TAU } from './constants';
import { moonPos, planetPos } from './ephemeris';
import { hash32, makeRng } from './rng';
import type { Site, StarSystem } from './types';
import { add, angleBetween, cross, dot, norm, rotX, scale, sub, unit, type Vec3 } from './vec';

export const eclToEq = (v: Vec3, eps: number) => rotX(v, eps);
export const eqToEcl = (v: Vec3, eps: number) => rotX(v, -eps);

/** Planet rotation angle (rad) of the site meridian at time t. */
export const meridianAngle = (sys: StarSystem, t: number, site: Site) =>
  sys.home.rotPhase0 + (TAU * t) / sys.home.siderealDay + site.lon;

/** Unit "up" vector of a site in the planet's inertial equatorial frame. */
export function siteUpEq(sys: StarSystem, t: number, site: Site): Vec3 {
  const th = meridianAngle(sys, t, site);
  const c = Math.cos(site.lat);
  return [c * Math.cos(th), c * Math.sin(th), Math.sin(site.lat)];
}

/** Heliocentric ecliptic position of the observer standing at a site. */
export function observerPos(sys: StarSystem, t: number, site: Site): Vec3 {
  const up = eqToEcl(siteUpEq(sys, t, site), sys.home.obliquity);
  return add(planetPos(sys.home, t), scale(up, sys.home.radius));
}

export type BodyId = 'star' | 'target' | 'moon';

export function bodyPos(sys: StarSystem, id: BodyId, t: number): Vec3 {
  if (id === 'star') return [0, 0, 0];
  if (id === 'target') return planetPos(sys.target, t);
  return moonPos(sys, t);
}

/** Topocentric vector (ecliptic frame) from the site to a body. */
export const topocentric = (sys: StarSystem, id: BodyId, t: number, site: Site) =>
  sub(bodyPos(sys, id, t), observerPos(sys, t, site));

export interface Horizontal {
  alt: number;
  az: number; // from north towards east
}

export interface LocalFrame {
  up: Vec3;
  east: Vec3;
  north: Vec3;
}

/** Local horizon basis expressed in the ecliptic frame. */
export function localFrame(sys: StarSystem, t: number, site: Site): LocalFrame {
  const eps = sys.home.obliquity;
  const upEq = siteUpEq(sys, t, site);
  const eastEq = unit(cross([0, 0, 1], upEq));
  const northEq = cross(upEq, eastEq);
  return { up: eqToEcl(upEq, eps), east: eqToEcl(eastEq, eps), north: eqToEcl(northEq, eps) };
}

export function toHorizontal(dirEcl: Vec3, f: LocalFrame): Horizontal {
  const d = unit(dirEcl);
  return {
    alt: Math.asin(Math.max(-1, Math.min(1, dot(d, f.up)))),
    az: Math.atan2(dot(d, f.east), dot(d, f.north)),
  };
}

export function fromHorizontal(h: Horizontal, f: LocalFrame): Vec3 {
  const c = Math.cos(h.alt);
  return add(add(scale(f.north, c * Math.cos(h.az)), scale(f.east, c * Math.sin(h.az))), scale(f.up, Math.sin(h.alt)));
}

/** Ecliptic longitude of a direction (rad, 0..2pi). */
export const eclLon = (v: Vec3) => ((Math.atan2(v[1], v[0]) % TAU) + TAU) % TAU;

export const starAltitude = (sys: StarSystem, t: number, site: Site) =>
  toHorizontal(topocentric(sys, 'star', t, site), localFrame(sys, t, site)).alt;

/** Angle between the star and planet 2 as seen from the site. */
export const elongation = (sys: StarSystem, t: number, site: Site) =>
  angleBetween(topocentric(sys, 'star', t, site), topocentric(sys, 'target', t, site));

// ---------------------------------------------------------------------------
// Background star catalogue (procedural, fixed per seed).

export interface CatalogStar {
  dir: Vec3; // unit vector, ecliptic frame
  mag: number;
  color: [number, number, number];
  twinklePhase: number;
}

/** Approximate RGB of a blackbody of the given temperature (K). */
export function blackbodyRGB(T: number): [number, number, number] {
  const t = T / 100;
  let r: number;
  let g: number;
  let b: number;
  if (t <= 66) {
    r = 255;
    g = 99.47 * Math.log(t) - 161.12;
    b = t <= 19 ? 0 : 138.52 * Math.log(t - 10) - 305.04;
  } else {
    r = 329.7 * (t - 60) ** -0.1332;
    g = 288.12 * (t - 60) ** -0.0755;
    b = 255;
  }
  const c = (x: number) => Math.max(0, Math.min(255, x)) / 255;
  return [c(r), c(g), c(b)];
}

export function starCatalog(seed: number, count = 2600): CatalogStar[] {
  const rng = makeRng(hash32(seed, 0x5ca1ab1e));
  const stars: CatalogStar[] = [];
  for (let i = 0; i < count; i++) {
    const z = rng.range(-1, 1);
    const phi = rng.range(0, TAU);
    const s = Math.sqrt(1 - z * z);
    // Cumulative counts grow roughly as 10^(0.47 m) for naked-eye stars.
    const mag = Math.max(-1.4, 6.6 + Math.log10(Math.max(1e-9, rng.next())) / 0.47);
    const T = rng.next() < 0.7 ? rng.range(3300, 6500) : rng.range(6500, 20000);
    stars.push({ dir: [s * Math.cos(phi), s * Math.sin(phi), z], mag, color: blackbodyRGB(T), twinklePhase: rng.range(0, TAU) });
  }
  return stars;
}

export const distance = (v: Vec3) => norm(v);

/**
 * Faint unresolved stars concentrated along a great circle tilted to the
 * ecliptic: this system's Milky Way. Returns [x, y, z, brightness] tuples.
 */
export function milkyWay(seed: number, count = 3800): Float32Array {
  const rng = makeRng(hash32(seed, 0x6a1a));
  const tilt = rng.range(50, 70) * (Math.PI / 180);
  const node = rng.range(0, TAU);
  const out = new Float32Array(count * 4);
  for (let i = 0; i < count; i++) {
    const lon = rng.range(0, TAU);
    // Thicker towards a "galactic centre".
    const dc = ((lon - Math.PI + TAU) % TAU) - Math.PI;
    const core = Math.exp(-(dc * dc) / 1.2);
    const lat = rng.normal(0, 0.07 + 0.1 * core);
    const c = Math.cos(lat);
    let v: Vec3 = [c * Math.cos(lon), c * Math.sin(lon), Math.sin(lat)];
    v = rotX(v, tilt);
    const cn = Math.cos(node);
    const sn = Math.sin(node);
    v = [v[0] * cn - v[1] * sn, v[0] * sn + v[1] * cn, v[2]];
    out.set([v[0], v[1], v[2], 0.25 + 0.75 * core * rng.next()], i * 4);
  }
  return out;
}
