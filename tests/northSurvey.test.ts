import { describe, expect, it } from 'vitest';
import { DAY } from '../src/engine/constants';
import { northSurveyRoute, northSurveyTrip } from '../src/game/northSurvey';
import { northSite, shadowSolarClock } from '../src/game/shadowObservation';
import { useGame } from '../src/game/store';
import { world } from '../src/game/world';

const sys = world(316, 'navigator', 3).system;
const initial = useGame.getState();

describe('north survey itinerary', () => {
  it('uses the planned station and shows the first shared noon after the estimated arrival', () => {
    const route = northSurveyRoute(sys, { ...initial, northTrip: { dist: 0, arriveAt: 0, planKm: 900 } }, DAY);
    expect(route.station).toBe(900_000);
    expect(route.eta).toBe(DAY + 900 / 400 * DAY);
    expect(route.campNoon).toBeGreaterThan(route.eta!);
    expect(route.stationNoon).toBe(route.campNoon);
    const atStation = northSite(sys.site, route.station, sys.home.radius);
    expect(atStation.lon).toBe(sys.site.lon);
    expect(shadowSolarClock(sys, route.stationNoon!, atStation).hours).toBeCloseTo(12);
  });

  it('interpolates an outbound and a return leg and frees the rover upon return', () => {
    const trip = { dist: 800_000, from: 0, departAt: DAY, arriveAt: 3 * DAY };
    expect(northSurveyTrip(trip, 2 * DAY)).toMatchObject({ moving: true, distance: 400_000, progress: 0.5 });
    const home = { dist: 0, from: 800_000, departAt: 3 * DAY, arriveAt: 5 * DAY };
    expect(northSurveyRoute(sys, { ...initial, northTrip: home }, 4 * DAY)).toMatchObject({
      moving: true, returning: true, distance: 400_000, station: 800_000, eta: 5 * DAY,
    });
    expect(northSurveyTrip(home, 5 * DAY)).toMatchObject({ moving: false, distance: 0, away: false });
  });
});
