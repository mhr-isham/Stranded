import { DAY } from '../engine/constants';
import type { StarSystem } from '../engine/types';
import { hasChallenge } from './challenges';
import { nextShadowNoon, northLimit, northSite, shadowSolarClock } from './shadowObservation';
import type { GameState } from './store';

type Trip = GameState['northTrip'];

export const northSurveyLimitKm = (sys: StarSystem) => Math.floor(northLimit(sys) / 50_000) * 50;
export const northSurveyPlanKm = (sys: StarSystem, trip: Trip) => Math.min(northSurveyLimitKm(sys), Math.max(200, trip.planKm ?? 800));

export function northSurveySpeed(s: Pick<GameState, 'settings' | 'survival'>) {
  return (s.settings.survival && s.survival.upgrades.includes('rover') ? 700 : 400) * 1000 * (hasChallenge(s, 'rover') ? 0.5 : 1);
}

export function northSurveyTrip(trip: Trip, now: number) {
  const moving = trip.arriveAt > now;
  const from = trip.from ?? 0;
  const duration = trip.arriveAt - (trip.departAt ?? now);
  const progress = moving ? Math.max(0, Math.min(1, 1 - (trip.arriveAt - now) / Math.max(1, duration))) : 1;
  const distance = moving ? from + (trip.dist - from) * progress : trip.dist;
  return { moving, from, progress, distance, away: moving || trip.dist > 0 };
}

export function northSurveyRoute(sys: StarSystem, state: Pick<GameState, 'northTrip' | 'settings' | 'survival'>, now: number) {
  const trip = state.northTrip;
  const travel = northSurveyTrip(trip, now);
  const planned = !travel.away;
  const station = trip.dist || (travel.moving ? travel.from : northSurveyPlanKm(sys, trip) * 1000);
  const site = northSite(sys.site, station, sys.home.radius);
  const eta = travel.moving ? trip.arriveAt : planned ? now + station / northSurveySpeed(state) * DAY : null;
  const reference = eta ?? now;
  return {
    ...travel, station, planned, eta, returning: travel.moving && trip.dist === 0,
    campHours: shadowSolarClock(sys, now).hours,
    stationHours: shadowSolarClock(sys, now, site).hours,
    campNoon: nextShadowNoon(sys, reference),
    stationNoon: nextShadowNoon(sys, reference, site),
  };
}
