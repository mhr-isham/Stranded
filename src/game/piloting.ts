import { modeOf } from './modes';
import { useGame, type GameState } from './store';

export type FlightLeg = 'ascent' | 'landing';
export interface PilotingRecord { ascent?: 'manual'; landing?: 'manual'; assisted: FlightLeg[] }

/** Old saves keep their original contract; scored hard runs require this from ruleset 2 onward. */
export const manualFlightRequired = (s: Pick<GameState, 'settings' | 'tutorial'>) =>
  (s.settings.rulesetVersion ?? 1) >= 2 && !!modeOf(s.settings.difficulty).manualFlight && !s.settings.freeRoam && !s.tutorial.active;

export function markFlightAssisted(leg: FlightLeg) {
  const s = useGame.getState();
  if (!manualFlightRequired(s)) return;
  const record = s.piloting ?? { assisted: [] };
  if (!record.assisted.includes(leg)) useGame.setState({ piloting: { ...record, assisted: [...record.assisted, leg] } });
}

export function completeManualFlight(leg: FlightLeg) {
  const s = useGame.getState();
  const record = s.piloting ?? { assisted: [] };
  if (!record.assisted.includes(leg)) useGame.setState({ piloting: { ...record, [leg]: 'manual' } });
}

/** The result gate also protects alternate paths that reach a debrief without flight proof. */
export function assistedFlight(s: Pick<GameState, 'settings' | 'tutorial' | 'piloting' | 'phase' | 'outcome'>) {
  return manualFlightRequired(s) && (
    !!s.piloting?.assisted.length ||
    (s.phase === 'results' && s.outcome?.result.outcome === 'success' && (s.piloting?.ascent !== 'manual' || s.piloting?.landing !== 'manual'))
  );
}
