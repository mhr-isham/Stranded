// Lines for ECHO, the ship's damaged navigation AI.

import type { EchoLine } from './store';

export const INTRO: { title: string; text: string }[] = [
  {
    title: 'Impact',
    text: 'The jump drive misfired. We dropped out of hyperspace inside an uncharted star system and came down hard on the first world we hit.',
  },
  {
    title: 'Systems report',
    text: 'Hull: holding. Long-range radio: destroyed. Star catalogue and navigation memory: corrupted. Fuel: fixed — there is no way to make more. Life support: counting down.',
  },
  {
    title: 'A blue light',
    text: 'There is a second planet out there — blue, with oceans and air. Our cryo-pods can keep us alive on the cruise, and a heat shield can land us. We just need to get there.',
  },
  {
    title: 'The problem',
    text: 'I can fly the ship. I can’t fly it blind. I need numbers: how big this world is, how strong its gravity, how long its year, how far away the blue planet is and how heavy it all is.',
  },
  {
    title: 'The plan',
    text: 'You measure. I calculate. Every number you give me carries an error — be honest about it. Bad numbers will burn fuel we don’t have.',
  },
];

export const ECHO: Record<string, EchoLine> = {
  welcome: {
    id: 'welcome',
    text: 'Hello again, Navigator. I’m ECHO — what is left of me. Your missions are on the left. Start with the pendulum rig next to the ship: let’s find out how heavy things are here.',
  },
  gravity: {
    id: 'gravity',
    text: 'Pendulum rig ready. Time as many swings as you can in one go — your reaction time is the same for 1 swing or 20, so 20 swings shrink the error twenty-fold.',
  },
  radius: {
    id: 'radius',
    text: 'Good. Now the hill. From the summit, the horizon dips below level by an angle θ. For height h: R ≈ 2h/θ². Tiny angles, so zoom in and hold steady.',
  },
  mass: {
    id: 'mass',
    text: 'With g and R we can weigh the whole planet: M = gR²/G. Open the progress sheet and enter your values with honest error bars.',
  },
  identify: {
    id: 'identify',
    text: 'Night is our laboratory. Somewhere up there is the blue planet. Stars twinkle; planets shine steadily. Find the steady one and point the telescope at it.',
    mood: 'calm',
  },
  year: {
    id: 'year',
    text: 'Our year next. At dusk or dawn, when stars and our star share the sky, log where the star sits against the background. Repeat over weeks — a longer baseline means a smaller error.',
  },
  track: {
    id: 'track',
    text: 'Turn on auto-tracking for the blue planet. Every clear night I will log its position. Warp time and watch the path — it will loop backwards when we overtake it.',
  },
  retrograde: {
    id: 'retrograde',
    text: 'It’s moving backwards against the stars! Retrograde. We are overtaking it on the inside track. The middle of this loop is opposition.',
    mood: 'happy',
  },
  parallax: {
    id: 'parallax',
    text: 'Opposition is close — the planet is as near as it gets. Send the rover east. When both cameras see the planet at once, its position shifts against the stars. That shift is parallax: d = B / p.',
    mood: 'alert',
  },
  moon: {
    id: 'moon',
    text: 'There is a faint dot swinging back and forth beside the blue planet. A moon! Its orbit lets us weigh the blue planet — exactly as Kepler would have done.',
    mood: 'happy',
  },
  plan: {
    id: 'plan',
    text: 'The chain is complete. Let’s open the launch planner. The cheapest path — a Hohmann transfer — opens once per synodic period. Missing it costs fuel; waiting costs air.',
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
