import { describe, expect, it } from 'vitest';
import { DIFFICULTY } from '../src/engine/system';
import { MODES, MODE_ORDER } from '../src/game/modes';
import { useGame } from '../src/game/store';
import { checkMissions } from '../src/game/sim';
import { ECHO } from '../src/game/echo';

describe('modes', () => {
  it('every mode has margins and rules', () => {
    for (const id of MODE_ORDER) {
      expect(DIFFICULTY[id]).toBeDefined();
      expect(MODES[id].expect.length).toBeGreaterThan(0);
    }
  });

  it('margins and help shrink as modes get harder', () => {
    for (let i = 1; i < MODE_ORDER.length; i++) {
      const easy = MODE_ORDER[i - 1];
      const hard = MODE_ORDER[i];
      expect(DIFFICULTY[hard].fuelAllowance).toBeLessThan(DIFFICULTY[easy].fuelAllowance);
      expect(DIFFICULTY[hard].lifeSlack[1]).toBeLessThan(DIFFICULTY[easy].lifeSlack[1]);
      expect(MODES[hard].hints).toBeLessThanOrEqual(MODES[easy].hints);
      expect(MODES[hard].rewinds).toBeLessThanOrEqual(MODES[easy].rewinds);
      expect(MODES[hard].checkpoints).toBeLessThanOrEqual(MODES[easy].checkpoints);
    }
  });

  it('Navigator keeps goals and warnings without volunteering methods or correcting guesses', () => {
    expect(MODES.navigator).toMatchObject({ missions: 'goals', coaching: false, sanity: true, hints: 1, verifies: 2, checkpoints: 3, rewinds: 1, rewindPenalty: 150 });
    useGame.getState().newGame(316, { difficulty: 'navigator', survival: false, formulas: true, sound: false });
    checkMissions();
    useGame.getState().say(ECHO.parallax);
    expect(useGame.getState().echo).toEqual([]);
    useGame.getState().say(ECHO.lowLife);
    expect(useGame.getState().echo.map((l) => l.id)).toEqual(['lowLife']);
  });

  it('Astronomer permits formulas and warnings while retaining its independent one-shot rules', () => {
    expect(MODES.astronomer).toMatchObject({ missions: 'off', coaching: false, sanity: true, formulas: false, hints: 0, verifies: 0, checkpoints: 0, rewinds: 0 });
    expect(MODES.astronomer.formulasLocked).not.toBe(true);
  });
});
