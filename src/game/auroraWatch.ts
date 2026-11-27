import { auroraRibbons, auroraStorm, type AuroraRibbon } from '../engine/aurora';
import { DEG } from '../engine/constants';
import { starAltitude } from '../engine/sky';
import type { StarSystem } from '../engine/types';
import { add, scale, unit, type Vec3 } from '../engine/vec';
import { altAzFromDir, makeProjector, type Camera } from '../render/projection';
import type { Landscape } from '../render/terrain';
import { opticalWeather } from './observing';
import { skyline } from './skyObservation';
import type { GameState } from './store';

type Observer = Pick<GameState, 'seed' | 'settings'>;

export interface AuroraPhoto { at: number; phase: number; camera: Camera }
export interface AuroraView {
  ribbons: AuroraRibbon[];
  direction: Vec3 | null;
  reason: string;
}

export function auroraView(sys: StarSystem, state: Observer, land: Landscape, at: number, phase: number): AuroraView {
  const none = (reason: string): AuroraView => ({ ribbons: [], direction: null, reason });
  if (sys.features.real) return none('No global auroral oval is modeled at this camp.');
  const storm = auroraStorm(sys, at);
  const { cloudy, flare } = opticalWeather(sys, state, at);
  if (flare || cloudy) return none(flare ? 'Flare glare obscures the sky.' : 'Clouds cover the sky.');
  const darkness = Math.min(1, Math.max(0, (-starAltitude(sys, at, sys.site) / DEG - 8) / 9));
  if (darkness === 0) return none('The sky is too bright for the curtains to stand out.');
  if (!storm) return none('Clear dark sky · no auroral activity right now.');
  const ribbons = auroraRibbons(sys, storm, phase, darkness);
  let direction: Vec3 | null = null, best = 0;
  let center: Vec3 = [0, 0, 0];
  for (const ribbon of ribbons) for (const r of ribbon) {
    const sight = unit(add(scale(r.middle, .75), scale(r.upper, .25)));
    const { alt, az } = altAzFromDir(sight);
    const clear = alt - skyline(land, az);
    const quality = r.brightness * Math.min(1, Math.max(0, clear / (4 * DEG)));
    if (quality <= .08) continue;
    center = add(center, scale(sight, quality ** 2));
    if (quality > best) { best = quality; direction = sight; }
  }
  if (direction) {
    const middle = unit(center), { alt, az } = altAzFromDir(middle);
    if (alt > skyline(land, az)) direction = middle;
  }
  return direction ? { ribbons, direction, reason: 'Aurora visible. Look for the glow above the horizon.' }
    : none('The auroral glow is too low to see above the skyline.');
}

export function auroraInFrame(view: AuroraView, camera: Camera, land: Landscape) {
  const projection = makeProjector(camera);
  return view.ribbons.some((ribbon) => ribbon.some((r) => r.brightness > .09 && [r.middle, unit(add(r.middle, r.upper))].some((ray) => {
    const p = projection.project(ray);
    if (!p || p.x < 0 || p.y < 0 || p.x > camera.w || p.y > camera.h) return false;
    const { alt, az } = altAzFromDir(ray);
    return alt > skyline(land, az);
  })));
}
