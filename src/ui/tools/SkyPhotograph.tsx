import { useEffect, useRef } from 'react';
import type { AuroraRibbon } from '../../engine/aurora';
import type { MeteorTrail } from '../../engine/meteors';
import type { currentWorld } from '../../game/sim';
import { paintSky } from '../../render/paint';
import type { Camera } from '../../render/projection';
import type { Landscape } from '../../render/terrain';

export function SkyPhotograph({ at, camera, land, system, catalog, label, meteors, aurora }: {
  at: number; camera: Camera; land: Landscape; label: string;
  meteors?: readonly MeteorTrail[]; aurora?: readonly AuroraRibbon[];
} & Pick<ReturnType<typeof currentWorld>, 'system' | 'catalog'>) {
  const surface = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = surface.current, ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const factor = 960 / Math.max(camera.w, camera.h);
    const w = Math.max(1, Math.round(camera.w * factor)), h = Math.max(1, Math.round(camera.h * factor));
    canvas.width = w;
    canvas.height = h;
    paintSky(ctx, { ...camera, w, h }, system, catalog, land, at, 0, Math.max(w, h) / 680,
      { meteors, aurora, reduceFlicker: true });
  }, [at, camera, land, system, catalog, meteors, aurora]);
  return <canvas ref={surface} role="img" aria-label={label} />;
}
