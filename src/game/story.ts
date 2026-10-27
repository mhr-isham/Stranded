// Story scenes and logs (docs/STORY.md). Scenes play at natural pauses and can
// always be skipped; every scene stays readable in the Codex under Logs.
// Logs belong to the player, not the run: they survive new expeditions.

import { useGame } from './store';

export type Speaker = 'echo' | 'vale' | 'mira' | 'navigator' | 'note';

export interface StoryLine {
  who: Speaker;
  text: string;
}

export interface StoryLog {
  title: string;
  chapter: number;
  kind: 'scene' | 'journal' | 'discovery';
  lines: StoryLine[];
}

export const SPEAKER: Record<Speaker, { name: string; cls: string }> = {
  echo: { name: 'ECHO', cls: 'blue' },
  vale: { name: 'Commander Vale', cls: 'amber' },
  mira: { name: 'Mira Sato · Halcyon journal', cls: 'violet' },
  navigator: { name: 'You', cls: '' },
  note: { name: '', cls: 'faint' },
};

export const LOGS: Record<string, StoryLog> = {
  fall: {
    title: 'Fold exit — irregular',
    chapter: 1,
    kind: 'scene',
    lines: [
      { who: 'echo', text: 'The fold drive misfired on its first long jump. We dropped out deep inside a star system no one has charted.' },
      { who: 'echo', text: 'Hull holding. Radio gone. Most of my memory corrupted. One load of fuel. Commander Vale’s pod is failing — that is our clock.' },
      { who: 'echo', text: 'And a pulse on the radio from the blue planet: a beacon forty years out of date. The Halcyon’s.' },
    ],
  },
  relay: {
    title: 'A star that moves',
    chapter: 1,
    kind: 'discovery',
    lines: [
      { who: 'echo', text: 'That is not a star. It crossed a good part of the sky while we watched — it’s in orbit around this planet, a few planet-radii up.' },
      { who: 'echo', text: 'It only shows in the evening and the morning, when our sky is dark but it still catches the light. Something small and shiny. Something built.' },
      { who: 'echo', text: 'No transponder answers. But I can read the hull markings at full zoom: H-A-L-C-Y-O-N. A relay satellite. They were here.' },
      { who: 'note', text: 'Real satellites behave the same way: they are seen just after dusk and before dawn, and they vanish when they pass into the planet’s shadow.' },
    ],
  },
  vale1: {
    title: 'First wake-up',
    chapter: 1,
    kind: 'scene',
    lines: [
      { who: 'note', text: 'A hiss of cold air. ECHO risks a partial thaw to check the failing pod.' },
      { who: 'vale', text: '…How long?' },
      { who: 'echo', text: 'Long enough to measure a planet, Commander. The Navigator has been busy.' },
      { who: 'vale', text: 'Good. Then I don’t need to be awake for this. You’re the navigator — navigate.' },
      { who: 'vale', text: 'And ECHO… if the numbers say we wait, we wait. Don’t let me talk you into launching early.' },
      { who: 'echo', text: 'Noted. Putting you back under. Sleep well, Commander.' },
    ],
  },
  mira1: {
    title: 'Halcyon journal · Day 1',
    chapter: 1,
    kind: 'journal',
    lines: [{ who: 'mira', text: 'Day 1. The sky is wrong, and I’m the only one awake who can fix it. Pendulum first. Then the stars. Then we’ll see.' }],
  },
  mira2: {
    title: 'Halcyon journal · Day 63',
    chapter: 1,
    kind: 'journal',
    lines: [
      {
        who: 'mira',
        text: 'Measured the year three times. Got three answers. Averaged them and wrote down an error bar I’m not proud of. It’s honest, though. Honest is the only thing out here that doesn’t run out.',
      },
    ],
  },
  toolbox: {
    title: 'A Halcyon toolbox',
    chapter: 0,
    kind: 'discovery',
    lines: [
      { who: 'note', text: 'Half buried in the regolith: a dented toolbox stamped HALCYON. Inside, wrapped in plastic, a page of horizon-dip readings.' },
      { who: 'echo', text: 'Every reading has an error bar. Some of them are wider than mine would have been. All of them are honest.' },
      { who: 'mira', text: 'Dip 1.07° ± 0.02°. Wind. Hands cold. Taking the mean anyway — Mira.' },
    ],
  },
  brief2: {
    title: 'The Silent Planet',
    chapter: 2,
    kind: 'scene',
    lines: [
      { who: 'echo', text: 'The Halcyon coils took us one jump closer. New system. Another blue planet — and another beacon, fainter than the last.' },
      { who: 'echo', text: 'One problem: I’ve watched it for hours. Nothing orbits it. No moon. Without something swinging around it, we can’t weigh it — and without its mass, we can’t plan the braking burn.' },
      { who: 'echo', text: 'But we have probes on the rail. If we throw one past the planet and listen to its radio, the planet will tell us how heavy it is.' },
      { who: 'note', text: 'Optional: the Flight School module “Weighing a planet with a flyby” is in the Codex.' },
    ],
  },
  cache2: {
    title: 'Debris in orbit',
    chapter: 2,
    kind: 'scene',
    lines: [
      { who: 'echo', text: 'Orbit confirmed. And the probe’s last pictures showed something else in orbit: twisted metal, tumbling.' },
      { who: 'echo', text: 'Its orbit is decaying very slowly in the thin top of the air. From the rate, it has been up there for decades. Forty years, give or take.' },
      { who: 'vale', text: '…Are the others all right? Ada?' },
      { who: 'echo', text: 'All pods stable, Commander. Yours is the only one complaining.' },
      { who: 'vale', text: 'Typical. Carry on, Navigator.' },
    ],
  },
  mira3: {
    title: 'Halcyon journal · Day 212',
    chapter: 2,
    kind: 'journal',
    lines: [{ who: 'mira', text: 'No moon. Of course no moon. We threw our last probe at it. It came back with a number. I have never loved a number more.' }],
  },
  brief3: {
    title: 'Thick Air',
    chapter: 3,
    kind: 'scene',
    lines: [
      { who: 'echo', text: 'Third system. The air here is thick and wet — beautiful sunsets, terrible for measuring.' },
      { who: 'echo', text: 'Low light skims through the densest air and bends. The horizon will look higher than it really is, so the hill would tell us the planet is far bigger than it is.' },
      { who: 'note', text: 'Near the landing site stands a small cairn of stones with a straight metal rod in it. Scratched into the flat rock at its foot: a row of short lines, each marked with a date.' },
      { who: 'echo', text: 'Noon shadows. Someone measured the length of this rod’s shadow at noon, day after day. Someone who knew the horizon couldn’t be trusted here.' },
      { who: 'note', text: 'Optional: the Flight School module “Light bends in air · Eratosthenes” is in the Codex.' },
    ],
  },
  cache3: {
    title: 'The rod by the cairn',
    chapter: 3,
    kind: 'scene',
    lines: [
      { who: 'echo', text: 'Orbit confirmed. The cache was where the beacon said: water, filters, and a second drive coil.' },
      { who: 'vale', text: 'You look tired, Navigator. Is there coffee left?' },
      { who: 'echo', text: 'There is something the ship calls coffee.' },
      { who: 'vale', text: 'Then there’s hope.' },
    ],
  },
  mira4: {
    title: 'Halcyon journal · Day 340',
    chapter: 3,
    kind: 'journal',
    lines: [{ who: 'mira', text: 'The air lies about the horizon. Twice I got a planet twice its real size. Use the sun instead — a stick, a shadow, a long walk north. Eratosthenes would laugh at me.' }],
  },
  brief5: {
    title: 'Inward',
    chapter: 5,
    kind: 'scene',
    lines: [
      { who: 'echo', text: 'This time the beacon is on a planet inside our orbit. It never strays far from the star: we will only see it in twilight.' },
      { who: 'echo', text: 'No oppositions, no retrograde loops at midnight. But every so often it will pass right in front of the star — a transit. The solar camera can time those.' },
      { who: 'note', text: 'Optional: the Flight School module “Inner planets and transits” is in the Codex.' },
    ],
  },
  cache5: {
    title: 'The mid-route beacon',
    chapter: 5,
    kind: 'scene',
    lines: [
      { who: 'echo', text: 'Orbit confirmed. The beacon is in orbit around this planet, not on it. I timed its transits too — it crosses the planet’s face every few hours.' },
      { who: 'vale', text: 'Navigator. When this is over — where’s home, for you?' },
      { who: 'navigator', text: 'Somewhere with a sky I can name.' },
      { who: 'vale', text: 'Good answer.' },
    ],
  },
  mira5: {
    title: 'Halcyon journal · Day 501',
    chapter: 5,
    kind: 'journal',
    lines: [{ who: 'mira', text: 'Inner planets never stand opposite the sun. You have to catch them at the edge, in the half-light, and wait for them to cross the sun’s face. Patience is a measuring instrument too.' }],
  },
  cache1: {
    title: 'The beacon',
    chapter: 1,
    kind: 'scene',
    lines: [
      { who: 'echo', text: 'Orbit confirmed. The beacon is directly below us, on a ridge above the sea.' },
      { who: 'note', text: 'The cache is a sealed case under a cairn of stones: spare fold-drive coils, a pressure suit too small for anyone aboard, and a journal.' },
      { who: 'echo', text: 'The journal belongs to the Halcyon’s navigator. Mira Sato. The first page is dated forty-one years ago.' },
      { who: 'echo', text: 'The coils fit our drive. She left them for whoever came next. She expected someone would.' },
    ],
  },
};

/** Unlock a log and (optionally) play its scene now. */
export function unlockLog(id: keyof typeof LOGS | string, play = true) {
  const s = useGame.getState();
  if (s.tutorial.active || !LOGS[id]) return;
  const logs = s.logs.includes(id) ? s.logs : [...s.logs, id];
  useGame.setState({ logs, storyQueue: play && !s.logs.includes(id) ? [...s.storyQueue, id] : s.storyQueue });
}

export const playLog = (id: string) => useGame.setState((s) => ({ storyQueue: [...s.storyQueue, id] }));
