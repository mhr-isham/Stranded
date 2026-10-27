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
export const completedActs = (s: GameState) => actsFor(s.chapter).filter((a) => a.missions.every((m) => done(s, m))).map((a) => a.n);

/** The act the player is currently in. */
export const currentAct = (s: GameState) => {
  const acts = actsFor(s.chapter);
  return acts.find((a) => !a.missions.every((m) => done(s, m))) ?? acts[acts.length - 1];
};

/** Acts per chapter: the same five beats, with the chapter's own missions. */
export function actsFor(chapter: number): Act[] {
  if (chapter === 2)
    return ACTS.map((a) =>
      a.n === 4
        ? {
            ...a,
            name: 'The probe',
            missions: ['probeLaunch', 'probeRead', 'synodic'],
            learned: ['A probe speeds up as it falls past a planet; the speed-up weighs it: M₂ = rₚ(vₚ² − v∞²)/(2G).', 'The time between two oppositions is the synodic period.'],
          }
        : a,
    );
  if (chapter === 3)
    return ACTS.map((a) =>
      a.n === 1
        ? {
            ...a,
            missions: ['gravity', 'shadows', 'mass'],
            learned: ['Thick air bends light near the horizon, so the hill gave the wrong size.', 'Noon shadows at two sites on one meridian measure the planet: R = d/Δ.', 'Gravity and size weigh the whole planet.'],
          }
        : a,
    );
  if (chapter === 4)
    return ACTS.map((a) =>
      a.n === 4
        ? {
            ...a,
            name: 'The ellipse',
            missions: ['moon', 'uneven', 'ellipse'],
            learned: [
              'Kepler’s first law: planets move on ellipses with the star at one focus.',
              'Kepler’s second law: a planet sweeps equal areas in equal times — fast near the star, slow far away — so oppositions come unevenly.',
              'Directions alone, seen from our known orbit, pin down the ellipse: Kepler’s method.',
            ],
          }
        : a.n === 5
          ? { ...a, learned: ['On an ellipse, launch windows come unevenly too: the planner searches the real cost, date by date.'] }
          : a,
    );
  if (chapter === 6)
    return ACTS.map((a) =>
      a.n === 2
        ? {
            ...a,
            learned: [
              'A tidally locked planet turns once per orbit: one face always day, one always night, and a twilight band between.',
              'The star stands still in our sky, but the stars wheel overhead once a year — 360° ÷ the turn rate is the year.',
              'The tracker works around the clock here, except when a flare washes out the sky.',
            ],
          }
        : a.n === 3
          ? { ...a, learned: ['Near opposition the planet is low in the east, so the parallax baseline runs north–south.', ...a.learned.slice(1)] }
          : a,
    );
  if (chapter === 7)
    return ACTS.map((a) =>
      a.n === 3
        ? { ...a, missions: ['opposition', 'farYear', 'giantTrack'], learned: ['The far planet’s synodic period is nearly our year — a poor clock — so its year comes from fitting its drift.', 'The giant is the key to the trip.'] }
        : a.n === 4
          ? {
              ...a,
              name: 'The giant',
              missions: ['giantOrbit', 'parallax', 'disk', 'moon', 'giantMoon'],
              learned: ['Parallax works best on near things: triangulate the giant.', 'A giant’s moon weighs it, as for the blue planet.', 'Kepler’s method pins a planet’s timing better than eyeballing its loop.'],
            }
          : a.n === 5
            ? { ...a, learned: ['A gravity assist swaps speed with a planet: we leave the giant faster, relative to the star, than we arrived.'] }
            : a,
    );
  if (chapter === 5)
    return ACTS.map((a) =>
      a.n === 3
        ? {
            ...a,
            missions: ['transit', 'parallax', 'disk'],
            learned: ['An inner planet crosses the star’s face at inferior conjunction — a transit.', 'Its distance by parallax is measured in twilight, near greatest elongation.', 'Angle × distance = size.'],
            hook: 'We know where it is and how big. Now its weight — and its moon is swinging around it.',
          }
        : a,
    );
  return ACTS;
}
