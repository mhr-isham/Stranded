// The mission tracker: a guided path through the solve chain. Missions can be
// completed in any order; the tracker shows what is reachable now.

import type { GameState } from './store';

export interface Mission {
  id: string;
  title: string;
  /** Goal only, without the method (for modes that don't coach). */
  short: string;
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
    short: 'Measure the surface gravity g.',
    goal: 'Time the pendulum and keep at least 3 gravity readings.',
    why: 'Surface gravity g tells us how hard the engines must push. Together with the radius it gives the planet’s mass.',
    screen: 'pendulum',
    done: (s) => kept(s, 'g') >= 3,
  },
  {
    id: 'radius',
    title: 'Measure the world',
    short: 'Measure the planet’s radius R₁.',
    goal: 'Climb the hill and keep at least 3 horizon-dip readings.',
    why: 'The higher you stand, the further the horizon dips below level. The dip reveals how curved, and so how big, this planet is.',
    screen: 'hill',
    done: (s) => kept(s, 'R1') >= 3,
  },
  {
    id: 'mass',
    title: 'Weigh the planet',
    short: 'Put g and R₁ on the progress sheet.',
    goal: 'Enter g and R₁ on the progress sheet to unlock the planet’s mass.',
    why: 'M = gR²/G. The mass sets the escape speed — the biggest part of the fuel bill.',
    screen: 'sheet',
    done: (s) => !!s.sheet.g && !!s.sheet.R1,
  },
  {
    id: 'identify',
    title: 'Find the blue planet',
    short: 'Identify the blue planet in the night sky.',
    goal: 'At night, find the steady light that does not twinkle and identify it in the telescope.',
    why: 'Stars twinkle because they are points; planets shine steadily because they are tiny disks.',
    screen: 'observatory',
    done: (s) => s.identified,
  },
  {
    id: 'year',
    title: 'How long is a year?',
    short: 'Measure the length of the year P₁.',
    goal: 'At dusk or dawn, log the star’s position against the background stars over several weeks, then fit the drift.',
    why: 'The star creeps eastward against the stars as we orbit it. 360° divided by the daily drift is the year length P₁.',
    screen: 'observatory',
    done: (s) => !!s.sheet.P1,
  },
  {
    id: 'track',
    title: 'Watch it wander',
    short: 'Start following the blue planet’s path.',
    goal: 'Turn on the tracker’s nightly auto-log for the blue planet.',
    why: 'Its path against the stars will loop backwards (retrograde) when we overtake it — that loop marks opposition.',
    screen: 'observatory',
    done: (s) => s.trackOn,
  },
  {
    id: 'opposition',
    title: 'Opposition',
    short: 'Find the time of opposition.',
    goal: 'Mark the middle of the retrograde loop: the moment of opposition.',
    why: 'At opposition the blue planet is closest and directly opposite the star — the best time to measure it.',
    screen: 'observatory',
    done: (s) => s.oppPicks.length >= 1,
  },
  {
    id: 'parallax',
    title: 'The distance scale',
    short: 'Measure the distance to the blue planet.',
    goal: 'Drive the rover far east and image the blue planet from both sites at once. Measure the shift.',
    why: 'Parallax gives the first absolute distance in the system. Everything else — orbit sizes, star mass — is scaled from it.',
    screen: 'rover',
    done: (s) => !!s.sheet.dPar,
  },
  {
    id: 'disk',
    title: 'Size the target',
    short: 'Measure the blue planet’s angular size.',
    goal: 'Measure the angular diameter of the blue planet with the telescope micrometer.',
    why: 'Angle × distance = size. You will aim for an orbit just above its surface.',
    screen: 'observatory',
    done: (s) => !!s.sheet.alpha2,
  },
  {
    id: 'moon',
    title: 'Weigh it with its moon',
    short: 'Measure the moon’s orbit (θₘ and Pₘ).',
    goal: 'Track the moon’s swing around the blue planet; fit its greatest elongation and period.',
    why: 'Kepler’s third law around the blue planet: M₂ = 4π²a³/(GP²). You need M₂ to brake into orbit.',
    screen: 'observatory',
    done: (s) => !!s.sheet.thetaM && !!s.sheet.Pm,
  },
  {
    id: 'synodic',
    title: 'Full circle',
    short: 'Measure the synodic period S.',
    goal: 'Mark the next opposition too. The time between them is the synodic period S.',
    why: 'From S and our year P₁ we get the blue planet’s year, and from Kepler’s third law, its orbit size.',
    screen: 'observatory',
    done: (s) => !!s.sheet.S2,
  },
  {
    id: 'plan',
    title: 'Plot the course',
    short: 'Plan the transfer.',
    goal: 'Open the launch planner with a complete progress sheet and pick a departure date.',
    why: 'A Hohmann transfer is cheapest, but only when the blue planet leads us by just the right angle.',
    screen: 'launch',
    done: (s) => s.missionsDone.includes('plan'),
  },
];

export function activeMission(s: GameState) {
  return missionsFor(s).find((m) => !m.done(s)) ?? null;
}

const byId = (id: string) => MISSIONS.find((m) => m.id === id)!;

/** Chapter 2: no moon, so the probe flyby replaces the moon missions. */
const CH2: Mission[] = [
  ...['gravity', 'radius', 'mass', 'identify', 'year', 'track', 'opposition', 'parallax', 'disk'].map(byId),
  {
    id: 'probeLaunch',
    title: 'Throw something past it',
    short: 'Launch the probe at the blue planet.',
    goal: 'In the probe bay, choose how close the probe should pass — in units of your measured R₂ — and launch it. It costs fuel and takes weeks to arrive.',
    why: 'With no moon, the only way to weigh the blue planet is to watch something fall past it.',
    screen: 'probe',
    done: (s) => s.probesLaunched > 0,
  },
  {
    id: 'probeRead',
    title: 'Weigh it with the probe',
    short: 'Measure v∞, vₚ and rₚ from the flyby.',
    goal: 'After the flyby, read the probe’s far-away speed and its peak speed from the Doppler chart, and its closest approach from the altimeter. Send all three to the sheet.',
    why: 'Falling things speed up: the heavier the planet, the bigger the speed-up. vₚ² − v∞² = 2GM₂/rₚ.',
    screen: 'probe',
    done: (s) => !!s.sheet.vInf && !!s.sheet.vPeak && !!s.sheet.rPeri,
  },
  byId('synodic'),
  byId('plan'),
];

/** Chapter 3: thick air fools the horizon; noon shadows at two sites measure the planet. */
const CH3: Mission[] = [
  byId('gravity'),
  {
    id: 'shadows',
    title: 'Measure the world, the old way',
    short: 'Measure the planet’s radius R₁.',
    goal: 'The thick air bends light near the horizon, so the hill can’t be trusted here. Log the noon shadow at camp, drive the rover due north, and log its noon shadow on the same day.',
    why: 'Eratosthenes’ method: the difference in the noon sun’s angle between two places on one meridian, and the distance between them, give the planet’s size.',
    screen: 'gnomon',
    done: (s) => !!s.sheet.R1,
  },
  ...['mass', 'identify', 'year', 'track', 'opposition', 'parallax', 'disk', 'moon', 'synodic', 'plan'].map(byId),
];

/** Chapter 5: an inner planet — transits instead of oppositions. */
const CH5: Mission[] = [
  ...['gravity', 'radius', 'mass'].map(byId),
  {
    ...byId('identify'),
    goal: 'In the twilight after sunset or before sunrise, find the steady light that never strays far from the star, and identify it in the telescope.',
    why: 'An inner planet always stays near the star in our sky — an “evening star” or a “morning star”.',
  },
  byId('year'),
  {
    ...byId('track'),
    title: 'Watch it swing',
    goal: 'Turn on the tracker. It can only catch the planet in twilight; it logs how far the planet is from the star.',
    why: 'An inner planet swings out from the star to its greatest elongation and back. sin ε = a₂/a₁.',
  },
  {
    id: 'transit',
    title: 'A dot on the star',
    short: 'Time a transit.',
    goal: 'When the planet swings in front of the star, watch through the solar filter (Sky → Transit tab) and log when it enters and leaves the star’s disk.',
    why: 'At mid-transit the planet is exactly between us and the star. That moment fixes where both planets are.',
    screen: 'observatory',
    done: (s) => s.oppPicks.length >= 1,
  },
  {
    ...byId('parallax'),
    goal: 'When the planet is high in a dark twilight sky (near greatest elongation), drive the rover far east and image it from both sites at once.',
  },
  byId('disk'),
  byId('moon'),
  {
    id: 'synodic',
    title: 'Full circle',
    short: 'Measure the synodic period S.',
    goal: 'Time a second transit. The time between them is the synodic period S.',
    why: 'The planet laps us, so 1/P₂ = 1/P₁ + 1/S. From P₂ and our year, Kepler gives its orbit size.',
    screen: 'observatory',
    done: (s) => !!s.sheet.S2,
  },
  byId('plan'),
];

/** Chapter 4: an oval orbit — uneven oppositions, and Kepler's method to find the ellipse. */
const CH4: Mission[] = [
  ...['gravity', 'radius', 'mass', 'identify', 'year', 'track', 'opposition', 'parallax', 'disk', 'moon'].map(byId),
  {
    id: 'uneven',
    title: 'Uneven seasons',
    short: 'Mark a second opposition.',
    goal: 'Keep the tracker running and mark the next opposition too. Compare the gap with what a circular orbit would give.',
    why: 'On an ellipse the planet moves faster near the star, so the gaps between oppositions change from one to the next.',
    screen: 'observatory',
    done: (s) => s.oppPicks.length >= 2,
  },
  {
    id: 'ellipse',
    title: 'Kepler’s method',
    short: 'Fit the blue planet’s ellipse.',
    goal: 'In the observatory’s Orbit tab, fit an ellipse to the tracker’s nightly positions and send P₂, e and ϖ to the sheet.',
    why: 'To meet the planet you must know where it will be on its ellipse when you arrive — not where a circle says it would be.',
    screen: 'observatory',
    done: (s) => !!s.sheet.Porb && !!s.sheet.ecc && !!s.sheet.wPeri,
  },
  byId('plan'),
];

/** Chapter 6: a tidally locked planet around a red dwarf — no day, no night, and flares. */
const CH6: Mission[] = [
  ...['gravity', 'radius', 'mass', 'identify'].map(byId),
  {
    ...byId('year'),
    goal: 'The star never moves here, but the whole sky turns once a year. In the observatory’s Year tab, log the sky’s turn every few days for a few weeks, then fit the rate.',
    why: 'A locked planet turns once per orbit, so the stars circle overhead once a year: P₁ = 360° / (turn rate).',
  },
  {
    ...byId('track'),
    goal: 'Turn on the tracker. With no daylight it logs around the clock — except during flares, when the sky is washed out.',
  },
  {
    ...byId('parallax'),
    goal: 'Near opposition the planet hangs low in the east, almost along an east–west line, so drive the rover SOUTH this time, and image the planet from both sites at once.',
    why: 'A parallax baseline has to run across the line of sight. Along it, the two views barely differ.',
  },
  ...['opposition', 'disk', 'moon', 'synodic', 'plan'].map(byId),
];

/** Chapter 7: a far target and a giant to swing past on the way. */
const CH7: Mission[] = [
  ...['gravity', 'radius', 'mass', 'identify', 'year', 'track', 'opposition'].map(byId),
  {
    id: 'farYear',
    title: 'A poor clock',
    short: 'Fit the blue planet’s year P₂.',
    goal: 'The blue planet is so far out that its synodic period is almost our own year. Keep the tracker running, then use the Orbit tab to fit its year directly (Kepler’s method).',
    why: 'When S is close to P₁, a day’s error in S becomes weeks in P₂. Fitting its slow drift avoids that.',
    screen: 'observatory',
    done: (s) => !!s.sheet.Porb,
  },
  {
    id: 'giantTrack',
    title: 'The giant',
    short: 'Track the giant.',
    goal: 'In the observatory’s Giant tab, turn on the giant tracker. It logs the giant nightly and its big moon through the night.',
    why: 'We can’t reach the blue planet directly. The giant can throw us there — if we know where it will be and how heavy it is.',
    screen: 'observatory',
    done: (s) => s.trackGOn || s.trackG.length > 0,
  },
  {
    id: 'giantOrbit',
    title: 'Where the giant will be',
    short: 'Measure the giant’s S_G and opposition.',
    goal: 'Mark two of the giant’s oppositions, then sharpen them with Kepler’s method in the Giant tab. Send S_G and t_G to the sheet.',
    why: 'We meet the giant years from now: a small error in its period grows into a big miss.',
    screen: 'observatory',
    done: (s) => !!s.sheet.Sg && !!s.sheet.tOppG,
  },
  {
    ...byId('parallax'),
    goal: 'This time triangulate the GIANT: it is far closer than the blue planet, so its shift is much bigger. Drive the rover out and image it from both sites at once.',
    why: 'Parallax works best on near things. The giant’s distance sets the scale of the whole system.',
  },
  byId('disk'),
  byId('moon'),
  {
    id: 'giantMoon',
    title: 'Weigh the giant',
    short: 'Measure the giant’s moon (θ_G and P_G).',
    goal: 'Fit the swing of the giant’s moon in the Giant tab and send θ_G and its period to the sheet.',
    why: 'The giant’s mass decides how hard it bends our path. Too light a guess, and it flings us off course.',
    screen: 'observatory',
    done: (s) => !!s.sheet.thetaMg && !!s.sheet.Pmg,
  },
  byId('plan'),
];

/** Chapter 8: the usual chain, plus stellar parallax for a navigation fix. */
const CH8: Mission[] = [
  ...['gravity', 'radius', 'mass', 'identify', 'year', 'track', 'opposition', 'parallax', 'disk', 'moon', 'synodic'].map(byId),
  {
    id: 'starPar',
    title: 'Three wobbling stars',
    short: 'Measure the parallax of Kestrel, Wren and Osprey.',
    goal: 'In the observatory’s Stars tab, log each of the three stars every few weeks for most of a year, fit each yearly wobble and send the parallaxes to the sheet.',
    why: 'Our own orbit is the baseline: a star whose wobble is p away is a₁ / tan p from here.',
    screen: 'observatory',
    done: (s) => !!s.sheet.pStarA && !!s.sheet.pStarB && !!s.sheet.pStarC,
  },
  {
    id: 'fix',
    title: 'Where we are',
    short: 'Confirm a navigation fix.',
    goal: 'Compare your three distances with the Halcyon’s catalogue in the Stars tab. When exactly one place fits, confirm it.',
    why: 'Three distances to known stars pin down where you are, the way three radio beacons would.',
    screen: 'observatory',
    done: (s) => !!s.navFix,
  },
  byId('plan'),
];

/** The missions of the current chapter. */
export function missionsFor(s: Pick<GameState, 'chapter'>): Mission[] {
  if (s.chapter === 2) return CH2;
  if (s.chapter === 3) return CH3;
  if (s.chapter === 4) return CH4;
  if (s.chapter === 5) return CH5;
  if (s.chapter === 6) return CH6;
  if (s.chapter === 7) return CH7;
  if (s.chapter === 8) return CH8;
  return MISSIONS;
}
