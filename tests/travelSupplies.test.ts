import { beforeEach, describe, expect, it } from 'vitest';
import { DAY, G } from '../src/engine/constants';
import { truthValues } from '../src/engine/chain';
import { bestTransfer, modelFromPrimaries, planTransfer } from '../src/engine/planner';
import { generateSystem } from '../src/engine/system';
import { clock } from '../src/game/clock';
import { advanceHopTime, currentWorld, fastForward } from '../src/game/sim';
import { useGame } from '../src/game/store';
import { cruiseReserve, cruiseSupplies, flyTransfer } from '../src/game/travelSupplies';

const sys = generateSystem(316, 'navigator', 1);
const model = modelFromPrimaries(Object.fromEntries(Object.entries(truthValues(sys)).map(([key, value]) =>
  [key, { value, sigma: 0 }])), 'standard')!;
const departure = sys.windows.at(-1)!;
const routes = bestTransfer(model, departure)!;
const state = () => useGame.getState();

beforeEach(() => {
  state().newGame(316, { difficulty: 'navigator', survival: true, sound: false, formulas: true });
  useGame.setState({ phase: 'play', survival: { ...state().survival, o2: 20, food: 2 } });
});

describe('cruise supplies', () => {
  it('counts waiting at camp separately and previews air and food at departure', () => {
    const supplies = cruiseSupplies(state(), sys, departure - DAY, routes.plan)!;
    expect(supplies.air).toBe(cruiseReserve(1) + 19);
    expect(supplies.food).toBe(cruiseReserve(1) + 1);
    expect(supplies.canDepart).toBe(true);
    expect(cruiseSupplies(state(), sys, departure - 2 * DAY, routes.plan)?.canDepart).toBe(false);
  });

  it('uses the same supply estimate to stop a transfer before its capture burn', () => {
    const plan = planTransfer(model, departure, (cruiseReserve(1) + 5) * DAY)!.plan;
    const outcome = flyTransfer(state(), sys, 1e6, plan);
    expect(outcome.result.outcome).toBe('expired');
    expect(outcome.result.captureCost).toBe(0);
    expect(outcome.cruise).toMatchObject({ elapsed: (cruiseReserve(1) + 2) * DAY, airLeft: 18, foodLeft: 0 });
  });

  it('settles a viable coast and keeps failed takeoffs from using cruise stores', () => {
    const outcome = flyTransfer(state(), sys, 1e6, routes.plan);
    expect(outcome.result.outcome).toBe('success');
    expect(outcome.cruise?.elapsed).toBe(routes.plan.tof);
    expect(outcome.cruise?.foodLeft).toBeCloseTo(cruiseReserve(1) + 2 - routes.plan.tof / DAY);
    const failed = flyTransfer(state(), sys, 0, routes.plan);
    expect(failed.result.outcome).toBe('no-escape');
    expect(failed.cruise).toBeUndefined();
    const sandbox = { ...state(), settings: { ...state().settings, freeRoam: true } };
    expect(cruiseSupplies(sandbox, sys, departure, routes.plan)).toBeNull();
    expect(flyTransfer(sandbox, sys, 1e6, routes.plan).cruise?.foodLeft).toBeUndefined();
  });

  it('stops a gravity-assist flight short of the flyby and later burns', () => {
    const giant = generateSystem(316, 'navigator', 7);
    const plan = {
      ...routes.plan, departTime: giant.windows[0], tof: giant.hohmann.tof,
      flyby: { tof1: giant.hohmann.tof * .35, rp: 5 * giant.giant!.radius, rpMin: giant.giant!.radius,
        muModel: G * giant.giant!.mass, sense: 1 as const, dv: 0, extraTurn: 0, extraDv: 0 },
    };
    // The short-endurance fixture forces depletion during the first coast.
    const result = flyTransfer(state(), giant, 1e6, plan);
    expect(result.result.outcome).toBe('expired');
    expect(result.result.captureCost).toBe(0);
    expect(result.cruise?.elapsed).toBe((cruiseReserve(1) + 2) * DAY);
  });
});

describe('hop time', () => {
  it('advances the rover and debits only the fraction flown away from a day boundary', () => {
    currentWorld();
    clock.t = 100;
    clock.paused = true;
    useGame.setState({ phase: 'hop', rover: { ...state().rover, target: 50e3, arriveAt: 210 } });
    expect(advanceHopTime(240)).toBe(true);
    expect(clock.t).toBe(340);
    expect(clock.paused).toBe(true);
    expect(state().rover.dist).toBe(50e3);
    expect(state().survival.o2).toBeCloseTo(20 - 240 / DAY, 10);
    expect(state().survival.food).toBeCloseTo(2 - 240 / DAY, 10);
  });

  it('credits the part of a hop already paid when daily upkeep runs', () => {
    clock.t = DAY - 60;
    useGame.setState({ phase: 'hop' });
    expect(advanceHopTime(120)).toBe(true);
    expect(clock.t).toBe(DAY + 60);
    expect(state().survival.food).toBeCloseTo(1 - 60 / DAY, 10);
    useGame.setState({ phase: 'play' });
    state().set({ survival: { ...state().survival, food: 2 - 60 / DAY } });
    fastForward(2 * DAY);
    expect(state().survival.food).toBeCloseTo(1, 10);
    expect(state().survival.hopUpkeep).toBeUndefined();
  });
});
