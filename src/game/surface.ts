// The landing area as a place to explore (docs/DESIGN-V2.md §10): rover trips
// to finds, moving the camp (towing or hopping the ship) and turning ice into
// rocket propellant. All distances are along the 1D landing strip (m).

import { DAY, HOUR } from '../engine/constants';
import { hash32 } from '../engine/rng';
import { makeTerrain, siteAt, type Terrain } from '../engine/descent';
import type { StarSystem } from '../engine/types';
import type { Difficulty } from '../engine/types';
import type { GameState } from './store';

export const STRIP = 40e3; // the map runs from −40 km to +40 km
export const ROVER_KMH = 15;
export const TOW_KMH = 2;
export const ROVER_RANGE = 120e3; // m per charge
export const ICE_LOAD_DV = 100; // m/s of launch fuel per processed load

export type FindKind = 'parts' | 'meteorite' | 'clue';
export interface Find {
  id: string;
  kind: FindKind;
  x: number;
}

const rnd = (seed: number, i: number) => hash32(seed, i, 0x7a1) / 4294967296;

/** Deterministic finds scattered over the strip, revealed by the rover's scanner. */
export function findsFor(seed: number): Find[] {
  const kinds: FindKind[] = ['parts', 'parts', 'parts', 'meteorite', 'meteorite', 'clue'];
  return kinds.map((kind, i) => ({ id: `${kind}-${i}`, kind, x: (rnd(seed, i) * 2 - 1) * (STRIP - 3e3) }));
}

export const SCAN_RANGE = 1500;

export function terrainFor(sys: StarSystem): Terrain {
  return makeTerrain(sys.seed, sys.hillHeight);
}

export function campDistances(tr: Terrain, x: number) {
  const ice = tr.features.find((f) => f.kind === 'ice')!;
  return {
    site: siteAt(tr, x),
    hillKm: Math.abs(x - tr.hillX) / 1000,
    iceKm: x < ice.x0 ? (ice.x0 - x) / 1000 : x > ice.x1 ? (x - ice.x1) / 1000 : 0,
  };
}

/**
 * Textbook Δv for an impulsive ballistic hop of distance d (45° launch). Real
 * hops cost far more (finite thrust, drag, the landing): see engine/hop.ts.
 */
export const hopCost = (g: number, d: number) => 2 * Math.sqrt(g * Math.max(0, d));

export interface SurfaceRules {
  /** Capacity of the separate hop tank (m/s); 0 = hops use launch fuel. */
  hopTank: number;
  /** How the hop tank refills: every night, over three days, only from ice, or never. */
  hopRefill: 'nightly' | 'slow' | 'ice' | 'none';
  /** Days to process one load of ice. */
  isruDays: number;
  /** Most fuel ice can add, as a share of the mode's spare fuel. */
  isruCap: number;
}

export const SURFACE_RULES: Record<Difficulty, SurfaceRules> = {
  // Sized from flown hops (engine/hop.ts): a well-flown 5 km hop at 1 g takes about 1.3 km/s.
  stargazer: { hopTank: 4000, hopRefill: 'nightly', isruDays: 1, isruCap: 0.4 },
  cadet: { hopTank: 3000, hopRefill: 'nightly', isruDays: 2, isruCap: 0.4 },
  navigator: { hopTank: 2200, hopRefill: 'slow', isruDays: 3, isruCap: 0.25 },
  astronomer: { hopTank: 1400, hopRefill: 'ice', isruDays: 4, isruCap: 0.15 },
  legend: { hopTank: 0, hopRefill: 'none', isruDays: 5, isruCap: 0.1 },
};

/** Spare fuel of the system above the ideal transfer (the base for the ice cap). */
export const spareFuel = (sys: StarSystem) => sys.fuelDv - sys.hohmann.departCost - sys.hohmann.captureCost;


/** Things that happen on the surface as time passes: tasks finishing, charging, refills. */
export function advanceSurface(s: GameState, sys: StarSystem, t0: number, t1: number): Partial<GameState> {
  const rules = SURFACE_RULES[s.settings.difficulty];
  let sf = s.surface;
  const patch: Partial<GameState> = {};
  if (sf.hopTank < 0) sf = { ...sf, hopTank: rules.hopTank };
  // Rover charging at camp.
  if (sf.roverX === null && sf.roverBattery < ROVER_RANGE && !sf.task) {
    sf = { ...sf, roverBattery: Math.min(ROVER_RANGE, sf.roverBattery + ((t1 - t0) / HOUR) * 10e3) };
  }
  // Hop tank refill.
  const d0 = Math.floor(t0 / DAY);
  const d1 = Math.floor(t1 / DAY);
  if (d1 > d0 && sf.hopTank < rules.hopTank) {
    if (rules.hopRefill === 'nightly') sf = { ...sf, hopTank: rules.hopTank };
    else if (rules.hopRefill === 'slow') sf = { ...sf, hopTank: Math.min(rules.hopTank, sf.hopTank + ((d1 - d0) * rules.hopTank) / 3) };
  }
  // A task finishing.
  const task = sf.task;
  if (task && t1 >= task.done) {
    const camp = s.camp?.x ?? 0;
    if (task.kind === 'drive' && task.toX !== undefined) {
      const from = sf.roverX ?? camp;
      const lo = Math.min(from, task.toX) - SCAN_RANGE;
      const hi = Math.max(from, task.toX) + SCAN_RANGE;
      const seen = findsFor(sys.seed).filter((f) => f.x >= lo && f.x <= hi && !sf.found.includes(f.id)).map((f) => f.id);
      const back = Math.abs(task.toX - camp) < 200;
      sf = { ...sf, roverX: back ? null : task.toX, roverBattery: Math.max(0, sf.roverBattery - Math.abs(task.toX - from)), found: [...sf.found, ...seen] };
    } else if (task.kind === 'tow' && sf.roverX !== null && s.camp) {
      const tr = terrainFor(sys);
      patch.camp = { ...s.camp, x: sf.roverX, ...campDistances(tr, sf.roverX) };
      sf = { ...sf, roverX: null };
    } else if (task.kind === 'haul') {
      sf = { ...sf, iceLoads: sf.iceLoads + 1, roverX: null, roverBattery: Math.max(0, sf.roverBattery - 2 * (s.camp?.iceKm ?? 0) * 1000) };
    } else if (task.kind === 'process') {
      const cap = rules.isruCap * spareFuel(sys);
      if (rules.hopRefill === 'ice' && sf.hopTank < rules.hopTank) {
        sf = { ...sf, hopTank: Math.min(rules.hopTank, sf.hopTank + ICE_LOAD_DV * 4), iceLoads: Math.max(0, sf.iceLoads - 1) };
      } else {
        const add = Math.max(0, Math.min(ICE_LOAD_DV, cap - sf.fuelMade));
        sf = { ...sf, fuelMade: sf.fuelMade + add, iceLoads: Math.max(0, sf.iceLoads - 1) };
        patch.penaltyDv = s.penaltyDv - add;
      }
    }
    sf = { ...sf, task: null };
  }
  if (sf !== s.surface) patch.surface = sf;
  return patch;
}
