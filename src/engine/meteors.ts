import { DEG, TAU } from './constants';
import { trueLongitude } from './ephemeris';
import { unitHash } from './rng';
import type { StarSystem } from './types';
import { add, cross, scale, type Vec3 } from './vec';

interface Stream { longitude: number; radiant: Vec3 }
interface Meteor {
  at: number;
  radiant: Vec3;
  tangent: Vec3;
  start: number;
  length: number;
  duration: number;
  persistence: number;
  brightness: number;
  warm: boolean;
}

export interface MeteorTrail { from: Vec3; to: Vec3; intensity: number; warm: boolean; head: boolean }
const INTERVAL = 12;
export const METEOR_LOOKBACK = 44;
const streams = new WeakMap<StarSystem, Stream[]>();

function streamsFor(sys: StarSystem) {
  let found = streams.get(sys);
  if (found) return found;
  const crossing = unitHash(sys.seed, 724) * TAU;
  found = Array.from({ length: 2 }, (_, i) => {
    const longitude = crossing + i * Math.PI;
    // An illustrative stream with a fixed radiant for its short season.
    // Relative velocity may come from ahead of the planet with an inclined component.
    const bearing = longitude + (.34 + .28 * unitHash(sys.seed, i, 211)) * Math.PI;
    const latitude = (unitHash(sys.seed, i, 212) * 58 - 29) * DEG;
    return { longitude, radiant: [Math.cos(latitude) * Math.cos(bearing), Math.cos(latitude) * Math.sin(bearing), Math.sin(latitude)] };
  });
  streams.set(sys, found);
  return found;
}

/** Debris streams are seasonal. Their widths and particle rates are illustrative. */
export function meteorActivity(sys: StarSystem, at: number) {
  const longitude = trueLongitude(sys.home, at);
  for (const stream of streamsFor(sys)) {
    const gap = longitude - stream.longitude;
    const offset = Math.atan2(Math.sin(gap), Math.cos(gap)) / (10 * DEG);
    if (Math.abs(offset) < 1) return { radiant: stream.radiant, strength: (1 - offset ** 2) ** 1.5 };
  }
  return null;
}

function meteorForSlot(sys: StarSystem, slot: number): Meteor | null {
  const random = (salt: number) => unitHash(sys.seed, slot, salt);
  const at = (slot + random(1)) * INTERVAL;
  const active = meteorActivity(sys, at);
  if (!active || random(2) > active.strength) return null;
  const { radiant } = active;
  const east = cross([0, 0, 1], radiant), up = cross(radiant, east);
  const azimuth = random(3) * TAU;
  const latitude = Math.asin(radiant[2]);
  const tangent = scale(add(scale(east, Math.cos(azimuth)), scale(up, Math.sin(azimuth))), 1 / Math.cos(latitude));
  const start = Math.acos(.98 - 1.72 * random(4));
  const length = Math.min(Math.PI - start - .01, (3.5 + 14 * random(5) ** 1.5) * DEG);
  const brightness = .42 + .58 * random(6) ** 1.4;
  return { at, radiant, tangent, start, length, brightness, warm: random(7) < .25,
    duration: .42 + 1.05 * random(8), persistence: 13 + 28 * random(9) };
}

export function meteorsBetween(sys: StarSystem, from: number, to: number) {
  const events: Meteor[] = [];
  for (let slot = Math.floor(Math.max(0, from) / INTERVAL); slot * INTERVAL <= to; slot++) {
    const event = meteorForSlot(sys, slot);
    if (event && event.at >= from && event.at <= to) events.push(event);
  }
  return events;
}

export function meteorTrail(event: Meteor, head: number, intensity: number, lit: boolean): MeteorTrail {
  const point = (theta: number) => add(scale(event.radiant, Math.cos(theta)), scale(event.tangent, Math.sin(theta)));
  return { from: point(event.start), to: point(event.start + head * event.length), intensity: event.brightness * intensity, warm: event.warm, head: lit };
}

export function liveMeteorTrail(event: Meteor, at: number): MeteorTrail | null {
  const elapsed = at - event.at;
  if (elapsed <= 0 || elapsed >= event.duration + event.persistence) return null;
  if (elapsed < event.duration) return meteorTrail(event, elapsed / event.duration, 1, true);
  const age = (elapsed - event.duration) / event.persistence;
  return meteorTrail(event, 1, .64 * (1 - age) ** 2, false);
}
