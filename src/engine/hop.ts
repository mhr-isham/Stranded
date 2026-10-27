// Hops of the ship across the landing strip: an autopilot that flies them the
// way a good pilot would (lift off, burn at an angle until the coast will carry
// us to the target, turn round, brake, settle), and the fuel such a flight
// really takes. With a 2.6 g engine and thick air near the ground, that is far
// more than the textbook impulsive figure 2√(g·d): gravity eats into every
// burn, and a fast hop fights drag all the way.

import { stepDescent, type DescentParams, type DescentState } from './descent';

export interface HopPlan {
  burnDeg: number;
  brakeMargin: number;
  hoverH: number;
}

export type HopPhase = 'lift' | 'burn' | 'coast' | 'brake' | 'hover';

/** Ground height: a constant (flat ground) or the real terrain profile. */
export type Ground = number | ((x: number) => number);
const heightAt = (g: Ground, x: number) => (typeof g === 'number' ? g : g(x));

/** Where the ship comes down if it stops burning now. */
export function coastImpactX(p: DescentParams, s: DescentState, ground: Ground) {
  let c = { ...s };
  for (let i = 0; i < 8000 && (c.y > heightAt(ground, c.x) || c.vy > 0); i++) c = stepDescent(p, c, { turn: 0, throttle: 0 }, 0.1);
  return c.x;
}

/**
 * One step of the autopilot: the controls a good pilot would use now.
 * `toX` is the target, `ground` the terrain (or a flat height); `phase` is carried between calls.
 */
export function hopPilot(p: DescentParams, s: DescentState, toX: number, ground: Ground, plan: HopPlan, mem: { phase: HopPhase; n: number }) {
  const dir = Math.sign(toX - s.x) || 1;
  const h = s.y - heightAt(ground, s.x);
  const v = Math.hypot(s.vx, s.vy);
  const att = (thCmd: number) => Math.max(-1, Math.min(1, (thCmd - s.th) * 4 - s.om * 2.5));
  mem.n++;
  if (mem.phase === 'lift') {
    // Uphill: first climb above the target's height, then fly the hop as if on the level.
    if (h > 15 && s.y > heightAt(ground, toX) + 15) mem.phase = 'burn';
    return { turn: att(0), throttle: 1 };
  }
  if (mem.phase === 'burn') {
    if (mem.n % 10 === 0 && (coastImpactX(p, s, ground) - toX) * dir >= 0) mem.phase = 'coast';
    // Rising ground ahead: stand up more and climb before leaning over again.
    let clear = Infinity;
    for (const k of [2, 4, 6]) clear = Math.min(clear, s.y + s.vy * k - heightAt(ground, s.x + s.vx * k));
    const deg = clear < 80 ? Math.min(plan.burnDeg, 15) : plan.burnDeg;
    return { turn: att((dir * deg * Math.PI) / 180), throttle: 1 };
  }
  const retro = Math.atan2(-s.vx, -s.vy);
  if (mem.phase === 'coast') {
    const aNet = p.thrust - p.g * Math.max(0, -s.vy / Math.max(v, 1e-6));
    const stop = (v * v) / (2 * Math.max(0.3 * p.g, aNet));
    // Height above whichever is higher: the ground here or at the target (an uphill hop brakes earlier).
    const hRef = s.y - Math.max(heightAt(ground, s.x), heightAt(ground, toX));
    if (s.vy < 0 && Math.min(h, hRef) < stop * plan.brakeMargin * Math.max(0.2, -s.vy / Math.max(v, 1e-6)) + plan.hoverH) mem.phase = 'brake';
    return { turn: att(Math.max(-1.8, Math.min(1.8, retro))), throttle: 0 };
  }
  if (mem.phase === 'brake') {
    // Slow enough, low enough, or the burn has us rising again: settle.
    if (v < 4 || h < plan.hoverH * 0.5 || s.vy > 0) mem.phase = 'hover';
    return { turn: att(Math.max(-1.2, Math.min(1.2, retro))), throttle: 1 };
  }
  // Settle: nearly upright, cancel the drift (and creep towards the target), 1.5–4 m/s down.
  const want = Math.max(-3, Math.min(3, (toX - s.x) * 0.05));
  const thCmd = Math.max(-0.35, Math.min(0.35, (want - s.vx) * 0.08));
  // Hold height until over the pad, then come down.
  const off = Math.abs(toX - s.x);
  const targetVy = off > 8 && h < 40 ? 0 : -Math.max(1.5, Math.min(4, h * 0.08));
  return { turn: att(thCmd), throttle: Math.max(0, Math.min(1, (p.g + (targetVy - s.vy) * 2) / (p.thrust * Math.max(0.5, Math.cos(s.th))))) };
}

/** Fly a hop on flat ground with the autopilot; the fuel it used (m/s) and where it landed. */
export function flyHop(p: DescentParams, d: number, plan: HopPlan, dt = 0.04) {
  let s: DescentState = { x: 0, y: 0, vx: 0, vy: 0, th: 0, om: 0, fuel: 1e9, chute: 'cut', t: 0 };
  const mem = { phase: 'lift' as HopPhase, n: 0 };
  let launched = false;
  for (let i = 0; i < 200000; i++) {
    s = stepDescent(p, s, hopPilot(p, s, d, 0, plan, mem), dt);
    if (s.y > 3) launched = true;
    if (!launched && s.y < 0) s = { ...s, y: 0, vy: Math.max(0, s.vy) };
    if (launched && s.y <= 0) return { used: 1e9 - s.fuel, x: s.x, vy: s.vy };
  }
  return null;
}

const cache = new Map<string, { cost: number; plan: HopPlan }>();

/** The fuel a well-flown hop of distance d takes (searched over burn angles), and the plan that does it. */
export function hopEstimate(p: DescentParams, d: number) {
  const key = `${p.g.toFixed(3)}:${Math.round(d / 50)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let best = { cost: Infinity, plan: { burnDeg: 45, brakeMargin: 1.5, hoverH: 15 } as HopPlan };
  for (const burnDeg of [20, 35, 50, 60, 70]) {
    // Brake with some margin: a good pilot doesn't cut it fine (and ECHO's safety net stays quiet).
    const plan = { burnDeg, brakeMargin: 1.5, hoverH: 15 };
    const r = flyHop(p, Math.max(100, d), plan);
    if (r && Math.abs(r.x - d) < 0.05 * d + 60 && r.vy > -6 && r.used < best.cost) best = { cost: r.used, plan };
  }
  cache.set(key, best);
  return best;
}

/**
 * Fuel to load for a hop flown by hand. A human-style test pilot (reading the
 * screen, keys with reaction time) used 2–2.7x the estimate, and up to 3.2x on a
 * short hop it cut early and then hovered across the gap. This covers that, plus
 * two minutes of hovering. You pay only for what you burn.
 */
export const hopBudget = (p: DescentParams, d: number) => 2.5 * hopEstimate(p, d).cost + 120 * p.g;

/** The ship's flight model near the ground (the same as for the landing). */
export const hopParams = (g: number, assist = true): DescentParams => ({
  g,
  rho0: 1.1,
  scaleH: 8500,
  thrust: 2.6 * g,
  bodyCdA: 0.0025,
  chuteCdA: 0.1,
  chuteMaxQ: assist ? 14000 : 9000,
  turnAccel: 1.4,
  assist,
});
