import { beforeEach, describe, expect, it } from 'vitest';
import { cadetGuidanceEnabled, dismissCadetOffer, isCadetExpedition, noteCadetWarning, walkthroughFor } from '../src/game/cadetGuidance';
import { activeMission, missionsFor } from '../src/game/missions';
import { useGame } from '../src/game/store';
import { checkMissions } from '../src/game/sim';
import { ECHO } from '../src/game/echo';
import { clock } from '../src/game/clock';

beforeEach(() => {
  useGame.getState().newGame(316, { difficulty: 'cadet', survival: false, formulas: true, sound: false });
  useGame.setState({ phase: 'play', screen: 'pendulum' });
});

describe('Cadet guidance boundaries', () => {
  it('offers one goal without restricting other activities or queuing its method', () => {
    checkMissions();
    expect(activeMission(useGame.getState())?.id).toBe('gravity');
    expect(useGame.getState().echo).toEqual([]);
    useGame.getState().go('rover');
    expect(useGame.getState().screen).toBe('rover');
    for (let i = 0; i < 3; i++) useGame.getState().addReading({ key: 'g', value: 9 + i / 100, at: i, note: '' });
    checkMissions();
    expect(activeMission(useGame.getState())?.id).toBe('radius');
    expect(useGame.getState().missionsDone).toContain('gravity');
    expect(useGame.getState().echo).toEqual([]);
    expect(useGame.getState().sheet.g).toBeUndefined();
  });

  it('counts explicit warnings for the active tool and remembers declining help', () => {
    const before = clock.t;
    checkMissions();
    expect(useGame.getState().cadetHelp.warnings).toEqual({});
    for (let i = 0; i < 3; i++) noteCadetWarning();
    expect(useGame.getState().cadetHelp.warnings.gravity).toBe(3);
    expect(clock.t).toBe(before);
    dismissCadetOffer('gravity');
    noteCadetWarning();
    expect(useGame.getState().cadetHelp.warnings.gravity).toBe(3);
    expect(useGame.getState().cadetHelp.offered).toEqual(['gravity']);
    useGame.getState().go('hill');
    noteCadetWarning();
    expect(useGame.getState().cadetHelp.warnings.radius).toBeUndefined();
  });

  it('keeps warnings and paid assistance separate from the optional goal card', () => {
    const s = useGame.getState();
    useGame.setState({ settings: { ...s.settings, cadetGuidance: false } });
    expect(isCadetExpedition(useGame.getState())).toBe(true);
    expect(cadetGuidanceEnabled(useGame.getState())).toBe(false);
    noteCadetWarning();
    useGame.getState().say(ECHO.gravity);
    useGame.getState().say(ECHO.lowLife);
    expect(useGame.getState().echo.map((l) => l.id)).toEqual(['lowLife']);
    expect(useGame.getState().cadetHelp.warnings).toEqual({});
    expect(useGame.getState().hintsUsed).toBe(0);
    expect(useGame.getState().checksUsed).toBe(0);
    expect(useGame.getState().penaltyDv).toBe(0);
  });

  it('does not apply expedition help to Flight School, Free Roam or other difficulties', () => {
    for (const settings of [
      { ...useGame.getState().settings, freeRoam: true },
      { ...useGame.getState().settings, difficulty: 'navigator' as const },
      { ...useGame.getState().settings, challenges: ['noSanity' as const] },
    ]) {
      useGame.setState({ settings });
      noteCadetWarning();
    }
    expect(useGame.getState().cadetHelp.warnings).toEqual({});
    const s = useGame.getState();
    expect(isCadetExpedition({ ...s, settings: { ...s.settings, difficulty: 'cadet' }, tutorial: { ...s.tutorial, active: true } })).toBe(false);
  });

  it('retains each chapter’s methods and provides walkthroughs without filling answers', () => {
    for (let chapter = 1; chapter <= 9; chapter++) {
      for (const m of missionsFor({ chapter })) expect(walkthroughFor(m).length).toBeGreaterThan(1);
    }
    const transit = missionsFor({ chapter: 9 }).find((m) => m.id === 'transit')!;
    expect(walkthroughFor(transit)[0]).toContain('solar filter');
    expect(walkthroughFor(missionsFor({ chapter: 3 }).find((m) => m.id === 'shadows')!)[0]).toContain('due north');
    expect(useGame.getState().sheet).toEqual({});
  });
});
