import { expect, it } from 'vitest';
import { DAY, DEG } from '../src/engine/constants';
import { liveMeteorTrail, meteorActivity, meteorTrail, meteorsBetween } from '../src/engine/meteors';
import { generateSystem } from '../src/engine/system';
import { angleBetween, dot, norm } from '../src/engine/vec';
import { exposeMeteorPhoto, METEOR_EXPOSURE, meteorWatchStatus, visibleMeteorTrails } from '../src/game/meteorWatch';
import { makeLandscape } from '../src/render/terrain';
import { isCloudy } from '../src/game/survival';

const sys = generateSystem(316, 'navigator', 1);
const state = { seed: sys.seed, settings: { difficulty: 'navigator' as const, sound: false, formulas: true, survival: false } };

it('repeats the seeded shower near the same orbital longitude each year', () => {
  let at = 0;
  while (at < sys.home.period && (meteorActivity(sys, at)?.strength ?? 0) < .99) at += 900;
  const activity = meteorActivity(sys, at)!;
  expect(at).toBeLessThan(sys.home.period);
  expect(meteorActivity(sys, at + sys.home.period)?.strength).toBeCloseTo(activity.strength, 10);
  expect(meteorActivity(sys, at + sys.home.period / 4)).toBeNull();
  expect(norm(activity.radiant)).toBeCloseTo(1, 12);
});

it('projects each streak away from the radiant and lets a persistent train fade', () => {
  let events = meteorsBetween(sys, 0, 2 * DAY);
  for (let d = 2; !events.length && d < sys.home.period / DAY; d += 2) events = meteorsBetween(sys, d * DAY, (d + 2) * DAY);
  expect(events.length).toBeGreaterThan(0);
  const e = events[0], trail = meteorTrail(e, 1, 1, true);
  expect(angleBetween(trail.to, e.radiant)).toBeGreaterThan(angleBetween(trail.from, e.radiant));
  expect(dot(trail.from, e.radiant)).toBeCloseTo(Math.cos(e.start), 10);
  const fresh = liveMeteorTrail(e, e.at + e.duration + 1)!;
  expect(fresh.head).toBe(false);
  expect(liveMeteorTrail(e, e.at + e.duration + 10)!.intensity).toBeLessThan(fresh.intensity);
  expect(liveMeteorTrail(e, e.at + e.duration + e.persistence + 1)).toBeNull();
});

it('collects only events in the camera during a clear exposure', () => {
  const land = makeLandscape(sys.seed, sys.hillHeight);
  const camera = { az: Math.PI, alt: 35 * DEG, fov: 90 * DEG, w: 640, h: 420 };
  let at = 900, photo = null;
  for (; at < sys.home.period; at += 900) {
    if (!isCloudy(sys.seed, at) || !meteorWatchStatus(sys, state, at).active) continue;
    photo = exposeMeteorPhoto(sys, state, camera, land, at, at + METEOR_EXPOSURE);
    if (photo) break;
  }
  expect(photo?.trails.length).toBeGreaterThan(0);
  expect(photo?.camera).toEqual(camera);
  expect(photo?.at).toBe(at + METEOR_EXPOSURE / 2);
  const cloudy = { ...state, settings: { ...state.settings, survival: true } };
  expect(meteorWatchStatus(sys, cloudy, at).available).toBe(false);
  expect(exposeMeteorPhoto(sys, cloudy, camera, land, at, at + 20)).toBeNull();
  expect(visibleMeteorTrails(sys, cloudy, at)).toEqual([]);
  expect(exposeMeteorPhoto(sys, state, { ...camera, alt: -80 * DEG, fov: 15 * DEG }, land, at, at + METEOR_EXPOSURE)).toBeNull();
});
