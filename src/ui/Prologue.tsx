// The opening: the ship tumbles out of a failed fold, the controls come back,
// the player stops the spin, burns to fall on purpose, rides the entry
// corridor and flies the descent to a landing site of their choice — which
// becomes the camp. The prologue can't kill you: ECHO takes over before a
// crash. See docs/DESIGN-V2.md §9.1 and docs/STORY.md §5.1.

import { useEffect, useMemo, useRef, useState } from 'react';
import { flightAtmosphere } from '../engine/atmosphere';
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
import { advanceHopTime, currentWorld } from '../game/sim';
import { useGame, type CampInfo } from '../game/store';
import { FlightAssistDialog, FlightButton, FlightToolbar, useFlightControls } from './common/FlightControls';
import { AttitudeIndicator } from './common/AttitudeIndicator';
import { flightSensitivity } from '../game/flightInput';
import { completeManualFlight, manualFlightRequired, markFlightAssisted } from '../game/piloting';
import { leaveFlightPractice, startFlightPractice } from './common/flightPractice';
import { recordTraining } from '../game/training';
import { CanvasView } from './common/CanvasView';
import { drawStarship } from '../render/ship';
import { hopEstimate, hopPilot, type HopPhase } from '../engine/hop';
import { beginPlay } from './Intro';
import { unlockLog } from '../game/story';
import { chapterOf } from '../game/campaign';
import { campDistances, STRIP } from '../game/surface';
import { surveyLandingSites, type LandingSite } from '../engine/landingScan';
import { LandingScan, landingSiteName } from './common/LandingScan';

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
  /** Entry sparks (screen space), the dropped heat shield (world), and a camera jolt 0..1. */
  sparks: { x: number; y: number; vx: number; vy: number; life: number }[];
  shieldDrop: { x: number; y: number; vx: number; vy: number; rot: number } | null;
  shake: number;
  /** A hop has left the ground (until then, touching it isn't a landing). */
  launched: boolean;
  /** Last engine throttle (for the flame), and ECHO flying the hop. */
  thr: number;
  echoFly: boolean;
  pilot: { phase: HopPhase; n: number };
  /** Emergency fuel ECHO added during a rescue (m/s). */
  reserve: number;
  result: { touch: 'clean' | 'rough' | 'rescued'; site: SiteKind } | null;
}

export function Prologue({ arrival = false, hop = false }: { arrival?: boolean; hop?: boolean }) {
  const s = useGame();
  const { system: sys } = currentWorld();
  const mode = modeOf(s.settings.difficulty);
  const mars = !!sys.features.real && !arrival;
  const manualRequired = arrival && manualFlightRequired(s);
  const reducedMotion = s.settings.flightReducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const [assistDialog, setAssistDialog] = useState(false);
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
    () => ({
      g,
      ...flightAtmosphere(!!sys.features.real, arrival),
      thrust: 2.6 * g,
      bodyCdA: 0.0025,
      chuteCdA: 0.1,
      // The chute tears above a share of the falling ship's terminal pressure g/CdA: never at
      // terminal speed with assist, but in the hard modes you must burn to slow down first.
      chuteMaxQ: ((assist ? 1.6 : 0.8) * g) / 0.0025,
      turnAccel: 1.4,
      assist,
    }),
    [g, assist, sys.features.real, arrival],
  );
  const stars = useMemo(() => {
    const r = makeRng(sys.seed ^ 0x77);
    const tints = ['rgba(255,255,255,A)', 'rgba(255,255,255,A)', 'rgba(255,255,255,A)', 'rgba(190,215,255,A)', 'rgba(255,222,190,A)'];
    return Array.from({ length: 320 }, () => ({ x: r.next(), y: r.next(), b: 0.25 + r.next() * 0.75, c: tints[Math.floor(r.next() * tints.length)] }));
  }, [sys]);
  // Seeded scenery: nebula wash, the planet's colours and markings, distant ridges, clouds.
  const scenery = useMemo(() => {
    const r = makeRng(sys.seed ^ 0x5ce);
    const planet: [string, string, string] = sys.features.real
      ? ['#d0875a', '#9a4f2c', '#2a140c']
      : sys.features.locked
        ? ['#9a6a58', '#5a3a32', '#1a100e']
        : ['#a8916a', '#6b5a42', '#1d1a14'];
    // Surface markings: long faint streaks near the limb (foreshortened), and small craters.
    const marks = Array.from({ length: 70 }, () => {
      const crater = r.next() < 0.35;
      const rx = crater ? r.range(0.004, 0.012) : r.range(0.01, 0.06);
      return {
        x: r.range(-0.55, 0.55),
        y: r.range(0, 1),
        rx,
        ry: crater ? rx * 0.35 : r.range(0.002, 0.008),
        rot: crater ? 0 : r.range(-0.25, 0.25),
        c: crater ? 'rgba(25,18,12,0.22)' : r.next() < 0.5 ? 'rgba(40,30,20,0.13)' : 'rgba(255,240,215,0.08)',
      };
    });
    const nebula = [
      { x: r.range(0.55, 0.95), y: r.range(0.05, 0.35), r: r.range(0.25, 0.4), c: 'rgba(120,70,160,0.10)' },
      { x: r.range(0.2, 0.6), y: r.range(0.0, 0.25), r: r.range(0.2, 0.35), c: 'rgba(60,130,170,0.08)' },
    ];
    const ridge = (base: number, amp: number, par: number, c: string) => ({
      base,
      par,
      c,
      h: Array.from({ length: 4 }, (_, i) => ({ a: amp / (i + 1), k: 1 + i * 1.7 + r.next(), p: r.range(0, 6.28) })),
    });
    const ridges = arrival
      ? [ridge(46, 22, 0.05, 'rgba(120,160,190,0.55)'), ridge(22, 14, 0.12, 'rgba(80,120,110,0.75)')]
      : mars ? [ridge(52, 26, 0.05, 'rgba(137,79,51,0.66)'), ridge(24, 16, 0.12, 'rgba(86,52,40,0.85)')]
        : [ridge(52, 26, 0.05, 'rgba(150,130,140,0.5)'), ridge(24, 16, 0.12, 'rgba(110,88,70,0.8)')];
    const clouds = Array.from({ length: mars ? 0 : 14 }, () => ({ x: r.range(-9000, 9000), y: r.range(1800, 6500), w: r.range(400, 1400) }));
    return { planet, marks, nebula, ridges, clouds };
  }, [sys, arrival, mars]);

  // Later chapters arrive by a (mostly) controlled fold: no tumble.
  const later = s.chapter > 1 && !arrival && !hop;
  const opening = !later && !arrival && !hop && !s.settings.flightPractice;
  const [scan, setScan] = useState<{ fromX: number; sites: LandingSite[] } | null>(null);
  const [waypoint, setWaypoint] = useState<LandingSite | null>(null);
  const scanToggle = useRef<HTMLButtonElement>(null);
  const scanPanel = useRef<HTMLElement>(null);
  const hopTo = hop ? (s.hop?.toX ?? 0) : 0;
  const hopFrom = hop ? (s.hop?.fromX ?? s.camp?.x ?? 0) : 0;
  const [echoFly, setEchoFly] = useState(false);
  const hopProfile = useMemo(() => hop ? hopEstimate(params, Math.abs(hopTo - hopFrom)) : null, [params, hop, hopTo, hopFrom]);
  const hopStartedAt = useRef<number | null>(null);
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
    // A hop starts on the ground at camp, with the hop budget in the tank and no parachute.
    d: hop
      ? { x: hopFrom, y: terrain.height(hopFrom), vx: 0, vy: 0, th: 0, om: 0, fuel: s.hop?.budget ?? mode.landingDv, chute: 'cut', t: 0 }
      : { x: -3500, y: 8000, vx: 120, vy: -100, th: 0, om: 0, fuel: mode.landingDv, chute: 'stowed', t: 0 },
    rescued: false,
    said: new Set(),
    dust: [],
    sparks: [],
    shieldDrop: null,
    shake: 0,
    launched: !hop,
    thr: 0,
    echoFly: false,
    reserve: 0,
    pilot: { phase: 'lift', n: 0 },
    result: null,
  });
  const controls = useFlightControls(chute, manualRequired || !!s.settings.flightPractice);
  const { input } = controls;
  const [stage, setStage] = useState<Stage>(hop ? 'descent' : arrival ? 'entry' : later ? 'deorbit' : 'tumble');
  const [line, setLine] = useState(
    hop
      ? 'On the pad. Hold BURN to lift off, lean towards the blue flag, cut the engine and coast — then land near it, gently and upright. You pay for the fuel you burn.'
      : arrival
      ? 'Entry interface at the blue planet. Same rules as before: keep the flight-path angle in the green corridor. The beacon is on flat ground ahead.'
      : mars
      ? 'That’s Mars below us. Line up with the green retrograde marker and burn. The thin air will help slow us, then we finish on the engine.'
      : later
      ? 'Fold exit — controlled, this time. Mostly. New star, new planets, and we’re falling toward the nearest one. Turn the nose to the green retrograde marker and burn.'
      : 'Fold exit — irregular. Attitude thrusters are restarting. I can scan the ground below.',
  );
  const [hud, setHud] = useState({ alt: 0, vs: 0, hs: 0, tilt: 0, fuel: 1, chute: 'stowed' as DescentState['chute'], site: 'rough' as SiteKind, q: 0, x: 1, heat: 0, gamma: 0 });

  const closeScan = () => {
    setScan(null);
    scanToggle.current?.focus({ preventScroll: true });
  };
  const openScan = () => {
    const ship = sim.current.d;
    setScan({ fromX: ship.x, sites: surveyLandingSites(params, ship, terrain, flightSensitivity(s.settings.flightSensitivity)) });
  };
  useEffect(() => {
    if (scan) scanPanel.current?.focus({ preventScroll: true });
  }, [scan]);

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
    if (import.meta.env.DEV) Object.assign(window, { __prologue: { sim, input, controls, terrain, params, runId: s.runId } });
  });

  // Keyboard controls.
  useEffect(() => {
    const id = setInterval(() => {
      const S = sim.current;
      const ground = terrain.height(S.d.x);
      setHud({
        alt: S.d.y - ground,
        vs: S.d.vy,
        hs: S.d.vx,
        tilt: S.d.th / DEG,
        fuel: S.d.fuel / (hop ? (s.hop?.budget ?? 1) : mode.landingDv),
        chute: S.d.chute,
        site: siteAt(terrain, S.d.x),
        q: dynPressure(params, S.d),
        x: S.burn,
        heat: S.heat,
        gamma: S.gamma,
      });
    }, 100);
    return () => {
      clearInterval(id);
      stopRumble();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function chute() {
    const S = sim.current;
    if (S.stage !== 'descent' || S.d.chute !== 'stowed') return;
    S.d = deployChute(params, S.d);
    sfx(S.d.chute === 'open' ? 'chute' : 'bad');
    if (S.d.chute === 'torn') setLine('The chute tore — we were going too fast for it. Engines only now.');
    else setLine(mars ? 'Chute open. Watch your fall speed. Start braking early and use the engine to settle.'
      : 'Chute open. It slows us, but you’ll need a last burn near the ground.');
  }

  /** A hop pays for what was burned: hop tank first, the rest from the launch fuel. */
  const chargeHop = (used: number) => {
    const g0 = useGame.getState();
    const tank = Math.max(0, g0.surface.hopTank);
    const fromTank = Math.min(tank, used);
    useGame.setState({ surface: { ...g0.surface, hopTank: tank - fromTank }, penaltyDv: g0.penaltyDv + (used - fromTank) });
  };

  function finishHop(camp: CampInfo, fuel: number, seconds: number) {
    // A landing button can only settle the currently active hop once.
    if (useGame.getState().phase !== 'hop') return;
    chargeHop(fuel);
    if (!advanceHopTime(seconds)) return;
    useGame.setState({ camp: { ...camp, landing: s.camp?.landing ?? camp.landing }, hop: null, phase: 'play', screen: 'map' });
  }

  const elapsedHop = () => hopStartedAt.current === null ? 0 : sim.current.d.t - hopStartedAt.current;

  const finish = (camp: CampInfo) => {
    stopRumble();
    if (s.settings.flightPractice) { leaveFlightPractice(); return; }
    if (arrival) {
      if (camp.landing === 'rescued' || camp.landing === 'skipped') markFlightAssisted('landing');
      else completeManualFlight('landing');
      useGame.setState({ arrival: { landing: camp.landing, site: camp.site }, phase: 'results' });
      return;
    }
    if (hop) {
      finishHop(camp, Math.max(0, (s.hop?.budget ?? 0) + sim.current.reserve - sim.current.d.fuel), elapsedHop());
      return;
    }
    if (later) {
      if (s.settings.freeRoam) { useGame.setState({ camp, phase: 'play', screen: 'hub', storyQueue: [], echo: [] }); return; }
      // A new chapter: straight to camp, then the chapter's briefing.
      useGame.setState({ camp });
      beginPlay();
      const b = chapterOf(s.chapter).briefing;
      if (b) unlockLog(b);
      return;
    }
    if (s.settings.freeRoam) { useGame.setState({ camp, phase: 'play', screen: 'hub', storyQueue: [], echo: [] }); return; }
    unlockLog('fall', false);
    useGame.setState({ camp, phase: 'intro' });
  };

  const skip = () => {
    const f = terrain.features.find((q) => q.kind === 'flat')!;
    const x = (f.x0 + f.x1) / 2;
    stopRumble();
    if (arrival) {
      markFlightAssisted('landing');
      useGame.setState({ arrival: { landing: 'skipped', site: 'flat' }, phase: 'results' });
      return;
    }
    if (hop) {
      if (hopStartedAt.current !== null) return;
      finishHop(campAt(hopTo, 'skipped'), s.hop?.cost ?? 0, hopProfile?.seconds || 60);
      return;
    }
    if (s.settings.freeRoam) { useGame.setState({ camp: campAt(x, 'skipped'), phase: 'play', screen: 'hub', storyQueue: [], echo: [] }); return; }
    if (!later) unlockLog('fall', false);
    useGame.setState({ camp: campAt(x, 'skipped') });
    beginPlay();
    const b = later ? chapterOf(s.chapter).briefing : null;
    if (b) unlockLog(b);
  };

  const campAt = (x0: number, landing: CampInfo['landing']): CampInfo => {
    // A hop can overshoot the mapped strip; the camp stays on it.
    const x = Math.max(-STRIP + 100, Math.min(STRIP - 100, x0));
    return { ...campDistances(terrain, x), landing, x };
  };

  const landedCamp = stage === 'landed' && sim.current.result ? campAt(sim.current.d.x, sim.current.result.touch) : null;

  function update(dt: number) {
    if (controls.paused || assistDialog) return;
    const S = sim.current;
    const u = input.current;
    const turn = ((u.right ? 1 : 0) - (u.left ? 1 : 0)) * flightSensitivity(s.settings.flightSensitivity);
    S.stageT += dt;
    // Effects: sparks fade, the jolt settles, the dropped shield falls.
    for (const p of S.sparks) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
    }
    S.sparks = S.sparks.filter((p) => p.life > 0);
    for (const p of S.dust) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 3 * dt;
      p.vx *= Math.exp(-1.2 * dt);
      p.life -= dt;
    }
    S.dust = S.dust.filter((p) => p.life > 0);
    S.shake = Math.max(0, S.shake - dt * 1.8);
    if (S.shieldDrop) {
      const q = S.shieldDrop;
      q.vy -= g * dt;
      q.vx *= Math.exp(-0.3 * dt);
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.rot += 2.2 * dt;
      if (q.y < terrain.height(q.x) - 50) S.shieldDrop = null;
    }

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
      if (S.stageT > 20 && turn === 0) say('stabhint', `Tap ${S.spin > 0 ? '← (or A)' : '→ (or D)'} to push against the spin — little taps.`);
      // Nobody at the controls for a long time: ECHO steadies us.
      if (S.stageT > 45 && turn === 0) {
        S.spin *= Math.exp(-1.5 * dt);
        say('stabecho', 'I’ll steady us. Take the controls whenever you’re ready.');
      }
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
      if (S.stageT > 20 && S.burn === 0 && !u.thrust)
        say('deohint', aligned ? 'The nose is on the marker — hold BURN now (↑, W or Space).' : `Turn the nose onto the green marker: hold ${err > 0 ? '←' : '→'}, then BURN.`);
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
          // Required manual entry keeps steering with the player after damage.
          if (!manualRequired) S.gamma = Math.max(S.gamma, -6);
          S.d.fuel *= 0.85;
          setLine('Shield damage. We lost some of the descent tank to the heat. Stay in the corridor.');
          sfx('bad');
        }
      }
      setRumble(0.35 + 0.4 * Math.min(1, S.heat / 80 + 0.4), 0.8);
      if (S.alt <= ENTRY_BOTTOM) {
        goStage('descent');
        // The heat shield drops away under us.
        S.shieldDrop = { x: S.d.x, y: S.d.y - 3, vx: S.d.vx * 0.9, vy: S.d.vy - 6, rot: 0 };
        S.shake = 0.5;
        sfx('click');
        setLine(mars ? 'Heat shield away. Deploy the chute to take some speed off, then start your braking burn early. Watch your sideways drift.' : arrival ? 'Heat shield away. The beacon is on the flat ground I’ve marked. Bring us down gently — this is the last landing of the chapter.' : 'Heat shield away. You have the thrusters: tilt to steer, BURN to slow down. Pick somewhere to set down — I’ve marked what I can see.');
      }
    } else if (S.stage === 'descent') {
      const ground = terrain.height(S.d.x);
      const h = S.d.y - ground;
      // Rescue: the prologue can't kill you.
      // Rescue only when the engine really can't stop us in time (a late, hard
      // braking burn is fine), or when skidding in sideways, or falling with an empty tank.
      // Could we still stop? Either as we point now (if burning), or after swinging
      // upright first (about √(2|tilt|/turn rate) seconds of falling). Doomed only if neither works.
      const burning = u.thrust && S.d.fuel > 0;
      // A survivable hard touchdown is still a manual landing. Rescue must
      // not demand zero speed when the model accepts a rough arrival.
      const landingLimit = 9 * (assist ? 1.3 : 1);
      const canStop = (tDelay: number, accel: number) => {
        const hLeft = h - 2 - Math.max(0, -S.d.vy) * tDelay;
        const need = S.d.vy < 0 ? Math.max(0, S.d.vy * S.d.vy - (landingLimit - 0.1) ** 2) / (2 * Math.max(1, hLeft)) : 0;
        return need <= 1.05 * Math.max(0.1, accel);
      };
      const fuelOk = S.d.fuel > 0;
      const stoppable =
        fuelOk &&
        ((burning && canStop(0, params.thrust * Math.cos(S.d.th) - g)) ||
          canStop(Math.abs(S.d.om) / params.turnAccel + Math.sqrt((2 * Math.abs(S.d.th)) / params.turnAccel) + 0.3, params.thrust - g));
      // ECHO's own hop flights skip the stopping test (they brake late on purpose) but not the skid check.
      const doomed =
        (!(hop && S.echoFly) && ((h < 2500 && S.d.vy < -landingLimit && !stoppable && fuelOk) || (!fuelOk && S.d.vy < -landingLimit && h < 400))) ||
        (h < 35 && Math.abs(S.d.vx) > 12);
      if (S.launched && !S.rescued && doomed) {
        S.rescued = true;
        if (manualRequired) markFlightAssisted('landing');
        sfx('bad');
        setLine(manualRequired ? 'Taking control. Your journey continues as assisted, without a hard-mode score. Measurements are preserved.' : 'Taking control! Hold on.');
      }
      let uu = { turn, throttle: u.thrust ? 1 : 0 };
      // ECHO flies the hop the way a good pilot would.
      if (hopProfile && S.echoFly && !S.rescued) uu = hopPilot(params, S.d, hopTo, terrain.height, hopProfile.plan, S.pilot);
      if (S.rescued) {
        const targetVy = -Math.max(2, h * 0.12);
        const thCmd = Math.max(-0.45, Math.min(0.45, -S.d.vx * 0.035));
        uu = {
          turn: Math.max(-1, Math.min(1, (thCmd - S.d.th) * 3 - S.d.om)),
          throttle: Math.max(0, Math.min(1, (g + (targetVy - S.d.vy) * 1.8) / (params.thrust * Math.max(0.5, Math.cos(S.d.th))))),
        };
        // Emergency reserve (counted as burned on a hop).
        if (S.d.fuel < 200) {
          S.reserve += 200 - S.d.fuel;
          S.d.fuel = 200;
        }
      }
      // ECHO's hops run at 4x (2x for the final settle) so a long one doesn't drag.
      const speedUp = hop && S.echoFly && !S.rescued ? (h > 60 ? 4 : 2) : h > 2500 && !S.rescued ? 3 : 1;
      if (hop && uu.throttle > 0 && S.d.fuel > 0 && hopStartedAt.current === null) hopStartedAt.current = S.d.t;
      const n = Math.ceil((dt * speedUp) / 0.02);
      for (let i = 0; i < n; i++) S.d = stepDescent(params, S.d, uu, (dt * speedUp) / n);
      S.thr = S.d.fuel > 0 ? uu.throttle : 0;
      if (hop && !S.launched && S.stageT > 15 && !u.thrust && !S.echoFly) say('padhint', 'Hold BURN to lift off — or tap “Let ECHO fly”.');
      if (!S.launched) {
        // Still on the pad: the ground holds us up until the engine lifts us.
        const gh = terrain.height(S.d.x);
        if (S.d.y <= gh) S.d = { ...S.d, y: gh, vy: Math.max(0, S.d.vy), vx: 0, th: 0, om: 0 };
        if (S.d.y - gh > 4) {
          S.launched = true;
          say('liftoff', 'Liftoff. Lean towards the flag — not too far, or we’ll lose height. Cut the engine once we’re on our way, and save fuel for the landing.');
        }
      }
      setRumble(uu.throttle * 0.7 + Math.min(0.3, Math.hypot(S.d.vx, S.d.vy) / 600), uu.throttle > 0 ? 0.3 : 0.7);
      // Dust kicked up near the ground.
      if (uu.throttle > 0 && h < 40) {
        for (let i = 0; i < 3; i++) S.dust.push({ x: S.d.x + (Math.random() - 0.5) * 6, y: ground + 1, vx: (Math.random() - 0.5) * 30, vy: Math.random() * 6, life: 1.5 });
      }
      const v = Math.hypot(S.d.vx, S.d.vy);
      if (S.d.chute === 'stowed' && dynPressure(params, S.d) < params.chuteMaxQ * 0.8 && h > 1200)
        say('chute', mars ? 'Chute pressure is in range. Use it now, then brake with the engine while you still have altitude.'
          : 'We’re slow enough for the parachute now. It saves fuel — but it won’t land us on its own.');
      if (S.launched && S.d.vy < 0 && h < 1500 && v > 60 && !S.rescued) say('slow', 'The ground is coming up fast — burn to slow down.');
      if (S.launched && S.d.vy < 0 && h < 120 && Math.abs(S.d.vy) < 8 && !S.rescued) say('steady', `Steady… keep the descent under ${assist ? 5 : 4} m/s and the ship upright.`);
      if (!hop && S.d.fuel < 0.2 * mode.landingDv && S.d.fuel > 0) say('lowfuel', mars ? 'Descent tank under 20%. Keep the ship upright so more thrust can slow your fall.' : 'Descent tank under 20%. Use the parachute if you still have it.');
      if (hop && S.launched && S.d.fuel < 0.25 * (s.hop?.budget ?? 1) && S.d.fuel > 0) say('lowfuelhop', 'Hop fuel under a quarter. Save it for the landing burn.');
      if (S.launched && S.d.y <= ground) {
        // Touchdown: a burst of dust and a jolt, harder for a harder landing.
        const impact = Math.min(1, Math.hypot(S.d.vx, S.d.vy) / 12);
        S.shake = 0.35 + 0.65 * impact;
        for (let i = 0; i < 40 + 60 * impact; i++) {
          const a = Math.random() * Math.PI;
          const v = (6 + 22 * Math.random()) * (0.6 + impact);
          S.dust.push({ x: S.d.x + (Math.random() - 0.5) * 4, y: ground + 0.5, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.35, life: 1.2 + Math.random() * 0.8 });
        }
        S.d = { ...S.d, y: ground };
        const judged = judgeTouchdown(terrain, S.d, assist);
        // The prologue can't kill you: a crash counts as a rescue (with its damage).
        const touch = S.rescued || judged === 'crash' ? 'rescued' : judged;
        if (s.settings.flightPractice) recordTraining('flight:landing', 'completed', touch === 'rescued');
        if (manualRequired && touch === 'rescued') markFlightAssisted('landing');
        S.result = { touch, site: siteAt(terrain, S.d.x) };
        stopRumble();
        sfx(touch === 'clean' ? 'touchdown' : 'bad');
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
    const tumbling = S.stage === 'tumble';
    ctx.save();
    // The fold exit shakes everything.
    if (tumbling && !reducedMotion) {
      const k = (S.stageT < 1.5 ? 10 : 3) * dpr;
      ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    }
    ctx.fillStyle = '#02030a';
    ctx.fillRect(-20, -20, w + 40, h + 40);
    // Nebula wash and stars.
    for (const n of scenery.nebula) {
      const g = ctx.createRadialGradient(n.x * w, n.y * h, 0, n.x * w, n.y * h, n.r * Math.max(w, h));
      g.addColorStop(0, n.c);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);
    }
    stars.forEach((st, i) => {
      const tw = 0.75 + 0.25 * Math.sin(now / 600 + i * 1.7);
      ctx.fillStyle = st.c.replace('A', String(st.b * tw));
      const r = (st.b > 0.9 ? 1.9 : 1.3) * dpr;
      ctx.fillRect(st.x * w, st.y * h, r, r);
    });
    // The system's star, with a little lens flare.
    const sxs = w * 0.1;
    const sys0 = h * 0.12;
    const sg = ctx.createRadialGradient(sxs, sys0, 0, sxs, sys0, 140 * dpr);
    sg.addColorStop(0, 'rgba(255,248,225,1)');
    sg.addColorStop(0.08, 'rgba(255,225,170,0.9)');
    sg.addColorStop(0.35, 'rgba(255,190,120,0.18)');
    sg.addColorStop(1, 'rgba(255,170,100,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(sxs - 140 * dpr, sys0 - 140 * dpr, 280 * dpr, 280 * dpr);
    for (const [f, r, a] of [[0.35, 10, 0.12], [0.6, 22, 0.08], [0.85, 6, 0.18], [1.2, 34, 0.05]] as const) {
      ctx.fillStyle = `rgba(160,200,255,${a})`;
      ctx.beginPath();
      ctx.arc(sxs + (w / 2 - sxs) * f, sys0 + (h / 2 - sys0) * f, r * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    // The planet below: lit towards the star, with surface markings and a glowing limb.
    const R = Math.max(w, h) * 1.6;
    const cx = w / 2;
    const cy = h + R * 0.72;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.clip();
    const pal = scenery.planet;
    const base = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.75, R * 0.05, cx, cy, R);
    base.addColorStop(0, pal[0]);
    base.addColorStop(0.55, pal[1]);
    base.addColorStop(1, pal[2]);
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, w, h);
    for (const m of scenery.marks) {
      ctx.fillStyle = m.c;
      ctx.beginPath();
      ctx.ellipse(cx + m.x * R, cy - R * 0.98 + m.y * R * 0.3, m.rx * R, m.ry * R, m.rot, 0, Math.PI * 2);
      ctx.fill();
    }
    const term = ctx.createLinearGradient(w * 0.15, 0, w * 1.05, h * 0.6);
    term.addColorStop(0, 'rgba(0,0,0,0)');
    term.addColorStop(0.55, 'rgba(0,0,0,0.25)');
    term.addColorStop(1, 'rgba(0,0,6,0.75)');
    ctx.fillStyle = term;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
    const rimRadius = R * (mars ? 1.022 : 1.05);
    const atm = ctx.createRadialGradient(cx, cy, R * 0.985, cx, cy, rimRadius);
    atm.addColorStop(0, 'rgba(120,180,255,0)');
    atm.addColorStop(mars ? 0.45 : 0.28, mars ? 'rgba(236,155,112,0.38)' : 'rgba(140,200,255,0.55)');
    atm.addColorStop(mars ? 0.62 : 0.45, mars ? 'rgba(222,120,84,0.16)' : 'rgba(110,160,255,0.22)');
    atm.addColorStop(1, 'rgba(80,120,255,0)');
    ctx.fillStyle = atm;
    ctx.beginPath();
    ctx.arc(cx, cy, rimRadius, 0, Math.PI * 2);
    ctx.fill();
    // The blue planet, a small steady dot.
    ctx.fillStyle = '#9fd0ff';
    ctx.beginPath();
    ctx.arc(w * 0.82, h * 0.16, 2.4 * dpr, 0, Math.PI * 2);
    ctx.fill();

    const sx = w / 2;
    const sy = h * 0.42;
    const size = Math.min(70 * dpr, Math.min(w, h) * 0.14);
    // Markers for the deorbit burn.
    if (S.stage === 'deorbit') {
      const r = 130 * dpr;
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
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.setLineDash([4 * dpr, 4 * dpr]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + Math.sin(S.ang) * r, sy - Math.cos(S.ang) * r);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    const turn = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
    drawStarship(ctx, sx, sy, S.ang, size, {
      now,
      thrust: S.stage === 'deorbit' && input.current.thrust ? 1 : 0,
      rcs: S.stage === 'tumble' ? 0 : turn,
      shield: true,
      light: 1,
      lights: !(tumbling && Math.sin(now / 90) > 0.3),
    });
    ctx.restore();
    if (tumbling) {
      // The fold exit: a white flash and streaks rushing outwards.
      if (S.stageT < 1.8) {
        const k = 1 - S.stageT / 1.8;
        ctx.strokeStyle = `rgba(200,225,255,${0.5 * k})`;
        ctx.lineWidth = 1.5 * dpr;
        for (let i = 0; i < 70; i++) {
          const a = (i / 70) * Math.PI * 2 + i;
          const r0 = (0.1 + ((S.stageT * 1.4 + i * 0.137) % 1)) * Math.max(w, h) * 0.6;
          ctx.beginPath();
          ctx.moveTo(w / 2 + Math.cos(a) * r0, h / 2 + Math.sin(a) * r0);
          ctx.lineTo(w / 2 + Math.cos(a) * r0 * 1.25, h / 2 + Math.sin(a) * r0 * 1.25);
          ctx.stroke();
        }
        ctx.fillStyle = `rgba(235,245,255,${k * k * 0.95})`;
        ctx.fillRect(0, 0, w, h);
      }
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
    // How hard the air is pushing back: strongest in the middle of the entry, and when steep.
    const band = Math.pow(Math.sin(Math.PI * (1 - f)), 0.6);
    const I = Math.min(1, (0.3 + 0.7 * band) * (0.55 + S.heat / 140));
    ctx.save();
    const k = reducedMotion ? 0 : I * 5 * dpr;
    ctx.translate((Math.random() - 0.5) * k, (Math.random() - 0.5) * k);
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    const top = arrival ? [8, 16, 40] : [6, 9, 22];
    const bot = arrival ? [70, 130, 200] : mars ? [147, 86, 62] : [90, 110, 160];
    const mixc = (a: number[], b: number[], t: number) => `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * t)).join(',')})`;
    sky.addColorStop(0, mixc([2, 3, 10], top, 1 - f));
    sky.addColorStop(1, mixc([12, 18, 40], bot, 1 - f));
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, w + 40, h + 40);
    if (f > 0.4) {
      stars.forEach((st) => {
        ctx.fillStyle = `rgba(255,255,255,${st.b * (f - 0.4)})`;
        ctx.fillRect(st.x * w, st.y * h * 0.7, 1.2 * dpr, 1.2 * dpr);
      });
    }
    // The planet's curved limb below, with its glowing air.
    const Rr = w * (1.2 + 3 * (1 - f));
    const hy = h * (0.78 + 0.1 * (1 - f));
    const pcx = w / 2;
    const pcy = hy + Rr;
    const rimRadius = Rr * (mars ? 1.025 : 1.06);
    const glowR = ctx.createRadialGradient(pcx, pcy, Rr * 0.99, pcx, pcy, rimRadius);
    glowR.addColorStop(0, mars ? 'rgba(237,158,120,0.34)' : 'rgba(150,200,255,0.6)');
    glowR.addColorStop(1, 'rgba(120,170,255,0)');
    ctx.fillStyle = glowR;
    ctx.beginPath();
    ctx.arc(pcx, pcy, rimRadius, 0, Math.PI * 2);
    ctx.fill();
    const surf = ctx.createLinearGradient(0, hy, 0, h);
    surf.addColorStop(0, arrival ? '#4f86b0' : scenery.planet[0]);
    surf.addColorStop(1, arrival ? '#1d3550' : scenery.planet[2]);
    ctx.fillStyle = surf;
    ctx.beginPath();
    ctx.arc(pcx, pcy, Rr, 0, Math.PI * 2);
    ctx.fill();

    const sx = w * 0.45;
    const sy = h * 0.42;
    const size = Math.min(70 * dpr, Math.min(w, h) * 0.14);
    // Direction of travel on screen, and the ship turned so its shield leads.
    const gr = S.gamma * DEG;
    const vx = Math.cos(gr);
    const vy = -Math.sin(gr);
    const ang = Math.atan2(-vx, vy);
    // Speed streaks flowing past, against the travel direction.
    ctx.strokeStyle = `rgba(255,210,170,${0.08 + 0.18 * I})`;
    ctx.lineWidth = 1.5 * dpr;
    for (let i = 0; i < 34; i++) {
      const L = (60 + 80 * I) * dpr;
      const ox = ((i * 211 - now * 1.6 * vx) % (w * 1.3) + w * 1.3) % (w * 1.3) - w * 0.15;
      const oy = ((i * 97 - now * 1.6 * vy) % (h * 1.2) + h * 1.2) % (h * 1.2) - h * 0.1;
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.lineTo(ox - vx * L, oy - vy * L);
      ctx.stroke();
    }
    // Plasma: trailing streamers, then the ship, then the bow shock in front of the shield.
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang);
    for (let i = 0; i < 7; i++) {
      const side = i % 2 ? 1 : -1;
      const off = (0.18 + 0.03 * i) * side * size;
      const L = size * (1.4 + 0.9 * I + 0.3 * Math.sin(now / 60 + i));
      const g = ctx.createLinearGradient(0, 0.35 * size, 0, 0.35 * size - L);
      g.addColorStop(0, `rgba(255,200,130,${0.55 * I})`);
      g.addColorStop(0.4, `rgba(255,110,60,${0.25 * I})`);
      g.addColorStop(1, 'rgba(255,80,60,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(off - 0.05 * size, 0.33 * size);
      ctx.quadraticCurveTo(off * 1.8, 0.35 * size - L * 0.5, off * 1.4 + Math.sin(now / 90 + i) * 0.08 * size, 0.35 * size - L);
      ctx.quadraticCurveTo(off * 1.2, 0.35 * size - L * 0.4, off + 0.05 * size, 0.33 * size);
      ctx.fill();
    }
    ctx.restore();
    drawStarship(ctx, sx, sy, ang, size, { now, shield: true, heat: Math.min(1, 0.35 + S.heat / 110), light: 1 });
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(ang);
    const bow = ctx.createRadialGradient(0, 0.3 * size, 0.1 * size, 0, 0.42 * size, 0.75 * size);
    bow.addColorStop(0, `rgba(255,250,230,${0.95 * I})`);
    bow.addColorStop(0.35, `rgba(255,190,110,${0.6 * I})`);
    bow.addColorStop(1, 'rgba(255,90,50,0)');
    ctx.fillStyle = bow;
    ctx.beginPath();
    ctx.ellipse(0, 0.5 * size, 0.62 * size, 0.32 * size, 0, 0, Math.PI);
    ctx.ellipse(0, 0.36 * size, 0.42 * size, 0.08 * size, 0, Math.PI, 0, true);
    ctx.fill();
    ctx.restore();
    // Sparks shed from the shield.
    for (let i = 0; !reducedMotion && !controls.paused && i < 2 + I * 6; i++)
      S.sparks.push({ x: sx + vx * 0.4 * size + (Math.random() - 0.5) * size * 0.6, y: sy + vy * 0.4 * size, vx: -vx * (300 + 400 * Math.random()) * dpr + (Math.random() - 0.5) * 80 * dpr, vy: -vy * (300 + 400 * Math.random()) * dpr + (Math.random() - 0.5) * 80 * dpr, life: 0.6 });
    ctx.lineWidth = 1.6 * dpr;
    for (const p of S.sparks) {
      ctx.strokeStyle = `rgba(255,${180 + Math.floor(70 * p.life)},120,${p.life * 1.4})`;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.02, p.y - p.vy * 0.02);
      ctx.stroke();
    }
    // A warm wash over the whole view at peak heating.
    const wash = ctx.createRadialGradient(sx, sy, 0, sx, sy, Math.max(w, h) * 0.8);
    wash.addColorStop(0, `rgba(255,150,80,${0.18 * I})`);
    wash.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function drawDescent(ctx: CanvasRenderingContext2D, w: number, h: number, dpr: number, now: number, S: Sim) {
    const d = S.d;
    const ground = terrain.height(d.x);
    const hAlt = Math.max(0, d.y - ground);
    // Metres per device pixel: the camera closes right in for the last few dozen metres.
    const mpp = Math.max(0.085 / dpr, (hAlt + 22) / (0.45 * h));
    // Near the ground the camera drops so the landing site fills the view.
    const shipY = h * (0.38 + 0.2 * (1 - Math.min(1, hAlt / 400)));
    const X = (wx: number) => w / 2 + (wx - d.x) / mpp;
    const Y = (wy: number) => shipY - (wy - d.y) / mpp;
    ctx.save();
    if (S.shake > 0 && !reducedMotion) ctx.translate((Math.random() - 0.5) * S.shake * 14 * dpr, (Math.random() - 0.5) * S.shake * 14 * dpr);
    // Sky: deep blue high up, warm haze near the ground, and a low sun.
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    const hi = Math.min(1, d.y / 10000);
    sky.addColorStop(0, arrival ? (hi > 0.5 ? '#0f2c5a' : '#2a5ea0') : mars ? (hi > 0.5 ? '#292437' : '#614640') : hi > 0.5 ? '#14224a' : '#29467a');
    sky.addColorStop(0.6, arrival ? '#7fb0dc' : mars ? '#a76e55' : '#7b8fb0');
    sky.addColorStop(1, arrival ? '#d7ecf5' : mars ? '#e2ae81' : '#e3b585');
    ctx.fillStyle = sky;
    ctx.fillRect(-20, -20, w + 40, h + 40);
    const sunX = w * 0.82;
    const sunY = h * 0.22;
    const sun = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 160 * dpr);
    sun.addColorStop(0, 'rgba(255,250,232,1)');
    sun.addColorStop(0.1, 'rgba(255,236,190,0.95)');
    sun.addColorStop(0.3, 'rgba(255,210,150,0.25)');
    sun.addColorStop(1, 'rgba(255,200,140,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(sunX - 160 * dpr, sunY - 160 * dpr, 320 * dpr, 320 * dpr);
    // Distant ridges, hazy, sliding slowly by.
    const horizonY = Y(ground) + 4 * dpr;
    for (const [li, layer] of scenery.ridges.entries()) {
      ctx.fillStyle = layer.c;
      ctx.beginPath();
      ctx.moveTo(0, h);
      const shift = (d.x / mpp) * layer.par;
      for (let px = 0; px <= w + 8; px += 8 * dpr) {
        const u = (px + shift) / (w * 0.5);
        let yy = 0;
        for (const hm of layer.h) yy += hm.a * Math.sin(u * hm.k + hm.p);
        ctx.lineTo(px, Math.min(horizonY, horizonY - (layer.base + yy) * dpr * (li === 0 ? 1 : 0.7)));
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    }
    // Clouds we drop through.
    for (const c of scenery.clouds) {
      const cx = X(c.x + d.x * 0.0);
      const cy = Y(c.y);
      const rx = c.w / mpp;
      if (cx + rx < -50 || cx - rx > w + 50 || cy < -100 || cy > h + 100) continue;
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
      g.addColorStop(0, 'rgba(255,250,245,0.55)');
      g.addColorStop(1, 'rgba(255,245,240,0)');
      ctx.fillStyle = g;
      // Three overlapping puffs make a cloud.
      for (const [ox, oy, k] of [[-0.35, 0.02, 0.6], [0, -0.06, 0.75], [0.35, 0.03, 0.55]] as const) {
        ctx.beginPath();
        ctx.ellipse(cx + ox * rx, cy + oy * rx, rx * k, rx * 0.2 * (1 + k * 0.4), 0, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Terrain with a lit rim and scattered rocks.
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
    tg.addColorStop(0, arrival ? '#5a7d4f' : mars ? '#a45d3e' : '#7b6649');
    tg.addColorStop(1, arrival ? '#1f2d1c' : mars ? '#39231c' : '#2c241a');
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.strokeStyle = arrival ? 'rgba(200,240,190,0.35)' : 'rgba(255,215,160,0.35)';
    ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath();
    for (let px = 0; px <= w + step; px += step) {
      const wx = d.x + (px - w / 2) * mpp;
      if (px) ctx.lineTo(px, Y(terrain.height(wx)));
      else ctx.moveTo(px, Y(terrain.height(wx)));
    }
    ctx.stroke();
    if (mpp < 4) {
      const cell = 6;
      const i0 = Math.floor((d.x - (w / 2) * mpp) / cell);
      const i1 = Math.ceil((d.x + (w / 2) * mpp) / cell);
      for (let i = i0; i <= i1; i++) {
        const r = (Math.sin(i * 12.9898) * 43758.5453) % 1;
        if (Math.abs(r) < 0.55) continue;
        const wx = i * cell + Math.abs(r) * cell;
        const rr = (0.3 + Math.abs(r) * 0.9) / mpp;
        ctx.fillStyle = 'rgba(30,24,18,0.55)';
        ctx.beginPath();
        ctx.ellipse(X(wx), Y(terrain.height(wx)) + rr * 0.3, rr, rr * 0.55, 0, Math.PI, 0);
        ctx.fill();
      }
    }
    // Ice field tint and feature labels.
    ctx.font = `${12 * dpr}px Inter, sans-serif`;
    ctx.textAlign = 'center';
    for (const f of terrain.features) {
      const x0 = X(f.x0);
      const x1 = X(f.x1);
      if (x1 < 0 || x0 > w) continue;
      if (f.kind === 'ice') {
        ctx.fillStyle = 'rgba(220,240,255,0.7)';
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
    // The jettisoned heat shield, tumbling away below us.
    if (S.shieldDrop) {
      const q = S.shieldDrop;
      if (q.y > terrain.height(q.x)) {
        ctx.save();
        ctx.translate(X(q.x), Y(q.y));
        ctx.rotate(q.rot);
        const r = Math.max(6 * dpr, 2.6 / mpp);
        ctx.fillStyle = '#5b3f2c';
        ctx.beginPath();
        ctx.ellipse(0, 0, r, r * 0.28, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,140,70,0.5)';
        ctx.beginPath();
        ctx.ellipse(0, r * 0.08, r * 0.8, r * 0.16, 0, 0, Math.PI);
        ctx.fill();
        ctx.restore();
      }
    }
    // Dust.
    for (const p of S.dust) {
      const a = Math.max(0, p.life / 1.5);
      ctx.fillStyle = arrival ? `rgba(225,232,240,${a * 0.5})` : `rgba(205,175,135,${a * 0.55})`;
      ctx.beginPath();
      ctx.arc(X(p.x), Y(p.y), (3 + (1.5 - p.life) * 5) * dpr, 0, Math.PI * 2);
      ctx.fill();
    }
    // The surface waypoint is drawn in world coordinates and points off-screen as needed.
    const marker = hop ? hopTo : waypoint?.x;
    if (marker !== undefined && S.stage === 'descent') {
      const fx = X(marker);
      const fy = Y(terrain.height(marker));
      if (fx > -20 && fx < w + 20) {
        const ph = Math.max(40 * dpr, 12 / mpp);
        ctx.strokeStyle = '#e8eefc';
        ctx.lineWidth = 2 * dpr;
        ctx.beginPath();
        ctx.moveTo(fx, fy);
        ctx.lineTo(fx, fy - ph);
        ctx.stroke();
        ctx.fillStyle = '#6cc4ff';
        const wv = reducedMotion ? 0 : Math.sin(now / 200) * 3 * dpr;
        ctx.beginPath();
        ctx.moveTo(fx, fy - ph);
        ctx.lineTo(fx + ph * 0.5, fy - ph * 0.85 + wv);
        ctx.lineTo(fx, fy - ph * 0.7);
        ctx.fill();
      } else {
        const right = fx > w;
        const ax = right ? w - 26 * dpr : 26 * dpr;
        const ay = Math.max(80 * dpr, Math.min(h - 80 * dpr, fy));
        ctx.fillStyle = '#6cc4ff';
        ctx.beginPath();
        ctx.moveTo(ax + (right ? 14 : -14) * dpr, ay);
        ctx.lineTo(ax, ay - 10 * dpr);
        ctx.lineTo(ax, ay + 10 * dpr);
        ctx.fill();
        ctx.font = `${12 * dpr}px Inter, sans-serif`;
        ctx.textAlign = right ? 'right' : 'left';
        ctx.fillText(`${hop ? 'flag' : 'waypoint'} ${fmtKm(Math.abs(marker - d.x))}`, ax + (right ? -6 : 6) * dpr, ay - 16 * dpr);
      }
    }
    // Parachute: a striped canopy that breathes.
    const size = Math.max(30 * dpr, 7 / mpp);
    const sx = X(d.x);
    const sy = Y(d.y) - size * 0.55;
    if (d.chute === 'open' || d.chute === 'torn') {
      const cx = sx - Math.sin(d.th) * size * 2.8;
      const cy = sy - size * 2.8;
      const br = 1 + 0.04 * Math.sin(now / 240);
      const cw = size * 1.35 * br;
      const ch = size * 0.75 / br;
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = dpr;
      ctx.beginPath();
      for (let i = 0; i <= 4; i++) {
        ctx.moveTo(sx, sy - size * 0.55);
        ctx.lineTo(cx - cw + (2 * cw * i) / 4, cy);
      }
      ctx.stroke();
      if (d.chute === 'open') {
        const gores = 8;
        for (let i = 0; i < gores; i++) {
          const a0 = Math.PI + (Math.PI * i) / gores;
          const a1 = Math.PI + (Math.PI * (i + 1)) / gores;
          ctx.fillStyle = i % 2 ? '#fff4ea' : '#ff8a3d';
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.ellipse(cx, cy, cw, ch, 0, a0, a1);
          ctx.closePath();
          ctx.fill();
        }
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.beginPath();
        ctx.ellipse(cx, cy, cw, ch * 0.18, 0, 0, Math.PI);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#ff8a3d';
        ctx.lineWidth = 2 * dpr;
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(cx + (i - 1.5) * size * 0.4, cy);
          ctx.lineTo(cx + (i - 1.5) * size * 0.5 + Math.sin(now / 80 + i) * 6 * dpr, cy - size * 0.8);
          ctx.stroke();
        }
      }
    }
    const thr = S.stage === 'descent' ? S.thr : 0;
    const turn = (input.current.right ? 1 : 0) - (input.current.left ? 1 : 0);
    const legs = Math.max(0, Math.min(1, (450 - hAlt) / 250));
    // Light falling on the ground under a firing engine.
    if (thr && hAlt < 150) {
      const gx = sx;
      const gy = Y(ground);
      const lg = ctx.createRadialGradient(gx, gy, 0, gx, gy, 90 * dpr);
      lg.addColorStop(0, `rgba(255,190,120,${0.45 * (1 - hAlt / 150)})`);
      lg.addColorStop(1, 'rgba(255,170,100,0)');
      ctx.fillStyle = lg;
      ctx.fillRect(gx - 90 * dpr, gy - 90 * dpr, 180 * dpr, 180 * dpr);
    }
    drawStarship(ctx, sx, sy, d.th, size, { now, thrust: thr, rcs: S.stage === 'descent' ? turn : 0, shield: false, legs, light: -1 });
    ctx.restore();
  }

  const waypointRange = waypoint === null ? null : waypoint.x - sim.current.d.x;
  const flightStage = stage === 'tumble' && opening ? 'Attitude thrusters restarting' : stage;
  const flightStatus = s.settings.flightPractice ? 'Practice · unscored'
    : manualRequired && s.piloting.assisted.length ? 'Assisted · unscored'
    : manualRequired ? 'Manual flight required' : flightStage;

  return (
    <div className="screen prologue flight-screen" role="region" aria-label="Landing flight" tabIndex={-1}>
      <CanvasView draw={draw} />
      {stage !== 'landed' && <FlightToolbar title={hop ? 'Surface hop' : arrival ? (sys.features.real ? 'Earth landing' : 'Destination landing') : mars ? 'Mars arrival' : 'Arrival · opening sequence'}
        status={flightStatus} controls={controls}
        tools={opening && <button className="btn small" aria-label="Scan landing terrain" aria-expanded={!!scan} ref={scanToggle}
          onClick={scan ? closeScan : openScan}>Scan terrain</button>}>
        <p>Use short steering inputs. During entry, left makes the path shallower and right makes it steeper. During descent, tilt to control drift and burn to slow the fall. A parachute helps only within its pressure limit.</p>
        {mars && !hop && <p>Mars’s thin atmosphere provides much less drag. The parachute reduces speed. Start the engine burn while you still have height to brake.</p>}
        {hop && <p>After takeoff, simulated flight seconds use supplies. Pausing leaves the flight and supplies where they are.</p>}
        <p>Land nearly upright, with little sideways drift and vertical speed below {assist ? 5 : 4} m/s. The instruments show the current conditions.</p>
      </FlightToolbar>}
      <div className="prologue-echo panel">
        <span className="mono blue" style={{ fontSize: 11, letterSpacing: '0.14em' }}>
          ECHO
        </span>
        <div>{line}</div>
      </div>
      {stage !== 'landed' && (!hop || hopStartedAt.current === null) && (
        <button className="btn small ghost prologue-skip" onClick={() => { if (s.settings.flightPractice) leaveFlightPractice(); else if (manualRequired) { controls.pause(true); setAssistDialog(true); } else skip(); }}>
          {s.settings.flightPractice ? 'Exit practice' : manualRequired ? 'ECHO landing' : 'Skip'}
        </button>
      )}

      {opening && stage !== 'landed' && waypoint && waypointRange !== null && <div className="landing-waypoint panel" aria-label="Landing waypoint">
        <span aria-hidden="true">◇</span> <b>{landingSiteName(waypoint.kind)}</b>
        <span>{Math.abs(waypointRange) < 20 ? 'Below' : `${waypointRange < 0 ? 'Left' : 'Right'} · ${fmtKm(Math.abs(waypointRange))}`}</span>
      </div>}
      {opening && stage !== 'landed' && scan && <LandingScan terrain={terrain} sites={scan.sites} fromX={scan.fromX}
        waypoint={waypoint} panel={scanPanel} onClose={closeScan}
        onSelect={(site) => { setWaypoint(site); closeScan(); if (site) sfx('log'); }} />}

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
      {stage === 'descent' && <AttitudeIndicator angle={hud.tilt} label="Tilt" value={`${hud.tilt.toFixed(0)}°`} />}

      {stage === 'descent' && (
        <div className="prologue-hud panel">
          <dl className="kv">
            <dt>Altitude</dt>
            <dd>{hud.alt > 1000 ? `${(hud.alt / 1000).toFixed(2)} km` : `${hud.alt.toFixed(0)} m`}</dd>
            <dt>{hud.vs > 0.05 ? 'Climbing' : 'Falling'}</dt>
            <dd className={-hud.vs > (assist ? 5 : 4) && hud.alt < 200 ? 'red' : ''}>{Math.abs(hud.vs).toFixed(1)} m/s</dd>
            <dt>Drifting</dt>
            <dd className={Math.abs(hud.hs) > 3 && hud.alt < 200 ? 'amber' : ''}>{hud.hs.toFixed(1)} m/s</dd>
            <dt>Tilt</dt>
            <dd>{hud.tilt.toFixed(0)}°</dd>
            {mars && !hop && <><dt>Dynamic pressure</dt><dd>{hud.q.toFixed(0)} Pa</dd></>}
            <dt>Below</dt>
            <dd>{hud.site === 'rough' ? 'rough ground' : hud.site}</dd>
            {hop && (
              <>
                <dt>To the flag</dt>
                <dd className="blue">{fmtKm(Math.abs(hopTo - sim.current.d.x))}</dd>
              </>
            )}
          </dl>
          <div className="meter-label" style={{ marginTop: 6 }}>
            {hop ? 'Hop fuel' : 'Descent tank'}
          </div>
          <div className="meter" style={{ width: '100%' }}>
            <i style={{ width: `${hud.fuel * 100}%`, background: hud.fuel < 0.2 ? 'var(--red)' : 'var(--blue)' }} />
          </div>
          <div className="faint" style={{ fontSize: 11, marginTop: 4 }}>
            {hop ? `Ideal hop: ${(s.hop?.cost ?? 0).toFixed(0)} m/s. Flight time: ${Math.floor(elapsedHop())} s.` : 'Separate from the launch fuel.'} Land under {assist ? 5 : 4} m/s, nearly upright.
          </div>
        </div>
      )}

      {(stage === 'stabilize' || stage === 'deorbit' || stage === 'entry' || stage === 'descent') && (
        <div className="prologue-controls">
          <div className="row" style={{ gap: 10 }}>
            <FlightButton label="Rotate left" action="left" icon="↶" shortcut="← A" controls={controls} />
            <FlightButton label="Rotate right" action="right" icon="↷" shortcut="→ D" controls={controls} />
          </div>
          <div className="row" style={{ gap: 10 }}>
            {stage === 'descent' && !hop && (
              <button className="btn" disabled={hud.chute !== 'stowed'} onClick={chute}>
                🪂 {hud.chute === 'stowed' ? 'Parachute' : hud.chute === 'open' ? 'Chute open' : 'Chute torn'}
              </button>
            )}
            {hop && stage === 'descent' && (
              <button
                className={`btn ${echoFly ? 'primary' : ''}`}
                onClick={() => {
                  sim.current.echoFly = !echoFly;
                  setEchoFly(!echoFly);
                  setLine(!echoFly ? 'I have it. Climb, coast, turn round and brake for touchdown.' : 'Your ship, Navigator.');
                }}
              >
                {echoFly ? '🤖 ECHO is flying' : '🤖 Let ECHO fly'}
              </button>
            )}
            {(stage === 'deorbit' || stage === 'descent') && !(hop && echoFly) && <FlightButton label="Burn" action="thrust" icon="▲" shortcut="↑ W Space" controls={controls} burn />}
          </div>
        </div>
      )}
      {assistDialog && <FlightAssistDialog onCancel={() => setAssistDialog(false)} onConfirm={() => { setAssistDialog(false); skip(); }} />}
      {stage !== 'landed' && stage !== 'tumble' && (
        <div className="prologue-keys faint hide-phone">← → or A D rotate · ↑ W or Space burn{stage === 'descent' && !hop ? ' · P parachute' : ''}</div>
      )}

      {landedCamp && sim.current.result && (
        <div className="title-wrap">
          <div className="intro-card panel">
            <div className="meter-label">Touchdown</div>
            <h2>
              {sim.current.result.touch === 'clean' ? 'A clean landing' : sim.current.result.touch === 'rough' ? 'A hard landing' : 'ECHO landed us'}
            </h2>
            <div style={{ margin: '6px 0' }}>{arrival ? (sim.current.result.site === 'flat' ? 'Right beside the beacon.' : 'A walk from the beacon, but down safely.') : SITE_TEXT[opening ? landedCamp.site : sim.current.result.site]}</div>
            {opening && <dl className="kv touchdown-distances" aria-label="Camp distances">
              <dt>Water ice</dt><dd>{landedCamp.iceKm < 0.05 ? 'At camp' : fmtKm(landedCamp.iceKm * 1000)}</dd>
              <dt>Survey hill</dt><dd>{fmtKm(landedCamp.hillKm * 1000)}</dd>
            </dl>}
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
                  finish(landedCamp)
                }
              >
                {s.settings.flightPractice ? 'Finish practice' : 'Continue'}
              </button>
              {s.settings.flightPractice && <button className="btn" onClick={() => startFlightPractice('landing', s.settings.difficulty)}>Practise again</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const fmtKm = (m: number) => (m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m.toFixed(0)} m`);
