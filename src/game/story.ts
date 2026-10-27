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
