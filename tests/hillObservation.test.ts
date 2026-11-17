import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { HOUR } from '../src/engine/constants';
import { braceSeconds, hillPitch, hillTravel, travelTime } from '../src/game/hillObservation';
import { advance, spendTime } from '../src/game/sim';
import { useGame } from '../src/game/store';
import { clock } from '../src/game/clock';

const stations = [{ name: 'Camp', h: 0 }, { name: 'Boulder field', h: 350 }, { name: 'Saddle', h: 700 }, { name: 'Summit', h: 1000 }];
beforeEach(() => {
  vi.useFakeTimers();
  useGame.getState().newGame(316, { difficulty: 'cadet', survival: false, sound: false, formulas: true, freeRoam: true });
  useGame.setState({ phase: 'play' });
  clock.t = 500; clock.paused = true; clock.realtime = false; clock.pauseAtStop = false; clock.warpIndex = 5;
});
afterEach(() => vi.useRealTimers());

it('previews the same walking, vertical and setup time charged for the journey', () => {
  const up = hillTravel(stations, 0, 1, 4)!;
  expect(up).toEqual({ gain: 350, walk: HOUR, vertical: HOUR, setup: HOUR / 4, total: 2.25 * HOUR });
  expect(travelTime(up.total)).toBe('2 h 15 min');
  expect(hillTravel(stations, 1, 2, 20)!.total).toBe(1.25 * HOUR); // between hill stations: no camp walk
  const down = hillTravel(stations, 1, 0, 8)!;
  expect(down.gain).toBe(-350);
  expect(down.total).toBe(3.25 * HOUR);
  expect(hillTravel(stations, 0, 0, 4)!.total).toBe(0);
  expect(hillTravel(stations, 0, -1)).toBeNull();
  expect(hillTravel(stations, .5, 1)).toBeNull();
  expect(hillTravel(stations, 0, 1, NaN)).toBeNull();
});

it('keeps aiming in a mechanical range and gives bracing four real seconds', () => {
  expect(hillPitch(-.3 + .005)).toBe(-.295);
  expect(hillPitch(200)).toBe(15);
  expect(hillPitch(-200)).toBe(-15);
  expect(hillPitch(Infinity)).toBe(0);
  expect(braceSeconds(5000, 1000)).toBe(4);
  expect(braceSeconds(5000, 2500)).toBe(2.5);
  expect(braceSeconds(5000, 6000)).toBe(0);
});

it('charges the previewed expedition time and pauses on arrival without overshoot', () => {
  const done = vi.fn(), cost = hillTravel(stations, 0, 1, 4)!.total, start = clock.t;
  spendTime(cost, done, { pauseOnArrival: true });
  for (let i = 0; i < 100 && !clock.paused; i++) advance(.1);
  expect(clock.t).toBeCloseTo(start + cost, 8);
  expect(clock.paused).toBe(true);
  vi.advanceTimersByTime(50);
  expect(done).toHaveBeenCalledOnce();
  expect(clock.warpIndex).toBe(5);
  const arrived = clock.t;
  advance(.1);
  expect(clock.t).toBe(arrived);
});

it('cancels unfinished travel while retaining elapsed time and restoring prior clock settings', () => {
  const done = vi.fn(), cancel = spendTime(HOUR, done, { pauseOnArrival: true });
  advance(.1);
  const spent = clock.t;
  expect(spent).toBeGreaterThan(500);
  cancel();
  vi.advanceTimersByTime(1000);
  expect(done).not.toHaveBeenCalled();
  expect(clock.t).toBe(spent);
  expect(clock.stopAt).toBe(Infinity);
  expect(clock.paused).toBe(true);
  expect(clock.pauseAtStop).toBe(false);
  expect(clock.warpIndex).toBe(5);
});

it('preserves the arrival pause when leaving just before the completion callback', () => {
  const done = vi.fn(), cancel = spendTime(HOUR, done, { pauseOnArrival: true });
  for (let i = 0; i < 100 && !clock.paused; i++) advance(.1);
  cancel(); vi.advanceTimersByTime(50);
  expect(clock.paused).toBe(true);
  expect(clock.warpIndex).toBe(5);
  expect(done).not.toHaveBeenCalled();
});

it('does not let an abandoned action mutate a different run or a replacement action', () => {
  const oldDone = vi.fn(), cancel = spendTime(HOUR, oldDone, { pauseOnArrival: true });
  spendTime(2 * HOUR, vi.fn());
  const target = clock.stopAt;
  cancel();
  expect(clock.stopAt).toBe(target);
  expect(clock.paused).toBe(false);
  useGame.setState({ runId: useGame.getState().runId + 1 });
  clock.warpIndex = 1;
  vi.advanceTimersByTime(1000);
  expect(clock.warpIndex).toBe(1);
  expect(oldDone).not.toHaveBeenCalled();
});

it('keeps the existing non-pausing default for other time-spending actions', () => {
  const done = vi.fn(), target = clock.t + HOUR;
  spendTime(HOUR, done);
  for (let i = 0; i < 100 && clock.t < target; i++) advance(.1);
  vi.advanceTimersByTime(50);
  expect(done).toHaveBeenCalledOnce();
  expect(clock.paused).toBe(false);
  expect(clock.warpIndex).toBe(5);
});

it('retains an explicit pause made during a journey that started unpaused', () => {
  clock.paused = false;
  const cancel = spendTime(HOUR, vi.fn(), { pauseOnArrival: true });
  advance(.1);
  clock.paused = true;
  cancel();
  expect(clock.paused).toBe(true);
});

it('does not enable a hill arrival even a fraction of a game second early', () => {
  const done = vi.fn();
  spendTime(HOUR, done, { pauseOnArrival: true });
  const target = clock.stopAt;
  clock.t = target - .5;
  vi.advanceTimersByTime(50);
  expect(done).not.toHaveBeenCalled();
  advance(.1);
  vi.advanceTimersByTime(50);
  expect(done).toHaveBeenCalledOnce();
  expect(clock.t).toBe(target);
  expect(clock.paused).toBe(true);
});
