// Core data types for a generated star system. All values SI unless noted.

import type { SystemFeatures } from './chapters';

export type Difficulty = 'stargazer' | 'cadet' | 'navigator' | 'astronomer' | 'legend';

export interface Star {
  mass: number;
  radius: number;
  temperature: number; // K
  luminosity: number; // W
}

/** A planet on a circular, coplanar orbit (z = 0 is the orbital plane). */
export interface Planet {
  a: number; // orbit radius (m)
  period: number; // orbital period (s)
  phase0: number; // mean heliocentric longitude at t = 0 (rad); the true longitude for a circular orbit
  mass: number;
  radius: number;
  /** Eccentricity (chapter 4); absent or 0 = circular, `a` is then the radius. */
  e?: number;
  /** Longitude of perihelion (rad), for an eccentric orbit. */
  peri?: number;
}

export interface HomePlanet extends Planet {
  siderealDay: number; // rotation period relative to the stars (s)
  rotPhase0: number; // rotation angle at t = 0 (rad)
  obliquity: number; // axial tilt (rad)
}

export interface Moon {
  a: number; // orbit radius around the target planet (m)
  period: number; // (s)
  phase0: number; // (rad)
  radius: number;
}

/** Chapter 7: a giant planet between us and the target, with a big moon of its own. */
export interface Giant extends Planet {
  moon: Moon;
}

export interface Site {
  lat: number; // rad
  lon: number; // rad, measured on the home planet from the crash site meridian
}

export interface HohmannInfo {
  tof: number; // transfer time (s)
  leadAngle: number; // how far planet 2 must lead planet 1 at departure (rad)
  vInfDepart: number; // m/s
  vInfArrive: number; // m/s
  departCost: number; // surface -> escape with vInfDepart (m/s)
  captureCost: number; // vInfArrive -> parking orbit (m/s)
}

export interface StarSystem {
  seed: number;
  difficulty: Difficulty;
  /** Campaign chapter the system was generated for (1 for a plain expedition). */
  chapter: number;
  features: SystemFeatures;
  star: Star;
  home: HomePlanet;
  target: Planet;
  moon: Moon;
  site: Site;
  hillHeight: number; // summit height above the plain (m)
  synodic: number; // planet 1 - planet 2 synodic period (s), always positive
  firstOpposition: number; // first time both planets share a longitude after t = 0 (opposition, or inferior conjunction for an inner planet) (s)
  hohmann: HohmannInfo;
  /** Departure times of Hohmann windows inside the life-support budget (s). */
  windows: number[];
  parkingRadius: number; // capture orbit radius around planet 2 (m)
  fuelDv: number; // total delta-v the ship carries (m/s)
  lifeSupport: number; // time at which life support runs out (s)
  /** Chapter 7: the giant used for the slingshot. */
  giant?: Giant;
}
