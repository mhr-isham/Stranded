import { DAY, DEG, HOUR } from './constants';
import { unitHash } from './rng';
import type { StarSystem } from './types';
import { add, cross, dot, scale, sub, unit, type Vec3 } from './vec';

export interface AuroraStorm { strength: number; seed: number }
export interface AuroraRay { lower: Vec3; middle: Vec3; upper: Vec3; brightness: number }
export type AuroraRibbon = readonly AuroraRay[];

/** Seeded space-weather pulses. Mars has no global dipole in this model. */
export function auroraStorm(sys: StarSystem, at: number): AuroraStorm | null {
  if (sys.features.real || !(at >= 0)) return null;
  const interval = 9 * DAY, slot = Math.floor(at / interval);
  const sample = (salt: number) => unitHash(sys.seed, slot, salt);
  const start = slot * interval + (.75 + 6.6 * sample(0xaa1)) * DAY;
  const length = (12 + 22 * sample(0xaa2)) * HOUR;
  const progress = (at - start) / length;
  if (progress <= 0 || progress >= 1) return null;
  return { strength: (.86 + .14 * sample(0xaa3)) * Math.sin(Math.PI * progress) ** .65, seed: sample(0xaa4) * 10 };
}

/** Emitting sheets in the upper atmosphere, projected from the camp. The
 * modeled dipole is body-fixed. In stronger storms the oval expands equatorward. */
export function auroraRibbons(sys: StarSystem, storm: AuroraStorm, phase: number, darkness: number): AuroraRibbon[] {
  const { lat, lon } = sys.site, R = sys.home.radius;
  const up: Vec3 = [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];
  const east: Vec3 = [-Math.sin(lon), Math.cos(lon), 0];
  const north = cross(up, east);
  const tilt = (18 + 21 * unitHash(sys.seed, 0xaa5)) * DEG;
  const poleLon = (unitHash(sys.seed, 0xaa6) - .5) * 104 * DEG;
  const pole: Vec3 = [Math.sin(tilt) * Math.cos(poleLon), Math.sin(tilt) * Math.sin(poleLon), Math.cos(tilt)];
  const towardCamp = unit(sub(up, scale(pole, dot(up, pole))));
  const around = cross(pole, towardCamp);
  // Tune the peak oval for the generated observation site. Its active edge
  // expands toward camp while remaining poleward on a typical strong night.
  const campColatitude = Math.acos(Math.max(-1, Math.min(1, dot(up, pole))));
  const peakEdge = Math.min(56 * DEG, campColatitude - 4.4 * DEG);
  const edge = Math.max(12 * DEG, peakEdge - (1 - storm.strength) * 19 * DEG);
  const ray = (bearing: Vec3, theta: number, altitude: number): Vec3 => {
    // Follow a dipole field line outward from the 108 km emission layer.
    const s = Math.min(1, Math.sqrt((R + altitude) / (R + 108e3)) * Math.sin(theta));
    const shell = add(scale(pole, Math.sqrt(1 - s * s)), scale(bearing, s));
    const sight = unit(sub(scale(shell, R + altitude), scale(up, R)));
    return [dot(sight, east), dot(sight, north), dot(sight, up)];
  };

  return [0, 1].map((layer) => Array.from({ length: 145 }, (_, i) => {
    const u = i / 144, a = (u - .5) * (layer ? 1.42 : 1.75) + (layer ? .16 : -.07);
    const drift = storm.seed + phase * .14 + layer * 1.7;
    const fold = (.86 * Math.sin(a * 7 + drift) + .4 * Math.sin(a * 18 - drift * .72) +
      .2 * Math.sin(a * 36 + drift * 1.11)) * DEG;
    const theta = edge - (.7 + layer * .78) * DEG + fold;
    const bearing = add(scale(towardCamp, Math.cos(a)), scale(around, Math.sin(a)));
    const pillar = .5 + .5 * Math.sin(a * 54 + drift * 1.3) * Math.sin(a * 31 - drift);
    const brightness = darkness * storm.strength * Math.sin(Math.PI * u) ** .85 * (.51 + .49 * pillar) * (layer ? .58 : 1);
    return {
      lower: ray(bearing, theta, 108e3),
      middle: ray(bearing, theta, 157e3),
      upper: ray(bearing, theta, 225e3 + 90e3 * pillar),
      brightness,
    };
  }));
}
