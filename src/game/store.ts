// Persistent game state (zustand + localStorage). Time itself lives in clock.ts.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Estimate, PrimaryKey } from '../engine/chain';
import type { LaunchPlan, LaunchResult } from '../engine/launch';
import type { Difficulty } from '../engine/types';
import { clock } from './clock';
import { modeOf } from './modes';
import type { Prediction } from './predictions';
import type { ProbeState } from './probeState';
import type { AtlasCard, SystemNames } from './atlas';

export type Screen =
  | 'probe'
  | 'gnomon'
  | 'hub'
  | 'pendulum'
  | 'hill'
  | 'observatory'
  | 'rover'
  | 'sheet'
  | 'launch'
  | 'workshop'
  | 'codex';
export type Phase = 'title' | 'prologue' | 'intro' | 'play' | 'ascent' | 'flight' | 'landing' | 'results';

export interface Reading {
  id: string;
  key: PrimaryKey;
  value: number;
  at: number;
  kept: boolean;
  note: string;
}

export interface TimedValue {
  at: number;
  v: number;
}

export interface Settings {
  difficulty: Difficulty;
  survival: boolean;
  formulas: boolean;
  sound: boolean;
}

export interface SurvivalState {
  o2: number; // days of oxygen
  food: number; // days of food
  power: number; // battery %, 0..100
  parts: number;
  salvageLeft: number;
  upgrades: string[];
  greenhouseSince: number | null;
  leak: boolean;
  lastDay: number;
  log: string[];
}

export interface EchoLine {
  id: string;
  text: string;
  /** Coaching (next steps, discoveries pointed out); silent in modes where ECHO doesn't coach. */
  coach?: boolean;
  mood?: 'calm' | 'alert' | 'happy';
}

export interface CampInfo {
  site: 'flat' | 'hill' | 'ice' | 'rough';
  landing: 'clean' | 'rough' | 'rescued' | 'skipped';
  /** Position along the landing strip (m) and distances to features (km). */
  x: number;
  hillKm: number;
  iceKm: number;
}

export interface Outcome {
  plan: LaunchPlan;
  result: LaunchResult;
  sheet: Partial<Record<PrimaryKey, Estimate>>;
}

export interface TutorialState {
  active: boolean;
  step: number;
  /** Things the player has done that tutorial steps wait for (e.g. 'pend-released'). */
  flags: string[];
  /** Lessons the player has opened (for the lesson library). */
  lessons: string[];
  /** Extra text ECHO shows on the current step (e.g. the pre-flight report). */
  note?: string[];
}

export interface GameState {
  phase: Phase;
  screen: Screen;
  settings: Settings;
  seed: number;
  savedT: number;
  readings: Reading[];
  sheet: Partial<Record<PrimaryKey, Estimate>>;
  starObs: TimedValue[]; // star longitude against background stars (rad)
  trackOn: boolean;
  track: TimedValue[]; // blue planet longitude (rad), nightly
  moonTrackOn: boolean;
  moonTrack: TimedValue[]; // moon offset from planet (rad)
  identified: boolean;
  oppPicks: number[]; // times the player marked as oppositions
  rover: { dist: number; target: number; departAt: number; arriveAt: number };
  missionsDone: string[];
  hintsUsed: number;
  checksUsed: number;
  penaltyDv: number; // fuel spent on "is it right?" checks
  codex: string[];
  achievements: string[];
  echo: EchoLine[];
  seenEcho: string[];
  survival: SurvivalState;
  outcome: Outcome | null;
  lastNightLog: number;
  tutorial: TutorialState;
  /** Identifies this run, so checkpoints from an older run are ignored. */
  runId: number;
  /** Campaign chapter of this run (1 = the first system, also used for plain expeditions). */
  chapter: number;
  /** Best result per chapter and mode, kept across runs. */
  campaign: Record<number, { done: boolean; best: Partial<Record<Difficulty, { grade: string; score: number }>> }>;
  /** A launch waiting for the hand-flown ascent. */
  pendingLaunch: { plan: LaunchPlan } | null;
  /** Fuel the hand-flown ascent cost beyond ECHO's profile (m/s; negative = saved). */
  ascentPenalty: number | null;
  /** How the landing at the blue planet went. */
  arrival: { landing: 'clean' | 'rough' | 'rescued' | 'skipped'; site: string } | null;
  /** Chapter 2: the probe sent past the blue planet. */
  probe: ProbeState | null;
  probesLaunched: number;
  /** Chapter 5: the solar camera that times transits. */
  sunCamOn: boolean;
  sunLog: TimedValue[];
  /** Chapter 3: noon-shadow (gnomon) readings at camp and at the rover. */
  shadows: { site: 'camp' | 'rover'; at: number; alt: number; dist: number }[];
  /** Chapter 3: the rover's trip due north (m) for the second gnomon. */
  northTrip: { dist: number; arriveAt: number };
  /** Where and how the ship came down in the prologue. */
  camp: CampInfo | null;
  predictions: Prediction[];
  /** Your names for this system's bodies (private). */
  names: SystemNames;
  /** Every finished run, kept across expeditions. */
  atlas: AtlasCard[];
  /** Story logs unlocked (kept across expeditions) and scenes waiting to play. */
  logs: string[];
  storyQueue: string[];
  /** Acts whose end card the player has seen. */
  actsSeen: number[];
  checkpointsUsed: number;
  rewindsUsed: number;
  /** The player has seen the true values; no more rewinds. */
  debriefSeen: boolean;

  set: (p: Partial<GameState>) => void;
  go: (screen: Screen) => void;
  newGame: (seed: number, settings: Settings, chapter?: number) => void;
  addReading: (r: Omit<Reading, 'id' | 'kept' | 'note'> & { note?: string }) => void;
  toggleReading: (id: string) => void;
  removeReading: (id: string) => void;
  setSheet: (k: PrimaryKey, e: Estimate | undefined) => void;
  say: (line: EchoLine) => void;
  dismissEcho: () => void;
  unlock: (kind: 'codex' | 'achievements', id: string) => void;
}

export const freshSurvival = (lifeDays: number): SurvivalState => ({
  o2: Math.round(lifeDays * 1.02),
  food: Math.round(lifeDays * 1.0),
  power: 80,
  parts: 2,
  salvageLeft: 12,
  upgrades: [],
  greenhouseSince: null,
  leak: false,
  lastDay: 0,
  log: [],
});

const initial = {
  phase: 'title' as Phase,
  screen: 'hub' as Screen,
  settings: { difficulty: 'navigator' as Difficulty, survival: false, formulas: true, sound: true },
  seed: 1,
  savedT: 0,
  readings: [] as Reading[],
  sheet: {},
  starObs: [],
  trackOn: false,
  track: [],
  moonTrackOn: false,
  moonTrack: [],
  identified: false,
  oppPicks: [] as number[],
  rover: { dist: 0, target: 0, departAt: 0, arriveAt: 0 },
  missionsDone: [],
  hintsUsed: 0,
  checksUsed: 0,
  penaltyDv: 0,
  codex: [],
  achievements: [],
  echo: [],
  seenEcho: [],
  survival: freshSurvival(600),
  outcome: null,
  lastNightLog: -1,
  tutorial: { active: false, step: 0, flags: [], lessons: [] } as TutorialState,
  runId: 0,
  chapter: 1,
  campaign: {} as GameState['campaign'],
  camp: null as CampInfo | null,
  probe: null as ProbeState | null,
  pendingLaunch: null as GameState['pendingLaunch'],
  ascentPenalty: null as number | null,
  arrival: null as GameState['arrival'],
  probesLaunched: 0,
  shadows: [] as GameState['shadows'],
  sunCamOn: false,
  sunLog: [] as TimedValue[],
  northTrip: { dist: 0, arriveAt: 0 },
  predictions: [] as Prediction[],
  names: {} as SystemNames,
  atlas: [] as AtlasCard[],
  actsSeen: [] as number[],
  logs: [] as string[],
  storyQueue: [] as string[],
  checkpointsUsed: 0,
  rewindsUsed: 0,
  debriefSeen: false,
};

let nextId = Date.now();

export const useGame = create<GameState>()(
  persist(
    (set, get) => ({
      ...initial,
      set: (p) => set(p),
      go: (screen) => set({ screen }),
      newGame: (seed, settings, chapter = 1) => {
        clock.t = 0;
        clock.paused = false;
        clock.warpIndex = 3;
        clock.stopAt = Infinity;
        set({
          ...initial,
          phase: 'prologue',
          runId: Date.now(),
          chapter,
          campaign: get().campaign ?? {},
          seed,
          settings,
          codex: get().codex,
          achievements: get().achievements,
          atlas: get().atlas ?? [],
          logs: get().logs ?? [],
          tutorial: { ...initial.tutorial, lessons: get().tutorial?.lessons ?? [] },
        });
      },
      addReading: (r) =>
        set((s) => ({ readings: [...s.readings, { ...r, id: String(nextId++), kept: true, note: r.note ?? '' }] })),
      toggleReading: (id) => set((s) => ({ readings: s.readings.map((r) => (r.id === id ? { ...r, kept: !r.kept } : r)) })),
      removeReading: (id) => set((s) => ({ readings: s.readings.filter((r) => r.id !== id) })),
      setSheet: (k, e) =>
        set((s) => {
          const sheet = { ...s.sheet };
          if (e) sheet[k] = e;
          else delete sheet[k];
          return { sheet };
        }),
      say: (line) =>
        set((s) =>
          line.coach && !modeOf(s.settings.difficulty).coaching ? s : (s.seenEcho.includes(line.id) ? s : { echo: [...s.echo, line], seenEcho: [...s.seenEcho, line.id] })),
      dismissEcho: () => set((s) => ({ echo: s.echo.slice(1) })),
      unlock: (kind, id) => set((s) => (s[kind].includes(id) ? s : { [kind]: [...s[kind], id] } as Partial<GameState>)),
    }),
    {
      name: 'stranded-save-v1',
      version: 2,
      migrate: (old) => ({ ...(old as object), tutorial: { active: false, step: 0, flags: [], lessons: [] } }) as unknown as GameState,
      partialize: (s) => {
        const { set: _a, go: _b, newGame: _c, addReading: _d, toggleReading: _e, removeReading: _f, setSheet: _g, say: _h, dismissEcho: _i, unlock: _j, ...rest } = s;
        return { ...rest, savedT: clock.t };
      },
      onRehydrateStorage: () => (state) => {
        if (state) clock.t = state.savedT;
      },
    },
  ),
);

/** Mean and standard error of the kept readings of one quantity. */
export function readingStats(readings: Reading[], key: PrimaryKey) {
  const rs = readings.filter((r) => r.key === key && r.kept);
  const n = rs.length;
  if (!n) return null;
  const mean = rs.reduce((a, r) => a + r.value, 0) / n;
  const sd = n > 1 ? Math.sqrt(rs.reduce((a, r) => a + (r.value - mean) ** 2, 0) / (n - 1)) : NaN;
  const at = rs.reduce((a, r) => a + r.at, 0) / n;
  return { n, mean, sd, se: sd / Math.sqrt(n), at };
}
