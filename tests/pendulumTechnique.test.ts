import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { comparableTimings, controlledTiming, earnsTwentySwings, motionMatchesCount, observeSwingMotion, swingMotion } from '../src/game/pendulumTechnique';
import { useGame, type Reading } from '../src/game/store';
import { loadSlot, saveSlot } from '../src/game/checkpoints';
import { leaveFlightPractice, practiceSnapshot } from '../src/ui/common/flightPractice';

const reading = (id = 'a', turns = 40, swings = 20): Reading => ({ id, key: 'g', value: 8, at: 500, kept: true, note: '', pendulum: { length: 1, period: 2, time: 2 * swings, swings, technique: { source: 'manual', releaseId: id, angle: 6, turns } }, environment: { instrument: 'pendulum', at: 500, rawValue: 8, wind: { speed: 2, protection: 'windscreen' } } });
beforeEach(() => {
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
  useGame.getState().newGame(316, { difficulty: 'cadet', survival: false, sound: false, formulas: true });
  useGame.setState({ phase: 'play' });
});
afterEach(() => vi.unstubAllGlobals());

it('records changes of motion direction without double-counting stationary samples', () => {
  const motion = swingMotion(1);
  for (let i = 0; i < 40; i++) {
    observeSwingMotion(motion, 0);
    observeSwingMotion(motion, NaN);
    const omega = i % 2 === 0 ? -1 : 1;
    observeSwingMotion(motion, omega);
    observeSwingMotion(motion, omega);
  }
  expect(motion.turns).toBe(40);
});

it('recognizes controlled motion and counts without using correct gravity', () => {
  const r = reading();
  expect(earnsTwentySwings(r)).toBe(true);
  r.value = 80; // a wrong ruler reading can still have genuine controlled motion
  expect(earnsTwentySwings(r)).toBe(true);
  expect(controlledTiming(reading('short', 10, 5))).toBe(true);
  expect(earnsTwentySwings(reading('short', 10, 5))).toBe(false);
  expect(motionMatchesCount(reading('phase', 41, 20))).toBe(true);
});

it('does not award a typed twenty, ECHO observation, legacy record or uncontrolled release', () => {
  expect(earnsTwentySwings(reading('typed', 0, 20))).toBe(false);
  for (const angle of [0, .5, 11, NaN]) {
    const r = reading(); r.pendulum!.technique!.angle = angle;
    expect(earnsTwentySwings(r)).toBe(false);
  }
  const echo = reading(); echo.pendulum!.technique!.source = 'echo';
  expect(earnsTwentySwings(echo)).toBe(false);
  const legacy = reading(); delete legacy.pendulum!.technique;
  expect(earnsTwentySwings(legacy)).toBe(false);
  const excluded = reading(); excluded.kept = false;
  expect(earnsTwentySwings(excluded)).toBe(false);
  for (const turns of [-1, 3.5, Infinity, 30, 50]) expect(earnsTwentySwings(reading('bad', turns, 20))).toBe(false);
  const mismatch = reading(); mismatch.pendulum!.time = 1;
  expect(earnsTwentySwings(mismatch)).toBe(false);
});

it('uses kept comparable setups and separate releases, even at a paused expedition time', () => {
  const a = reading('a'), b = reading('b'), c = reading('c'), duplicate = { ...a, id: 'duplicate' };
  const otherLength = reading('other'); otherLength.pendulum!.length = 2;
  const otherWind = reading('wind'); otherWind.environment!.wind!.protection = 'none';
  const excluded = reading('excluded'); excluded.kept = false;
  expect(comparableTimings([a, duplicate, b, otherLength, otherWind, excluded, c]).map((r) => r.id)).toEqual(['a', 'b', 'c']);
});

it('awards once when kept, with no score resources, hint uses or global achievement changes', () => {
  const s = useGame.getState();
  const before = { penalty: s.penaltyDv, checks: s.checksUsed, hints: s.hintsUsed, achievements: s.achievements };
  s.addReading(reading('bad', 0));
  expect(useGame.getState().pendulumMilestones).toEqual([]);
  s.addReading(reading());
  s.addReading(reading('b'));
  const now = useGame.getState();
  now.toggleReading(now.readings[1].id);
  now.toggleReading(now.readings[1].id);
  expect(now.pendulumMilestones).toEqual(['twentySwings']);
  expect({ penalty: now.penaltyDv, checks: now.checksUsed, hints: now.hintsUsed, achievements: now.achievements }).toEqual(before);
});

it('keeps the once-per-expedition milestone through checkpoint loads and resets new runs', () => {
  saveSlot(0);
  useGame.getState().addReading(reading());
  loadSlot(0);
  expect(useGame.getState().readings).toEqual([]);
  expect(useGame.getState().pendulumMilestones).toEqual(['twentySwings']);
  useGame.getState().newGame(317, useGame.getState().settings);
  expect(useGame.getState().pendulumMilestones).toEqual([]);
});

it('restores expedition milestones after isolated practice, including legacy snapshots', () => {
  const back = practiceSnapshot();
  useGame.getState().addReading(reading());
  useGame.setState({ practiceReturn: back });
  leaveFlightPractice();
  expect(useGame.getState().pendulumMilestones).toEqual([]);
  delete back.state.pendulumMilestones;
  useGame.setState({ practiceReturn: back, pendulumMilestones: ['twentySwings'] });
  leaveFlightPractice();
  expect(useGame.getState().pendulumMilestones).toEqual([]);
});
