// Fly the ascent to parking orbit yourself (or hand it to ECHO at any time).
// The orbit you are on is drawn live, with apoapsis and periapsis. Fuel you
// waste compared with ECHO's profile comes out of the ship's Δv budget.

import { useEffect, useMemo, useRef, useState } from 'react';
import { G } from '../../engine/constants';
import { apsides, ascentStart, autopilot, autopilotDv, inOrbit, stepAscent, type AscentParams } from '../../engine/ascent';
import { simulateLaunch } from '../../engine/launch';
import { setRumble, sfx, stopRumble } from '../../game/audio';
import { fmt } from '../../game/format';
import { useMode } from '../../game/modes';
import { currentWorld } from '../../game/sim';
import { useGame } from '../../game/store';
import { CanvasView } from '../common/CanvasView';

const SPEED = 20; // simulated seconds per real second

export function Ascent() {
  const s = useGame();
  const { system: sys } = currentWorld();
  const mode = useMode();
  const pending = s.pendingLaunch!;
  const params: AscentParams = useMemo(() => {
    const g = (G * sys.home.mass) / sys.home.radius ** 2;
    return { mu: G * sys.home.mass, R: sys.home.radius, rho0: 1.1, scaleH: 8500, thrust: 2.2 * g, cda: 0.0004, orbitAlt: 200e3 };
  }, [sys]);
  const baseline = useMemo(() => autopilotDv(params), [params]);
  const st = useRef(ascentStart(params));
  const input = useRef({ up: false, down: false, thrust: false });
  const [auto, setAuto] = useState(false);
  const autoRef = useRef(false);
  autoRef.current = auto;
  const [hud, setHud] = useState({ h: 0, v: 0, apo: 0, peri: 0, pitch: 90, dv: 0 });
  const [done, setDone] = useState<null | { dv: number; penalty: number; auto: boolean }>(null);
  const trail = useRef<{ r: number; th: number }[]>([]);
  // Wasted Δv is capped in the forgiving modes.
  const cap = mode.landingAssist ? (mode.rewinds === Infinity ? 300 : mode.rewinds > 0 ? 500 : 800) : Infinity;

  useEffect(() => {
    const set = (e: KeyboardEvent, v: boolean) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') input.current.down = v;
      else if (k === 'arrowright' || k === 'd') input.current.up = v;
      else if (k === 'arrowup' || k === 'w' || k === ' ') input.current.thrust = v;
      else return;
      e.preventDefault();
    };
    const d = (e: KeyboardEvent) => set(e, true);
    const u = (e: KeyboardEvent) => set(e, false);
    window.addEventListener('keydown', d);
    window.addEventListener('keyup', u);
    const id = setInterval(() => {
      const x = st.current;
      const a = apsides(params, x);
      setHud({ h: x.r - params.R, v: Math.hypot(x.vr, x.vt), apo: a.apo - params.R, peri: a.peri - params.R, pitch: (x.pitch * 180) / Math.PI, dv: x.dv });
    }, 100);
    return () => {
      window.removeEventListener('keydown', d);
      window.removeEventListener('keyup', u);
      clearInterval(id);
      stopRumble();
    };
  }, [params]);

  const finish = (usedAuto: boolean) => {
    const x = st.current;
    const penalty = Math.max(-150, Math.min(cap, x.dv - baseline));
    setDone({ dv: x.dv, penalty, auto: usedAuto });
    stopRumble();
    sfx(penalty < 200 ? 'unlock' : 'good');
  };

  const proceed = () => {
    const penalty = done?.penalty ?? 0;
    const g = useGame.getState();
    const budget = sys.fuelDv - g.penaltyDv - penalty;
    const result = simulateLaunch({ ...sys, fuelDv: budget }, pending.plan);
    useGame.setState({ penaltyDv: g.penaltyDv + penalty, ascentPenalty: penalty, outcome: { plan: pending.plan, result, sheet: g.sheet }, pendingLaunch: null, phase: 'flight' });
  };

  function update(dt: number) {
    if (done) return;
    let x = st.current;
    const n = Math.ceil((dt * SPEED) / 0.05);
    for (let i = 0; i < n; i++) {
      const u = autoRef.current
        ? autopilot(params, x)
        : { pitchRate: (input.current.up ? 0.35 : 0) - (input.current.down ? 0.35 : 0), throttle: input.current.thrust ? 1 : 0 };
      x = stepAscent(params, x, u, (dt * SPEED) / n);
      if (inOrbit(params, x)) break;
    }
    st.current = x;
    const thr = autoRef.current ? autopilot(params, x).throttle : input.current.thrust ? 1 : 0;
    setRumble(thr * 0.7, 0.3);
    if (trail.current.length === 0 || Math.abs(trail.current[trail.current.length - 1].th - x.th) > 0.002) trail.current.push({ r: x.r, th: x.th });
    if (inOrbit(params, x)) finish(autoRef.current);
    // Falling back, or far over budget: ECHO takes over.
    else if (!autoRef.current && ((x.t > 60 && x.vr < -50 && x.r - params.R < 30e3) || x.dv > baseline * 1.8)) {
      setAuto(true);
      sfx('bad');
    }
  }

  return (
    <div className="screen">
      <CanvasView
        draw={({ ctx, w, h, dpr, dt }) => {
          update(Math.min(dt, 0.05));
          const x = st.current;
          ctx.fillStyle = '#03050b';
          ctx.fillRect(0, 0, w, h);
          // Camera: zoom out as we climb.
          const span = Math.max(40e3, (x.r - params.R) * 3.2 + 30e3, 0);
          const scale = Math.min(w, h) / span;
          const cx = w / 2;
          const cy = h * 0.55;
          const sx = (r: number, th: number) => cx + (r * Math.sin(th) - (x.r * Math.sin(x.th))) * scale;
          const sy = (r: number, th: number) => cy - (r * Math.cos(th) - x.r * Math.cos(x.th)) * scale;
          // Atmosphere glow and the planet.
          const pcx = sx(0, 0);
          const pcy = sy(0, 0);
          const atm = ctx.createRadialGradient(pcx, pcy, params.R * scale, pcx, pcy, (params.R + 60e3) * scale);
          atm.addColorStop(0, 'rgba(120,170,255,0.45)');
          atm.addColorStop(1, 'rgba(120,170,255,0)');
          ctx.fillStyle = atm;
          ctx.beginPath();
          ctx.arc(pcx, pcy, (params.R + 60e3) * scale, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#5b5240';
          ctx.beginPath();
          ctx.arc(pcx, pcy, params.R * scale, 0, Math.PI * 2);
          ctx.fill();
          // Target orbit.
          ctx.strokeStyle = 'rgba(91,227,164,0.35)';
          ctx.setLineDash([6 * dpr, 6 * dpr]);
          ctx.beginPath();
          ctx.arc(pcx, pcy, (params.R + params.orbitAlt) * scale, 0, Math.PI * 2);
          ctx.stroke();
          ctx.setLineDash([]);
          // The orbit we are on now (a Kepler ellipse), drawn ahead.
          const a = apsides(params, x);
          if (Number.isFinite(a.apo)) {
            ctx.strokeStyle = 'rgba(108,196,255,0.7)';
            ctx.lineWidth = 1.5 * dpr;
            ctx.beginPath();
            let px = x;
            for (let i = 0; i < 400; i++) {
              px = stepAscent({ ...params, rho0: 0 }, px, { pitchRate: 0, throttle: 0 }, 8);
              if (px.r < params.R) break;
              const X = sx(px.r, px.th);
              const Y = sy(px.r, px.th);
              if (i === 0) ctx.moveTo(X, Y);
              else ctx.lineTo(X, Y);
            }
            ctx.stroke();
          }
          // Trail.
          ctx.strokeStyle = '#ffc46b';
          ctx.lineWidth = 2 * dpr;
          ctx.beginPath();
          trail.current.forEach((p, i) => (i ? ctx.lineTo(sx(p.r, p.th), sy(p.r, p.th)) : ctx.moveTo(sx(p.r, p.th), sy(p.r, p.th))));
          ctx.stroke();
          // Ship: pointing along pitch (above local horizontal, prograde to the right).
          const dir = x.th + Math.PI / 2 - x.pitch; // angle from "up" of the screen
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(dir);
          ctx.fillStyle = '#e8eefc';
          ctx.beginPath();
          ctx.moveTo(0, -10 * dpr);
          ctx.lineTo(5 * dpr, 7 * dpr);
          ctx.lineTo(-5 * dpr, 7 * dpr);
          ctx.closePath();
          ctx.fill();
          const thr = auto ? autopilot(params, x).throttle : input.current.thrust ? 1 : 0;
          if (thr > 0 && !done) {
            ctx.fillStyle = 'rgba(255,170,80,0.9)';
            ctx.beginPath();
            ctx.moveTo(-3 * dpr, 7 * dpr);
            ctx.lineTo(3 * dpr, 7 * dpr);
            ctx.lineTo(0, (18 + Math.random() * 6) * dpr);
            ctx.closePath();
            ctx.fill();
          }
          ctx.restore();
        }}
      />
      <div className="prologue-echo panel">
        <span className="mono blue" style={{ fontSize: 11, letterSpacing: '0.14em' }}>
          ECHO
        </span>
        <div>
          {done
            ? done.auto
              ? 'Orbit. I flew it — the departure burn comes next.'
              : `Orbit achieved. You used ${fmt(done.dv / 1000, 2)} km/s; my profile takes ${fmt(baseline / 1000, 2)}.`
            : auto
              ? 'I have it. Gravity turn, coast to the top, then a burn along the horizon to raise the low point.'
              : 'Climb straight up, then lean east steadily. When the blue line’s high point reaches the green orbit, cut the engine, coast up, and burn flat along the horizon to lift the low point out of the air.'}
        </div>
      </div>
      <div className="prologue-hud panel">
        <dl className="kv">
          <dt>Altitude</dt>
          <dd>{fmt(hud.h / 1000, 1)} km</dd>
          <dt>Speed</dt>
          <dd>{fmt(hud.v / 1000, 2)} km/s</dd>
          <dt>High point</dt>
          <dd>{Number.isFinite(hud.apo) ? `${fmt(hud.apo / 1000, 0)} km` : 'escape'}</dd>
          <dt>Low point</dt>
          <dd className={hud.peri > 0.7 * params.orbitAlt ? 'green' : ''}>{fmt(hud.peri / 1000, 0)} km</dd>
          <dt>Pitch</dt>
          <dd>{fmt(hud.pitch, 0)}°</dd>
          <dt>Δv used</dt>
          <dd>{fmt(hud.dv / 1000, 2)} km/s</dd>
        </dl>
        <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>
          Orbit when the low point is above {fmt((0.7 * params.orbitAlt) / 1000, 0)} km. ECHO’s profile: {fmt(baseline / 1000, 2)} km/s.
        </div>
      </div>
      {!done && (
        <div className="prologue-controls">
          <div className="row" style={{ gap: 10 }}>
            <HoldBtn label="⤴" aria="Pitch up" on={(v) => (input.current.down = v)} />
            <HoldBtn label="⤵" aria="Pitch over" on={(v) => (input.current.up = v)} />
          </div>
          <div className="row" style={{ gap: 10 }}>
            {!auto && (
              <button className="btn" onClick={() => setAuto(true)}>
                Let ECHO fly
              </button>
            )}
            <HoldBtn label="BURN" aria="Burn" big on={(v) => (input.current.thrust = v)} />
          </div>
        </div>
      )}
      {done && (
        <div className="title-wrap">
          <div className="intro-card panel">
            <div className="meter-label">Parking orbit</div>
            <h2>{done.penalty <= 50 ? 'A clean ascent' : done.penalty <= 400 ? 'In orbit' : 'In orbit — the hard way'}</h2>
            <div style={{ margin: '6px 0 12px' }}>
              {done.penalty <= 0
                ? `You beat ECHO’s profile by ${fmt(-done.penalty, 0)} m/s — that fuel is saved for corrections.`
                : `That cost ${fmt(done.penalty, 0)} m/s more than ECHO’s profile, taken from the fuel for corrections.`}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn primary" onClick={proceed}>
                Departure burn →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HoldBtn({ label, aria, on, big }: { label: string; aria: string; on: (v: boolean) => void; big?: boolean }) {
  return (
    <button
      className={`btn ${big ? 'amber big' : 'icon-big'}`}
      aria-label={aria}
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        on(true);
      }}
      onPointerUp={() => on(false)}
      onPointerCancel={() => on(false)}
      onPointerLeave={() => on(false)}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label}
    </button>
  );
}
