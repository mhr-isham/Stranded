// Gravity assists (chapter 7), patched conics. Inside the giant's sphere of
// influence the ship follows a hyperbola: its speed relative to the giant is
// the same going out as coming in, but its direction turns. Seen from the star
// the ship has borrowed some of the giant's orbital motion. A small burn at
// closest approach (a powered flyby) can also change the outgoing speed.

import type { Vec3 } from './vec';
import { norm } from './vec';

/** Half the turn of one hyperbolic leg: asin(1/e), e = 1 + rp·v∞²/μ. */
const halfTurn = (vInf: number, mu: number, rp: number) => Math.asin(1 / (1 + (rp * vInf * vInf) / mu));

/** Total turn of a flyby whose incoming and outgoing v∞ may differ (powered at periapsis). */
export const turnAngle = (vIn: number, vOut: number, mu: number, rp: number) => halfTurn(vIn, mu, rp) + halfTurn(vOut, mu, rp);

const angle2 = (a: Vec3, b: Vec3) => Math.atan2(a[0] * b[1] - a[1] * b[0], a[0] * b[0] + a[1] * b[1]);
const rotate = (v: Vec3, th: number): Vec3 => [v[0] * Math.cos(th) - v[1] * Math.sin(th), v[0] * Math.sin(th) + v[1] * Math.cos(th), 0];

export interface FlybyPlan {
  /** Closest approach to the giant's centre (m). */
  rp: number;
  /** Speed change at closest approach (m/s, + = faster). */
  dv: number;
  /** Turn direction in the orbital plane (+1 = counter-clockwise). */
  sense: 1 | -1;
  /** Turn the giant can't give, made up by a burn far from it (rad), and its cost (m/s). */
  extraTurn: number;
  extraDv: number;
}

/**
 * The flyby that turns v∞in into v∞out (relative to the giant): find the
 * closest approach giving the needed turn, never closer than rpMin.
 */
export function planFlyby(vInfIn: Vec3, vInfOut: Vec3, mu: number, rpMin: number): FlybyPlan & { cost: number } {
  const vi = norm(vInfIn);
  const vo = norm(vInfOut);
  const need = angle2(vInfIn, vInfOut);
  const sense: 1 | -1 = need >= 0 ? 1 : -1;
  const want = Math.abs(need);
  let rp = rpMin;
  let extraTurn = 0;
  if (turnAngle(vi, vo, mu, rpMin) <= want) {
    extraTurn = want - turnAngle(vi, vo, mu, rpMin);
  } else {
    // Turn shrinks as rp grows: bisect on log rp.
    let lo = Math.log(rpMin);
    let hi = Math.log(rpMin * 1e4);
    for (let i = 0; i < 60; i++) {
      const m = 0.5 * (lo + hi);
      if (turnAngle(vi, vo, mu, Math.exp(m)) > want) lo = m;
      else hi = m;
    }
    rp = Math.exp(0.5 * (lo + hi));
  }
  const vpIn = Math.sqrt(vi * vi + (2 * mu) / rp);
  const vpOut = Math.sqrt(vo * vo + (2 * mu) / rp);
  const dv = vpOut - vpIn;
  const extraDv = 2 * vo * Math.sin(extraTurn / 2);
  return { rp, dv, sense, extraTurn, extraDv, cost: Math.abs(dv) + extraDv };
}

/**
 * Fly a planned flyby past the REAL giant: same aim point and burn, but the
 * true mass decides the turn. A wrong mass sends the ship off in a wrong direction.
 */
export function flyFlyby(vInfIn: Vec3, muTrue: number, plan: FlybyPlan): Vec3 {
  const vi = norm(vInfIn);
  const vpIn = Math.sqrt(vi * vi + (2 * muTrue) / plan.rp);
  const vpOut = Math.max(vpIn + plan.dv, Math.sqrt((2 * muTrue) / plan.rp) * 1.0001);
  const vo = Math.sqrt(vpOut * vpOut - (2 * muTrue) / plan.rp);
  const turn = turnAngle(vi, vo, muTrue, plan.rp) + plan.extraTurn;
  const dir = rotate(vInfIn, plan.sense * turn);
  const k = vo / vi;
  return [dir[0] * k, dir[1] * k, 0];
}
