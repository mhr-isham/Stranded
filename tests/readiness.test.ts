import { describe, expect, it } from 'vitest';
import { keysFor, truthValues, type Primaries } from '../src/engine/chain';
import { DAY } from '../src/engine/constants';
import { flightReadiness, navigationProgress } from '../src/game/readiness';
import { world } from '../src/game/world';

describe('navigation progress and transfer readiness', () => {
  const { system } = world(316, 'navigator');
  const truth = truthValues(system);
  const complete = Object.fromEntries(keysFor('standard').map(k => [k, { value: truth[k], sigma: 0 }])) as Primaries;

  it('counts sheet entries separately from whether a transfer can be evaluated', () => {
    const partial = { g: complete.g };
    const context = [system, system.fuelDv, 0, system.lifeSupport] as const;
    expect(navigationProgress(partial, 'standard').logged).toBe(1);
    expect(flightReadiness(partial, ...context)).toEqual({ status: 'missing' });
    const unusable = { ...complete, g: { value: 10, sigma: NaN } };
    expect(navigationProgress(unusable, 'standard')).toMatchObject({ logged: keysFor('standard').length, invalid: ['g'] });
    expect(flightReadiness(unusable, ...context)).toEqual({ status: 'invalid-model' });
    expect(flightReadiness(complete, system, system.fuelDv, 2 * DAY, DAY)).toEqual({ status: 'no-window' });
  });

  it('counts capture within the budget and retains every draw in the estimate', () => {
    const ample = flightReadiness(complete, system, system.fuelDv * 10, 0, system.lifeSupport);
    expect(ample.status).toBe('sampled');
    if (ample.status !== 'sampled') return;
    expect(ample.summary).toMatchObject({ attempted: 24, succeeded: 24 });
    const noFuel = flightReadiness(complete, system, 0, 0, system.lifeSupport);
    expect(noFuel).toMatchObject({ status: 'sampled', window: ample.window,
      summary: { attempted: 24, succeeded: 0, unsuccessful: 24, unassessable: 0 } });
    const broad = Object.fromEntries(keysFor('standard').map(k => [k, { value: truth[k], sigma: Math.abs(truth[k]) * 10 }])) as Primaries;
    const uncertain = flightReadiness(broad, system, system.fuelDv, 0, system.lifeSupport);
    expect(uncertain.status).toBe('sampled');
    if (uncertain.status !== 'sampled') return;
    const { attempted, succeeded, unsuccessful, unassessable } = uncertain.summary;
    expect(unassessable).toBeGreaterThan(0);
    expect(succeeded + unsuccessful + unassessable).toBe(attempted);
  });
});
