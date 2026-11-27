import { moonPos, planetPos } from './ephemeris';
import type { StarSystem } from './types';
import { add, angleBetween, cross, dot, norm, scale, sub, unit, type Vec3 } from './vec';

export type LunarShadow = 'sunlit' | 'penumbral' | 'partial' | 'total';

export interface LunarLight {
  shadow: LunarShadow;
  toStar: Vec3;
  toPlanet: Vec3;
  starRadius: number;
  planetRadius: number;
  moonRadius: number;
}

/** Fraction of a uniformly bright apparent disk not covered by a nearer disk. */
export function diskVisibleFraction(separation: number, blocker: number, source: number) {
  const d = separation;
  if (d >= blocker + source) return 1;
  if (d <= Math.abs(blocker - source)) return Math.max(0, 1 - (blocker / source) ** 2);
  const arc = (r: number, s: number) => r ** 2 * Math.acos(Math.max(-1, Math.min(1, (d ** 2 + r ** 2 - s ** 2) / (2 * d * r))));
  const cross = Math.sqrt(Math.max(0, (-d + blocker + source) * (d + blocker - source) *
    (d - blocker + source) * (d + blocker + source)));
  return Math.max(0, Math.min(1, 1 - (arc(blocker, source) + arc(source, blocker) - cross / 2) / (Math.PI * source ** 2)));
}

/** Test the lunar sphere against the two cones tangent to the stellar and
 * planetary spheres. The umbra shrinks and the penumbra expands away from the star. */
export function lunarShadow(planet: Vec3, moon: Vec3, starRadius: number, planetRadius: number, moonRadius: number): LunarShadow {
  const axis = unit(planet), offset = sub(moon, planet);
  const depth = dot(offset, axis);
  if (depth <= 0) return 'sunlit';
  const sideways = norm(sub(offset, scale(axis, depth)));
  const distance = norm(planet);
  const signed = (sine: number) => sideways * Math.sqrt(1 - sine ** 2) + depth * sine - planetRadius;
  const penumbra = signed(-(starRadius + planetRadius) / distance);
  if (penumbra >= moonRadius) return 'sunlit';
  const sine = (starRadius - planetRadius) / distance;
  const tangentDistance = signed(sine);
  // Beyond the apex, the nearest point can be the apex rather than a tangent.
  const apex = sine > 0 ? planetRadius / sine : Infinity;
  const umbra = depth - tangentDistance * sine > apex ? Math.hypot(sideways, depth - apex) : tangentDistance;
  return umbra <= -moonRadius ? 'total' : umbra < moonRadius ? 'partial' : 'penumbral';
}

export function lunarLight(sys: StarSystem, at: number): LunarLight {
  const planet = planetPos(sys.target, at), moon = moonPos(sys, at);
  const { radius: starRadius } = sys.star, { radius: moonRadius } = sys.moon, { radius: planetRadius } = sys.target;
  return {
    shadow: lunarShadow(planet, moon, starRadius, planetRadius, moonRadius),
    toStar: scale(moon, -1), toPlanet: sub(planet, moon), starRadius, planetRadius, moonRadius,
  };
}

/** Direct starlight reaching a point, with uniform stellar brightness and no
 * atmospheric refraction. Disks are planar angular approximations at this scale. */
export function directMoonlight(light: LunarLight, surfaceOffset: Vec3) {
  if (light.shadow === 'sunlit') return 1;
  if (light.shadow === 'total') return 0;
  const star = sub(light.toStar, surfaceOffset), planet = sub(light.toPlanet, surfaceOffset);
  return diskVisibleFraction(angleBetween(star, planet), Math.asin(light.planetRadius / norm(planet)),
    Math.asin(light.starRadius / norm(star)));
}

export function lunarSurfaceLight(light: LunarLight, normal: Vec3, directionToStar: Vec3) {
  const cosine = Math.max(0, dot(normal, directionToStar));
  return cosine * directMoonlight(light, scale(normal, light.moonRadius));
}

export function lunarDiskPoint(right: Vec3, up: Vec3, facing: Vec3, x: number, y: number): Vec3 {
  return add(add(scale(right, x), scale(up, y)), scale(facing, Math.sqrt(Math.max(0, 1 - x * x - y * y))));
}

export function lunarView(dir: Vec3) {
  const right = unit(cross(dir, Math.abs(dir[2]) < .99 ? [0, 0, 1] : [0, 1, 0]));
  const up = unit(cross(right, dir)), facing = scale(dir, -1);
  return { right, up, facing };
}

/** Relative direct illumination of the visible face, sampled for unresolved optics. */
export function lunarExposure(light: LunarLight, dir: Vec3) {
  if (light.shadow === 'sunlit') return { fraction: 1, darkEdge: false };
  if (light.shadow === 'total') return { fraction: 0, darkEdge: true };
  const { right, up, facing } = lunarView(dir);
  const star = unit(light.toStar);
  let shaded = 0, clear = 0, darkEdge = false;
  for (const x of [-.64, -.32, 0, .32, .64]) for (const y of [-.64, -.32, 0, .32, .64]) {
    const normal = lunarDiskPoint(right, up, facing, x, y);
    const cosine = Math.max(0, dot(normal, star));
    if (cosine === 0) continue;
    const direct = directMoonlight(light, scale(normal, light.moonRadius));
    if (direct < .02 && cosine > .1) darkEdge = true;
    clear += cosine;
    shaded += cosine * direct;
  }
  return { fraction: clear > 0 ? shaded / clear : directMoonlight(light, [0, 0, 0]), darkEdge };
}
