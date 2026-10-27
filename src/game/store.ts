// Persistent game state (zustand + localStorage). Time itself lives in clock.ts.

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Estimate, PrimaryKey } from '../engine/chain';
import type { LaunchPlan, LaunchResult } from '../engine/launch';
import type { Difficulty } from '../engine/types';
import { clock } from './clock';
import { modeOf } from './modes';
import type { Prediction } from './predictions';

export type Screen =
  | 'hub'
  | 'pendulum'
  | 'hill'
  | 'observatory'
  | 'rover'
  | 'sheet'
  | 'launch'
  | 'workshop'
  | 'codex';
export type Phase = 'title' | 'intro' | 'play' | 'flight' | 'results';

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
  predictions: Prediction[];
  checkpointsUsed: number;
  rewindsUsed: number;
  /** The player has seen the true values; no more rewinds. */
  debriefSeen: boolean;

  set: (p: Partial<GameState>) => void;
  go: (screen: Screen) => void;
  newGame: (seed: number, settings: Settings) => void;
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
  predictions: [] as Prediction[],
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
      newGame: (seed, settings) => {
        clock.t = 0;
        clock.paused = false;
        clock.warpIndex = 3;
        clock.stopAt = Infinity;
        set({
          ...initial,
          phase: 'intro',
          runId: Date.now(),
          seed,
          settings,
          codex: get().codex,
          achievements: get().achievements,
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
