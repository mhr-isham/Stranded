// The opening: the ship tumbles out of a failed fold, the controls come back,
// the player stops the spin, burns to fall on purpose, rides the entry
// corridor and flies the descent to a landing site of their choice — which
// becomes the camp. The prologue can't kill you: ECHO takes over before a
// crash. See docs/DESIGN-V2.md §9.1 and docs/STORY.md §5.1.

import { useEffect, useMemo, useRef, useState } from 'react';
import { DEG } from '../engine/constants';
import {
  deployChute,
  dynPressure,
  judgeTouchdown,
  makeTerrain,
  siteAt,
  stepDescent,
  type DescentParams,
  type DescentState,
  type SiteKind,
} from '../engine/descent';
import { surfaceGravity } from '../engine/measure';
import { G } from '../engine/constants';
import { makeRng } from '../engine/rng';
import { setRumble, sfx, stopRumble } from '../game/audio';
import { modeOf } from '../game/modes';
import { currentWorld } from '../game/sim';
import { useGame, type CampInfo } from '../game/store';
import { CanvasView } from './common/CanvasView';
import { beginPlay } from './Intro';
import { unlockLog } from '../game/story';
import { chapterOf } from '../game/campaign';

type Stage = 'tumble' | 'stabilize' | 'deorbit' | 'entry' | 'descent' | 'landed';

const SITE_TEXT: Record<SiteKind, string> = {
  flat: 'A flat plain. Easy ground for the camp and the rover.',
  hill: 'The foot of the hill. The climb to measure the planet starts at the door.',
  ice: 'Beside the ice field. Water — and later, air and fuel.',
  rough: 'Rough, rocky ground. Not pretty, but we’re down.',
};

const ENTRY_TOP = 120_000;
const ENTRY_BOTTOM = 11_000;
const CORRIDOR: [number, number] = [-7.5, -3]; // flight-path angle, degrees

interface Sim {
  stage: Stage;
  stageT: number;
  // Space stages
  ang: number; // ship attitude, rad (0 = nose up)
  spin: number; // rad/s
  calm: number; // seconds the spin has been small
  burn: number; // 0..1 deorbit burn progress
  // Entry
  alt: number;
  gamma: number; // degrees
  heat: number; // 0..100
  shieldHurt: boolean;
  // Descent
  d: DescentState;
  rescued: boolean;
  said: Set<string>;
  dust: { x: number; y: number; vx: number; vy: number; life: number }[];
  result: { touch: 'clean' | 'rough' | 'rescued'; site: SiteKind } | null;
}

export function Prologue({ arrival = false, hop = false }: { arrival?: boolean; hop?: boolean }) {
  const s = useGame();
  const { system: sys } = currentWorld();
  const mode = modeOf(s.settings.difficulty);
  const assist = mode.landingAssist || s.tutorial.active;
  // Arrival at the blue planet uses its own gravity and a terrain around the beacon.
  const g = arrival ? (G * sys.target.mass) / sys.target.radius ** 2 : surfaceGravity(sys);
  const terrain = useMemo(() => {
    if (!arrival) return makeTerrain(sys.seed, sys.hillHeight);
    const tr = makeTerrain(sys.seed + 101, Math.round(sys.hillHeight * 0.7));
    const label: Record<string, string> = { flat: 'The beacon — flat ground', ice: 'Frozen lake', hill: 'Highlands' };
    return { ...tr, features: tr.features.map((f) => ({ ...f, label: label[f.kind] ?? f.label })) };
  }, [sys, arrival]);
  const params: DescentParams = useMemo(
    () => ({ g, rho0: 1.1, scaleH: 8500, thrust: 2.6 * g, bodyCdA: 0.0025, chuteCdA: 0.1, chuteMaxQ: assist ? 14000 : 9000, turnAccel: 1.4, assist }),
    [g, assist],
  );
  const stars = useMemo(() => {
    const r = makeRng(sys.seed ^ 0x77);
    return Array.from({ length: 260 }, () => ({ x: r.next(), y: r.next(), b: 0.3 + r.next() * 0.7 }));
  }, [sys]);

  // Later chapters arrive by a (mostly) controlled fold: no tumble.
  const later = s.chapter > 1 && !arrival && !hop;
  const hopTo = hop ? (s.hop?.toX ?? 0) : 0;
  const sim = useRef<Sim>({
    stage: hop ? 'descent' : arrival ? 'entry' : later ? 'deorbit' : 'tumble',
    stageT: 0,
    ang: later ? 0.3 : 0.4,
    spin: later ? 0 : 1.9,
    calm: 0,
    burn: 0,
    alt: ENTRY_TOP,
    gamma: -4.5,
    heat: 0,
    shieldHurt: false,
    d: hop
      ? { x: hopTo - 350, y: terrain.height(hopTo) + 900, vx: 18, vy: -12, th: 0, om: 0, fuel: mode.landingDv, chute: 'stowed', t: 0 }
      : { x: -3500, y: 8000, vx: 120, vy: -100, th: 0, om: 0, fuel: mode.landingDv, chute: 'stowed', t: 0 },
    rescued: false,
    said: new Set(),
    dust: [],
    result: null,
  });
  const input = useRef({ left: false, right: false, thrust: false });
  const [stage, setStage] = useState<Stage>(hop ? 'descent' : arrival ? 'entry' : later ? 'deorbit' : 'tumble');
  const [line, setLine] = useState(
    hop
      ? 'Hop! We’re coming down over the new site. Same as before: slow down, stay upright, touch down gently.'
      : arrival
      ? 'Entry interface at the blue planet. Same rules as before: keep the flight-path angle in the green corridor. The beacon is on flat ground ahead.'
      : later
      ? 'Fold exit — controlled, this time. Mostly. New star, new planets, and we’re falling toward the nearest one. Turn the nose to the green retrograde marker and burn.'
      : 'Fold exit — irregular. Spin rate high. Navigation… not found.',
  );
  const [hud, setHud] = useState({ alt: 0, vs: 0, hs: 0, tilt: 0, fuel: 1, chute: 'stowed' as DescentState['chute'], site: 'rough' as SiteKind, q: 0, x: 1, heat: 0, gamma: 0 });

  const say = (id: string, text: string) => {
    if (sim.current.said.has(id)) return;
    sim.current.said.add(id);
    setLine(text);
  };
  const goStage = (st: Stage) => {
    sim.current.stage = st;
    sim.current.stageT = 0;
    setStage(st);
  };

  // Test hook (dev server only).
  useEffect(() => {
    if (import.meta.env.DEV) Object.assign(window, { __prologue: { sim, input } });
  }, []);

  // Keyboard controls.
  useEffect(() => {
    const set = (e: KeyboardEvent, v: boolean) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') input.current.left = v;
      else if (k === 'arrowright' || k === 'd') input.current.right = v;
      else if (k === 'arrowup' || k === 'w' || k === ' ') input.current.thrust = v;
      else if (k === 'p' && v) chute();
      else return;
      e.preventDefault();
    };
    const down = (e: KeyboardEvent) => set(e, true);
    const up = (e: KeyboardEvent) => set(e, false);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    const id = setInterval(() => {
      const S = sim.current;
      const ground = terrain.height(S.d.x);
      setHud({
        alt: S.d.y - ground,
        vs: S.d.vy,
        hs: S.d.vx,
        tilt: S.d.th / DEG,
        fuel: S.d.fuel / mode.landingDv,
        chute: S.d.chute,
        site: siteAt(terrain, S.d.x),
        q: dynPressure(params, S.d),
        x: S.burn,
        heat: S.heat,
        gamma: S.gamma,
      });
    }, 100);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      clearInterval(id);
      stopRumble();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function chute() {
    const S = sim.current;
    if (S.stage !== 'descent' || S.d.chute !== 'stowed') return;
    S.d = deployChute(params, S.d);
    sfx(S.d.chute === 'open' ? 'good' : 'bad');
    if (S.d.chute === 'torn') setLine('The chute tore — we were going too fast for it. Engines only now.');
    else setLine('Chute open. It slows us, but not enough to land on its own — you’ll need a last burn near the ground.');
  }

  const finish = (camp: CampInfo) => {
    stopRumble();
    if (arrival) {
      useGame.setState({ arrival: { landing: camp.landing, site: camp.site }, phase: 'results' });
      return;
    }
    if (hop) {
      useGame.setState({ camp: { ...camp, landing: s.camp?.landing ?? camp.landing }, hop: null, phase: 'play', screen: 'map' });
      return;
    }
    if (later) {
      // A new chapter: straight to camp, then the chapter's briefing.
      useGame.setState({ camp });
      beginPlay();
      const b = chapterOf(s.chapter).briefing;
      if (b) unlockLog(b);
      return;
    }
    unlockLog('fall', false);
    useGame.setState({ camp, phase: 'intro' });
  };

  const skip = () => {
    const f = terrain.features.find((q) => q.kind === 'flat')!;
    const x = (f.x0 + f.x1) / 2;
    stopRumble();
    if (arrival) {
      useGame.setState({ arrival: { landing: 'skipped', site: 'flat' }, phase: 'results' });
      return;
    }
    if (hop) {
      useGame.setState({ camp: { ...campAt(hopTo, 'skipped'), landing: s.camp?.landing ?? 'skipped' }, hop: null, phase: 'play', screen: 'map' });
      return;
    }
    useGame.setState({ camp: campAt(x, 'skipped') });
    beginPlay();
    const b = later ? chapterOf(s.chapter).briefing : null;
    if (b) unlockLog(b);
  };

  const campAt = (x: number, landing: CampInfo['landing']): CampInfo => {
    const ice = terrain.features.find((q) => q.kind === 'ice')!;
    return {
      site: siteAt(terrain, x),
      landing,
      x,
      hillKm: Math.abs(x - terrain.hillX) / 1000,
      iceKm: x < ice.x0 ? (ice.x0 - x) / 1000 : x > ice.x1 ? (x - ice.x1) / 1000 : 0,
    };
  };

  function update(dt: number) {
    const S = sim.current;
    const u = input.current;
    const turn = (u.right ? 1 : 0) - (u.left ? 1 : 0);
    S.stageT += dt;

    if (S.stage === 'tumble') {
      S.ang += S.spin * dt;
      setRumble(0.15, 0.1);
      if (S.stageT > 4.5) say('noctl', 'Controls are not responding. Don’t fight it. Not yet.');
      if (S.stageT > 9) {
        goStage('stabilize');
        sfx('unlock');
        setLine('Attitude thrusters online. Navigator — stop the spin. Push against it, gently.');
      }
    } else if (S.stage === 'stabilize') {
      S.spin += turn * 1.3 * dt;
      if (assist && turn === 0 && S.stageT > 3) S.spin *= Math.exp(-0.25 * dt);
      S.spin = Math.max(-4, Math.min(4, S.spin));
      S.ang += S.spin * dt;
      if (Math.abs(S.spin) < 0.1) S.calm += dt;
      else S.calm = 0;
      if (turn !== 0 && Math.sign(turn) === Math.sign(S.spin) && Math.abs(S.spin) > 2.3) say('wrongway', 'Other way — you’re spinning us faster. Push against the turn.');
      if (S.calm > 0.8) {
        S.spin = 0;
        goStage('deorbit');
        sfx('good');
        setLine('Good. We’re falling toward the nearest planet anyway — better to fall on purpose. Turn the nose to the green retrograde marker, then hold BURN.');
      }
    } else if (S.stage === 'deorbit') {
      const target = -Math.PI / 2;
      S.spin += turn * 1.6 * dt;
      if (turn === 0) S.spin *= Math.exp((assist ? -2.5 : -0.6) * dt);
      S.ang += S.spin * dt;
      const err = Math.atan2(Math.sin(S.ang - target), Math.cos(S.ang - target));
      const tol = (assist ? 20 : 12) * DEG;
      const aligned = Math.abs(err) < tol;
      if (u.thrust && aligned) {
        S.burn = Math.min(1, S.burn + dt / 3.5);
        setRumble(0.6, 0.35);
      } else {
        setRumble(u.thrust ? 0.2 : 0.05, 0.2);
        if (u.thrust && !aligned) say('align', 'Not yet — line the nose up with the green marker first, or we’ll burn the wrong way.');
      }
      if (S.burn >= 1) {
        goStage('entry');
        sfx('launch');
        setLine('Burn complete. Here comes the air. Keep the flight-path angle inside the green corridor: too steep and we cook, too shallow and we skip off.');
      }
    } else if (S.stage === 'entry') {
      // Nose up (turn left) makes the path shallower.
      S.gamma += (-turn * 1.6 - 0.25) * dt;
      if (assist && turn === 0) S.gamma += (-5 - S.gamma) * 0.5 * dt;
      S.gamma = Math.max(-14, Math.min(2, S.gamma));
      const rate = Math.max(0.25, Math.min(2.2, -S.gamma / 5));
      S.alt -= S.gamma > -1.2 ? -900 * dt : 6000 * rate * dt;
      if (S.gamma > -1.2) say('skip', 'We’re skipping off the top of the air! Nose down — steeper.');
      const steep = Math.max(0, CORRIDOR[0] - S.gamma);
      S.heat = Math.max(0, S.heat + (steep * 14 - 6) * dt);
      if (steep > 0.5) say('hot', 'Too steep — the shield is overheating. Nose up a little.');
      if (S.heat >= 100) {
        if (assist) {
          S.gamma = -5;
          S.heat = 70;
          setLine('I’ve got it — easing us back into the corridor. Watch the heat.');
        } else {
          S.shieldHurt = true;
          S.heat = 60;
          S.gamma = Math.max(S.gamma, -6);
          S.d.fuel *= 0.85;
          setLine('Shield damage. We lost some of the descent tank to the heat. Stay in the corridor.');
          sfx('bad');
        }
      }
      setRumble(0.35 + 0.4 * Math.min(1, S.heat / 80 + 0.4), 0.8);
      if (S.alt <= ENTRY_BOTTOM) {
        goStage('descent');
        sfx('click');
        setLine(arrival ? 'Heat shield away. The beacon is on the flat ground I’ve marked. Bring us down gently — this is the last landing of the chapter.' : 'Heat shield away. You have the thrusters: tilt to steer, BURN to slow down. Pick somewhere to set down — I’ve marked what I can see.');
      }
    } else if (S.stage === 'descent') {
      const ground = terrain.height(S.d.x);
      const h = S.d.y - ground;
      // Rescue: the prologue can't kill you.
      if (!S.rescued && ((h < 260 && S.d.vy < -40) || (h < 70 && S.d.vy < -13) || (h < 35 && Math.abs(S.d.vx) > 12))) {
        S.rescued = true;
        sfx('bad');
        setLine('Taking control! Hold on.');
      }
      let uu = { turn, throttle: u.thrust ? 1 : 0 };
      if (S.rescued) {
        const targetVy = -Math.max(2, h * 0.12);
        const thCmd = Math.max(-0.45, Math.min(0.45, -S.d.vx * 0.035));
        uu = {
          turn: Math.max(-1, Math.min(1, (thCmd - S.d.th) * 3 - S.d.om)),
          throttle: Math.max(0, Math.min(1, (g + (targetVy - S.d.vy) * 1.8) / (params.thrust * Math.max(0.5, Math.cos(S.d.th))))),
        };
        S.d.fuel = Math.max(S.d.fuel, 200); // emergency reserve
      }
      const speedUp = h > 2500 && !S.rescued ? 3 : 1;
      const n = Math.ceil((dt * speedUp) / 0.02);
      for (let i = 0; i < n; i++) S.d = stepDescent(params, S.d, uu, (dt * speedUp) / n);
      setRumble(uu.throttle * 0.7 + Math.min(0.3, Math.hypot(S.d.vx, S.d.vy) / 600), uu.throttle > 0 ? 0.3 : 0.7);
      // Dust kicked up near the ground.
      if (uu.throttle > 0 && h < 40) {
        for (let i = 0; i < 3; i++) S.dust.push({ x: S.d.x + (Math.random() - 0.5) * 6, y: ground + 1, vx: (Math.random() - 0.5) * 30, vy: Math.random() * 6, life: 1.5 });
      }
      for (const p of S.dust) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy -= 3 * dt;
        p.life -= dt;
      }
      S.dust = S.dust.filter((p) => p.life > 0);
      const v = Math.hypot(S.d.vx, S.d.vy);
      if (S.d.chute === 'stowed' && dynPressure(params, S.d) < params.chuteMaxQ * 0.8 && h > 1200)
        say('chute', 'We’re slow enough for the parachute now. It saves fuel — but it won’t land us on its own.');
      if (h < 1500 && v > 60 && !S.rescued) say('slow', 'The ground is coming up fast — burn to slow down.');
      if (h < 120 && Math.abs(S.d.vy) < 8 && !S.rescued) say('steady', `Steady… keep the descent under ${assist ? 5 : 4} m/s and the ship upright.`);
      if (S.d.fuel < 0.2 * mode.landingDv && S.d.fuel > 0) say('lowfuel', 'Descent tank under 20%. Use the parachute if you still have it.');
      if (S.d.y <= ground) {
        S.d = { ...S.d, y: ground };
        const judged = judgeTouchdown(terrain, S.d, assist);
        const touch = S.rescued ? 'rescued' : judged === 'crash' ? 'rough' : judged;
        S.result = { touch, site: siteAt(terrain, S.d.x) };
        stopRumble();
        sfx(touch === 'clean' ? 'unlock' : 'bad');
        goStage('landed');
        setLine(
          touch === 'clean'
            ? 'Touchdown. Gently, too. Welcome to our new home, Navigator.'
            : touch === 'rough'
              ? 'Down — hard, but down. Some bruises on the landing legs. We’ll live.'
              : 'We’re down. I flew the last part; the legs took a beating. Next time, slow down earlier.',
        );
      }
    }
  }

  function draw({ ctx, w, h, dpr, dt, now }: { ctx: CanvasRenderingContext2D; w: number; h: number; dpr: number; dt: number; now: number }) {
    update(Math.min(dt, 0.05));
    const S = sim.current;
    if (S.stage === 'tumble' || S.stage === 'stabilize' || S.stage === 'deorbit') drawSpace(ctx, w, h, dpr, now, S);
    else if (S.stage === 'entry') drawEntry(ctx, w, h, dpr, now, S);
    else drawDescent(ctx, w, h, dpr, now, S);
  }

  function drawSpace(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, now: number, S: Sim) {
    ctx.fillStyle = '#02030a';
    ctx.fillRect(0, 0, w, h);
    for (const st of stars) {
      ctx.fillStyle = `rgba(255,255,255,${st.b * 0.8})`;
      ctx.fillRect(st.x * w, st.y * h, 1.4 * dpr, 1.4 * dpr);
    }
    // The planet below, lit from the left.
    const R = Math.max(w, h) * 1.6;
    const cx = w / 2;
    const cy = h + R * 0.72;
    const grd = ctx.createRadialGradient(cx - R * 0.3, cy - R * 0.6, R * 0.1, cx, cy, R);
    grd.addColorStop(0, arrival ? '#4f7fa8' : '#8a7a5c');
    grd.addColorStop(0.6, '#5b5240');
    grd.addColorStop(1, '#1d1a14');
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(140,190,255,0.55)';
    ctx.lineWidth = 6 * dpr;
    ctx.beginPath();
    ctx.arc(cx, cy, R + 3 * dpr, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    // The blue planet, a small steady dot.
    ctx.fillStyle = '#9fd0ff';
    ctx.beginPath();
    ctx.arc(w * 0.82, h * 0.16, 2.2 * dpr, 0, Math.PI * 2);
    ctx.fill();

    const sx = w / 2;
    const sy = h * 0.4;
    // Markers for the deorbit burn.
    if (S.stage === 'deorbit') {
      const r = 110 * dpr;
      ctx.lineWidth = 2 * dpr;
      ctx.strokeStyle = '#5be3a4';
      ctx.beginPath();
      ctx.arc(sx - r, sy, 14 * dpr, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx - r - 10 * dpr, sy - 10 * dpr);
      ctx.lineTo(sx - r + 10 * dpr, sy + 10 * dpr);
      ctx.moveTo(sx - r + 10 * dpr, sy - 10 * dpr);
      ctx.lineTo(sx - r - 10 * dpr, sy + 10 * dpr);
      ctx.stroke();
      ctx.fillStyle = '#5be3a4';
      ctx.font = `${12 * dpr}px Inter, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('retrograde', sx - r, sy + 30 * dpr);
      ctx.fillStyle = 'rgba(232,238,252,0.5)';
      ctx.fillText('direction of travel →', sx + r, sy + 30 * dpr);
      // Where the nose points.
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.sin(S.ang) * r, sy - Math.cos(S.ang) * r);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    drawShip(ctx, sx, sy, S.ang, 34 * dpr, S.stage === 'deorbit' && input.current.thrust ? 1 : 0, now, 'space');
    if (S.stage === 'tumble') {
      const a = 0.18 + 0.12 * Math.sin(now / 160);
      const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      vg.addColorStop(0, 'rgba(255,40,60,0)');
      vg.addColorStop(1, `rgba(255,40,60,${a})`);
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, w, h);
    }
  }

  function drawEntry(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, now: number, S: Sim) {
    const f = Math.max(0, Math.min(1, (S.alt - ENTRY_BOTTOM) / (ENTRY_TOP - ENTRY_BOTTOM)));
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, f > 0.5 ? '#050814' : '#0d1a3a');
    sky.addColorStop(1, f > 0.5 ? '#1a2850' : '#4f6f9f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    // Curved horizon far below.
    const hy = h * (0.72 + 0.2 * (1 - f));
    ctx.fillStyle = arrival ? '#2f5a7a' : '#3d3528';
    ctx.beginPath();
    ctx.moveTo(0, h);
    ctx.quadraticCurveTo(w / 2, hy - h * 0.12 * f, w, h);
    ctx.lineTo(w, h);
    ctx.fill();
    // Speed streaks.
    ctx.strokeStyle = 'rgba(255,200,150,0.18)';
    ctx.lineWidth = 1.5 * dpr;
    for (let i = 0; i < 26; i++) {
      const y = ((i * 97 + now * 0.6) % (h * 1.2)) - h * 0.1;
      const x = ((i * 211 + now * 1.4) % (w * 1.3)) - w * 0.15;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - 80 * dpr, y - 80 * dpr * Math.tan(-S.gamma * DEG * 3));
      ctx.stroke();
    }
    const sx = w * 0.45;
    const sy = h * 0.42;
    // Heat shield faces the direction of travel (right and down by gamma).
    const ang = -(Math.PI / 2 - Math.abs(S.gamma) * DEG);
    const glow = 0.35 + Math.min(0.65, S.heat / 100 + 0.25 * Math.sin(now / 50) * 0.3);
    const gx = sx + Math.cos(-S.gamma * DEG) * 26 * dpr;
    const gy = sy + Math.sin(-S.gamma * DEG) * 26 * dpr;
    const pg = ctx.createRadialGradient(gx, gy, 4 * dpr, gx, gy, 120 * dpr);
    pg.addColorStop(0, `rgba(255,240,200,${glow})`);
    pg.addColorStop(0.3, `rgba(255,140,60,${glow * 0.7})`);
    pg.addColorStop(1, 'rgba(255,80,40,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(0, 0, w, h);
    drawShip(ctx, sx, sy, ang, 34 * dpr, 0, now, 'space');
  }

  function drawDescent(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, now: number, S: Sim) {
    const d = S.d;
    const ground = terrain.height(d.x);
    const hAlt = Math.max(0, d.y - ground);
    const mpp = Math.max(0.22 / dpr, (hAlt + 60) / (0.45 * h)); // metres per device pixel
    // Near the ground the camera drops so the landing site fills the view.
    const shipY = h * (0.38 + 0.2 * (1 - Math.min(1, hAlt / 400)));
    const X = (wx: number) => w / 2 + (wx - d.x) / mpp;
    const Y = (wy: number) => shipY - (wy - d.y) / mpp;
    // Sky: darker high up, hazy near the ground; late afternoon.
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    const hi = Math.min(1, d.y / 10000);
    sky.addColorStop(0, hi > 0.5 ? '#16244a' : '#2b4a7e');
    sky.addColorStop(1, '#c9a27a');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);
    // Terrain.
    const step = 3 * dpr;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let px = 0; px <= w + step; px += step) {
      const wx = d.x + (px - w / 2) * mpp;
      ctx.lineTo(px, Y(terrain.height(wx)));
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    const tg = ctx.createLinearGradient(0, Y(ground) - 50 * dpr, 0, h);
    tg.addColorStop(0, arrival ? '#4d6a45' : '#6b5a41');
    tg.addColorStop(1, arrival ? '#1f2d1c' : '#2c241a');
    ctx.fillStyle = tg;
    ctx.fill();
    // Ice field tint and feature labels.
    ctx.font = `${12 * dpr}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    for (const f of terrain.features) {
      const x0 = X(f.x0);
      const x1 = X(f.x1);
      if (x1 < 0 || x0 > w) continue;
      if (f.kind === 'ice') {
        ctx.fillStyle = 'rgba(220,240,255,0.65)';
        for (let px = Math.max(0, x0); px < Math.min(w, x1); px += step) {
          const wx = d.x + (px - w / 2) * mpp;
          ctx.fillRect(px, Y(terrain.height(wx)) - 1, step + 1, 4 * dpr);
        }
      }
      const mid = (f.x0 + f.x1) / 2;
      const top = Math.min(Y(terrain.height(f.x0)), Y(terrain.height(mid)), Y(terrain.height(f.x1))) - 26 * dpr;
      const col = f.kind === 'ice' ? '#bfe6ff' : f.kind === 'hill' ? '#ffc46b' : '#5be3a4';
      ctx.strokeStyle = col;
      ctx.lineWidth = 1.5 * dpr;
      ctx.setLineDash([5 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(Math.max(-10, x0), top + 10 * dpr);
      ctx.lineTo(Math.max(-10, x0), top);
      ctx.lineTo(Math.min(w + 10, x1), top);
      ctx.lineTo(Math.min(w + 10, x1), top + 10 * dpr);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col;
      ctx.fillText(f.label, Math.max(90 * dpr, Math.min(w - 90 * dpr, (Math.max(0, x0) + Math.min(w, x1)) / 2)), top - 6 * dpr);
    }
    // Predicted path with no thrust (assist modes): where we'd hit.
    if (assist && S.stage === 'descent') {
      let p = { ...d };
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 60; i++) {
        for (let k = 0; k < 5; k++) p = stepDescent(params, p, { turn: 0, throttle: 0 }, 0.05);
        if (p.y < terrain.height(p.x)) {
          ctx.strokeStyle = 'rgba(255,107,125,0.9)';
          ctx.lineWidth = 2 * dpr;
          ctx.beginPath();
          ctx.arc(X(p.x), Y(terrain.height(p.x)), 6 * dpr, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        ctx.fillRect(X(p.x) - dpr, Y(p.y) - dpr, 2 * dpr, 2 * dpr);
      }
    }
    // Dust.
    for (const p of S.dust) {
      ctx.fillStyle = `rgba(200,170,130,${Math.max(0, p.life / 1.5) * 0.5})`;
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), 3 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    // Parachute.
    const size = Math.max(26 * dpr, 7 / mpp);
    const sx = X(d.x);
    const sy = Y(d.y) - size * 0.5;
    if (d.chute === 'open' || d.chute === 'torn') {
      const cx = sx - Math.sin(d.th) * size * 2.6;
      const cy = sy - size * 2.6;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)';
      ctx.lineWidth = dpr;
      ctx.beginPath();
      ctx.moveTo(sx, sy - size * 0.4);
      ctx.lineTo(cx - size, cy);
      ctx.moveTo(sx, sy - size * 0.4);
      ctx.lineTo(cx + size, cy);
      ctx.stroke();
      if (d.chute === 'open') {
        ctx.fillStyle = '#ff9a4a';
        ctx.beginPath();
        ctx.ellipse(cx, cy, size * 1.2, size * 0.7, 0, Math.PI, 0);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - size * 0.15, cy - size * 0.68, size * 0.3, size * 0.68);
      } else {
        ctx.strokeStyle = '#ff9a4a';
        ctx.lineWidth = 2 * dpr;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + (i - 1.5) * size * 0.4, cy);
          ctx.lineTo(cx + (i - 1.5) * size * 0.5 + Math.sin(now / 80 + i) * 6 * dpr, cy - size * 0.8);
          ctx.stroke();
        }
      }
    }
    const thr = S.stage === 'descent' && (input.current.thrust || S.rescued) && d.fuel > 0 ? 1 : 0;
    drawShip(ctx, sx, sy, d.th, size, thr, now, 'lander');
  }

  return (
    <div className="screen prologue">
      <CanvasView draw={draw} />
      <div className="prologue-echo panel">
        <span className="mono blue" style={{ fontSize: 11, letterSpacing: '0.14em' }}>
          ECHO
        </span>
        <div>{line}</div>
      </div>
      <button className="btn small ghost prologue-skip" onClick={skip}>
        Skip
      </button>

      {stage === 'tumble' && <div className="prologue-alert">CONTROLS NOT RESPONDING</div>}

      {stage === 'deorbit' && (
        <div className="prologue-gauge panel">
          <div className="meter-label">Deorbit burn</div>
          <div className="meter" style={{ width: 160 }}>
            <i style={{ width: `${hud.x * 100}%` }} />
          </div>
        </div>
      )}

      {stage === 'entry' && (
        <div className="prologue-corridor panel">
          <div className="meter-label">Flight path</div>
          <div className="corridor">
            <div
              className="band"
              style={{ top: `${(-CORRIDOR[1] / 14) * 100}%`, height: `${((CORRIDOR[1] - CORRIDOR[0]) / 14) * 100}%` }}
            />
            <div className="needle" style={{ top: `${Math.max(0, Math.min(100, (-hud.gamma / 14) * 100))}%` }} />
          </div>
          <div className="mono" style={{ fontSize: 12 }}>{hud.gamma.toFixed(1)}°</div>
          <div className="meter-label" style={{ marginTop: 8 }}>
            Heat
          </div>
          <div className="meter" style={{ width: 70 }}>
            <i style={{ width: `${Math.min(100, hud.heat)}%`, background: hud.heat > 70 ? 'var(--red)' : 'var(--amber)' }} />
          </div>
          <div className="faint" style={{ fontSize: 11, marginTop: 6 }}>◀ nose up · shallower</div>
          <div className="faint" style={{ fontSize: 11 }}>▶ nose down · steeper</div>
        </div>
      )}

      {stage === 'descent' && (
        <div className="prologue-hud panel">
          <dl className="kv">
            <dt>Altitude</dt>
            <dd>{hud.alt > 1000 ? `${(hud.alt / 1000).toFixed(2)} km` : `${hud.alt.toFixed(0)} m`}</dd>
            <dt>Falling</dt>
            <dd className={-hud.vs > (assist ? 5 : 4) && hud.alt < 200 ? 'red' : ''}>{(-hud.vs).toFixed(1)} m/s</dd>
            <dt>Drifting</dt>
            <dd className={Math.abs(hud.hs) > 3 && hud.alt < 200 ? 'amber' : ''}>{hud.hs.toFixed(1)} m/s</dd>
            <dt>Tilt</dt>
            <dd>{hud.tilt.toFixed(0)}°</dd>
            <dt>Below</dt>
            <dd>{hud.site === 'rough' ? 'rough ground' : hud.site}</dd>
          </dl>
          <div className="meter-label" style={{ marginTop: 6 }}>
            Descent tank
          </div>
          <div className="meter" style={{ width: '100%' }}>
            <i style={{ width: `${hud.fuel * 100}%`, background: hud.fuel < 0.2 ? 'var(--red)' : 'var(--blue)' }} />
          </div>
          <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>Separate from the launch fuel. Land under {assist ? 5 : 4} m/s, nearly upright.</div>
        </div>
      )}

      {(stage === 'stabilize' || stage === 'deorbit' || stage === 'entry' || stage === 'descent') && (
        <div className="prologue-controls">
          <div className="row" style={{ gap: 10 }}>
            <HoldButton label="⟲" aria="Rotate left" on={(v) => (input.current.left = v)} />
            <HoldButton label="⟳" aria="Rotate right" on={(v) => (input.current.right = v)} />
          </div>
          <div className="row" style={{ gap: 10 }}>
            {stage === 'descent' && (
              <button className="btn" disabled={hud.chute !== 'stowed'} onClick={chute}>
                🪂 {hud.chute === 'stowed' ? 'Parachute' : hud.chute === 'open' ? 'Chute open' : 'Chute torn'}
              </button>
            )}
            {(stage === 'deorbit' || stage === 'descent') && <HoldButton label="BURN" aria="Burn" big on={(v) => (input.current.thrust = v)} />}
          </div>
        </div>
      )}
      {stage !== 'landed' && stage !== 'tumble' && (
        <div className="prologue-keys faint hide-phone">← → or A D rotate · ↑ W or Space burn{stage === 'descent' ? ' · P parachute' : ''}</div>
      )}

      {stage === 'landed' && sim.current.result && (
        <div className="title-wrap">
          <div className="intro-card panel">
            <div className="meter-label">Touchdown</div>
            <h2>
              {sim.current.result.touch === 'clean' ? 'A clean landing' : sim.current.result.touch === 'rough' ? 'A hard landing' : 'ECHO landed us'}
            </h2>
            <div style={{ margin: '6px 0' }}>{arrival ? (sim.current.result.site === 'flat' ? 'Right beside the beacon.' : 'A walk from the beacon, but down safely.') : SITE_TEXT[sim.current.result.site]}</div>
            <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>
              {sim.current.result.touch === 'clean'
                ? arrival
                  ? 'No damage. Welcome to the blue planet.'
                  : 'No damage. The ship is now your camp.'
                : arrival
                  ? 'Bent landing legs, but everyone is alive.'
                  : 'The landing legs are bent — nothing that stops us measuring. The ship is now your camp.'}
              {sim.current.shieldHurt ? ' The heat shield is scorched, too.' : ''}
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button
                className="btn primary"
                onClick={() =>
                  finish(campAt(sim.current.d.x, sim.current.result!.touch === 'rescued' ? 'rescued' : sim.current.result!.touch))
                }
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HoldButton({ label, aria, on, big }: { label: string; aria: string; on: (v: boolean) => void; big?: boolean }) {
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

/** A small capsule lander: nose up at angle 0, engine at the bottom. */
function drawShip(ctx: CanvasRenderingContext2D, x: number, y: number, ang: number, size: number, thrust: number, now: number, kind: 'space' | 'lander') {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(ang);
  const s = size;
  if (thrust > 0) {
    const fl = s * (0.9 + 0.25 * Math.sin(now / 30) + 0.15 * Math.random());
    const fg = ctx.createLinearGradient(0, s * 0.45, 0, s * 0.45 + fl);
    fg.addColorStop(0, 'rgba(255,240,200,0.95)');
    fg.addColorStop(0.4, 'rgba(255,160,70,0.8)');
    fg.addColorStop(1, 'rgba(255,80,40,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-s * 0.18, s * 0.45);
    ctx.lineTo(s * 0.18, s * 0.45);
    ctx.lineTo(0, s * 0.45 + fl);
    ctx.closePath();
    ctx.fill();
  }
  // Body.
  ctx.fillStyle = '#c9ced8';
  ctx.strokeStyle = '#59606e';
  ctx.lineWidth = Math.max(1, s * 0.04);
  ctx.beginPath();
  ctx.moveTo(-s * 0.18, -s * 0.5);
  ctx.lineTo(s * 0.18, -s * 0.5);
  ctx.lineTo(s * 0.42, s * 0.32);
  ctx.lineTo(-s * 0.42, s * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // Window.
  ctx.fillStyle = '#6cc4ff';
  ctx.beginPath();
  ctx.arc(0, -s * 0.12, s * 0.08, 0, Math.PI * 2);
  ctx.fill();
  // Base / heat shield.
  ctx.fillStyle = kind === 'space' ? '#8a5a3a' : '#3b3f48';
  ctx.fillRect(-s * 0.46, s * 0.3, s * 0.92, s * 0.12);
  // Engine bell.
  ctx.fillStyle = '#2a2d33';
  ctx.beginPath();
  ctx.moveTo(-s * 0.1, s * 0.42);
  ctx.lineTo(s * 0.1, s * 0.42);
  ctx.lineTo(s * 0.17, s * 0.5);
  ctx.lineTo(-s * 0.17, s * 0.5);
  ctx.closePath();
  ctx.fill();
  if (kind === 'lander') {
    ctx.strokeStyle = '#9aa1ad';
    ctx.lineWidth = Math.max(1, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(-s * 0.36, s * 0.36);
    ctx.lineTo(-s * 0.55, s * 0.62);
    ctx.moveTo(s * 0.36, s * 0.36);
    ctx.lineTo(s * 0.55, s * 0.62);
    ctx.stroke();
  }
  ctx.restore();
}
