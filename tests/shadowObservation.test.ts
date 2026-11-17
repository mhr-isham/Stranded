import { expect, it } from 'vitest';
import { DAY, DEG, HOUR } from '../src/engine/constants';
import { solarDay } from '../src/engine/ephemeris';
import { eclToEq, topocentric } from '../src/engine/sky';
import { generateSystem } from '../src/engine/system';
import { apparentShadowAltitude, compareShadows, correctedShadowAltitude, makeShadowCapture, markedShadow, nextShadowNoon, northLimit, northSite, shadowAvailable, shadowSolarClock, type ShadowReading } from '../src/game/shadowObservation';

function fixture(chapter = 1) {
  const sys = generateSystem(316, 'cadet', chapter);
  let t = nextShadowNoon(sys, 0)!;
  for (let i = 0; i < 400; i++, t = nextShadowNoon(sys, t + 1)!) {
    const frame = makeShadowCapture(sys, t, 800e3, 1000, 'test');
    if (frame) return { sys, t, frame };
  }
  throw Error('No usable noon');
}
function exactMarks(chapter = 1) {
  const f = fixture(chapter);
  const correction = chapter === 3 ? { k: f.sys.features.refraction, sigmaK: .02 } : undefined;
  return { ...f, c: markedShadow(f.frame, 'camp', f.frame.camp.length, .01, correction)!, r: markedShadow(f.frame, 'rover', f.frame.rover.length, .01, correction)! };
}

it('recovers physical radius from marked shadows without using stored latitude gaps', () => {
  for (const chapter of [1, 2, 3, 4, 5, 7, 8, 9]) {
    const { sys, c, r } = exactMarks(chapter);
    const a = compareShadows([c, r]); expect(a.result).not.toBeNull();
    expect(Math.abs(a.result!.radius / sys.home.radius - 1)).toBeLessThan(.002);
    const forgedCoordinates = compareShadows([{ ...c, position: { lat: -1, lon: 0 } }, { ...r, position: { lat: 1, lon: 0 } }]);
    expect(forgedCoordinates.result!.radius).toBe(a.result!.radius);
    expect(a.result!.sigma).toBeGreaterThan(0);
  }
});

it('adds opposing signed shadow angles instead of subtracting their magnitudes', () => {
  const { c, r } = exactMarks();
  const a = { ...c, length: 2 * Math.tan(3 * DEG), direction: -1 as const }, b = { ...r, length: 2 * Math.tan(5 * DEG), direction: 1 as const };
  const fit = compareShadows([a, b]).result!;
  expect(fit.delta / DEG).toBeCloseTo(8, 7); expect(fit.radius).toBeCloseTo(800e3 / (8 * DEG), 5);
  const { sys, t } = fixture();
  const v = eclToEq(topocentric(sys, 'star', t, sys.site), sys.home.obliquity);
  const declination = Math.atan2(v[2], Math.hypot(v[0], v[1]));
  sys.site = { ...sys.site, lat: declination - 3 * DEG };
  const physical = makeShadowCapture(sys, t, sys.home.radius * 8 * DEG, 1000, 'straddling')!;
  expect(physical).not.toBeNull(); expect(physical.camp.direction).not.toBe(physical.rover.direction);
  const inferred = compareShadows([markedShadow(physical, 'camp', physical.camp.length, .01)!, markedShadow(physical, 'rover', physical.rover.length, .01)!]);
  expect(Math.abs(inferred.result!.radius / sys.home.radius - 1)).toBeLessThan(.002);
});

it('groups by actual local solar days and finds noon on a non-Earth rotation', () => {
  const { sys } = fixture(); sys.home.siderealDay = 31 * HOUR;
  const a = nextShadowNoon(sys, 0)!, b = nextShadowNoon(sys, a + 1)!;
  expect(shadowSolarClock(sys, a).hours).toBeCloseTo(12, 7);
  expect(b - a).toBeGreaterThan(30 * HOUR); expect(b - a).toBeLessThan(32 * HOUR);
  expect(shadowSolarClock(sys, b).day - shadowSolarClock(sys, a).day).toBe(1);
  expect(shadowSolarClock(sys, a - 7 * HOUR).day).toBe(shadowSolarClock(sys, a + 7 * HOUR).day);
  // The same Earth-day bin can contain the midnight boundary of the local day.
  const midnight = a + solarDay(sys) / 2;
  let crossing: number | null = null;
  for (let t = midnight - HOUR; t < midnight + HOUR; t += 60) if (shadowSolarClock(sys, t).day !== shadowSolarClock(sys, t + 60).day) { crossing = t; break; }
  expect(crossing).not.toBeNull(); expect(shadowSolarClock(sys, crossing!).day).not.toBe(shadowSolarClock(sys, crossing! + 60).day);
  expect(Math.floor((crossing! + 60) / DAY)).toBe(Math.floor(crossing! / DAY));
});

it('rejects mixed captures/days/meridians, old incomplete provenance and unusable inputs', () => {
  const { c, r, frame } = exactMarks();
  for (const bad of [{ ...r, capture: 'other' }, { ...r, solarDay: r.solarDay! + 1 }, { ...r, position: { ...r.position!, lon: .2 } }, { ...r, length: Infinity }]) expect(compareShadows([c, bad]).result).toBeNull();
  expect(compareShadows([{ site: 'camp', at: 0, alt: .5, dist: 0 }, { site: 'rover', at: 0, alt: .4, dist: 800e3 }]).pair).toBeNull();
  expect(markedShadow(frame, 'camp', 0, .01)).toBeNull(); expect(markedShadow(frame, 'camp', 1, 0)).toBeNull();
  expect(markedShadow(frame, 'camp', NaN, .1)).toBeNull();
});

it('retains off-noon observations but rejects their use, and accounts for smaller timing offsets', () => {
  const { c, r } = exactMarks();
  expect(compareShadows([{ ...c, solarHours: 13 }, { ...r, solarHours: 13 }]).status).toMatch(/15 local/);
  const near = compareShadows([{ ...c, solarHours: 12.01 }, { ...r, solarHours: 12.01 }]).result!;
  const noon = compareShadows([c, r]).result!;
  expect(near.timing).toBeGreaterThan(noon.timing); expect(near.sigma).toBeGreaterThan(noon.sigma);
});

it('inverts high-Sun refraction, preserves raw marks and propagates a shared coefficient', () => {
  expect(apparentShadowAltitude(.8, 0)).toBe(.8);
  expect(correctedShadowAltitude(apparentShadowAltitude(.8, .55), .55)).toBeCloseTo(.8, 10);
  const { c, r } = exactMarks(3), rawC = c.length;
  const corrected = compareShadows([c, r]).result!;
  const raw = compareShadows([{ ...c, refraction: undefined }, { ...r, refraction: undefined }]).result!;
  expect(corrected.refraction).toBeGreaterThan(0); expect(corrected.radius).not.toBe(raw.radius); expect(c.length).toBe(rawC);
  expect(compareShadows([c, { ...r, refraction: { k: .2, sigmaK: .02 } }]).result).toBeNull();
  const larger = compareShadows([c, { ...r, sigmaLength: r.sigmaLength! * 3 }]).result!;
  expect(larger.marking).toBeGreaterThan(corrected.marking);
});

it('bounds northward sites and refuses locked, nighttime or travelling-style invalid captures', () => {
  const { sys, t } = fixture();
  expect(northSite(sys.site, 800e3, sys.home.radius).lon).toBe(sys.site.lon);
  expect(makeShadowCapture(sys, t, northLimit(sys) + 1, 1000, 'outside')).toBeNull();
  expect(makeShadowCapture(sys, t, 0, 1000, 'zero')).toBeNull();
  const locked = generateSystem(316, 'cadet', 6);
  expect(shadowAvailable(locked)).toBe(false); expect(nextShadowNoon(locked, 0)).toBeNull();
  expect(makeShadowCapture(locked, 0, 800e3, 1000, 'locked')).toBeNull();
});

it('does not count revisions as extra observations when selecting the latest synchronized pair', () => {
  const { c, r } = exactMarks();
  const older: ShadowReading = { ...r, at: r.at - 1, capture: 'old' };
  const a = compareShadows([older, { ...c, length: c.length! + .1 }, c, r]);
  expect(a.pair!.camp).toBe(c); expect(a.pair!.rover).toBe(r);
  const second = [{ ...c, capture: 'second' }, { ...r, capture: 'second', length: r.length! + .02 }];
  expect(compareShadows([c, r, ...second]).pair!.rover.capture).toBe('second');
});
