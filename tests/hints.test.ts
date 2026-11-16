import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { gradeRun, HINT_POINT_COST } from '../src/engine/scoring';
import { useGame } from '../src/game/store';
import { unlockHint } from '../src/game/hints';
import { loadSlot, rewindToLaunch, savePrelaunch, saveSlot } from '../src/game/checkpoints';
import { requestVerification } from '../src/game/verification';

beforeEach(() => {
  useGame.getState().newGame(316, { difficulty: 'cadet', survival: false, formulas: true, sound: false });
  useGame.setState({ phase: 'play', sheet: { g: { value: 9.8, sigma: .1 } } });
  const data = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => data.set(key, value), removeItem: (key: string) => data.delete(key) });
});
afterEach(() => vi.unstubAllGlobals());

describe('paid hint progress', () => {
  it('charges a newly unlocked level once and preserves the existing 25-point grading rule', () => {
    expect(unlockHint('g', 1)).toBe(true);
    expect(unlockHint('g', 1)).toBe(false);
    expect(unlockHint('g', 3)).toBe(false);
    expect(unlockHint('g', 2)).toBe(true);
    expect(useGame.getState().hintsUsed).toBe(2);
    expect(useGame.getState().hintsSeen.g).toBe(2);
    const base = { measurementPoints: 900, fuelLeftFraction: .4, daysLeftFraction: .4, success: true };
    expect(gradeRun({ ...base, hintsUsed: 0 }).total - gradeRun({ ...base, hintsUsed: 2 }).total).toBe(2 * HINT_POINT_COST);
  });
  it('retains paid hints and verification costs across repeated checkpoint loads', () => {
    saveSlot(0);
    unlockHint('g', 1);
    requestVerification('g', 'sensors');
    for (let i = 0; i < 3; i++) {
      expect(loadSlot(0)).toBe(true);
      expect(useGame.getState().hintsSeen.g).toBe(1);
      expect(useGame.getState().hintsUsed).toBe(1);
      expect(useGame.getState().checksUsed).toBe(1);
      expect(useGame.getState().penaltyDv).toBe(40);
      expect(unlockHint('g', 1)).toBe(false);
    }
    expect(unlockHint('g', 2)).toBe(true);
    loadSlot(0);
    expect(useGame.getState().hintsSeen.g).toBe(2);
    expect(useGame.getState().hintsUsed).toBe(2);
  });
  it('retains hint access and costs after failed-flight rewind', () => {
    savePrelaunch();
    unlockHint('g', 1);
    unlockHint('R1', 1);
    expect(rewindToLaunch()).toBe(true);
    expect(useGame.getState().hintsSeen).toEqual({ g: 1, R1: 1 });
    expect(useGame.getState().hintsUsed).toBe(2);
    expect(useGame.getState().rewindsUsed).toBe(1);
  });
  it('merges different legacy hint branches and counts their unique paid levels', () => {
    unlockHint('g', 1);
    saveSlot(0);
    // Reproduce the state an older version could leave after refunding a hint.
    useGame.setState({ hintsSeen: {}, hintsUsed: 0 });
    unlockHint('R1', 1);
    loadSlot(0);
    expect(useGame.getState().hintsSeen).toEqual({ g: 1, R1: 1 });
    expect(useGame.getState().hintsUsed).toBe(2);
    loadSlot(0);
    expect(useGame.getState().hintsUsed).toBe(2);
  });
  it('uses maximum levels for overlapping legacy progress rather than charging their sum', () => {
    unlockHint('g', 1); unlockHint('g', 2);
    saveSlot(0);
    useGame.setState({ hintsSeen: { g: 1 }, hintsUsed: 1 });
    loadSlot(0);
    expect(useGame.getState().hintsSeen.g).toBe(2);
    expect(useGame.getState().hintsUsed).toBe(2);
  });
  it('preserves free Stargazer hints without converting them into paid uses', () => {
    useGame.setState((s) => ({ settings: { ...s.settings, difficulty: 'stargazer' } }));
    saveSlot(0);
    unlockHint('g', 1); unlockHint('g', 2); unlockHint('g', 3);
    loadSlot(0);
    expect(useGame.getState().hintsSeen.g).toBe(3);
    expect(useGame.getState().hintsUsed).toBe(0);
  });
  it('enforces mode limits and resets run-specific hint progress only on a new expedition', () => {
    useGame.setState((s) => ({ settings: { ...s.settings, difficulty: 'navigator' } }));
    expect(unlockHint('g', 1)).toBe(true);
    expect(unlockHint('g', 2)).toBe(false);
    expect(unlockHint('R1', 1.5)).toBe(false);
    useGame.setState({ phase: 'ascent' });
    expect(unlockHint('R1', 1)).toBe(false);
    for (const difficulty of ['astronomer', 'legend'] as const) {
      useGame.setState((s) => ({ phase: 'play', settings: { ...s.settings, difficulty } }));
      expect(unlockHint('R1', 1)).toBe(false);
    }
    useGame.getState().newGame(90, useGame.getState().settings);
    expect(useGame.getState().hintsSeen).toEqual({});
    expect(useGame.getState().hintsUsed).toBe(0);
  });
});
