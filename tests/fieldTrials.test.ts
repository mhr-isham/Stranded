import { afterEach, beforeEach, expect, it } from 'vitest';
import { DAY, DEG } from '../src/engine/constants';
import { comparePendulumTrial, compareStarTrial, makePrediction, pendingOf, predictionPoints, resolveNow, resolvePredictions } from '../src/game/predictions';
import { useGame } from '../src/game/store';

const settings = useGame.getState().settings;
beforeEach(() => useGame.setState({ settings: { ...settings, sound: false } }));
afterEach(() => useGame.setState({ predictions: [], settings }));

it('waits for a fresh manual timing at the chosen setting and keeps the comparison outside score', () => {
  const id = makePrediction({ kind: 'pendulum', made: 10, due: 10, at: 1, value: 2, sigma: .1, fieldTrial: true });
  const pendulum = { length: 1.012, period: 2.04, technique: { source: 'manual' as const, releaseId: 'release', angle: 6, turns: 10 } };
  expect(resolveNow(id, 5)).toBeNull();
  resolvePredictions(20 * DAY);
  comparePendulumTrial({ at: 9, pendulum });
  comparePendulumTrial({ at: 10, pendulum: { ...pendulum, length: 2 } });
  comparePendulumTrial({ at: 10, pendulum: { ...pendulum, technique: { ...pendulum.technique, releaseId: '' } } });
  expect(pendingOf(useGame.getState(), 'pendulum')?.id).toBe(id);
  comparePendulumTrial({ at: 10, pendulum });
  expect(useGame.getState().predictions[0].result).toMatchObject({ truth: 2.04, points: 0, observedAt: 10 });
  expect(predictionPoints(useGame.getState())).toBe(0);
  comparePendulumTrial({ at: 11, pendulum: { ...pendulum, period: 4 } });
  expect(useGame.getState().predictions[0].result?.truth).toBe(2.04);
});

it('uses the actual manual sky reading on the forecast day and expires missed windows', () => {
  const forecast = { kind: 'star' as const, made: 0, due: DAY, at: 1, value: 361, sigma: 2, fieldTrial: true as const };
  makePrediction(forecast);
  resolvePredictions(DAY);
  compareStarTrial({ at: DAY - 1, v: DEG, source: 'manual' });
  compareStarTrial({ at: DAY, v: DEG, source: 'tracker' });
  expect(pendingOf(useGame.getState(), 'star')).not.toBeNull();
  compareStarTrial({ at: DAY + 123, v: 2 * DEG, source: 'manual' });
  expect(useGame.getState().predictions[0].result).toEqual({ truth: 362, z: .5, points: 0, observedAt: DAY + 123 });
  const id = makePrediction(forecast);
  expect(id).not.toBe(useGame.getState().predictions[0].id);
  resolvePredictions(2 * DAY);
  expect(pendingOf(useGame.getState(), 'star')).toBeNull();
  expect(useGame.getState().predictions[1]).toMatchObject({ missed: true });
});
