import { describe, expect, it } from 'vitest';
import { DIFFICULTY } from '../src/engine/system';
import { MODES, MODE_ORDER } from '../src/game/modes';

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
});
