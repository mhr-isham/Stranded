import { describe, expect, it } from 'vitest';
import { deployChute, judgeTouchdown, makeTerrain, stepDescent, type DescentParams, type DescentState } from '../src/engine/descent';

const P: DescentParams = { g: 9.8, rho0: 1.1, scaleH: 8500, thrust: 25, bodyCdA: 0.0025, chuteCdA: 0.1, chuteMaxQ: 9000, turnAccel: 1.2, assist: true };
const start: DescentState = { x: 0, y: 9000, vx: 200, vy: -120, th: 0, om: 0, fuel: 1000, chute: 'stowed', t: 0 };

describe('descent physics', () => {
  it('falls toward a terminal speed without a parachute', () => {
    let s = { ...start, vx: 0 };
    for (let i = 0; i < 4000 && s.y > 200; i++) s = stepDescent(P, s, { turn: 0, throttle: 0 }, 0.02);
    const vt = Math.sqrt((2 * P.g) / (P.rho0 * Math.exp(-s.y / P.scaleH) * P.bodyCdA));
    expect(Math.abs(s.vy)).toBeGreaterThan(0.8 * vt);
    expect(Math.abs(s.vy)).toBeLessThan(1.1 * vt);
  });

  it('a parachute tears when opened too fast, holds when opened slowly', () => {
    expect(deployChute(P, { ...start, y: 2000, vx: 0, vy: -300 }).chute).toBe('torn');
    expect(deployChute(P, { ...start, y: 2000, vx: 0, vy: -80 }).chute).toBe('open');
  });

  it('a parachute alone is too fast to land; the engine finishes the job', () => {
    let s: DescentState = { ...start, y: 2000, vx: 0, vy: -80, chute: 'open' };
    for (let i = 0; i < 20000 && s.y > 0; i++) s = stepDescent(P, s, { turn: 0, throttle: 0 }, 0.02);
    expect(Math.abs(s.vy)).toBeGreaterThan(8); // too hard to land on the chute alone
    expect(Math.abs(s.vy)).toBeLessThan(25);
  });

  it('full thrust upright slows the fall and uses fuel', () => {
    let s: DescentState = { ...start, vx: 0, vy: -50 };
    for (let i = 0; i < 100; i++) s = stepDescent(P, s, { turn: 0, throttle: 1 }, 0.02);
    expect(s.vy).toBeGreaterThan(-50);
    expect(s.fuel).toBeLessThan(1000);
  });

  it('judges touchdowns', () => {
    const tr = makeTerrain(5, 1000);
    const f = tr.features.find((q) => q.kind === 'flat')!;
    const x = (f.x0 + f.x1) / 2;
    expect(judgeTouchdown(tr, { ...start, x, vx: 0.5, vy: -2, th: 0.05 }, false)).toBe('clean');
    expect(judgeTouchdown(tr, { ...start, x, vx: 0, vy: -30 }, true)).toBe('crash');
  });
});
