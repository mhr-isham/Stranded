import { DAY, DEG } from './constants';
import { moonPos, planetPos } from './ephemeris';
import { diskVisibleFraction } from './eclipse';
import { unitHash } from './rng';
import { topocentric } from './sky';
import type { StarSystem } from './types';
import { add, angleBetween, dot, norm, scale, sub, type Vec3 } from './vec';

export interface SolarDisc { direction: Vec3; radius: number }
type SolarKind = 'transit' | 'partial' | 'annular' | 'total';
interface SolarOverlap { kind: SolarKind; covered: number }

export function solarOverlap(star: Vec3, starRadius: number, foreground: Vec3, bodyRadius: number, localMoon = false): SolarOverlap | null {
  const distance = norm(foreground), dStar = norm(star);
  if (distance <= bodyRadius || dStar <= starRadius || distance >= dStar) return null;
  const sun = Math.asin(starRadius / dStar), body = Math.asin(bodyRadius / distance);
  const separation = angleBetween(star, foreground);
  if (separation >= sun + body) return null;
  const covered = 1 - diskVisibleFraction(separation, body, sun);
  if (body >= sun + separation) return { kind: 'total', covered };
  if (localMoon || body >= sun) return { kind: separation + body < sun ? 'annular' : 'partial', covered };
  return { kind: 'transit', covered };
}

export function campSolarDiscs(sys: StarSystem, at: number, star: Vec3, planet: Vec3, moon: Vec3): SolarDisc[] {
  const bodies = [{ direction: planet, radius: sys.target.radius }];
  if (sys.features.moon) bodies.push({ direction: moon, radius: sys.moon.radius });
  if (sys.giant) {
    bodies.push({ direction: topocentric(sys, 'giant', at, sys.site), radius: sys.giant.radius },
      { direction: topocentric(sys, 'giantMoon', at, sys.site), radius: sys.giant.moon.radius });
  }
  return bodies.filter((disc) => solarOverlap(star, sys.star.radius, disc.direction, disc.radius) !== null)
    .map(({ direction, radius }) => ({ direction, radius: Math.asin(radius / norm(direction)) }));
}

export interface BeaconSolarFrame {
  star: Vec3;
  starRadius: number;
  moon: SolarDisc;
  altitude: number;
  overlap: SolarOverlap | null;
}
export interface BeaconEclipseWindow { from: number; to: number }

const BEACON_HORIZON = 3 * DEG;

/** The landed beacon camera is equatorial. Generated destinations use a
 * 24-hour sidereal rotation. The Earth chapter uses Earth's sidereal day. */
export function beaconSolarFrame(sys: StarSystem, at: number): BeaconSolarFrame {
  const planet = planetPos(sys.target, at);
  const sidereal = sys.features.real ? 86164 : DAY;
  const phase = 2 * Math.PI * ((at % sidereal) / sidereal + unitHash(sys.seed, 0x5bea));
  const up: Vec3 = [Math.cos(phase), Math.sin(phase), 0];
  const observer = add(planet, scale(up, sys.target.radius));
  const star = scale(observer, -1), direction = sub(moonPos(sys, at), observer);
  const altitude = Math.asin(Math.max(-1, Math.min(1, dot(star, up) / norm(star))));
  const starRadius = Math.asin(sys.star.radius / norm(star));
  return {
    star, starRadius, altitude, moon: { direction, radius: Math.asin(sys.moon.radius / norm(direction)) },
    overlap: sys.features.moon && altitude - starRadius >= BEACON_HORIZON
      ? solarOverlap(star, sys.star.radius, direction, sys.moon.radius, true) : null,
  };
}

export const beaconSunVisible = (frame: BeaconSolarFrame) => frame.altitude - frame.starRadius >= BEACON_HORIZON;

/** A bounded clear-line-of-sight opportunity, not a table of exact contacts.
 * Five-minute sampling is sufficient for the main passage. A very short
 * grazing overlap can fall between samples. */
export function nextBeaconEclipse(sys: StarSystem, start: number): BeaconEclipseWindow | null {
  if (!sys.features.moon || !Number.isFinite(start) || start < 0) return null;
  const step = 300, synodic = 1 / Math.abs(1 / sys.moon.period - 1 / sys.target.period);
  const end = start + Math.min(365 * DAY, Math.max(6 * synodic, sys.target.period));
  let first: number | null = null, last = 0;
  for (let at = start; at <= end; at += step) {
    if (beaconSolarFrame(sys, at).overlap) {
      first ??= at;
      last = at;
    } else if (first !== null) break;
  }
  return first === null ? null : { from: Math.max(start, first - 30 * 60), to: last + 30 * 60 };
}
