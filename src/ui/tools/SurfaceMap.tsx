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
import { FIND_TEXT, collectFind } from '../../game/finds';
import {
  ICE_LOAD_DV,
  ROVER_KMH,
  ROVER_RANGE,
  STRIP,
  SURFACE_RULES,
  TOW_KMH,
  findsFor,
  safePad,
  spareFuel,
  terrainFor,
} from '../../game/surface';
import { CanvasView, canvasPoint } from '../common/CanvasView';
import { drawStarship } from '../../render/ship';
import { drawRover } from '../../render/rover';
import { hopBudget, hopEstimate, hopParams } from '../../engine/hop';
import { hasChallenge } from '../../game/challenges';
import { ToolHeader } from '../common/sheetBits';
import { toast, useGameTime } from '../common/widgets';

export function SurfaceMap() {
  const { system: sys } = currentWorld();
  const s = useGame();
  const t = useGameTime(4);
  const mode = useMode();
  const rules = SURFACE_RULES[s.settings.difficulty];
  const tr = useMemo(() => terrainFor(sys), [sys]);
  const finds = useMemo(() => findsFor(sys.seed), [sys]);
  const [target, setTarget] = useState<number | null>(null);
  const view = useRef({
    cx: s.camp?.x ?? 0,
    span: 30e3,
    drag: null as null | { x: number; cx: number; moved: boolean },
    pts: new Map<number, number>(),
    pinch: null as null | { d: number; span: number },
  });
  const sf = s.surface;
  const campX = s.camp?.x ?? 0;
  const roverX = sf.roverX ?? campX;
  const kmh = ROVER_KMH * (hasChallenge(s, 'rover') ? 0.5 : 1);
  const busy = !!sf.task && sf.task.done > t;
  const g = surfaceGravity(sys);
  const hopTank = sf.hopTank < 0 ? rules.hopTank : sf.hopTank;
  const iceCap = rules.isruCap * spareFuel(sys);
  const nearIce = (s.camp?.iceKm ?? 99) < 1;
  const atFind = finds.find((f) => sf.found.includes(f.id) && !sf.collected.includes(f.id) && Math.abs(f.x - roverX) < 300);

  // Ice goes to the hop tank in modes where only ice refills it; otherwise to launch fuel (capped).
  const iceToHop = rules.hopRefill === 'ice' && hopTank < rules.hopTank;
  const iceCapped = !iceToHop && sf.fuelMade >= iceCap;
  const haulCharge = 2 * (s.camp?.iceKm ?? 0) * 1000;
  // The other rover job (the long trips north and east) uses the same rover.
  const longTrip = s.northTrip.dist > 0 || s.northTrip.arriveAt > t || s.rover.dist > 0 || s.rover.arriveAt > t;

  /** Where to draw the rover now: moving along during a drive or haul. */
  const roverShownAt = (now: number): number | null => {
    const task = sf.task;
    if (task && task.done > now && (task.kind === 'drive' || task.kind === 'haul')) {
      const from = sf.roverX ?? campX;
      const to = task.kind === 'drive' ? (task.toX ?? campX) : null;
      const start = task.start ?? now;
      const f = Math.max(0, Math.min(1, (now - start) / Math.max(1, task.done - start)));
      if (to !== null) return from + (to - from) * f;
      // A haul: out to the ice and back.
      const ice = tr.features.find((q) => q.kind === 'ice')!;
      const iceX = campX < ice.x0 ? ice.x0 : campX > ice.x1 ? ice.x1 : campX;
      return campX + (iceX - campX) * (1 - Math.abs(1 - 2 * f));
    }
    return sf.roverX;
  };

  const startTask = (kind: 'drive' | 'tow' | 'haul' | 'process', hours: number, toX?: number) => {
    useGame.setState({ surface: { ...sf, hopTank, task: { kind, toX, start: clock.t, done: clock.t + hours * HOUR } } });
    sfx('click');
  };

  const drive = () => {
    if (target === null) return;
    if (longTrip) return toast('The rover is away on the long trip (shadow stick or parallax). Bring it back first.');
    const dist = Math.abs(target - roverX);
    const backHome = Math.abs(target - campX);
    if (dist + backHome > sf.roverBattery && Math.abs(target - campX) > 200) return toast('Not enough charge to get there and back. Recharge at camp first.');
    startTask('drive', dist / 1000 / kmh, target);
    toast(`Rover driving ${fmt(dist / 1000, 1)} km (${fmt(dist / 1000 / kmh, 1)} h)`);
  };

  const tow = () => {
    const dist = Math.abs(roverX - campX);
    startTask('tow', dist / 1000 / TOW_KMH);
    toast(`Towing the camp ${fmt(dist / 1000, 1)} km — about ${fmt(dist / 1000 / TOW_KMH / 24, 1)} days`);
  };

  // A hop as the ship really flies it: the fuel a good pilot uses, and the tank load for flying it by hand.
  const hopInfo = useMemo(() => {
    if (target === null) return null;
    const p = hopParams(g, mode.landingAssist);
    const d = Math.abs(target - campX);
    return { est: hopEstimate(p, d).cost, budget: hopBudget(p, d) };
  }, [target, campX, g, mode.landingAssist]);

  const hop = () => {
    if (target === null || !hopInfo) return;
    const { est, budget } = hopInfo;
    const fromLaunch = Math.max(0, budget - hopTank);
    // Ask only when even a decent flight may dip into the launch fuel.
    const likely = hopTank < 1.5 * est;
    if (
      fromLaunch > 0 &&
      likely &&
      !confirm(
        `Flown well, this hop takes about ${fmt(est, 0)} m/s. ${hopTank > 0 ? `The hop tank has ${fmt(hopTank, 0)} m/s; anything` : 'Anything'} more you burn comes out of the launch fuel (up to ${fmt(fromLaunch, 0)} m/s). Go?`,
      )
    )
      return;
    if (sf.roverX !== null) toast('The rover stays where it is parked. Drive it to the new camp, or bring it home from the map.');
    // Land on the nearest ground flat enough for the legs.
    const pad = safePad(tr, target);
    if (Math.abs(pad - target) > 20) toast(`ECHO marked a flat pad ${fmt(Math.abs(pad - target), 0)} m from your spot.`);
    useGame.setState({
      surface: { ...sf, hopTank },
      hop: { toX: pad, cost: est, fromX: campX, budget },
      phase: 'hop',
    });
    sfx('launch');
  };

  // With too little charge the rover still gets home: it waits for its solar wing on the way (about 1 h per km short).
  const bringHome = () => {
    const dist = Math.abs(roverX - campX);
    const short = Math.max(0, dist - sf.roverBattery);
    startTask('drive', dist / 1000 / kmh + short / 1000, campX);
  };

  const collect = collectFind;

  return (
    <div className="tool">
      <div className="tool-stage" style={{ background: 'linear-gradient(#1b2a4a, #3d4560)' }}>
        <CanvasView
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            const v = view.current;
            v.pts.set(e.pointerId, e.clientX);
            if (v.pts.size === 2) {
              // Two fingers: pinch to zoom (and no tap or pan from this gesture).
              const [a, b] = [...v.pts.values()];
              v.pinch = { d: Math.max(10, Math.abs(a - b)), span: v.span };
              v.drag = null;
            } else if (v.pts.size === 1) v.drag = { x: e.clientX, cx: v.cx, moved: false };
          }}
          onPointerMove={(e) => {
            const v = view.current;
            if (v.pts.has(e.pointerId)) v.pts.set(e.pointerId, e.clientX);
            if (v.pinch && v.pts.size >= 2) {
              const [a, b] = [...v.pts.values()];
              v.span = Math.max(4e3, Math.min(80e3, (v.pinch.span * v.pinch.d) / Math.max(10, Math.abs(a - b))));
              return;
            }
            const d = v.drag;
            if (!d) return;
            const c = e.currentTarget;
            const mpp = view.current.span / c.clientWidth;
            if (Math.abs(e.clientX - d.x) > 4) d.moved = true;
            view.current.cx = Math.max(-STRIP, Math.min(STRIP, d.cx - (e.clientX - d.x) * mpp));
          }}
          onPointerCancel={(e) => {
            view.current.pts.delete(e.pointerId);
            if (view.current.pts.size < 2) view.current.pinch = null;
            view.current.drag = null;
          }}
          onPointerUp={(e) => {
            const v = view.current;
            v.pts.delete(e.pointerId);
            if (v.pinch) {
              if (v.pts.size < 2) v.pinch = null;
              v.drag = null;
              return;
            }
            const d = v.drag;
            v.drag = null;
            if (d && !d.moved) {
              const c = e.currentTarget;
              const p = canvasPoint(e);
              const x = view.current.cx + ((p.x - c.width / 2) / c.width) * view.current.span;
              setTarget(Math.max(-STRIP, Math.min(STRIP, x)));
            }
          }}
          onWheel={(e) => (view.current.span = Math.max(4e3, Math.min(80e3, view.current.span * (e.deltaY > 0 ? 1.15 : 0.87))))}
          draw={({ ctx, w, h, dpr, now }) => {
            const span = view.current.span;
            const cx = view.current.cx;
            const X = (x: number) => w / 2 + ((x - cx) / span) * w;
            const hmax = 2500;
            const base = h * 0.78;
            const Y = (z: number) => base - (z / hmax) * h * 0.4;
            const sky = ctx.createLinearGradient(0, 0, 0, h);
            sky.addColorStop(0, '#1b2a4a');
            sky.addColorStop(1, '#3d4560');
            ctx.fillStyle = sky;
            ctx.fillRect(0, 0, w, h);
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
            drawStarship(ctx, X(campX), Y(tr.height(campX)) - 13 * dpr, 0, 28 * dpr, { now, legs: 1, shield: false, light: 1 });
            const rx = roverShownAt(t);
            if (rx !== null) drawRover(ctx, X(rx), Y(tr.height(rx)), 30 * dpr, { now, lights: true, flip: busy && (sf.task!.toX ?? campX) < (sf.roverX ?? campX) });
            // Where the rover can reach and still get back to camp on this charge.
            const r0 = sf.roverX ?? campX;
            const lo = Math.min(r0, campX);
            const hi = Math.max(r0, campX);
            const spare = (sf.roverBattery - (hi - lo)) / 2;
            if (spare > 0) {
              ctx.strokeStyle = 'rgba(108,196,255,0.4)';
              ctx.setLineDash([4 * dpr, 4 * dpr]);
              ctx.beginPath();
              ctx.moveTo(X(lo - spare), base + 14 * dpr);
              ctx.lineTo(X(hi + spare), base + 14 * dpr);
              ctx.stroke();
              ctx.setLineDash([]);
            }
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
              <button
                className="btn primary"
                disabled={busy}
                onClick={() => useGame.setState({ driveTarget: target, screen: 'drive' })}
              >
                🕹 Drive the rover there yourself
              </button>
              <button className="btn" disabled={busy} onClick={drive}>
                🚙 Let it drive itself ({fmt(Math.abs(target - roverX) / 1000 / kmh, 1)} h)
              </button>
              <button className="btn" style={{ whiteSpace: 'normal', height: 'auto' }} disabled={busy || Math.abs(target - campX) < 500} onClick={hop}>
                🚀 Hop the ship there (≈{fmt(hopInfo?.est ?? 0, 0)} m/s flown well{rules.hopTank > 0 ? ', hop tank first' : ', launch fuel'})
              </button>
            </div>
          )}
          {!busy && (
            <button className="btn" onClick={() => useGame.setState({ driveTarget: target, screen: 'drive' })}>
              🕹 Take the rover for a drive
            </button>
          )}
          {sf.roverX !== null && !busy && (
            <button className="btn" onClick={tow}>
              ⛺ Tow the camp to the rover (~{fmt(Math.abs(roverX - campX) / 1000 / TOW_KMH / 24, 1)} days, no fuel)
            </button>
          )}
          {sf.roverX !== null && !busy && (
            <button className="btn ghost" onClick={bringHome}>
              Bring the rover home{sf.roverBattery < Math.abs(roverX - campX) ? ' (battery low: it waits for the sun on the way)' : ''}
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
            <button
              className="btn"
              disabled={busy || sf.roverX !== null || longTrip || sf.roverBattery < haulCharge}
              onClick={() => startTask('haul', (2 * (s.camp?.iceKm ?? 0)) / kmh + 2)}
            >
              Haul a load of ice with the rover ({fmt((2 * (s.camp?.iceKm ?? 0)) / kmh + 2, 1)} h)
            </button>
          )}
          {!nearIce && sf.roverX === null && !busy && sf.roverBattery < haulCharge && (
            <div className="faint" style={{ fontSize: 12 }}>
              Not enough charge for the round trip ({fmt(haulCharge / 1000, 1)} km). Let the rover charge at camp.
            </div>
          )}
          <button className="btn primary" disabled={busy || iceCapped || (!nearIce && sf.iceLoads < 1)} onClick={() => startTask('process', rules.isruDays * 24)}>
            Process a load ({rules.isruDays} day{rules.isruDays > 1 ? 's' : ''}{iceToHop ? ', into the hop tank' : ''})
          </button>
          {iceCapped && (
            <div className="faint" style={{ fontSize: 12 }}>
              The launch tanks hold all the ice fuel this mission allows{rules.hopRefill === 'ice' ? '; ice will go to the hop tank once it has room' : ''}.
            </div>
          )}
          <div className="faint" style={{ fontSize: 12 }}>Life support keeps running while you work — that is the real price of fuel.</div>
        </div>
      </div>
    </div>
  );
}

