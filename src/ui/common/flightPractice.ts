import type { Difficulty } from '../../engine/types';
import { clock } from '../../game/clock';
import { useGame, type GameState } from '../../game/store';
import type { FlightLeg } from '../../game/piloting';
import { startRun } from './widgets';

/** Standalone drills preserve the player's existing expedition, including its clock. */
export function startFlightPractice(leg: FlightLeg, difficulty: Difficulty) {
  const s = useGame.getState();
  const state = Object.fromEntries(Object.entries(s).filter(([key, value]) => typeof value !== 'function' && key !== 'practiceReturn')) as Partial<GameState>;
  const back = s.practiceReturn ?? { state: JSON.parse(JSON.stringify(state)), t: clock.t, warpIndex: clock.warpIndex };
  startRun(316, {
    ...s.settings, difficulty, survival: false, challenges: [], formulas: true,
    freeRoam: true, freeRoamGuidance: false, showTruth: false, campaignRun: false, flightPractice: leg,
  }, 1, () => useGame.setState({ practiceReturn: back, phase: leg === 'ascent' ? 'ascent' : 'landing', pendingLaunch: null, storyQueue: [], echo: [] }));
}

export function leaveFlightPractice() {
  const s = useGame.getState();
  const back = s.practiceReturn;
  if (!back) { useGame.setState({ phase: 'title', savedT: 0 }); return; }
  clock.t = back.t;
  clock.warpIndex = back.warpIndex;
  clock.paused = true;
  clock.stopAt = Infinity;
  const settings = back.state.settings ?? s.settings;
  useGame.setState({
    ...back.state, practiceReturn: null,
    settings: { ...settings, flightSensitivity: s.settings.flightSensitivity, flightReducedMotion: s.settings.flightReducedMotion },
  });
  clock.emit();
}
