// Convenience wrapper: build the scene for time t and draw the wide sky.

import { blackbodyRGB } from '../engine/sky';
import type { CatalogStar } from '../engine/sky';
import type { StarSystem } from '../engine/types';
import type { RGB } from './color';
import type { Camera } from './projection';
import { buildScene } from './scene';
import { drawSky, eclipticCircle, type SkyOptions } from './skyDraw';
import type { Landscape } from './terrain';

export const starRGB = (sys: StarSystem): RGB => blackbodyRGB(sys.star.temperature).map((c) => c * 255) as RGB;

export function paintSky(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  sys: StarSystem,
  catalog: CatalogStar[],
  land: Landscape | null,
  t: number,
  now: number,
  dpr: number,
  extra: Partial<SkyOptions> = {},
) {
  const scene = buildScene(sys, catalog, t);
  const P = drawSky(ctx, cam, scene, catalog, land, {
    realTime: now,
    starColor: starRGB(sys),
    starAngularRadius: Math.asin(sys.star.radius / scene.sunDist),
    mars: !!sys.features.real,
    dpr,
    eclipticDirs: extra.showEcliptic ? eclipticCircle(scene) : undefined,
    ...extra,
  });
  return { scene, P };
}
