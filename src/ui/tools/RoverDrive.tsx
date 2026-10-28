// Drive the rover yourself: side-on over the real terrain of the landing strip.
// Hold to drive, climbs slow you down, the battery drains with distance (and
// more on climbs), and game time passes as you go — warp it for long trips.
// The scanner reveals finds as you pass; stop beside one to pick it up.

import { useEffect, useMemo, useRef, useState } from 'react';
import { DEG, HOUR } from '../../engine/constants';
import { surfaceGravity } from '../../engine/measure';
import { starAltitude } from '../../engine/sky';
import { hasChallenge } from '../../game/challenges';
import { clock } from '../../game/clock';
import { FIND_TEXT, collectFind } from '../../game/finds';
import { fmt } from '../../game/format';
import { currentWorld, fastForward } from '../../game/sim';
import { useGame } from '../../game/store';
import { ROVER_KMH, SCAN_RANGE, roverRange, STRIP, findsFor, terrainFor } from '../../game/surface';
import { skyColors } from '../../render/color';
import { drawRover } from '../../render/rover';
import { drawStarship } from '../../render/ship';
import { CanvasView } from '../common/CanvasView';
import { toast } from '../common/widgets';

const WARPS = [1, 10, 60, 240];
const WHEEL_R = 0.35; // m

/** Small bumps on top of the smooth strip profile (m). */
/** Crawl-gear pull as a share of g: enough to climb the steepest slope on the strip (~45°). */
const LOW_GEAR = 0.85;

const bumps = (x: number) => 0.1 * Math.sin(x / 2.3) + 0.05 * Math.sin(x / 0.9 + 1.3) + 0.22 * Math.sin(x / 7.1 + 0.4);

export function RoverDrive() {
  const s = useGame();
  const { system: sys } = currentWorld();
  const tr = useMemo(() => terrainFor(sys), [sys]);
  const finds = useMemo(() => findsFor(sys.seed), [sys]);
  const g = surfaceGravity(sys);
  const campX = s.camp?.x ?? 0;
  const vmax = (ROVER_KMH * (hasChallenge(s, 'rover') ? 0.5 : 1)) / 3.6;
  const ground = (x: number) => tr.height(x) + bumps(x);
  // The slope the wheels climb: across the wheelbase, ignoring the small bumps
  // (the rocker-bogie rides over those).
  const climbSlope = (x: number) => Math.atan((tr.height(x + 1.5) - tr.height(x - 1.5)) / 3);
  const st = useRef({
    x: Math.max(-STRIP, Math.min(STRIP, s.surface.roverX ?? campX + 12)),
    v: 0,
    face: 1,
    wheel: 0,
    battery: s.surface.roverBattery,
    dust: [] as { x: number; y: number; vx: number; vy: number; life: number }[],
    sync: 0,
  });
  const input = useRef({ left: false, right: false });
  const [warp, setWarp] = useState(1);
  const [hud, setHud] = useState({ x: st.current.x, v: 0, battery: st.current.battery, slope: 0 });
  const target = s.driveTarget;

  // Keyboard.
  useEffect(() => {
    const set = (e: KeyboardEvent, v: boolean) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') input.current.left = v;
      else if (k === 'arrowright' || k === 'd') input.current.right = v;
      else return;
      e.preventDefault();
    };
    const dn = (e: KeyboardEvent) => set(e, true);
    const up = (e: KeyboardEvent) => set(e, false);
    window.addEventListener('keydown', dn);
    window.addEventListener('keyup', up);
    const id = setInterval(() => {
      const S = st.current;
      setHud({ x: S.x, v: S.v, battery: S.battery, slope: climbSlope(S.x) });
    }, 120);
    // While driving the clock runs at real time (like at the pendulum); the warp buttons speed it up.
    clock.realtime = true;
    clock.emit();
    // The rover is out of the camp while we drive (it doesn't charge).
    useGame.setState((g0) => ({ surface: { ...g0.surface, roverX: st.current.x, task: null } }));
    return () => {
      window.removeEventListener('keydown', dn);
      window.removeEventListener('keyup', up);
      clearInterval(id);
      clock.realtime = false;
      clock.emit();
      // Leaving by the nav bar parks the rover where it is.
      const S = st.current;
      const home = Math.abs(S.x - campX) < 200;
      useGame.setState((q) => ({ surface: { ...q.surface, roverX: home ? null : S.x, roverBattery: S.battery } }));
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = () => {
    const S = st.current;
    const home = Math.abs(S.x - campX) < 200;
    useGame.setState((g0) => ({ surface: { ...g0.surface, roverX: home ? null : S.x, roverBattery: S.battery } }));
  };

  function step(dtReal: number) {
    const S = st.current;
    const u = input.current;
    const thr = (u.right ? 1 : 0) - (u.left ? 1 : 0);
    const dtGame = dtReal * warp;
    if (!(dtGame > 0)) return;
    const n = Math.max(1, Math.ceil(dtGame / 0.1));
    const h = dtGame / n;
    for (let i = 0; i < n; i++) {
      const slope = climbSlope(S.x);
      const canDrive = S.battery > 0 && thr !== 0;
      const pull = g * Math.sin(slope);
      let a: number;
      if (canDrive) {
        // Motors push a third of g at speed; below a third of top speed they shift
        // to a crawl gear with enough force for any slope on the strip.
        const ahead = S.v * thr;
        a = thr * (ahead < vmax / 3 ? LOW_GEAR * g : 0.35 * g) - pull;
      } else {
        // Brakes: they slow the rover and hold it still on any slope on the strip (up to ~48°).
        const hold = 0.75 * g;
        a = -pull + Math.max(-hold, Math.min(hold, -S.v / h + pull));
      }
      S.v = Math.max(-vmax, Math.min(vmax, S.v + a * h));
      const dx = S.v * h;
      const nx = Math.max(-STRIP, Math.min(STRIP, S.x + dx));
      if (nx !== S.x + dx) S.v = 0; // the end of the mapped strip
      const moved = Math.abs(nx - S.x);
      S.x = nx;
      S.wheel += dx / WHEEL_R;
      if (thr) S.face = thr;
      // Battery: one metre of charge per metre, more when climbing.
      S.battery = Math.max(0, S.battery - moved * (1 + Math.max(0, Math.sin(slope) * dx > 0 ? 4 * Math.abs(Math.sin(slope)) : 0)));
    }
    // Dust from the wheels.
    if (Math.abs(S.v) > 1 && Math.random() < 0.6)
      S.dust.push({ x: S.x - S.face * 1.2, y: ground(S.x) + 0.2, vx: -S.v * 0.3 + (Math.random() - 0.5), vy: Math.random() * 0.8, life: 1.2 });
    for (const p of S.dust) {
      p.x += p.vx * dtReal;
      p.y += p.vy * dtReal;
      p.vy -= 0.4 * dtReal;
      p.life -= dtReal;
    }
    S.dust = S.dust.filter((p) => p.life > 0);
    // Game time passes as we drive: the clock runs at real time here, and the
    // warp adds the rest.
    if (warp > 1) fastForward(clock.t + dtReal * (warp - 1));
    // Scanner: finds within range of the rover.
    const g0 = useGame.getState();
    const seen = finds.filter((f) => !g0.surface.found.includes(f.id) && Math.abs(f.x - S.x) < SCAN_RANGE);
    if (seen.length) {
      useGame.setState({ surface: { ...g0.surface, found: [...g0.surface.found, ...seen.map((f) => f.id)] } });
      for (const f of seen) toast(`Scanner: ${FIND_TEXT[f.kind].name.toLowerCase()} ${fmt(Math.abs(f.x - S.x) / 1000, 1)} km ${f.x > S.x ? 'ahead to the east' : 'to the west'}`);
    }
    S.sync += dtReal;
    if (S.sync > 0.5) {
      S.sync = 0;
      useGame.setState((q) => ({ surface: { ...q.surface, roverX: S.x, roverBattery: S.battery } }));
    }
    if (S.battery <= 0 && !S.dust.length && thr) toast('Battery flat. Park and bring the rover home from the map.');
  }

  const S = st.current;
  const nearFind = finds.find((f) => s.surface.found.includes(f.id) && !s.surface.collected.includes(f.id) && Math.abs(f.x - S.x) < 25);
  const sunAltNow = starAltitude(sys, clock.t, sys.site) / DEG;

  return (
    <div className="screen drive">
      <CanvasView
        draw={({ ctx, w, h, dpr, dt, now }) => {
          step(Math.min(dt, 0.05));
          const R = st.current;
          const span = 60 * (1 + (warp - 1) / 20); // metres across the screen
          const mpp = span / w;
          const gy = h * 0.68;
          const X = (x: number) => w / 2 + (x - R.x) / mpp;
          const Y = (z: number) => gy - (z - ground(R.x)) / mpp;
          const sunAlt = starAltitude(sys, clock.t, sys.site) / DEG;
          const col = skyColors(sunAlt, !!sys.features.real);
          const sky = ctx.createLinearGradient(0, 0, 0, gy);
          sky.addColorStop(0, `rgb(${col.zenith.join(',')})`);
          sky.addColorStop(1, `rgb(${col.horizon.join(',')})`);
          ctx.fillStyle = sky;
          ctx.fillRect(0, 0, w, h);
          // Stars at night.
          if (sunAlt < -8) {
            for (let i = 0; i < 160; i++) {
              const sx = ((Math.sin(i * 91.7) * 43758.5) % 1 + 1) % 1;
              const sy = ((Math.sin(i * 12.3) * 23421.6) % 1 + 1) % 1;
              ctx.fillStyle = `rgba(255,255,255,${0.3 + 0.5 * (((i * 37) % 10) / 10)})`;
              ctx.fillRect(sx * w, sy * gy * 0.9, 1.3 * dpr, 1.3 * dpr);
            }
          }
          // Distant ridges (parallax) and the hill, far away.
          for (const [k, par, c, amp] of [
            [1, 0.002, 0.72, 50],
            [2, 0.008, 0.85, 30],
          ] as const) {
            ctx.fillStyle = `rgba(${col.ground.map((v) => Math.round(v * c + 18 * (1 - c))).join(',')},1)`;
            ctx.beginPath();
            ctx.moveTo(0, h);
            for (let px = 0; px <= w + 8; px += 8 * dpr) {
              const u = (px + R.x / mpp * par * 20) / (w * 0.35);
              const yy = amp * (Math.sin(u * 1.3 + k) * 0.6 + Math.sin(u * 3.1 + 2 * k) * 0.3);
              ctx.lineTo(px, gy - (60 + yy) * dpr * (k === 1 ? 1.4 : 1));
            }
            ctx.lineTo(w, h);
            ctx.fill();
          }
          // Ground.
          ctx.beginPath();
          ctx.moveTo(0, h);
          for (let px = 0; px <= w + 3 * dpr; px += 3 * dpr) ctx.lineTo(px, Y(ground(R.x + (px - w / 2) * mpp)));
          ctx.lineTo(w, h);
          ctx.closePath();
          const gg = ctx.createLinearGradient(0, gy - 40 * dpr, 0, h);
          gg.addColorStop(0, `rgb(${col.ground.map((v) => Math.min(255, v + 20)).join(',')})`);
          gg.addColorStop(1, `rgb(${col.ground.map((v) => Math.round(v * 0.45)).join(',')})`);
          ctx.fillStyle = gg;
          ctx.fill();
          // Rocks.
          const cell = 4;
          for (let i = Math.floor((R.x - span) / cell); i <= Math.ceil((R.x + span) / cell); i++) {
            const r = Math.abs((Math.sin(i * 12.9898) * 43758.5453) % 1);
            if (r < 0.6) continue;
            const wx = i * cell + r * cell;
            const rr = (0.12 + r * 0.35) / mpp;
            ctx.fillStyle = `rgba(${col.ground.map((v) => Math.round(v * 0.5)).join(',')},0.9)`;
            ctx.beginPath();
            ctx.ellipse(X(wx), Y(ground(wx)) + rr * 0.25, rr, rr * 0.6, 0, Math.PI, 0);
            ctx.fill();
          }
          // The ice field glints.
          const ice = tr.features.find((f) => f.kind === 'ice');
          if (ice) {
            ctx.fillStyle = 'rgba(220,240,255,0.75)';
            for (let px = Math.max(0, X(ice.x0)); px < Math.min(w, X(ice.x1)); px += 3 * dpr)
              ctx.fillRect(px, Y(ground(R.x + (px - w / 2) * mpp)) - 1, 3 * dpr + 1, 3 * dpr);
          }
          // Camp (the ship), finds and the target flag.
          if (Math.abs(campX - R.x) < span) {
            const shipH = 9 / mpp;
            drawStarship(ctx, X(campX), Y(ground(campX)) - shipH * 0.47, -4 * DEG, shipH, { now, legs: 1, shield: false, lights: sunAlt < 3, shade: Math.max(0, Math.min(0.85, (6 - sunAlt) / 20)) });
          }
          ctx.textAlign = 'center';
          for (const f of finds) {
            if (!s.surface.found.includes(f.id) || s.surface.collected.includes(f.id) || Math.abs(f.x - R.x) > span) continue;
            ctx.font = `${Math.max(16 * dpr, 1.2 / mpp)}px Inter`;
            ctx.fillText(FIND_TEXT[f.kind].icon, X(f.x), Y(ground(f.x)) - 4 * dpr);
          }
          if (target !== null && Math.abs(target - R.x) < span) {
            const fx = X(target);
            const fy = Y(ground(target));
            ctx.strokeStyle = '#e8eefc';
            ctx.lineWidth = 2 * dpr;
            ctx.beginPath();
            ctx.moveTo(fx, fy);
            ctx.lineTo(fx, fy - 46 * dpr);
            ctx.stroke();
            ctx.fillStyle = '#6cc4ff';
            ctx.beginPath();
            ctx.moveTo(fx, fy - 46 * dpr);
            ctx.lineTo(fx + 22 * dpr, fy - 39 * dpr);
            ctx.lineTo(fx, fy - 32 * dpr);
            ctx.fill();
          }
          // Dust, then the rover.
          for (const p of R.dust) {
            ctx.fillStyle = `rgba(${col.ground.map((v) => Math.min(255, v + 60)).join(',')},${p.life * 0.4})`;
            ctx.beginPath();
            ctx.arc(X(p.x), Y(p.y), (2 + (1.2 - p.life) * 6) * dpr, 0, Math.PI * 2);
            ctx.fill();
          }
          // The rocker-bogie averages the bumps: pitch from the ground under the outer wheels, smoothed.
          const pitch = Math.atan2(ground(R.x + 2) - ground(R.x - 2), 4);
          const size = Math.max(3.0 / mpp, 46 * dpr);
          drawRover(ctx, w / 2, Y(ground(R.x)), size, { now, wheel: R.wheel * R.face, pitch: R.face > 0 ? pitch : -pitch, flip: R.face < 0, lights: sunAlt < 0 });
          // Mini-map of the whole strip.
          const mx0 = 16 * dpr;
          const mx1 = w - 16 * dpr;
          const my = 84 * dpr;
          const M = (x: number) => mx0 + ((x + STRIP) / (2 * STRIP)) * (mx1 - mx0);
          ctx.fillStyle = 'rgba(4,6,12,0.6)';
          ctx.fillRect(mx0 - 6 * dpr, my - 10 * dpr, mx1 - mx0 + 12 * dpr, 24 * dpr);
          ctx.strokeStyle = 'rgba(200,215,240,0.4)';
          ctx.lineWidth = dpr;
          ctx.beginPath();
          ctx.moveTo(mx0, my + 4 * dpr);
          ctx.lineTo(mx1, my + 4 * dpr);
          ctx.stroke();
          if (ice) {
            ctx.fillStyle = 'rgba(191,230,255,0.5)';
            ctx.fillRect(M(ice.x0), my, M(ice.x1) - M(ice.x0), 8 * dpr);
          }
          ctx.fillStyle = '#ffc46b';
          ctx.fillRect(M(tr.hillX) - dpr, my - 4 * dpr, 2 * dpr, 12 * dpr);
          ctx.font = `${11 * dpr}px Inter`;
          for (const f of finds) if (s.surface.found.includes(f.id) && !s.surface.collected.includes(f.id)) ctx.fillText(FIND_TEXT[f.kind].icon, M(f.x), my + 2 * dpr);
          ctx.fillStyle = '#e8eefc';
          ctx.fillText('⛺', M(campX), my + 3 * dpr);
          if (target !== null) {
            ctx.fillStyle = '#6cc4ff';
            ctx.fillRect(M(target) - 1.5 * dpr, my - 6 * dpr, 3 * dpr, 14 * dpr);
          }
          ctx.fillStyle = '#ff8a3d';
          ctx.beginPath();
          ctx.arc(M(R.x), my + 4 * dpr, 4 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }}
      />
      <div className="drive-hud panel">
        <dl className="kv">
          <dt>Speed</dt>
          <dd>
            {fmt(Math.abs(hud.v) * 3.6, 1)} km/h{Math.abs(hud.slope) > 15 * DEG && Math.abs(hud.v) > 0.05 && Math.abs(hud.v) < vmax / 3 + 0.05 ? ' · crawl gear' : ''}
          </dd>
          <dt>Slope</dt>
          <dd className={Math.abs(hud.slope) > 12 * DEG ? 'amber' : ''}>{fmt(hud.slope / DEG, 0)}°</dd>
          <dt>Battery</dt>
          <dd className={hud.battery < Math.abs(hud.x - campX) * 1.2 ? 'red' : ''}>
            {fmt(hud.battery / 1000, 1)} / {fmt(roverRange(s) / 1000, 0)} km
          </dd>
          <dt>From camp</dt>
          <dd>{fmt((hud.x - campX) / 1000, 2)} km</dd>
          {target !== null && (
            <>
              <dt>To the flag</dt>
              <dd className="blue">{fmt((target - hud.x) / 1000, 2)} km</dd>
            </>
          )}
          <dt>{sunAltNow > 0 ? '☀️ Day' : '🌙 Night'}</dt>
          <dd>{fmt(clock.t / (24 * HOUR), 1)} d</dd>
        </dl>
        {hud.battery <= 0 ? (
          <div className="red" style={{ fontSize: 12 }}>Battery flat. Leave the drive and bring the rover home from the map: its solar wing trickles it back.</div>
        ) : (
          hud.battery < Math.abs(hud.x - campX) * 1.2 && <div className="red" style={{ fontSize: 12 }}>Turn back soon: the charge left barely covers the way home.</div>
        )}
      </div>
      {nearFind && (
        <div className="drive-find panel">
          <b>
            {FIND_TEXT[nearFind.kind].icon} {FIND_TEXT[nearFind.kind].name}
          </b>
          <div className="muted" style={{ fontSize: 13 }}>
            {FIND_TEXT[nearFind.kind].text}
          </div>
          <button className="btn primary small" onClick={() => collectFind(nearFind)}>
            Pick it up
          </button>
        </div>
      )}
      <div className="drive-controls">
        <HoldBtn label="◀" on={(v) => (input.current.left = v)} />
        <HoldBtn label="▶" on={(v) => (input.current.right = v)} />
      </div>
      <div className="drive-top">
        <div className="drive-warp panel">
          <span className="faint" style={{ fontSize: 11 }}>time</span>
          {WARPS.map((k) => (
            <button key={k} className={`btn small ${warp === k ? 'primary' : 'ghost'}`} onClick={() => setWarp(k)}>
              ×{k}
            </button>
          ))}
        </div>
        <button
          className="btn small"
          onClick={() => {
            save();
            useGame.setState({ screen: 'map' });
          }}
        >
          ⏏ Park & map
        </button>
        <span className="faint hide-phone" style={{ fontSize: 12 }}>
          ← → or A D to drive
        </span>
      </div>
    </div>
  );
}

function HoldBtn({ label, on }: { label: string; on: (v: boolean) => void }) {
  return (
    <button
      className="btn icon-big"
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        on(true);
      }}
      onPointerUp={() => on(false)}
      onPointerCancel={() => on(false)}
      onPointerLeave={() => on(false)}
    >
      {label}
    </button>
  );
}
