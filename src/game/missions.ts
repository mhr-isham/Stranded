// The mission tracker: a guided path through the solve chain. Missions can be
// completed in any order; the tracker shows what is reachable now.

import type { GameState } from './store';

export interface Mission {
  id: string;
  title: string;
  goal: string;
  why: string;
  screen?: GameState['screen'];
  done: (s: GameState) => boolean;
}

const kept = (s: GameState, key: string) => s.readings.filter((r) => r.key === key && r.kept).length;

export const MISSIONS: Mission[] = [
  {
    id: 'gravity',
    title: 'Feel the pull',
    goal: 'Time the pendulum and keep at least 3 gravity readings.',
    why: 'Surface gravity g tells us how hard the engines must push. Together with the radius it gives the planet’s mass.',
    screen: 'pendulum',
    done: (s) => kept(s, 'g') >= 3,
  },
  {
    id: 'radius',
    title: 'Measure the world',
    goal: 'Climb the hill and keep at least 3 horizon-dip readings.',
    why: 'The higher you stand, the further the horizon dips below level. The dip reveals how curved, and so how big, this planet is.',
    screen: 'hill',
    done: (s) => kept(s, 'R1') >= 3,
  },
  {
    id: 'mass',
    title: 'Weigh the planet',
    goal: 'Enter g and R₁ on the progress sheet to unlock the planet’s mass.',
    why: 'M = gR²/G. The mass sets the escape speed — the biggest part of the fuel bill.',
    screen: 'sheet',
    done: (s) => !!s.sheet.g && !!s.sheet.R1,
  },
  {
    id: 'identify',
    title: 'Find the blue planet',
    goal: 'At night, find the steady light that does not twinkle and identify it in the telescope.',
    why: 'Stars twinkle because they are points; planets shine steadily because they are tiny disks.',
    screen: 'observatory',
    done: (s) => s.identified,
  },
  {
    id: 'year',
    title: 'How long is a year?',
    goal: 'At dusk or dawn, log the star’s position against the background stars over several weeks, then fit the drift.',
    why: 'The star creeps eastward against the stars as we orbit it. 360° divided by the daily drift is the year length P₁.',
    screen: 'observatory',
    done: (s) => !!s.sheet.P1,
  },
  {
    id: 'track',
    title: 'Watch it wander',
    goal: 'Turn on the tracker’s nightly auto-log for the blue planet.',
    why: 'Its path against the stars will loop backwards (retrograde) when we overtake it — that loop marks opposition.',
    screen: 'observatory',
    done: (s) => s.trackOn,
  },
  {
    id: 'opposition',
    title: 'Opposition',
    goal: 'Mark the middle of the retrograde loop: the moment of opposition.',
    why: 'At opposition the blue planet is closest and directly opposite the star — the best time to measure it.',
    screen: 'observatory',
    done: (s) => s.oppPicks.length >= 1,
  },
  {
    id: 'parallax',
    title: 'The distance scale',
    goal: 'Drive the rover far east and image the blue planet from both sites at once. Measure the shift.',
    why: 'Parallax gives the first absolute distance in the system. Everything else — orbit sizes, star mass — is scaled from it.',
    screen: 'rover',
    done: (s) => !!s.sheet.dPar,
  },
  {
    id: 'disk',
    title: 'Size the target',
    goal: 'Measure the angular diameter of the blue planet with the telescope micrometer.',
    why: 'Angle × distance = size. You will aim for an orbit just above its surface.',
    screen: 'observatory',
    done: (s) => !!s.sheet.alpha2,
  },
  {
    id: 'moon',
    title: 'Weigh it with its moon',
    goal: 'Track the moon’s swing around the blue planet; fit its greatest elongation and period.',
    why: 'Kepler’s third law around the blue planet: M₂ = 4π²a³/(GP²). You need M₂ to brake into orbit.',
    screen: 'observatory',
    done: (s) => !!s.sheet.thetaM && !!s.sheet.Pm,
  },
  {
    id: 'synodic',
    title: 'Full circle',
    goal: 'Mark the next opposition too. The time between them is the synodic period S.',
    why: 'From S and our year P₁ we get the blue planet’s year, and from Kepler’s third law, its orbit size.',
    screen: 'observatory',
    done: (s) => !!s.sheet.S2,
  },
  {
    id: 'plan',
    title: 'Plot the course',
    goal: 'Open the launch planner with a complete progress sheet and pick a departure date.',
    why: 'A Hohmann transfer is cheapest, but only when the blue planet leads us by just the right angle.',
    screen: 'launch',
    done: (s) => s.missionsDone.includes('plan'),
  },
];

export function activeMission(s: GameState) {
  return MISSIONS.find((m) => !m.done(s)) ?? null;
}
