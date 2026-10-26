import { useMemo, useRef } from 'react';
import { DEG } from '../engine/constants';
import { clock } from '../game/clock';
import { activeMission } from '../game/missions';
import { currentWorld } from '../game/sim';
import { useGame, type Screen } from '../game/store';
import { skyColors } from '../render/color';
import { paintSky } from '../render/paint';
import { drawCampLight, drawRocks, drawStation, type Station, type StationKind } from '../render/stations';
import { makeLandscape } from '../render/terrain';
import { CanvasView } from './common/CanvasView';

interface HubStation extends Station {
  label: string;
  icon: string;
  screen: Screen;
}

export function Hub() {
  const { system: sys, catalog } = currentWorld();
  const survival = useGame((s) => s.settings.survival);
  const go = useGame((s) => s.go);
  const next = useGame((s) => activeMission(s));
  const land = useMemo(() => makeLandscape(sys.seed, sys.hillHeight), [sys]);
  const stations = useMemo<HubStation[]>(() => {
    const list: HubStation[] = [
      { kind: 'observatory', az: 118 * DEG, alt: -2.6 * DEG, size: 7 * DEG, label: 'Observatory', icon: '🔭', screen: 'observatory' },
      { kind: 'pendulum', az: 143 * DEG, alt: -4.5 * DEG, size: 6.5 * DEG, label: 'Pendulum rig', icon: '⏱', screen: 'pendulum' },
      { kind: 'ship', az: 166 * DEG, alt: -6 * DEG, size: 15 * DEG, label: 'Ship · Progress sheet', icon: '🛰', screen: 'sheet' },
      { kind: 'rover', az: 190 * DEG, alt: -3.2 * DEG, size: 4.2 * DEG, label: 'Rover', icon: '🚙', screen: 'rover' },
      { kind: 'hill', az: land.hillAz, alt: land.ridges[1].alt(land.hillAz) - 0.2 * DEG, size: 2.2 * DEG, label: 'The hill', icon: '⛰', screen: 'hill' },
    ];
    if (survival) list.push({ kind: 'workshop' as StationKind, az: 207 * DEG, alt: -3 * DEG, size: 5 * DEG, label: 'Workshop', icon: '🔧', screen: 'workshop' });
    return list;
  }, [land, survival]);
  const tagRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const cam = useRef({ az: 165 * DEG, drag: null as null | { x: number; az: number }, scale: 1 });

  return (
    <div className="screen">
      <CanvasView
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          cam.current.drag = { x: e.clientX, az: cam.current.az };
        }}
        onPointerMove={(e) => {
          const d = cam.current.drag;
          if (d) cam.current.az = d.az - ((e.clientX - d.x) * (window.devicePixelRatio || 1)) / cam.current.scale;
        }}
        onPointerUp={() => (cam.current.drag = null)}
        draw={({ ctx, w, h, dpr, now }) => {
          const portrait = h > w;
          const camera = { az: cam.current.az, alt: (portrait ? 14 : 9) * DEG, fov: (portrait ? 75 : 100) * DEG, w, h };
          const { scene, P } = paintSky(ctx, camera, sys, catalog, land, clock.t, now, dpr);
          cam.current.scale = P.scale;
          const ground = skyColors(scene.sunAltDeg).ground;
          drawRocks(ctx, P, sys.seed, ground, scene.sunAltDeg);
          drawCampLight(ctx, P, 166 * DEG, scene.sunAltDeg);
          stations.forEach((st, i) => {
            const top = drawStation(ctx, P, st, ground, scene.sunAltDeg, now);
            const el = tagRefs.current[i];
            if (!el) return;
            if (!top || top.x < -50 || top.x > w + 50) el.style.display = 'none';
            else {
              el.style.display = 'flex';
              el.style.transform = `translate(${top.x / dpr}px, ${top.y / dpr - 4}px) translate(-50%, -100%)`;
            }
          });
          // Ground fog at the bottom for depth.
          const fog = ctx.createLinearGradient(0, h * 0.75, 0, h);
          fog.addColorStop(0, 'rgba(0,0,0,0)');
          fog.addColorStop(1, 'rgba(0,0,0,0.45)');
          ctx.fillStyle = fog;
          ctx.fillRect(0, h * 0.75, w, h * 0.25);
        }}
      />
      {stations.map((st, i) => (
        <button
          key={st.kind}
          ref={(el) => void (tagRefs.current[i] = el)}
          className="hotspot"
          style={{ transform: 'translate(-9999px,0)' }}
          onClick={() => go(st.screen)}
        >
          <span className={`tag ${next?.screen === st.screen ? 'next' : ''}`}>
            {st.icon} {st.label}
          </span>
          <span className="stem" />
        </button>
      ))}
    </div>
  );
}
