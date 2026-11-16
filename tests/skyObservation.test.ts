import { describe, expect, it } from 'vitest';
import { DAY, DEG, HOUR } from '../src/engine/constants';
import { generateSystem } from '../src/engine/system';
import { localFrame, starAltitude, starCatalog, toHorizontal } from '../src/engine/sky';
import { makeLandscape } from '../src/render/terrain';
import { makeSkySighting, sightingChange, sightingSeries, skyCode, skyDirection, skyline, visibleSkyLights } from '../src/game/skyObservation';
import { useGame } from '../src/game/store';
import { leaveFlightPractice, practiceSnapshot } from '../src/ui/common/flightPractice';

const sys = generateSystem(4), catalog = starCatalog(sys.seed), land = makeLandscape(sys.seed, sys.hillHeight);
const atHour = (test: (t: number) => boolean) => {
  for (let hour = 0; hour < 240; hour++) if (test(hour * HOUR)) return hour * HOUR;
  throw Error('No observing fixture time');
};
const ray = (lon: number) => [Math.cos(lon * DEG), Math.sin(lon * DEG), 0] as [number, number, number];

describe('observable sky discovery', () => {
  it('assigns stable neutral codes without collisions or target-first labels', () => {
    const refs = [{ kind: 'star' as const }, { kind: 'target' as const }, { kind: 'relay' as const }, { kind: 'giant' as const }, ...catalog.map((_, i) => ({ kind: 'catalog' as const, i }))];
    const codes = refs.map((ref) => skyCode(sys.seed, ref));
    expect(new Set(codes).size).toBe(refs.length);
    expect(codes[1]).toMatch(/^Light [0-9A-Z]{3}$/);
    expect(skyCode(sys.seed, refs[1])).toBe(codes[1]);
  });
  it('offers only lights in the actual dark field above the landscape', () => {
    const at = atHour((t) => starAltitude(sys, t, sys.site) < -18 * DEG);
    const frame = localFrame(sys, at, sys.site);
    const i = catalog.findIndex((star) => star.mag < 2.6 && toHorizontal(star.dir, frame).alt > 30 * DEG);
    expect(i).toBeGreaterThanOrEqual(0);
    const position = toHorizontal(catalog[i].dir, frame);
    const camera = { az: position.az, alt: position.alt, fov: 60 * DEG, w: 800, h: 600 };
    const lights = visibleSkyLights(sys, catalog, at, camera, land);
    expect(lights.some((light) => light.key === `catalog:${i}`)).toBe(true);
    for (const light of lights) {
      expect(light.alt).toBeGreaterThan(skyline(land, light.az));
      expect(light.x).toBeGreaterThanOrEqual(0); expect(light.x).toBeLessThanOrEqual(camera.w);
      expect(light.y).toBeGreaterThanOrEqual(0); expect(light.y).toBeLessThanOrEqual(camera.h);
    }
    expect(visibleSkyLights(sys, catalog, at, camera, land, true)).toEqual([]);
    expect(visibleSkyLights(sys, catalog, at, camera, { ridges: [{ alt: () => Math.PI / 2, haze: 0 }], hillAz: 0 })).toEqual([]);
  });
  it('does not expose daylight background stars or an invisible target in the wide view', () => {
    const at = atHour((t) => starAltitude(sys, t, sys.site) > 20 * DEG);
    const lights = visibleSkyLights(sys, catalog, at, { az: 0, alt: 45 * DEG, fov: 120 * DEG, w: 800, h: 600 }, land);
    expect(lights.every((light) => light.ref.kind === 'star')).toBe(true);
  });
  it('shows actual relative planetary motion without moving the fixed catalogue', () => {
    const a = makeSkySighting('target', 'Light A', 0, skyDirection(sys, catalog, { kind: 'target' }, 0), 'scope')!;
    const b = makeSkySighting('target', 'Light A', 30 * DAY, skyDirection(sys, catalog, { kind: 'target' }, 30 * DAY), 'scope')!;
    expect(sightingChange(a, b)).toBeGreaterThan(.01);
    expect(skyDirection(sys, catalog, { kind: 'catalog', i: 0 }, 0)).toEqual(skyDirection(sys, catalog, { kind: 'catalog', i: 0 }, 30 * DAY));
  });
});

describe('observer-owned sky notebook', () => {
  it('uses readout steps, finite pointing data and bounded written notes', () => {
    expect(makeSkySighting('a', 'Light A', 0, ray(1.234), 'wide')!.lon).toBeCloseTo(1.2);
    const fine = makeSkySighting('a', 'Light A', 0, ray(1.234), 'scope', 'x'.repeat(300))!;
    expect(fine.lon).toBeCloseTo(1.235); expect(fine.note).toHaveLength(240);
    expect(makeSkySighting('a', 'Light A', 0, ray(359.9999), 'scope')!.lon).toBe(0);
    expect(makeSkySighting('a', 'Light A', NaN, ray(0), 'scope')).toBeNull();
    expect(makeSkySighting('a', 'Light A', 0, [0, 0, 0], 'scope')).toBeNull();
  });
  it('compares only saved pointings, including angular wrap and unordered dates', () => {
    const a = makeSkySighting('a', 'Light A', 0, ray(359.9), 'scope')!;
    const b = makeSkySighting('a', 'Light A', DAY, ray(.1), 'scope')!;
    const other = makeSkySighting('b', 'Light B', 2 * DAY, ray(55), 'wide')!;
    expect(sightingChange(a, b)).toBeCloseTo(.2);
    const series = sightingSeries([b, other, a], 'a');
    expect(series).toHaveLength(2);
    expect(series[0]).toEqual({ id: a.id, x: 1, y: 0 });
    expect(series[1].y).toBeCloseTo(.2);
    expect(series.at(-1)!.x).toBe(2); // no interpolated or future sightings
  });
  it('restores original expedition sightings after isolated practice', () => {
    useGame.getState().newGame(316, { difficulty: 'cadet', formulas: true, survival: false, sound: false });
    const original = makeSkySighting('a', 'Light A', 0, ray(25), 'wide')!;
    useGame.setState({ phase: 'play', skySightings: [original] });
    const back = practiceSnapshot();
    useGame.getState().newGame(316, { difficulty: 'cadet', freeRoam: true, formulas: true, survival: false, sound: false });
    useGame.setState({ practiceReturn: back, settings: { ...useGame.getState().settings, skyReducedFlicker: true }, skySightings: [makeSkySighting('b', 'Light B', DAY, ray(40), 'scope')!] });
    leaveFlightPractice();
    expect(useGame.getState().skySightings).toEqual([original]);
    expect(useGame.getState().settings.skyReducedFlicker).toBe(true);
  });
  it('does not leak practice sightings or new per-run fields into legacy return snapshots', () => {
    const back = practiceSnapshot();
    delete back.state.skySightings; delete back.state.verificationHistory;
    delete back.state.instrumentSetup; delete back.state.readingPredictions;
    useGame.setState({ practiceReturn: back, settings: { ...useGame.getState().settings, skyReducedFlicker: true }, skySightings: [makeSkySighting('b', 'Light B', DAY, ray(40), 'scope')!], instrumentSetup: { pendulumScreen: true } });
    leaveFlightPractice();
    expect(useGame.getState().skySightings).toEqual([]);
    expect(useGame.getState().verificationHistory).toEqual([]);
    expect(useGame.getState().instrumentSetup.pendulumScreen).toBe(false);
    expect(useGame.getState().readingPredictions).toEqual({});
  });
});
