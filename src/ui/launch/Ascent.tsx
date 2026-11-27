// Fly the ascent to parking orbit yourself (or hand it to ECHO at any time).
// The orbit you are on is drawn live, with apoapsis and periapsis. Fuel you
// waste compared with ECHO's profile comes out of the ship's Δv budget.

import { flightAtmosphere } from '../../engine/atmosphere';
import { useEffect, useMemo, useRef, useState } from 'react';
import { G } from '../../engine/constants';
import { apsides, ascentStart, autopilot, autopilotDv, inOrbit, stepAscent, type AscentParams } from '../../engine/ascent';
import { flyTransfer } from '../../game/travelSupplies';
import { setRumble, sfx, stopRumble } from '../../game/audio';
import { fmt } from '../../game/format';
import { useMode } from '../../game/modes';
import { currentWorld } from '../../game/sim';
import { useGame } from '../../game/store';
import { drawStarship } from '../../render/ship';
import { CanvasView } from '../common/CanvasView';
import { FlightAssistDialog, FlightButton, FlightToolbar, useFlightControls } from '../common/FlightControls';
import { flightSensitivity } from '../../game/flightInput';
import { completeManualFlight, manualFlightRequired, markFlightAssisted } from '../../game/piloting';
import { AttitudeIndicator } from '../common/AttitudeIndicator';
import { leaveFlightPractice, startFlightPractice } from '../common/flightPractice';
import { recordTraining } from '../../game/training';

const SPEED = 20; // simulated seconds per real second
/** Pitch change while a control is held (rad per simulated second): ~23° per real second. */
const PITCH_RATE = 0.4 / SPEED;

export function Ascent() {
  const s = useGame();
  const { system: sys } = currentWorld();
  const mode = useMode();
  const pending = s.pendingLaunch!;
  const params: AscentParams = useMemo(() => {
    const g = (G * sys.home.mass) / sys.home.radius ** 2;
    return { mu: G * sys.home.mass, R: sys.home.radius, ...flightAtmosphere(!!sys.features.real), thrust: 2.2 * g, cda: 0.0004, orbitAlt: 200e3 };
  }, [sys]);
  const baseline = useMemo(() => autopilotDv(params), [params]);
  const st = useRef(ascentStart(params));
  const controls = useFlightControls(undefined, true);
  const { input } = controls;
  const manualRequired = manualFlightRequired(s);
  const [assistDialog, setAssistDialog] = useState(false);
  const [auto, setAuto] = useState(false);
  const autoRef = useRef(false);
  autoRef.current = auto;
  const [hud, setHud] = useState({ h: 0, v: 0, vr: 0, vt: 0, apo: 0, peri: 0, pitch: 90, dv: 0 });
  const [done, setDone] = useState<null | { dv: number; penalty: number; auto: boolean }>(null);
  const trail = useRef<{ r: number; th: number }[]>([]);
  // Wasted Δv is capped in the forgiving modes.
  const cap = mode.landingAssist ? (mode.rewinds === Infinity ? 300 : mode.rewinds > 0 ? 500 : 800) : Infinity;

  useEffect(() => {
    const id = setInterval(() => {
      const x = st.current;
      const a = apsides(params, x);
      setHud({ h: x.r - params.R, v: Math.hypot(x.vr, x.vt), vr: x.vr, vt: x.vt, apo: a.apo - params.R, peri: a.peri - params.R, pitch: (x.pitch * 180) / Math.PI, dv: x.dv });
    }, 100);
    return () => {
      clearInterval(id);
      stopRumble();
    };
  }, [params]);

  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __ascent: { state: st, input, controls, params, baseline, runId: s.runId } });
  });

  const takeOver = () => {
    markFlightAssisted('ascent');
    controls.release();
    setAuto(true);
    autoRef.current = true;
  };

  const finish = (usedAuto: boolean) => {
    const x = st.current;
    const penalty = Math.max(-150, Math.min(cap, x.dv - baseline));
    setDone({ dv: x.dv, penalty, auto: usedAuto });
    if (s.settings.flightPractice) recordTraining('flight:ascent', 'completed', usedAuto);
    if (!usedAuto) completeManualFlight('ascent');
    stopRumble();
    sfx(penalty < 200 ? 'unlock' : 'good');
  };

  const proceed = () => {
    if (s.settings.flightPractice) { leaveFlightPractice(); return; }
    if (!pending) return;
    const penalty = done?.penalty ?? 0;
    const g = useGame.getState();
    const budget = sys.fuelDv - g.penaltyDv - penalty;
    const outcome = flyTransfer(g, sys, budget, pending.plan);
    useGame.setState({ penaltyDv: g.penaltyDv + penalty, ascentPenalty: penalty, outcome, pendingLaunch: null, phase: 'flight' });
  };

  function update(dt: number) {
    if (done || controls.paused || assistDialog) return;
    let x = st.current;
    const n = Math.ceil((dt * SPEED) / 0.05);
    for (let i = 0; i < n; i++) {
      const u = autoRef.current
        ? autopilot(params, x)
        : { pitchRate: ((input.current.left ? PITCH_RATE : 0) - (input.current.right ? PITCH_RATE : 0)) * flightSensitivity(s.settings.flightSensitivity), throttle: input.current.thrust ? 1 : 0 };
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
      takeOver();
      sfx('bad');
    }
  }

  return (
    <div className="screen flight-screen ascent-screen" role="region" aria-label="Ascent flight" tabIndex={-1}>
      <CanvasView
        draw={({ ctx, w, h, dpr, dt }) => {
          update(Math.min(dt, 0.05));
          const x = st.current;
          ctx.fillStyle = '#03050b';
          ctx.fillRect(0, 0, w, h);
          const sky = ctx.createRadialGradient(w * 0.25, h * 0.15, 0, w * 0.25, h * 0.15, Math.max(w, h));
          sky.addColorStop(0, '#142c51'); sky.addColorStop(0.65, '#050d1c'); sky.addColorStop(1, '#03050b');
          ctx.fillStyle = sky; ctx.fillRect(0, 0, w, h);
          for (let i = 0; i < 90; i++) {
            ctx.fillStyle = i % 4 === 0 ? '#9db9da' : '#52627b';
            ctx.fillRect(((i * 0.618033 + sys.seed * 0.001) % 1) * w, ((i * 0.414214) % 1) * h, dpr, dpr);
          }
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
          const planet = ctx.createLinearGradient(0, Math.max(0, pcy - params.R * scale), 0, h);
          planet.addColorStop(0, '#766b53'); planet.addColorStop(1, '#242b2b');
          ctx.fillStyle = planet;
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
          const thr = auto ? autopilot(params, x).throttle : input.current.thrust ? 1 : 0;
          drawStarship(ctx, cx, cy, dir, 30 * dpr, { now: performance.now(), thrust: thr > 0 && !done ? thr : 0, shield: false, light: 1 });
        }}
      />
      {!done && <FlightToolbar title="Ascent · parking orbit" status={s.settings.flightPractice ? 'Practice · unscored' : manualRequired && s.piloting.assisted.length ? 'Assisted · unscored' : auto ? 'ECHO flying' : manualRequired ? 'Manual flight required' : 'Manual flight'} controls={controls}>
        <p>Pitch is measured above the local horizon: 90° points up, 0° points along it. Raise the high point, coast, then raise the low point into orbit. Fuel beyond ECHO’s reference profile reduces your transfer reserve.</p>
      </FlightToolbar>}
      {s.settings.flightPractice && !done && <button className="btn small prologue-skip" onClick={leaveFlightPractice}>Exit practice</button>}
      <div className="prologue-echo panel">
        <span className="mono blue" style={{ fontSize: 11, letterSpacing: '0.14em' }}>
          ECHO
        </span>
        <div>
          {done
            ? done.auto
              ? s.settings.flightPractice ? 'Orbit reached. Practice complete; your expedition is waiting.' : `Orbit. I flew it — the departure burn comes next.${manualRequired ? ' This journey is assisted and unscored.' : ''}`
              : `Orbit achieved. You used ${fmt(done.dv / 1000, 2)} km/s; my profile takes ${fmt(baseline / 1000, 2)}.`
            : auto
              ? `ECHO has control.${manualRequired ? ' Your expedition continues as assisted, without a hard-mode score.' : ''}`
              : 'Climb straight up, then lean east steadily. When the blue line’s high point reaches the green orbit, cut the engine, coast up, and burn flat along the horizon to lift the low point out of the air.'}
        </div>
      </div>
      <div className="prologue-hud panel">
        <div className="meter-label">Flight instruments</div>
        <dl className="kv">
          <dt>Altitude</dt>
          <dd>{fmt(hud.h / 1000, 1)} km</dd>
          <dt>Speed</dt>
          <dd>{fmt(hud.v / 1000, 2)} km/s</dd>
          <dt>Climb rate</dt><dd>{fmt(hud.vr, 0)} m/s</dd>
          <dt>East speed</dt><dd>{fmt(hud.vt / 1000, 2)} km/s</dd>
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
      <AttitudeIndicator angle={90 - hud.pitch} label="Pitch" value={`${fmt(hud.pitch, 0)}°`} />
      {!done && <div className="flight-legend panel"><span className="green">◎ Target orbit</span><span className="blue">↗ Current coast</span><span className="amber">— Flown path</span></div>}
      {!done && (
        <div className="prologue-controls">
          <div className="row" style={{ gap: 10 }}>
            <FlightButton label="Pitch up" action="left" icon="↶" shortcut="← A" controls={controls} />
            <FlightButton label="Pitch over" action="right" icon="↷" shortcut="→ D" controls={controls} />
          </div>
          <div className="row" style={{ gap: 10 }}>
            {!auto && (
              <button className="btn flight-assist-button" onClick={() => { if (manualRequired) { controls.pause(true); setAssistDialog(true); } else takeOver(); }}>
                {manualRequired ? 'Request ECHO rescue' : 'Let ECHO fly'}
              </button>
            )}
            <FlightButton label="Burn" action="thrust" icon="▲" shortcut="↑ W Space" controls={controls} burn />
          </div>
        </div>
      )}
      {assistDialog && <FlightAssistDialog onCancel={() => setAssistDialog(false)} onConfirm={() => { takeOver(); setAssistDialog(false); controls.pause(false); }} />}
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
                {s.settings.flightPractice ? 'Finish practice' : 'Departure burn →'}
              </button>
              {s.settings.flightPractice && <button className="btn" onClick={() => startFlightPractice('ascent', s.settings.difficulty)}>Practise again</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
