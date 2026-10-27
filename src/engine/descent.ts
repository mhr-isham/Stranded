// 2D powered descent through an atmosphere: the physics behind the prologue
// landing (and later any landing). Side view: x along the ground, y up.
// Gravity is the planet's real surface gravity; the air thins exponentially.

import { hash32 } from './rng';

export interface DescentParams {
  g: number; // m/s²
  rho0: number; // kg/m³ at the ground
  scaleH: number; // m
  /** Main engine acceleration at full throttle (m/s²). */
  thrust: number;
  /** Drag area per mass (m²/kg), body only and with the parachute open. */
  bodyCdA: number;
  chuteCdA: number;
  /** Dynamic pressure above which an opening parachute tears (Pa). */
  chuteMaxQ: number;
  /** Turn rate the thrusters give (rad/s²). */
  turnAccel: number;
  /** Attitude hold: the ship levels itself when you let go. */
  assist: boolean;
}

export interface DescentState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Tilt from vertical (rad), + = nose to the right (thrust pushes right). */
  th: number;
  om: number;
  /** Δv left in the descent tank (m/s). */
  fuel: number;
  chute: 'stowed' | 'open' | 'torn' | 'cut';
  t: number;
}

export interface DescentInput {
  /** -1 (rotate left) … +1 (rotate right). */
  turn: number;
  /** 0 … 1. */
  throttle: number;
}

export const density = (p: DescentParams, y: number) => p.rho0 * Math.exp(-Math.max(0, y) / p.scaleH);
export const dynPressure = (p: DescentParams, s: DescentState) => 0.5 * density(p, s.y) * (s.vx * s.vx + s.vy * s.vy);

/** Advance the descent by dt seconds (call with small steps, ≤ 0.05 s). */
export function stepDescent(p: DescentParams, s: DescentState, u: DescentInput, dt: number): DescentState {
  let { x, y, vx, vy, th, om, fuel, chute, t } = s;
  // Attitude: thrusters give angular acceleration; the assist levels the ship.
  if (u.turn !== 0) om += u.turn * p.turnAccel * dt;
  else if (p.assist) om += (-th * 2.2 - om * 2.4) * dt;
  om *= Math.exp(-0.25 * dt); // a little aerodynamic damping
  if (chute === 'open') om += (-th * 3 - om * 2) * dt; // a parachute hangs the ship upright
  th += om * dt;
  th = Math.max(-Math.PI * 0.6, Math.min(Math.PI * 0.6, th));

  // Forces.
  const rho = density(p, y);
  const v = Math.hypot(vx, vy);
  const cda = p.bodyCdA + (chute === 'open' ? p.chuteCdA : 0);
  const drag = 0.5 * rho * v * cda; // × velocity gives acceleration
  let ax = -drag * vx;
  let ay = -drag * vy - p.g;
  const thr = fuel > 0 ? Math.max(0, Math.min(1, u.throttle)) : 0;
  if (thr > 0) {
    const a = p.thrust * thr;
    ax += a * Math.sin(th);
    ay += a * Math.cos(th);
    fuel = Math.max(0, fuel - a * dt);
  }
  vx += ax * dt;
  vy += ay * dt;
  x += vx * dt;
  y += vy * dt;
  return { x, y, vx, vy, th, om, fuel, chute, t: t + dt };
}

/** Try to open the parachute. It tears if the air pushes too hard on it. */
export function deployChute(p: DescentParams, s: DescentState): DescentState {
  if (s.chute !== 'stowed') return s;
  return { ...s, chute: dynPressure(p, s) > p.chuteMaxQ ? 'torn' : 'open' };
}

// ---------------------------------------------------------------- terrain

export type SiteKind = 'flat' | 'hill' | 'ice' | 'rough';

export interface TerrainFeature {
  kind: Exclude<SiteKind, 'rough'>;
  x0: number;
  x1: number;
  label: string;
}

export interface Terrain {
  height: (x: number) => number;
  features: TerrainFeature[];
  /** Hill summit position and height (the hill used to measure the planet). */
  hillX: number;
  hillH: number;
}

const rnd = (seed: number, i: number) => hash32(seed, i, 0x51e) / 4294967296;

/** The landing area: plains, a rocky band, an ice field and the measuring hill. */
export function makeTerrain(seed: number, hillHeight: number): Terrain {
  const ph = [0, 1, 2, 3, 4].map((i) => rnd(seed, i) * Math.PI * 2);
  const hillX = 7000 + rnd(seed, 9) * 2000;
  const hillW = 2600;
  const iceX0 = -9000 + rnd(seed, 10) * 1500;
  const iceX1 = iceX0 + 2200;
  const flatX0 = -1500 + rnd(seed, 11) * 1000;
  const flatX1 = flatX0 + 3200;
  const smooth = (x: number, a: number, b: number) => {
    // 1 inside [a, b], easing to 0 over 600 m outside.
    const e = 600;
    if (x < a - e || x > b + e) return 0;
    if (x < a) return (x - (a - e)) / e;
    if (x > b) return ((b + e) - x) / e;
    return 1;
  };
  const height = (x: number) => {
    const base = 120 * Math.sin(x / 5200 + ph[0]) + 60 * Math.sin(x / 2100 + ph[1]);
    const rough = 22 * Math.sin(x / 140 + ph[2]) + 14 * Math.sin(x / 61 + ph[3]) + 8 * Math.sin(x / 23 + ph[4]);
    const flatness = Math.max(smooth(x, flatX0, flatX1), smooth(x, iceX0, iceX1));
    const hill = hillHeight * Math.exp(-(((x - hillX) / hillW) ** 2));
    const valley = base * (1 - 0.85 * flatness);
    return valley + rough * (1 - flatness) + hill;
  };
  return {
    height,
    hillX,
    hillH: hillHeight,
    features: [
      { kind: 'flat', x0: flatX0, x1: flatX1, label: 'Flat plain — easy landing' },
      { kind: 'ice', x0: iceX0, x1: iceX1, label: 'Ice field — water for air and fuel' },
      { kind: 'hill', x0: hillX - 3400, x1: hillX - 1600, label: 'Foot of the hill — good for measuring the planet' },
    ],
  };
}

export const slopeAt = (tr: Terrain, x: number) => Math.atan(Math.abs(tr.height(x + 4) - tr.height(x - 4)) / 8);

export function siteAt(tr: Terrain, x: number): SiteKind {
  for (const f of tr.features) if (x >= f.x0 && x <= f.x1) return f.kind;
  return 'rough';
}

export type Touchdown = 'clean' | 'rough' | 'crash';

/** Judge the moment of ground contact. */
export function judgeTouchdown(tr: Terrain, s: DescentState, assist: boolean): Touchdown {
  const k = assist ? 1.3 : 1;
  const slope = slopeAt(tr, s.x);
  if (Math.abs(s.vy) < 4 * k && Math.abs(s.vx) < 3 * k && Math.abs(s.th) < 0.21 * k && slope < 0.17 * k) return 'clean';
  if (Math.abs(s.vy) < 9 * k && Math.abs(s.vx) < 7 * k && Math.abs(s.th) < 0.45 && slope < 0.35) return 'rough';
  return 'crash';
}
