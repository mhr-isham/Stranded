// Original score “Error Bars”: 112 BPM, E minor. No third-party recordings.
// The same motif changes arrangement with the task. Pure composition permits
// rendering the actual score with OfflineAudioContext as well as live playback.
export type AudioScene = 'title' | 'explore' | 'focus' | 'planning' | 'flight' | 'story' | 'success' | 'failure';
export type Instrument = 'pad' | 'bass' | 'arp' | 'lead' | 'kick' | 'snare' | 'hat';
export interface Note {
  instrument: Instrument;
  midi: number;
  duration: number;
  velocity: number;
  pan?: number;
}
export const STEP_SECONDS = 60 / 112 / 4;
// Em9 → Cmaj9 → Gmaj9 → D6. Two bars per harmony.
const CHORDS = [
  [52, 55, 59, 62, 66],
  [48, 52, 55, 59, 62],
  [43, 47, 50, 54, 57],
  [50, 54, 57, 59, 64],
];
const MOTIF = [76, 0, 79, 0, 83, 81, 79, 0, 78, 0, 74, 0, 71, 74, 78, 0];
const ANSWER = [79, 0, 83, 0, 86, 83, 81, 0, 78, 0, 81, 0, 78, 74, 71, 0];

export function scoreStep(scene: AudioScene, step: number): Note[] {
  const notes: Note[] = [];
  const beat = step % 16;
  const chord = CHORDS[Math.floor(step / 32) % CHORDS.length];
  const add = (instrument: Instrument, midi: number, duration: number, velocity: number, pan = 0) =>
    notes.push({ instrument, midi, duration, velocity, pan });
  const quiet = scene === 'focus' || scene === 'story' || scene === 'failure';
  const flight = scene === 'flight';
  if (step % 32 === 0) chord.slice(0, 4).forEach((m, i) => add('pad', m, 32 * STEP_SECONDS, quiet ? 0.2 : 0.28, (i - 1.5) * 0.4));
  if (scene === 'failure') {
    if (beat === 0) add('lead', [71, 69, 67, 66][Math.floor(step / 16) % 4], 1.5, 0.32);
    return notes;
  }
  if (scene === 'story') {
    if (step % 8 === 0) add('arp', chord[(step / 8) % 5] + 12, 0.5, 0.28, beat < 8 ? -0.5 : 0.5);
    return notes;
  }
  if (step % (quiet ? 8 : 2) === 0) {
    const arp = [0, 2, 1, 3, 2, 4, 1, 3][Math.floor(step / 2) % 8];
    add('arp', chord[arp] + 12, flight ? 0.14 : 0.23, quiet ? 0.3 : 0.5, Math.sin(step * 0.5) * 0.65);
  }
  if (!quiet && (beat === 0 || beat === 6 || beat === 8 || beat === 14 || (flight && beat === 11)))
    add('bass', chord[0] - 12 + (beat === 14 ? 12 : 0), 0.18, 0.7);
  if (quiet && beat === 0) add('bass', chord[0] - 12, 0.6, 0.35);
  if (!quiet) {
    if (beat % 4 === 0 || (flight && beat === 14)) add('kick', 36, 0.25, flight ? 0.85 : 0.65);
    if (beat === 4 || beat === 12) add('snare', 38, 0.16, flight ? 0.65 : 0.4);
    if (beat % (flight ? 1 : 2) === 0)
      add('hat', 42, beat % 4 === 2 ? 0.1 : 0.04, beat % 4 === 2 ? 0.38 : 0.2, beat % 4 < 2 ? -0.25 : 0.25);
  }
  // Focus leaves room for instrument timing; full phrases return at camp.
  if (!quiet && step % 4 === 0) {
    const phrase = Math.floor(step / 64) % 2 ? ANSWER : MOTIF;
    const midi = phrase[Math.floor(step / 4) % phrase.length];
    if (midi)
      add(
        'lead',
        midi + (scene === 'success' ? 12 : 0),
        flight ? 0.28 : 0.42,
        scene === 'title' || scene === 'success' ? 0.65 : 0.4,
        -0.12,
      );
  }
  if (flight && step % 2 === 1) add('arp', chord[step % 5] + 24, 0.09, 0.22, 0.5);
  return notes;
}

export interface AudioState {
  phase: string;
  screen: string;
  storyQueue: unknown[];
  outcome: { result: { outcome: string } } | null;
}
export function sceneFor(s: AudioState): AudioScene {
  if (s.phase === 'title') return 'title';
  if (s.storyQueue.length || s.phase === 'intro') return 'story';
  if (s.phase === 'results') return s.outcome?.result.outcome === 'success' ? 'success' : 'failure';
  if (['prologue', 'ascent', 'flight', 'landing', 'hop'].includes(s.phase)) return 'flight';
  if (s.screen === 'launch') return 'planning';
  if (['pendulum', 'hill', 'observatory', 'rover', 'gnomon', 'probe', 'codex', 'sheet'].includes(s.screen)) return 'focus';
  return 'explore';
}
