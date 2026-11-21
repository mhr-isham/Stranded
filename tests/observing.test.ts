import { afterEach, expect, it, vi } from 'vitest';
import { DAY, DEG } from '../src/engine/constants';
import { flareAt } from '../src/engine/flares';
import { parallaxSite } from '../src/engine/measure';
import { localFrame, toHorizontal, topocentric } from '../src/engine/sky';
import { generateSystem } from '../src/engine/system';
import { assessOpticalConditions, opticalLimits, opticalStatus, opticalWeather, type OpticalConditions, type OpticalMethod } from '../src/game/observing';
import { fastForward, currentWorld, giantObservable, targetObservable } from '../src/game/sim';
import { useGame } from '../src/game/store';
import { clock } from '../src/game/clock';
import { isCloudy } from '../src/game/survival';
import * as survival from '../src/game/survival';

const methods: OpticalMethod[] = ['target-track', 'giant-track', 'parallax', 'diameter', 'nearby-star', 'solar-year', 'locked-year', 'solar-camera', 'view', 'night-view'];
const sys = generateSystem(316, 'cadet', 7);
const clear: OpticalConditions = { at: DAY, sunAlt: -20 * DEG, alt: 45 * DEG, cloudy: false, flare: false, seeing: 1, referenceVisible: true, inField: true };
function ready(method: OpticalMethod): OpticalConditions { return { ...clear, ...(method === 'solar-year' ? { sunAlt: 5 * DEG, alt: 5 * DEG } : method === 'solar-camera' ? { sunAlt: 30 * DEG } : {}) }; }
const state = (difficulty: 'cadet' | 'legend' = 'cadet', survival = false) => ({ seed: 316, settings: { difficulty, survival, sound: false, formulas: true } });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('uses the same weather decision and single-reason priority for every optical method', () => {
  for (const method of methods) {
    const limits = opticalLimits(sys, method), c = ready(method);
    expect(assessOpticalConditions(method, c, limits).ok, method).toBe(true);
    expect(assessOpticalConditions(method, { ...c, cloudy: true }, limits).code).toBe('clouds');
    const blocked = assessOpticalConditions(method, { ...c, cloudy: true, flare: true, referenceVisible: false, inField: false }, limits);
    expect(blocked.code).toBe('flare');expect(blocked.reason).toBe('Flare glare — wait for it to fade.');
    expect(assessOpticalConditions(method, { ...c, seeing: 6.6 }, limits).ok).toBe(true);
  }
});
it('keeps solar/filter, bright-disk and locked-world exceptions explicit', () => {
  expect(assessOpticalConditions('solar-camera', { ...clear, sunAlt: 30 * DEG, referenceVisible: false }, opticalLimits(sys, 'solar-camera')).ok).toBe(true);
  expect(assessOpticalConditions('solar-year', { ...clear, sunAlt: 5 * DEG, referenceVisible: false }, opticalLimits(sys, 'solar-year')).ok).toBe(true);
  expect(assessOpticalConditions('nearby-star', { ...clear, sunAlt: 5 * DEG }, opticalLimits(sys, 'nearby-star')).code).toBe('daylight');
  expect(assessOpticalConditions('diameter', { ...clear, sunAlt: 20 * DEG, referenceVisible: false }, opticalLimits(sys, 'diameter')).ok).toBe(true);
  const locked = generateSystem(316, 'cadet', 6);
  expect(opticalStatus(locked, state(), 100, 'locked-year').ok).toBe(true);
  expect(opticalStatus(locked, state(), 100, 'solar-year').ok).toBe(false);
});
it('enforces altitude, field, reference and strict window boundaries without mutating its snapshot', () => {
  for (const method of methods) {
    const limits = opticalLimits(sys, method), c = ready(method);
    expect(assessOpticalConditions(method, { ...c, inField: false }, limits).code).toBe('field');
    expect(assessOpticalConditions(method, { ...c, referenceVisible: false }, limits).ok).toBe(!limits.references);
    if (limits.minAlt !== undefined) expect(assessOpticalConditions(method, { ...c, alt: limits.minAlt }, limits).code).toBe('low');
    if (limits.maxSun !== undefined) expect(assessOpticalConditions(method, { ...c, sunAlt: limits.maxSun }, limits).code).toBe('daylight');
  }
  const limits = opticalLimits(sys, 'solar-year', 2 * DEG);
  expect(assessOpticalConditions('solar-year', { ...clear, sunAlt: -0.5 * DEG, alt: -0.5 * DEG }, limits).code).toBe('low');
  const before = JSON.stringify(clear);assessOpticalConditions('nearby-star', clear, opticalLimits(sys, 'nearby-star'));
  expect(JSON.stringify(clear)).toBe(before);
});
it('rejects unavailable or nonfinite geometry instead of making a usable-looking view', () => {
  for (const patch of [{ at: NaN }, { at: -1 }, { sunAlt: Infinity }, { alt: NaN }, { seeing: 0 }]) expect(assessOpticalConditions('view', { ...clear, ...patch }, opticalLimits(sys, 'view')).code).toBe('invalid');
  expect(opticalStatus(sys, state(), NaN, 'view').code).toBe('invalid');
  expect(opticalStatus(sys, state(), -1, 'view').code).toBe('invalid');
  expect(opticalStatus(generateSystem(316, 'cadet', 1), state(), 100, 'giant-track').code).toBe('invalid');
  expect(opticalStatus(sys, state(), 100, 'view', { direction: [0, 0, 0] }).ok).toBe(false);
  expect(opticalStatus(sys, state(), 100, 'view', { direction: [1, 0, 0], horizon: NaN }).code).toBe('invalid');
});
it('uses the requested site and observation instant, and keeps survival-off cloud behavior', () => {
  const world = generateSystem(316, 'cadet', 1), rover = parallaxSite(world, world.site, 5e6);
  let differences = 0, cloudyAt = -1;
  for (let h = 0; h < 200; h++) {
    const at = h * 3600;
    const a = opticalStatus(world, state(), at, 'parallax'), b = opticalStatus(world, state(), at, 'parallax', { site: rover });
    const expected = toHorizontal(topocentric(world, 'target', at, rover), localFrame(world, at, rover)).alt;
    expect(b.alt).toBeCloseTo(expected, 12);
    if (a.ok !== b.ok) differences++;
    if (isCloudy(316, at)) cloudyAt = at;
  }
  expect(differences).toBeGreaterThan(0);expect(cloudyAt).toBeGreaterThanOrEqual(0);
  expect(opticalWeather(world, state('cadet', true), cloudyAt).cloudy).toBe(true);
  expect(opticalWeather(world, state('cadet', false), cloudyAt).cloudy).toBe(false);
});
it('checks live visibility and retains recorded provenance during native automatic sampling', () => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  for (const chapter of [1, 5, 6, 7]) {
    useGame.getState().newGame(316, { difficulty: 'cadet', survival: true, sound: false, formulas: true }, chapter);
    const { system } = currentWorld();clock.t = 0;
    useGame.setState({ phase: 'play', identified: true, trackOn: true, moonTrackOn: true, trackGOn: true, sunCamOn: true });
    fastForward(25 * DAY);
    const s = useGame.getState();
    expect(s.track.length, `chapter ${chapter}`).toBeGreaterThan(0);
    for (const [records, method] of [[s.track, 'target-track'], [s.moonTrack, 'target-track'], [s.trackG, 'giant-track'], [s.moonTrackG, 'giant-track'], [s.sunLog, 'solar-camera']] as const) {
      for (const record of records) {
        expect(opticalStatus(system, s, record.at, method).ok).toBe(true);
        expect(record.environment?.at).toBe(record.at);expect(record.environment?.rawValue).toBe(record.v);
        expect(record.environment?.seeing?.factor).toBeGreaterThanOrEqual(1);
      }
    }
    expect(targetObservable(clock.t).ok).toBe(opticalStatus(system, s, clock.t, 'target-track').ok);
    expect(giantObservable(clock.t)).toBe(!!system.giant && opticalStatus(system, s, clock.t, 'giant-track').ok);
  }
});
it('consistently blocks real red-dwarf flares even with survival disabled', () => {
  const locked = generateSystem(316, 'cadet', 6);let at = 0;
  while (at < 100 * DAY && !flareAt(locked, at)) at += 600;
  expect(at).toBeLessThan(100 * DAY);
  for (const method of methods.filter((m) => m !== 'giant-track')) expect(opticalStatus(locked, state(), at, method).code).toBe('flare');
});
it('does not create solar-camera observations through an opaque weather interval', () => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  const run = (clouds: boolean) => {
    useGame.getState().newGame(316, { difficulty: 'cadet', survival: clouds, freeRoam: true, sound: false, formulas: true }, 5);
    clock.t = 0;useGame.setState({ phase: 'play', sunCamOn: true });fastForward(600 * DAY);
    return useGame.getState().sunLog;
  };
  const original = run(false);expect(original.length).toBeGreaterThan(0);
  const saved = JSON.stringify(original);
  vi.spyOn(survival, 'isCloudy').mockReturnValue(true);
  expect(run(true)).toHaveLength(0);
  expect(JSON.stringify(original)).toBe(saved);
});
it('retains usable tracker data when fewer than two transit events can be photographed', () => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {} });
  useGame.getState().newGame(22, { difficulty: 'cadet', survival: true, freeRoam: true, sound: false, formulas: true }, 5);
  const { system } = currentWorld();clock.t = 0;
  useGame.setState({ phase: 'play', identified: true, trackOn: true, sunCamOn: true });
  fastForward(system.lifeSupport);
  const { track, sunLog } = useGame.getState();
  const events = sunLog.reduce<number[]>((a, o) => { if (!a.length || o.at - a[a.length - 1] > 10 * DAY) a.push(o.at);return a; }, []);
  expect(events).toHaveLength(1);expect(track.length).toBeGreaterThan(20);
  let bracketed = 0;
  for (let t = system.firstOpposition; t < system.lifeSupport; t += system.synodic) {
    const before = track.slice().reverse().find((o) => o.at < t), after = track.find((o) => o.at > t);
    if (before && after && t - before.at < .35 * system.synodic && after.at - t < .35 * system.synodic) bracketed++;
  }
  expect(bracketed).toBeGreaterThanOrEqual(2);
});
