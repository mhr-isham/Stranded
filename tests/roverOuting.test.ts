import { describe, expect, it } from 'vitest';
import { DAY, DEG } from '../src/engine/constants';
import { solarDay } from '../src/engine/ephemeris';
import { norm, unit } from '../src/engine/vec';
import { topocentric } from '../src/engine/sky';
import { completeOuting, outingArrival, roverTrackForecast, roverWindows } from '../src/game/roverOuting';
import { opticalStatus } from '../src/game/observing';
import { world } from '../src/game/world';
import type { GameState } from '../src/game/store';

describe('rover-camera forecasts', () => {
  const observations = [359, 0, 1].map((longitude, i) => ({
    at: (i + 1) * DAY, v: longitude * DEG, skyLatitude: .2 * DEG, source: 'tracker' as const,
  }));

  it('unwraps the crossing at zero and preserves both measured coordinates', () => {
    const model = roverTrackForecast(observations, 3 * DAY, DAY)!;
    const next = model.at(4 * DAY)!;
    expect(Math.atan2(next.direction[1], next.direction[0]) / DEG).toBeCloseTo(2, 8);
    expect(Math.asin(next.direction[2]) / DEG).toBeCloseTo(.2, 8);
    expect(next.margin).toBeGreaterThan(0);
    expect(model.at(model.until + 1)).toBeNull();
  });

  it('needs distinct fresh two-coordinate sightings and rejects future records', () => {
    expect(roverTrackForecast(observations, 3 * DAY - 1, DAY)).toBeNull();
    expect(roverTrackForecast(observations, 6 * DAY, DAY)).toBeNull();
    expect(roverTrackForecast(observations.map(({ at, v }) => ({ at, v })), 3 * DAY, DAY)).toBeNull();
    expect(roverTrackForecast([observations[0], observations[0], observations[2]], 3 * DAY, DAY)).toBeNull();
  });

  it('searches after rover arrival and before the deadline using the track rather than the true orbit', () => {
    const { system: sys } = world(316, 'navigator');
    const period = solarDay(sys);
    const now = sys.firstOpposition;
    const state = { seed: sys.seed, settings: { difficulty: 'navigator', survival: false, sound: false, formulas: true } } as const;
    const track = [];
    for (let day = 4; day >= 1; day--) {
      for (let step = 0; step < 8; step++) {
        const at = now - (day - step / 8) * period;
        if (!opticalStatus(sys, state, at, 'target-track').ok) continue;
        const ray = topocentric(sys, 'target', at, sys.site);
        track.push({ at, v: Math.atan2(ray[1], ray[0]), skyLatitude: Math.asin(ray[2] / norm(ray)) });
        break;
      }
    }
    const input = { sys, track, solarDay: period, sunNow: unit(topocentric(sys, 'star', now, sys.site)), now,
      readyAt: now + period / 2, endAt: now + 2 * period, distance: 500_000 };
    const windows = roverWindows(input);
    expect(windows.length).toBeGreaterThan(0);
    for (const slot of windows) {
      expect(slot.start).toBeGreaterThanOrEqual(input.readyAt);
      expect(slot.end).toBeLessThan(input.endAt);
      expect(slot.at).toBeGreaterThanOrEqual(slot.start);
      expect(slot.at).toBeLessThanOrEqual(slot.end);
    }
    expect(roverWindows({ ...input, sys: { ...sys, target: { ...sys.target, e: .99 } } })).toEqual(windows);
    expect(roverWindows({ ...input, endAt: input.readyAt })).toEqual([]);
    expect(roverWindows({ ...input, requestedDay: Math.floor(input.endAt / DAY) + 1 })).toEqual([]);
  });

  it('uses the real route speed and only records a matching capture within the window', () => {
    const s = { settings: { survival: true, challenges: ['rover'] },
      survival: { upgrades: ['rover'] }, rover: { dist: 0, target: 700_000, arriveAt: 3 * DAY } } as Pick<GameState, 'rover' | 'settings' | 'survival'>;
    expect(outingArrival(s, 1_050_000, DAY)).toBe(4 * DAY);
    const slot = { start: 100, end: 200, at: 150, lowerAltitude: .5, margin: .02, localHour: 22,
      distance: 500_000, observations: 3, observedFrom: 1, observedTo: 30 };
    expect(completeOuting(slot, 150, 600_000)).toBe(slot);
    expect(completeOuting(slot, 201, 500_000)).toBe(slot);
    const captured = completeOuting(slot, 180, 500_000)!;
    expect(captured.capturedAt).toBe(180);
    expect(completeOuting(captured, 190, 500_000)).toBe(captured);
  });
});
