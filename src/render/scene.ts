// Snapshot of where everything is in the local sky at one instant.

import { DEG } from '../engine/constants';
import { localFrame, milkyWay, topocentric, type CatalogStar, type LocalFrame } from '../engine/sky';
import type { Site, StarSystem } from '../engine/types';
import { dot, norm, type Vec3 } from '../engine/vec';
import type { Dir } from './projection';

export interface Scene {
  t: number;
  frame: LocalFrame;
  sun: Dir;
  sunAltDeg: number;
  target: Dir;
  targetDist: number;
  moon: Dir;
  sunDist: number;
  stars: Float32Array; // local (e, n, u) triples for the catalogue
  milky: Float32Array; // local (e, n, u, brightness)
}

export const toLocal = (v: Vec3, f: LocalFrame): Dir => {
  const n = norm(v) || 1;
  return [dot(v, f.east) / n, dot(v, f.north) / n, dot(v, f.up) / n];
};

const starBuf = new Map<number, Float32Array>();
const milkyCache = new Map<number, { src: Float32Array; local: Float32Array }>();

export function buildScene(sys: StarSystem, catalog: CatalogStar[], t: number, site: Site = sys.site): Scene {
  const frame = localFrame(sys, t, site);
  const sunV = topocentric(sys, 'star', t, site);
  const tgtV = topocentric(sys, 'target', t, site);
  const moonV = topocentric(sys, 'moon', t, site);
  let stars = starBuf.get(catalog.length);
  if (!stars) {
    stars = new Float32Array(catalog.length * 3);
    starBuf.set(catalog.length, stars);
  }
  const { east, north, up } = frame;
  for (let i = 0; i < catalog.length; i++) {
    const d = catalog[i].dir;
    stars[i * 3] = d[0] * east[0] + d[1] * east[1] + d[2] * east[2];
    stars[i * 3 + 1] = d[0] * north[0] + d[1] * north[1] + d[2] * north[2];
    stars[i * 3 + 2] = d[0] * up[0] + d[1] * up[1] + d[2] * up[2];
  }
  let mw = milkyCache.get(sys.seed);
  if (!mw) {
    mw = { src: milkyWay(sys.seed), local: new Float32Array(0) };
    mw.local = new Float32Array(mw.src.length);
    milkyCache.set(sys.seed, mw);
  }
  for (let i = 0; i < mw.src.length; i += 4) {
    const x = mw.src[i];
    const y = mw.src[i + 1];
    const z = mw.src[i + 2];
    mw.local[i] = x * east[0] + y * east[1] + z * east[2];
    mw.local[i + 1] = x * north[0] + y * north[1] + z * north[2];
    mw.local[i + 2] = x * up[0] + y * up[1] + z * up[2];
    mw.local[i + 3] = mw.src[i + 3];
  }
  const sun = toLocal(sunV, frame);
  return {
    t,
    frame,
    sun,
    sunAltDeg: Math.asin(sun[2]) / DEG,
    target: toLocal(tgtV, frame),
    targetDist: norm(tgtV),
    moon: toLocal(moonV, frame),
    sunDist: norm(sunV),
    stars,
    milky: mw.local,
  };
}
