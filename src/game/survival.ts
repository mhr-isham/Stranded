// Survival mode (optional): oxygen, food, power, weather, breakdowns and
// salvage. With survival off, life support is a fixed deadline and the sky is
// always clear.

import { DAY } from '../engine/constants';
import { hash32 } from '../engine/rng';
import type { StarSystem } from '../engine/types';
import { clock } from './clock';
import type { GameState, SurvivalState } from './store';

export interface Upgrade {
  id: string;
  name: string;
  cost: number;
  text: string;
}

export const UPGRADES: Upgrade[] = [
  { id: 'tripod', name: 'Theodolite tripod', cost: 2, text: 'Cuts hand sway on the hill by 80%.' },
  { id: 'vernier', name: 'Vernier scale', cost: 2, text: 'Angle readings to 0.001° instead of 0.005°.' },
  { id: 'panels', name: 'Extra solar panels', cost: 2, text: '+40% power from the star.' },
  { id: 'recycler', name: 'O₂ recycler', cost: 3, text: 'Uses 20% less oxygen per day.' },
  { id: 'greenhouse', name: 'Hydroponic greenhouse', cost: 3, text: 'After 30 days it grows 0.35 days of food per day (needs power).' },
  { id: 'rover', name: 'Rover battery pack', cost: 3, text: 'Rover drives 700 km/day instead of 400.' },
];

const rand = (seed: number, day: number, salt: number) => hash32(seed, day, salt) / 4294967296;

/** Dust storms last a few days, black out the sky and starve the solar panels. */
export function inStorm(seed: number, day: number) {
  for (let d = day; d > day - 7; d--) {
    if (rand(seed, d, 11) < 0.025) {
      const len = 3 + Math.floor(rand(seed, d, 12) * 5);
      if (day - d < len) return true;
    }
  }
  return false;
}

/** Deterministic weather: is the sky clouded over at time t? (Survival mode only.) */
export function isCloudy(seed: number, t: number) {
  const day = Math.floor(t / DAY);
  return inStorm(seed, day) || rand(seed, day, 77) < 0.18;
}

export const o2Rate = (sv: SurvivalState) => (sv.upgrades.includes('recycler') ? 0.8 : 1) * (sv.power <= 0 ? 1.5 : 1) + (sv.leak ? 0.5 : 0);
export const foodRate = () => 1;

export function lifeSupportEnd(s: GameState, sys: StarSystem) {
  // Free Roam: the air never runs out; a horizon that moves with time keeps planning finite.
  if (s.settings.freeRoam) return clock.t + 3 * sys.synodic;
  if (!s.settings.survival) return sys.lifeSupport;
  const sv = s.survival;
  const days = Math.min(sv.o2 / o2Rate(sv), sv.food / foodRate());
  return clock.t + Math.max(0, days) * DAY;
}

/** Apply daily upkeep for every day boundary crossed. */
export function survivalDay(s: GameState, _sys: StarSystem, d0: number, d1: number): Partial<GameState> {
  const sv: SurvivalState = { ...s.survival, upgrades: [...s.survival.upgrades], log: [...s.survival.log] };
  const roverBusy = s.rover.arriveAt > d0 * DAY;
  for (let day = d0 + 1; day <= d1; day++) {
    const storm = inStorm(s.seed, day);
    const solar = 48 * (storm ? 0.2 : 1) * (sv.upgrades.includes('panels') ? 1.4 : 1);
    const draw = 26 + (s.trackOn ? 5 : 0) + (s.moonTrackOn ? 4 : 0) + (roverBusy ? 10 : 0) + (sv.upgrades.includes('greenhouse') ? 5 : 0);
    const wasFlat = sv.power <= 0;
    sv.power = Math.max(0, Math.min(100, sv.power + solar - draw));
    sv.o2 -= o2Rate(sv);
    sv.food -= foodRate();
    if (sv.greenhouseSince !== null && day * DAY - sv.greenhouseSince > 30 * DAY && sv.power > 0) sv.food += 0.35;
    if (storm && !inStorm(s.seed, day - 1)) sv.log.unshift(`Day ${day}: dust storm rolling in. Solar power down, sky blacked out.`);
    if (!sv.leak && rand(s.seed, day, 31) < 0.012) {
      sv.leak = true;
      sv.log.unshift(`Day ${day}: micrometeorite! Oxygen tank leaking — repair it in the workshop.`);
    }
    if (sv.power <= 0 && !wasFlat) sv.log.unshift(`Day ${day}: batteries flat — scrubbers struggling, oxygen use up 50%. Turn off trackers or build panels.`);
    if (sv.power > 0 && wasFlat) sv.log.unshift(`Day ${day}: power restored.`);
  }
  sv.log = sv.log.slice(0, 30);
  sv.lastDay = d1;
  return { survival: sv };
}

/** Salvage one load from the wreck: parts, and sometimes supplies. */
export function salvage(s: GameState): { survival: SurvivalState; found: string } {
  const sv = { ...s.survival };
  if (sv.salvageLeft <= 0) return { survival: sv, found: 'Nothing useful left in the wreck.' };
  const day = Math.floor(clock.t / DAY);
  const r = rand(s.seed, day * 13 + sv.salvageLeft, 51);
  sv.salvageLeft -= 1;
  if (r < 0.15) {
    sv.food += 12;
    return { survival: sv, found: 'Found a sealed crate of emergency rations: +12 days of food.' };
  }
  if (r < 0.25) {
    sv.o2 += 8;
    return { survival: sv, found: 'Recovered an intact oxygen canister: +8 days of O₂.' };
  }
  const n = r < 0.7 ? 1 : 2;
  sv.parts += n;
  return { survival: sv, found: `Salvaged ${n} usable part${n > 1 ? 's' : ''}.` };
}
