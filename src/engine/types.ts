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
  phase0: number; // heliocentric longitude at t = 0 (rad)
  mass: number;
  radius: number;
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
}
