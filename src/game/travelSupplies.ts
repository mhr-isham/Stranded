import { DAY } from '../engine/constants';
import { simulateLaunch, type LaunchPlan } from '../engine/launch';
import type { StarSystem } from '../engine/types';
import { lifeSupportEnd, o2Rate } from './survival';
import type { GameState, Outcome } from './store';

// Sealed cruise stores are fixed provisioning, independent of the measured
// orbit. They keep the existing surface observation window viable.
const CRUISE_RESERVE: Readonly<Record<number, number>> = { 4: 430, 5: 125, 6: 65, 7: 1750, 9: 245 };
export const cruiseReserve = (chapter: number) => CRUISE_RESERVE[chapter] ?? 255;

export interface CruiseSupplies {
  air: number; // days of air at the ship's cruise rate
  food?: number; // survival only
  needs: number; // days of cruise
  canDepart: boolean;
}

export function cruiseSupplies(s: GameState, sys: StarSystem, now: number, plan: LaunchPlan): CruiseSupplies | null {
  if (s.settings.freeRoam || s.tutorial.active) return null;
  const end = lifeSupportEnd(s, sys, now);
  const reserve = cruiseReserve(s.chapter);
  const departure = Math.max(now, plan.departTime);
  const daysWaiting = (departure - now) / DAY;
  const needs = plan.tof / DAY;
  const canDepart = departure < end;
  return s.settings.survival
    ? { air: reserve + Math.max(0, s.survival.o2 - daysWaiting * o2Rate(s.survival)),
        food: reserve + Math.max(0, s.survival.food - daysWaiting), needs, canDepart }
    : { air: reserve + Math.max(0, (end - departure) / DAY), needs, canDepart };
}

export function cruiseLimit(supplies: CruiseSupplies) {
  return Math.min(supplies.air, supplies.food ?? Infinity);
}

export function flyTransfer(s: GameState, sys: StarSystem, budget: number, plan: LaunchPlan): Outcome {
  const supplies = cruiseSupplies(s, sys, plan.departTime, plan);
  const campEnd = lifeSupportEnd(s, sys, plan.departTime);
  const limit = supplies ? cruiseLimit(supplies) * DAY : Infinity;
  const result = simulateLaunch({ ...sys, fuelDv: budget, lifeSupport: supplies?.canDepart === false ? -Infinity : Infinity }, plan, limit);
  if (result.outcome === 'no-escape' || supplies?.canDepart === false) return { plan, result, sheet: s.sheet };
  const elapsed = Math.min(limit, plan.tof);
  return {
    plan, result, sheet: s.sheet,
    cruise: { elapsed, departureMargin: (campEnd - plan.departTime) / campEnd, ...(supplies && {
      airLeft: Math.max(0, supplies.air - elapsed / DAY),
      foodLeft: supplies.food === undefined ? undefined : Math.max(0, supplies.food - elapsed / DAY),
    }) },
  };
}
