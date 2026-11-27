import { DAY, DEG, TAU } from '../engine/constants';
import { localFrame, toHorizontal, topocentric, type CatalogStar } from '../engine/sky';
import type { StarSystem } from '../engine/types';
import { angleBetween, unit, type Vec3 } from '../engine/vec';
import { relaySunlit, relayTopocentric } from '../engine/relay';
import { limitingMag } from '../render/color';
import { makeProjector, type Camera } from '../render/projection';
import type { Landscape } from '../render/terrain';
import { toLocal } from '../render/scene';
import { hash32 } from '../engine/rng';

export type SkyRef = { kind: 'star' | 'target' | 'relay' | 'giant' } | { kind: 'catalog'; i: number };
export interface SkyLight {
  ref: SkyRef; key: string; code: string; dir: Vec3;
  x: number; y: number; alt: number; az: number;
  variation: 'steadier' | 'slight variation' | 'stronger variation'; tint: string;
}
export interface SkySighting {
  id: string; key: string; code: string; at: number;
  lon: number; lat: number; step: number; instrument: 'wide' | 'scope'; note: string;
  /** Angular aiming allowance (degrees) for a centred moving-light sighting. */
  relayPrecision?: number;
}
export const skyKey = (ref: SkyRef) => ref.kind === 'catalog' ? `catalog:${ref.i}` : ref.kind;
/** Stable, neutral labels with no special target ordering or colour dependence. */
export function skyCode(seed: number, ref: SkyRef) {
  const index = ref.kind === 'catalog' ? ref.i + 4 : ['star', 'target', 'relay', 'giant'].indexOf(ref.kind);
  const n = ((index + hash32(seed, 824) % 10007) * (1 + hash32(seed, 825) % 10006)) % 10007;
  return `Light ${n.toString(36).toUpperCase().padStart(3, '0')}`;
}
export function skyDirection(sys: StarSystem, catalog: CatalogStar[], ref: SkyRef, at: number): Vec3 {
  if (ref.kind === 'catalog') return catalog[ref.i]?.dir ?? [0, 0, 1];
  if (ref.kind === 'relay') return unit(relayTopocentric(sys, at, sys.site));
  return unit(topocentric(sys, ref.kind === 'giant' ? 'giant' : ref.kind, at, sys.site));
}
export const skyline = (land: Landscape, az: number) => Math.max(0, ...land.ridges.map((ridge) => ridge.alt(az)));

/** Uses the same daylight limit, skyline and field projection as the wide view. */
export function visibleSkyLights(sys: StarSystem, catalog: CatalogStar[], at: number, camera: Camera, land: Landscape, obscured = false): SkyLight[] {
  if (obscured) return [];
  const frame = localFrame(sys, at, sys.site);
  const sunAlt = toHorizontal(topocentric(sys, 'star', at, sys.site), frame).alt / DEG;
  const lim = limitingMag(sunAlt), projection = makeProjector(camera);
  const refs: SkyRef[] = [{ kind: 'star' }, ...(lim > .5 ? [{ kind: 'target' } as SkyRef] : []), ...(sys.giant && lim > 0 ? [{ kind: 'giant' } as SkyRef] : [])];
  if (sunAlt < -6 && relaySunlit(sys, at) && toHorizontal(relayTopocentric(sys, at, sys.site), frame).alt > 3 * DEG) refs.push({ kind: 'relay' });
  catalog.forEach((star, i) => { if (star.mag < 2.6 && star.mag < lim - .1) refs.push({ kind: 'catalog', i }); });
  const lights: SkyLight[] = [];
  for (const ref of refs) {
    const dir = skyDirection(sys, catalog, ref, at), local = toLocal(dir, frame);
    const horizontal = toHorizontal(dir, frame), point = projection.project(local);
    if (!point || horizontal.alt <= skyline(land, horizontal.az) || point.x < 0 || point.x > camera.w || point.y < 0 || point.y > camera.h) continue;
    const color = ref.kind === 'catalog' ? catalog[ref.i].color : ref.kind === 'giant' ? [1, .9, .7] : [.7, .85, 1];
    lights.push({ ref, key: skyKey(ref), code: skyCode(sys.seed, ref), dir, x: point.x, y: point.y, alt: horizontal.alt, az: horizontal.az,
      variation: ref.kind === 'catalog' ? horizontal.alt < 30 * DEG ? 'stronger variation' : 'slight variation' : 'steadier',
      tint: color[0] > color[2] * 1.1 ? 'warm tint' : color[2] > color[0] * 1.1 ? 'cool tint' : 'pale tint' });
  }
  return lights.sort((a, b) => a.x - b.x || a.y - b.y);
}

let nextSighting = Date.now();
/** The supplied ray is the observer's pointing, not an orbital prediction. */
export function makeSkySighting(key: string, code: string, at: number, ray: Vec3, instrument: 'wide' | 'scope', note = ''): SkySighting | null {
  if (!Number.isFinite(at) || at < 0 || !key || !code || !ray.every(Number.isFinite) || Math.hypot(...ray) < .5) return null;
  const step = instrument === 'scope' ? .005 : .1, dir = unit(ray);
  const lon = (Math.round((((Math.atan2(dir[1], dir[0]) % TAU) + TAU) % TAU) / DEG / step) * step) % 360;
  const lat = Math.round(Math.asin(Math.max(-1, Math.min(1, dir[2]))) / DEG / step) * step;
  return { id: String(nextSighting++), key, code, at, lon, lat, step, instrument, note: note.slice(0, 240) };
}
const direction = (s: SkySighting): Vec3 => [Math.cos(s.lat * DEG) * Math.cos(s.lon * DEG), Math.cos(s.lat * DEG) * Math.sin(s.lon * DEG), Math.sin(s.lat * DEG)];
export function sightingChange(a: SkySighting, b: SkySighting) { return angleBetween(direction(a), direction(b)) / DEG; }
export function sightingSeries(notes: SkySighting[], key: string) {
  const sorted = notes.filter((n) => n.key === key).sort((a, b) => a.at - b.at);
  return sorted.map((n, i) => ({ id: n.id, x: n.at / DAY + 1, y: i ? sightingChange(sorted[0], n) : 0 }));
}
