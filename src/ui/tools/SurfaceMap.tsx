// The landing area: drive the rover to finds, move the camp (tow it, or hop
// the ship) and turn ice into rocket propellant. Every action costs time, and
// hops cost fuel — from the hop tank in the easy modes, launch fuel in Legend.

import { useMemo, useRef, useState } from 'react';
import { HOUR } from '../../engine/constants';
import { surfaceGravity } from '../../engine/measure';
import { sfx } from '../../game/audio';
import { clock } from '../../game/clock';
import { fmt } from '../../game/format';
import { useMode } from '../../game/modes';
import { currentWorld } from '../../game/sim';
import { useGame } from '../../game/store';
import { unlockLog } from '../../game/story';
import {
  ICE_LOAD_DV,
  ROVER_KMH,
  ROVER_RANGE,
  STRIP,
  SURFACE_RULES,
  TOW_KMH,
  findsFor,
  hopCost,
  spareFuel,
  terrainFor,
  type Find,
} from '../../game/surface';
import { CanvasView, canvasPoint } from '../common/CanvasView';
import { ToolHeader } from '../common/sheetBits';
import { toast, useGameTime } from '../common/widgets';

const FIND_TEXT: Record<Find['kind'], { icon: string; name: string; text: string }> = {
  parts: { icon: '🔩', name: 'Wreckage', text: 'A torn hull panel from the crash, with usable parts.' },
  meteorite: { icon: '☄️', name: 'Meteorite', text: 'A heavy, rust-crusted stone — iron and nickel. Meteorites like this are leftovers from when the planets formed.' },
  clue: { icon: '🧰', name: 'Halcyon toolbox', text: 'A dented toolbox stamped HALCYON. Inside: a page of horizon-dip readings in neat handwriting, each with an error bar.' },
};

export function SurfaceMap() {
  const { system: sys } = currentWorld();
  const s = useGame();
  const t = useGameTime(4);
  const mode = useMode();
  const rules = SURFACE_RULES[s.settings.difficulty];
  const tr = useMemo(() => terrainFor(sys), [sys]);
  const finds = useMemo(() => findsFor(sys.seed), [sys]);
  const [target, setTarget] = useState<number | null>(null);
  const view = useRef({ cx: s.camp?.x ?? 0, span: 30e3, drag: null as null | { x: number; cx: number; moved: boolean } });
  const sf = s.surface;
  const campX = s.camp?.x ?? 0;
  const roverX = sf.roverX ?? campX;
  const busy = !!sf.task && sf.task.done > t;
  const g = surfaceGravity(sys);
  const hopTank = sf.hopTank < 0 ? rules.hopTank : sf.hopTank;
  const iceCap = rules.isruCap * spareFuel(sys);
  const nearIce = (s.camp?.iceKm ?? 99) < 1;
  const atFind = finds.find((f) => sf.found.includes(f.id) && !sf.collected.includes(f.id) && Math.abs(f.x - roverX) < 300);

  const startTask = (kind: 'drive' | 'tow' | 'haul' | 'process', hours: number, toX?: number) => {
    useGame.setState({ surface: { ...sf, hopTank, task: { kind, toX, done: clock.t + hours * HOUR } } });
    sfx('click');
  };

  const drive = () => {
    if (target === null) return;
    const dist = Math.abs(target - roverX);
    const backHome = Math.abs(target - campX);
    if (dist + backHome > sf.roverBattery && Math.abs(target - campX) > 200) return toast('Not enough charge to get there and back. Recharge at camp first.');
    startTask('drive', dist / 1000 / ROVER_KMH, target);
    toast(`Rover driving ${fmt(dist / 1000, 1)} km (${fmt(dist / 1000 / ROVER_KMH, 1)} h)`);
  };

  const tow = () => {
    const dist = Math.abs(roverX - campX);
    startTask('tow', dist / 1000 / TOW_KMH);
    toast(`Towing the camp ${fmt(dist / 1000, 1)} km — about ${fmt(dist / 1000 / TOW_KMH / 24, 1)} days`);
  };

  const hop = () => {
    if (target === null) return;
    const cost = hopCost(g, Math.abs(target - campX));
    const fromTank = Math.min(cost, hopTank);
    const fromLaunch = cost - fromTank;
    if (fromLaunch > 0 && !confirm(`This hop costs ${fmt(cost, 0)} m/s. ${fromTank > 0 ? `${fmt(fromTank, 0)} from the hop tank and ` : ''}${fmt(fromLaunch, 0)} m/s from the launch fuel. Go?`)) return;
    useGame.setState({
      surface: { ...sf, hopTank: hopTank - fromTank, roverX: null },
      penaltyDv: s.penaltyDv + fromLaunch,
      hop: { toX: target, cost },
      phase: 'hop',
    });
    sfx('launch');
  };

  const collect = (f: Find) => {
    const patch: Record<string, unknown> = { surface: { ...sf, collected: [...sf.collected, f.id] } };
    if (f.kind === 'parts' && s.settings.survival) patch.survival = { ...s.survival, parts: s.survival.parts + 2 };
    if (f.kind === 'meteorite') useGame.getState().unlock('codex', 'meteorite');
    useGame.setState(patch);
    if (f.kind === 'clue') unlockLog('toolbox');
    toast(`${FIND_TEXT[f.kind].name} collected${f.kind === 'parts' ? (s.settings.survival ? ': +2 spare parts' : '') : ''}`);
    sfx('unlock');
  };

  return (
    <div className="tool">
      <div className="tool-stage" style={{ background: 'linear-gradient(#1b2a4a, #3d4560)' }}>
        <CanvasView
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            view.current.drag = { x: e.clientX, cx: view.current.cx, moved: false };
          }}
          onPointerMove={(e) => {
            const d = view.current.drag;
            if (!d) return;
            const c = e.currentTarget;
            const mpp = view.current.span / c.clientWidth;
            if (Math.abs(e.clientX - d.x) > 4) d.moved = true;
            view.current.cx = Math.max(-STRIP, Math.min(STRIP, d.cx - (e.clientX - d.x) * mpp));
          }}
          onPointerUp={(e) => {
            const d = view.current.drag;
            view.current.drag = null;
            if (d && !d.moved) {
              const c = e.currentTarget;
              const p = canvasPoint(e);
              const x = view.current.cx + ((p.x - c.width / 2) / c.width) * view.current.span;
              setTarget(Math.max(-STRIP, Math.min(STRIP, x)));
            }
          }}
          onWheel={(e) => (view.current.span = Math.max(4e3, Math.min(80e3, view.current.span * (e.deltaY > 0 ? 1.15 : 0.87))))}
          draw={({ ctx, w, h, dpr }) => {
            const span = view.current.span;
            const cx = view.current.cx;
            const X = (x: number) => w / 2 + ((x - cx) / span) * w;
            const hmax = 2500;
            const base = h * 0.78;
            const Y = (z: number) => base - (z / hmax) * h * 0.4;
            ctx.clearRect(0, 0, w, h);
            // Terrain profile.
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let px = 0; px <= w; px += 3 * dpr) ctx.lineTo(px, Y(tr.height(cx + ((px - w / 2) / w) * span)));
            ctx.lineTo(w, h);
            ctx.closePath();
            const gr = ctx.createLinearGradient(0, h * 0.4, 0, h);
            gr.addColorStop(0, '#6b5a41');
            gr.addColorStop(1, '#2c241a');
            ctx.fillStyle = gr;
            ctx.fill();
            // Feature zones.
            ctx.font = `${11 * dpr}px Inter`;
            ctx.textAlign = 'center';
            for (const f of tr.features) {
              const col = f.kind === 'ice' ? '#bfe6ff' : f.kind === 'hill' ? '#ffc46b' : '#5be3a4';
              ctx.fillStyle = col;
              ctx.globalAlpha = 0.18;
              ctx.fillRect(X(f.x0), Y(2400), X(f.x1) - X(f.x0), base - Y(2400) + h);
              ctx.globalAlpha = 1;
              ctx.fillText(f.kind === 'ice' ? 'Ice field' : f.kind === 'hill' ? 'Hill foot' : 'Flat plain', (X(f.x0) + X(f.x1)) / 2, Y(2300));
            }
            ctx.fillStyle = '#ffc46b';
            ctx.fillText('⛰ summit', X(tr.hillX), Y(tr.height(tr.hillX)) - 8 * dpr);
            // Finds the scanner has seen.
            for (const f of finds) {
              if (!sf.found.includes(f.id)) continue;
              const done = sf.collected.includes(f.id);
              ctx.globalAlpha = done ? 0.35 : 1;
              ctx.font = `${16 * dpr}px Inter`;
              ctx.fillText(FIND_TEXT[f.kind].icon, X(f.x), Y(tr.height(f.x)) - 10 * dpr);
              ctx.globalAlpha = 1;
            }
            // Camp and rover.
            ctx.font = `${20 * dpr}px Inter`;
            ctx.fillText('⛺', X(campX), Y(tr.height(campX)) - 6 * dpr);
            if (sf.roverX !== null) ctx.fillText('🚙', X(sf.roverX), Y(tr.height(sf.roverX)) - 6 * dpr);
            // Rover range from camp.
            ctx.strokeStyle = 'rgba(108,196,255,0.4)';
            ctx.setLineDash([4 * dpr, 4 * dpr]);
            ctx.beginPath();
            ctx.moveTo(X(campX - sf.roverBattery / 2), base + 14 * dpr);
            ctx.lineTo(X(campX + sf.roverBattery / 2), base + 14 * dpr);
            ctx.stroke();
            ctx.setLineDash([]);
            if (target !== null) {
              ctx.strokeStyle = '#6cc4ff';
              ctx.lineWidth = 2 * dpr;
              ctx.beginPath();
              ctx.moveTo(X(target), Y(tr.height(target)) - 40 * dpr);
              ctx.lineTo(X(target), Y(tr.height(target)));
              ctx.stroke();
            }
            ctx.fillStyle = 'rgba(255,255,255,0.7)';
            ctx.font = `${11 * dpr}px JetBrains Mono`;
            ctx.textAlign = 'left';
            ctx.fillText(`${fmt((cx - span / 2) / 1000, 0)} km`, 8 * dpr, h - 10 * dpr);
            ctx.textAlign = 'right';
            ctx.fillText(`${fmt((cx + span / 2) / 1000, 0)} km`, w - 8 * dpr, h - 10 * dpr);
          }}
        />
      </div>
      <div className="tool-side">
        <ToolHeader title="Surface map" sub="Drag to pan, scroll or pinch to zoom, tap to choose a spot." />
        <div className="panel panel-pad stack">
          <dl className="kv">
            <dt>Camp</dt>
            <dd>
              {s.camp?.site ?? '—'} · hill {fmt(s.camp?.hillKm ?? 0, 1)} km · ice {fmt(s.camp?.iceKm ?? 0, 1)} km
            </dd>
            <dt>Rover</dt>
            <dd>{sf.roverX === null ? 'at camp' : `${fmt((sf.roverX - campX) / 1000, 1)} km from camp`}</dd>
            <dt>Rover charge</dt>
            <dd>
              {fmt(sf.roverBattery / 1000, 0)} / {fmt(ROVER_RANGE / 1000, 0)} km
            </dd>
            {rules.hopTank > 0 && (
              <>
                <dt>Hop tank</dt>
                <dd>
                  {fmt(hopTank, 0)} / {rules.hopTank} m/s
                </dd>
              </>
            )}
          </dl>
          {busy && <div className="amber" style={{ fontSize: 13 }}>Busy: {sf.task!.kind} — done in {fmt((sf.task!.done - t) / HOUR, 1)} h. Warp time.</div>}
          {target !== null && (
            <div className="stack" style={{ gap: 6 }}>
              <b style={{ fontSize: 13 }}>Chosen spot: {fmt((target - campX) / 1000, 1)} km from camp</b>
              <button className="btn" disabled={busy} onClick={drive}>
                🚙 Drive the rover there ({fmt(Math.abs(target - roverX) / 1000 / ROVER_KMH, 1)} h)
              </button>
              <button className="btn" disabled={busy || Math.abs(target - campX) < 500} onClick={hop}>
                🚀 Hop the ship there ({fmt(hopCost(g, Math.abs(target - campX)), 0)} m/s{rules.hopTank > 0 ? ', hop tank first' : ', launch fuel'})
              </button>
            </div>
          )}
          {sf.roverX !== null && !busy && (
            <button className="btn" onClick={tow}>
              ⛺ Tow the camp to the rover (~{fmt(Math.abs(roverX - campX) / 1000 / TOW_KMH / 24, 1)} days, no fuel)
            </button>
          )}
          {sf.roverX !== null && !busy && (
            <button className="btn ghost" onClick={() => startTask('drive', Math.abs(roverX - campX) / 1000 / ROVER_KMH, campX)}>
              Bring the rover home
            </button>
          )}
          {atFind && (
            <div className="callout tip" style={{ margin: 0 }}>
              <b>
                {FIND_TEXT[atFind.kind].icon} {FIND_TEXT[atFind.kind].name}
              </b>
              <div style={{ fontSize: 13 }}>{FIND_TEXT[atFind.kind].text}</div>
              <button className="btn small" style={{ marginTop: 6 }} onClick={() => collect(atFind)}>
                Collect
              </button>
            </div>
          )}
          {mode.coaching && <div className="hint">The rover’s scanner reveals finds within 1.5 km of its path. Moving the camp next to the hill shortens every climb; next to the ice, the fuel plant needs no hauling.</div>}
        </div>
        <div className="panel panel-pad stack">
          <b>Fuel from ice</b>
          <div className="muted" style={{ fontSize: 13 }}>
            Split water ice with solar power into hydrogen and oxygen — real rocket propellant. Each load gives {ICE_LOAD_DV} m/s and takes {rules.isruDays} day
            {rules.isruDays > 1 ? 's' : ''}. This system’s ice can add at most {fmt(iceCap, 0)} m/s.
          </div>
          <dl className="kv">
            <dt>Made so far</dt>
            <dd>{fmt(sf.fuelMade, 0)} m/s</dd>
            <dt>Loads waiting</dt>
            <dd>{nearIce ? 'camp is at the ice' : sf.iceLoads}</dd>
          </dl>
          {!nearIce && (
            <button className="btn" disabled={busy || sf.roverX !== null} onClick={() => startTask('haul', (2 * (s.camp?.iceKm ?? 0)) / ROVER_KMH + 2)}>
              Haul a load of ice with the rover ({fmt((2 * (s.camp?.iceKm ?? 0)) / ROVER_KMH + 2, 1)} h)
            </button>
          )}
          <button className="btn primary" disabled={busy || sf.fuelMade >= iceCap || (!nearIce && sf.iceLoads < 1)} onClick={() => startTask('process', rules.isruDays * 24)}>
            Process a load ({rules.isruDays} day{rules.isruDays > 1 ? 's' : ''})
          </button>
          {sf.fuelMade >= iceCap && <div className="faint" style={{ fontSize: 12 }}>The usable ice here is used up.</div>}
          <div className="faint" style={{ fontSize: 12 }}>Life support keeps running while you work — that is the real price of fuel.</div>
        </div>
      </div>
    </div>
  );
}

