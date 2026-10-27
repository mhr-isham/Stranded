// Astronomer Challenges (docs/DESIGN-V2.md §4.3): optional realistic
// handicaps for Astronomer and Legend, unlocked by one Astronomer success.
// Each is something real expeditions have had to cope with.

import { DAY } from '../engine/constants';
import { hash32 } from '../engine/rng';
import type { GameState } from './store';

export type ChallengeId = 'stopwatch' | 'seeing' | 'rover' | 'noFormula' | 'survival' | 'handFit' | 'noSanity' | 'shortAir';

export const CHALLENGES: Record<ChallengeId, { name: string; icon: string; text: string }> = {
  stopwatch: { name: 'Worn stopwatch', icon: '⏱', text: 'The button sticks: every timing is late by up to 0.2 s.' },
  seeing: { name: 'Bad-seeing season', icon: '🌫', text: 'Turbulent air all season: the telescope image swims three times as much.' },
  rover: { name: 'Tired rover', icon: '🚙', text: 'Half the rover’s speed and range.' },
  noFormula: { name: 'No formula sheet', icon: '📕', text: 'You work from memory.' },
  survival: { name: 'Survival', icon: '🔥', text: 'Survival mode is on.' },
  handFit: { name: 'Fit by hand', icon: '✍️', text: 'No automatic fits: you read the drift and the moon’s swing off the charts yourself and type the values on the sheet.' },
  noSanity: { name: 'No safety net', icon: '🕳', text: 'ECHO never warns about suspicious readings.' },
  shortAir: { name: 'Short supplies', icon: '🫁', text: 'A quarter less spare air.' },
};

export const CHALLENGE_IDS = Object.keys(CHALLENGES) as ChallengeId[];

/** Unlocked after reaching orbit once in Astronomer (or Legend). */
export const challengesUnlocked = (s: Pick<GameState, 'atlas'>) => s.atlas.some((c) => c.outcome === 'success' && (c.mode === 'astronomer' || c.mode === 'legend'));

export const hasChallenge = (s: Pick<GameState, 'settings'>, id: ChallengeId) => !!s.settings.challenges?.includes(id);

/** Score bonus: 5% per challenge. */
export const challengeBonus = (s: Pick<GameState, 'settings'>) => 1 + 0.05 * (s.settings.challenges?.length ?? 0);

/** Telescope seeing multiplier for this night (bad-seeing season, or a real bad night in the hard modes). */
export function seeingFactor(s: Pick<GameState, 'settings' | 'seed'>, t: number) {
  const night = Math.floor(t / DAY);
  const base = hasChallenge(s, 'seeing') ? 3 : 1;
  // Real nights vary: about one night in five the air is rough.
  const rough = hash32(s.seed, night, 0x5ee) / 4294967296 < 0.2 ? 2.2 : 1;
  return base * rough;
}
