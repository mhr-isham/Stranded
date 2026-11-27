import { DEG } from '../engine/constants';
import { liveMeteorTrail, METEOR_LOOKBACK, meteorActivity, meteorsBetween, meteorTrail, type MeteorTrail } from '../engine/meteors';
import { localFrame, starAltitude } from '../engine/sky';
import type { StarSystem } from '../engine/types';
import { add, scale, unit } from '../engine/vec';
import { altAzFromDir, makeProjector, type Camera } from '../render/projection';
import { toLocal } from '../render/scene';
import type { Landscape } from '../render/terrain';
import { opticalWeather } from './observing';
import { skyline } from './skyObservation';
import type { GameState } from './store';

export const METEOR_EXPOSURE = 90;
export const METEOR_PHOTO_LIMIT = 8;
type Observer = Pick<GameState, 'seed' | 'settings'>;
export interface MeteorPhoto {
  at: number;
  camera: Camera;
  trails: MeteorTrail[];
}

function viewWeather(sys: StarSystem, s: Observer, at: number) {
  const { cloudy, flare } = opticalWeather(sys, s, at);
  return flare ? 'Flare glare obscures the sky.' : cloudy ? 'Clouds cover the sky.' :
    starAltitude(sys, at, sys.site) > -8 * DEG ? 'The sky is too bright to see a shower clearly.' : null;
}

export function meteorWatchStatus(sys: StarSystem, s: Observer, at: number) {
  const reason = viewWeather(sys, s, at);
  if (reason) return { available: false, active: false, text: reason };
  const shower = meteorActivity(sys, at);
  if (!shower) return { available: true, active: false, text: 'Clear dark sky · no shower activity right now.' };
  const up = toLocal(shower.radiant, localFrame(sys, at, sys.site))[2];
  return up > 0
    ? { available: true, active: true, text: 'Meteor shower active. Look across the wide sky.' }
    : { available: true, active: false, text: 'The shower’s radiant is below the horizon.' };
}

export function visibleMeteorTrails(sys: StarSystem, s: Observer, now: number) {
  if (!meteorActivity(sys, now) || viewWeather(sys, s, now)) return [];
  const frame = localFrame(sys, now, sys.site);
  return meteorsBetween(sys, now - METEOR_LOOKBACK, now).flatMap((event) => {
    if (toLocal(event.radiant, frame)[2] <= 0 || viewWeather(sys, s, event.at)) return [];
    const trail = liveMeteorTrail(event, now);
    return trail ? [{ ...trail, from: toLocal(trail.from, frame), to: toLocal(trail.to, frame) }] : [];
  });
}

export function exposeMeteorPhoto(sys: StarSystem, s: Observer, camera: Camera, land: Landscape, start: number, end: number): MeteorPhoto | null {
  const projector = makeProjector(camera);
  const trails: MeteorTrail[] = [];
  for (const event of meteorsBetween(sys, start, end)) {
    if (viewWeather(sys, s, event.at)) continue;
    const frame = localFrame(sys, event.at, sys.site);
    if (toLocal(event.radiant, frame)[2] <= 0) continue;
    const progress = Math.min(1, (end - event.at) / event.duration);
    const trail = meteorTrail(event, progress, 1, true);
    const from = toLocal(trail.from, frame), to = toLocal(trail.to, frame);
    const a = projector.project(from), b = projector.project(to);
    if (!a || !b || Math.hypot(a.x - b.x, a.y - b.y) < 2) continue;
    const seen = [0, .125, .25, .375, .5, .625, .75, .875, 1].some((f) => {
      const direction = unit(add(scale(from, 1 - f), scale(to, f)));
      const p = projector.project(direction), { alt, az } = altAzFromDir(direction);
      return !!p && p.x >= 0 && p.x <= camera.w && p.y >= 0 && p.y <= camera.h && alt > skyline(land, az);
    });
    if (seen) trails.push({ ...trail, from, to });
  }
  return trails.length ? { at: start + (end - start) / 2, camera: { ...camera }, trails } : null;
}
