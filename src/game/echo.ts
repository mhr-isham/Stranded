// Lines for ECHO, the ship's damaged navigation AI.

import type { EchoLine } from './store';

// The opening ship log. See docs/STORY.md for the story these belong to.
export const INTRO: { title: string; text: string }[] = [
  {
    title: 'Fold exit — irregular',
    text: 'The Kestrel’s fold drive misfired on its first long jump. We dropped out deep inside a star system no one has charted and came down hard on the first world in our way.',
  },
  {
    title: 'Systems report',
    text: 'Hull: holding. Long-range radio: gone. Star catalogue and most of my memory: corrupted. Fuel: one fixed load. Fold drive: needs parts — and a calibration of this system before it can jump anywhere.',
  },
  {
    title: 'Commander Vale',
    text: 'Four crew in cryo. Commander Vale’s pod is failing; it draws on the same life support as you. That is our clock. It is not a generous one.',
  },
  {
    title: 'A pulse on the radio',
    text: 'Something on the blue planet is transmitting — a beacon, very regular and very old. The design is forty years out of date. The Halcyon’s. The ship that vanished on this same route.',
  },
  {
    title: 'The plan',
    text: 'To reach it I need numbers: this world’s size and gravity, its year, how far away the blue planet is and how heavy everything is. You measure; I calculate. Be honest about your errors — bad numbers burn fuel we don’t have.',
  },
];

export const ECHO: Record<string, EchoLine> = {
  welcomeQuiet: {
    id: 'welcomeQuiet',
    text: 'Hello again, Navigator. ECHO online — arithmetic only, as you asked. The tools are around the camp; the plan is yours. I’ll speak up if the air runs low.',
  },
  welcome: {
    id: 'welcome',
    text: 'Hello again, Navigator. I’m ECHO — what is left of me. Your missions are on the left. Start with the pendulum rig next to the ship: let’s find out how heavy things are here.',
  },
  gravity: {
    id: 'gravity',
    coach: true,
    text: 'Pendulum rig ready. Time as many swings as you can in one go — your reaction time is the same for 1 swing or 20, so 20 swings shrink the error twenty-fold.',
  },
  radius: {
    id: 'radius',
    coach: true,
    text: 'Good. Now the hill. From the summit, the horizon dips below level by an angle θ. For height h: R ≈ 2h/θ². Tiny angles, so zoom in and hold steady.',
  },
  mass: {
    id: 'mass',
    coach: true,
    text: 'With g and R we can weigh the whole planet: M = gR²/G. Open the progress sheet and enter your values with honest error bars.',
  },
  identify: {
    id: 'identify',
    coach: true,
    text: 'Night is our laboratory. Somewhere up there is the blue planet. Stars twinkle; planets shine steadily. Find the steady one and point the telescope at it.',
    mood: 'calm',
  },
  year: {
    id: 'year',
    coach: true,
    text: 'Our year next. At dusk or dawn, when stars and our star share the sky, log where the star sits against the background. Repeat over weeks — a longer baseline means a smaller error.',
  },
  track: {
    id: 'track',
    coach: true,
    text: 'Turn on auto-tracking for the blue planet. Every clear night I will log its position. Warp time and watch the path — it will loop backwards when we overtake it.',
  },
  retrograde: {
    id: 'retrograde',
    coach: true,
    text: 'It’s moving backwards against the stars! Retrograde. We are overtaking it on the inside track. The middle of this loop is opposition.',
    mood: 'happy',
  },
  parallax: {
    id: 'parallax',
    coach: true,
    text: 'Opposition is close — the planet is as near as it gets. Send the rover east. When both cameras see the planet at once, its position shifts against the stars. That shift is parallax: d = B / p.',
    mood: 'alert',
  },
  moon: {
    id: 'moon',
    coach: true,
    text: 'There is a faint dot swinging back and forth beside the blue planet. A moon! Its orbit lets us weigh the blue planet — exactly as Kepler would have done.',
    mood: 'happy',
  },
  plan: {
    id: 'plan',
    coach: true,
    text: 'The chain is complete. Let’s open the launch planner. The cheapest path — a Hohmann transfer — opens once per synodic period. Missing it costs fuel; waiting costs air.',
  },
  predict: {
    id: 'predict',
    coach: true,
    text: 'With two logs you can already call your shot: predict where the star will be in a couple of weeks. Reason from your own line, give an honest range — I’ll tell you how it went.',
  },
  relayHint: {
    id: 'relayHint',
    text: 'One more thing from the night sky: just after dusk I keep catching a faint light that moves while the stars stand still. If you see it in the Sky view, tap it.',
  },
  flare: {
    id: 'flare',
    text: 'Flare. The star just brightened several times over — the sky is washed out and the instruments are blind until it fades, an hour or a few. Red dwarfs do this. They come at random: I can tell you the rate, never the next one.',
  },
  lockedSky: {
    id: 'lockedSky',
    text: 'The star never moves here. This planet keeps one face to it — one turn per orbit — so the sky above us turns once a year. We live in the twilight band: permanent dusk, the star just below the western horizon.',
  },
  transitSoon: {
    id: 'transitSoon',
    coach: true,
    text: 'The planet is closing in on the star. A transit is due within a few days — make sure the solar camera is on.',
  },
  nameIt: {
    id: 'nameIt',
    text: 'Nobody has ever named that blue world. If you’d like to, the progress sheet has a “Name this system” button. Only we will know.',
  },
  lowLife: {
    id: 'lowLife',
    text: 'Warning: life support below 15%. Whatever we know now is what we launch with.',
    mood: 'alert',
  },
  roverArrived: {
    id: 'roverArrived',
    text: 'Rover in position. Its camera is synced to our telescope. Image the blue planet when it is high in the sky for both sites.',
  },
};
