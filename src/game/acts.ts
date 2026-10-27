// Chapter 1 is split into five acts. Each ends at a high point with a save,
// a hook into the next act and a Continue button (DESIGN-V2 §12.9, §13).

import type { GameState } from './store';

export interface Act {
  n: number;
  name: string;
  /** Missions that complete this act. */
  missions: string[];
  learned: string[];
  hook: string;
}

export const ACTS: Act[] = [
  {
    n: 1,
    name: 'Ground',
    missions: ['gravity', 'radius', 'mass'],
    learned: [
      'A pendulum’s swing time measures gravity: g = 4π²L/T².',
      'The horizon dips below level from a height; the dip measures the planet’s size.',
      'Gravity and size together weigh the whole planet: M = gR²/G.',
    ],
    hook: 'Tonight the stars will show us how long a year is here — and somewhere among them is the blue planet.',
  },
  {
    n: 2,
    name: 'Sky',
    missions: ['identify', 'year', 'track'],
    learned: [
      'Stars twinkle; planets shine steadily — that’s how you found the blue planet.',
      'The star drifts east against the background stars; 360° ÷ the daily drift is the year.',
      'The tracker logs the blue planet every clear night.',
    ],
    hook: 'The blue planet is slowing down against the stars. In a few weeks it will do something strange.',
  },
  {
    n: 3,
    name: 'The blue planet',
    missions: ['opposition', 'parallax', 'disk'],
    learned: [
      'We overtake the blue planet on the inside track, so it seems to move backwards — retrograde.',
      'The middle of the loop is opposition: closest approach, the best time to measure.',
      'Two sites, one moment: parallax gives the first real distance in the system.',
      'Angle × distance = size.',
    ],
    hook: 'We know where it is and how big it is. To land, we need to know how heavy it is — and something small is swinging around it.',
  },
  {
    n: 4,
    name: 'The moon',
    missions: ['moon', 'synodic'],
    learned: [
      'A moon’s swing and period weigh its planet with Kepler’s third law.',
      'The time between two oppositions is the synodic period; with our year it gives the blue planet’s year.',
    ],
    hook: 'Everything is on the sheet. Now: plan the flight, and choose the moment.',
  },
  {
    n: 5,
    name: 'Flight',
    missions: ['plan'],
    learned: ['A Hohmann transfer opens once per synodic period — when the blue planet leads us by just the right angle.'],
    hook: 'The launch planner is open. Your numbers, your decision.',
  },
];

const done = (s: GameState, id: string) => s.missionsDone.includes(id);

/** Acts whose missions are all complete. */
export const completedActs = (s: GameState) => ACTS.filter((a) => a.missions.every((m) => done(s, m))).map((a) => a.n);

/** The act the player is currently in. */
export const currentAct = (s: GameState) => ACTS.find((a) => !a.missions.every((m) => done(s, m))) ?? ACTS[ACTS.length - 1];
