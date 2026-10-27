import { describe, expect, it } from 'vitest';
import { DAY, HOUR } from '../src/engine/constants';
import { generateSystem } from '../src/engine/system';
import { useGame, type GameState } from '../src/game/store';
import { ICE_LOAD_DV, SURFACE_RULES, advanceSurface, findsFor, hopCost, spareFuel } from '../src/game/surface';

const sys = generateSystem(21, 'navigator');
const base = (): GameState => ({ ...useGame.getState(), camp: { site: 'flat', landing: 'clean', x: 0, hillKm: 8, iceKm: 6 } });

describe('surface', () => {
  it('a rover drive reveals finds near its path', () => {
    const s = base();
    const f = findsFor(sys.seed)[0];
    s.surface = { ...s.surface, hopTank: 0, task: { kind: 'drive', toX: f.x, done: HOUR } };
    const p = advanceSurface(s, sys, 0, 2 * HOUR);
    expect(p.surface!.found).toContain(f.id);
    expect(p.surface!.roverX).toBeCloseTo(f.x);
  });

  it('towing moves the camp to the rover', () => {
    const s = base();
    s.surface = { ...s.surface, roverX: 5000, task: { kind: 'tow', done: DAY } };
    const p = advanceSurface(s, sys, 0, 2 * DAY);
    expect(p.camp!.x).toBe(5000);
    expect(p.surface!.roverX).toBeNull();
  });

  it('ice makes fuel, up to the cap', () => {
    const s = base();
    const cap = SURFACE_RULES.navigator.isruCap * spareFuel(sys);
    s.surface = { ...s.surface, hopTank: 700, iceLoads: 1, fuelMade: cap - 30, task: { kind: 'process', done: DAY } };
    const p = advanceSurface(s, sys, 0, 2 * DAY);
    expect(p.surface!.fuelMade).toBeCloseTo(cap);
    expect(p.penaltyDv).toBeCloseTo(s.penaltyDv - 30);
    expect(ICE_LOAD_DV).toBeGreaterThan(30);
  });

  it('hops cost real Δv: a few km is hundreds of m/s', () => {
    expect(hopCost(10, 5000)).toBeGreaterThan(400);
    expect(hopCost(10, 100000)).toBeGreaterThan(1900);
  });
});
