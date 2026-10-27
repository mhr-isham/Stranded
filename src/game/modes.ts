// What each mode promises and which kinds of help it gives. The physics is the
// same in every mode; only margins (engine/system.ts DIFFICULTY), help and
// pressure change. Margins quoted in `expect` are measured from the generator —
// update them together (see docs/DESIGN-V2.md §3–4).

import type { Difficulty } from '../engine/types';
import { useGame } from './store';

export interface ModeRules {
  name: string;
  tag: string;
  forWho: string;
  expect: string[];
  /** Formula sheet default when the mode is picked. */
  formulas: boolean;
  /** Formula sheet can't be turned on. */
  formulasLocked?: boolean;
  /** Survival is always on. */
  survivalForced?: boolean;
  /** ECHO's warnings on suspicious readings, and the scatter-based error guide. */
  sanity: boolean;
  /** Mission tracker: full coaching, goals only, or hidden (you plan). */
  missions: 'coach' | 'goals' | 'off';
  /** ECHO volunteers coaching lines (next steps, "it's going backwards!"). */
  coaching: boolean;
  /** Hint levels available per quantity on the sheet (0–3). */
  hints: number;
  /** Hints cost score. */
  hintsCost: boolean;
  /** "Ask ECHO to verify" uses per run. */
  verifies: number;
  /** Manual checkpoint saves per run (Infinity = any time). */
  checkpoints: number;
  /** Rewinds to the launch planner after a failed flight. */
  rewinds: number;
  /** Score penalty per rewind. */
  rewindPenalty: number;
  /** Days of dust-storm warning in survival mode. */
  stormForecast: number;
  /** Landing: attitude hold and wider limits. */
  landingAssist: boolean;
  /** Δv in the descent tank (separate from the launch fuel). */
  landingDv: number;
}

export const MODES: Record<Difficulty, ModeRules> = {
  stargazer: {
    name: 'Stargazer',
    tag: 'Relaxed',
    forWho: 'Learning at your own pace, or just enjoying the sky.',
    expect: [
      'Huge spare fuel (about 30–60% over the ideal flight) — rough measurements still get you there.',
      'Spare air of roughly 6 months to 2 years after the first launch window you can reach.',
      'ECHO coaches every step. Hints are free. Rewind as often as you like after a failed flight.',
    ],
    formulas: true,
    sanity: true,
    missions: 'coach',
    coaching: true,
    hints: 3,
    hintsCost: false,
    verifies: Infinity,
    checkpoints: Infinity,
    rewinds: Infinity,
    rewindPenalty: 0,
    stormForecast: 3,
    landingAssist: true,
    landingDv: 1300,
  },
  cadet: {
    name: 'Cadet',
    tag: 'Forgiving',
    forWho: 'Your first full expeditions.',
    expect: [
      'Plenty of spare fuel (about 20–40% over the ideal flight) to absorb measurement mistakes.',
      'Lots of spare air: roughly 3–13 months after the first launch window you can reach.',
      'ECHO coaches you and flags odd readings. 3 hint levels, any-time checkpoints, one rewind after a failed flight.',
    ],
    formulas: true,
    sanity: true,
    missions: 'coach',
    coaching: true,
    hints: 3,
    hintsCost: true,
    verifies: 5,
    checkpoints: Infinity,
    rewinds: 1,
    rewindPenalty: 0,
    stormForecast: 2,
    landingAssist: true,
    landingDv: 1100,
  },
  navigator: {
    name: 'Navigator',
    tag: 'Standard',
    forWho: 'Once you are comfortable with every tool.',
    expect: [
      'Spare fuel about 10–20%: careful work succeeds, sloppy work does not.',
      'Spare air roughly 2–8 months — you can miss a window, but not many.',
      'Missions show goals, not instructions. 1 hint level, 3 checkpoints, one rewind (costs score).',
    ],
    formulas: true,
    sanity: true,
    missions: 'goals',
    coaching: true,
    hints: 1,
    hintsCost: true,
    verifies: 2,
    checkpoints: 3,
    rewinds: 1,
    rewindPenalty: 150,
    stormForecast: 1,
    landingAssist: true,
    landingDv: 900,
  },
  astronomer: {
    name: 'Astronomer',
    tag: 'Hard',
    forWho: 'After a Navigator success.',
    expect: [
      'Thin spare fuel, about 6–13%: every error bar matters.',
      'Spare air roughly 1–5 months — often only one launch window.',
      'No mission list, hints or verify — you plan. ECHO stays quiet. Formula sheet off by default. One shot: no checkpoints or rewinds.',
    ],
    formulas: false,
    sanity: true,
    missions: 'off',
    coaching: false,
    hints: 0,
    hintsCost: true,
    verifies: 0,
    checkpoints: 0,
    rewinds: 0,
    rewindPenalty: 0,
    stormForecast: 0,
    landingAssist: false,
    landingDv: 750,
  },
  legend: {
    name: 'Legend',
    tag: 'Hardest',
    forWho: 'After an Astronomer success. For the very best.',
    expect: [
      'Spare fuel only about 5–9%; spare air roughly 1–4 months.',
      'Survival always on. No formula sheet, and no warnings about suspicious readings — check your own data.',
      'Everything Astronomer removes, removed. One shot.',
    ],
    formulas: false,
    formulasLocked: true,
    survivalForced: true,
    sanity: false,
    missions: 'off',
    coaching: false,
    hints: 0,
    hintsCost: true,
    verifies: 0,
    checkpoints: 0,
    rewinds: 0,
    rewindPenalty: 0,
    stormForecast: 0,
    landingAssist: false,
    landingDv: 650,
  },
};

export const MODE_ORDER: Difficulty[] = ['stargazer', 'cadet', 'navigator', 'astronomer', 'legend'];

export const modeOf = (d: Difficulty): ModeRules => MODES[d] ?? MODES.navigator;

/** Rules of the expedition in progress, as a hook. */
export function useMode() {
  return modeOf(useGame((s) => s.settings.difficulty));
}

/** Rules of the expedition in progress, outside React. */
export const currentMode = () => modeOf(useGame.getState().settings.difficulty);

/** "∞" for unlimited counts, else the number. */
export const countText = (n: number) => (Number.isFinite(n) ? String(n) : '∞');
