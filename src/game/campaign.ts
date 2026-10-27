// The campaign: one star system per chapter, each teaching one new idea
// (docs/DESIGN-V2.md §7, docs/STORY.md §4). Chapter lessons are optional —
// "Train first" or "Jump in".

import type { LessonId } from '../ui/tutorial/lessons';
import type { GameState } from './store';

export interface ChapterSpec {
  n: number;
  title: string;
  idea: string;
  /** Why the method from earlier chapters stops working here. */
  twist: string;
  /** Optional Flight School module(s) for the new idea. */
  lessons: LessonId[];
  /** Story scene played at the start of the chapter. */
  briefing: string | null;
  /** Logs unlocked when the chapter is completed. */
  successLogs: string[];
  /** Built and playable yet? */
  ready: boolean;
}

export const CHAPTERS: ChapterSpec[] = [
  {
    n: 1,
    title: 'First Light',
    idea: 'The whole chain: gravity, size, year, distance, parallax, the moon, the transfer.',
    twist: 'Where it all begins.',
    lessons: [],
    briefing: null,
    successLogs: ['cache1', 'mira1', 'mira2'],
    ready: true,
  },
  {
    n: 2,
    title: 'The Silent Planet',
    idea: 'Weigh a planet by flying a probe past it: it speeds up as it falls in.',
    twist: 'The blue planet has no moon, so the moon method can’t give its mass.',
    lessons: ['flyby'],
    briefing: 'brief2',
    successLogs: ['cache2', 'mira3'],
    ready: true,
  },
  {
    n: 3,
    title: 'Thick Air',
    idea: 'Air bends light near the horizon. Measure the planet with noon shadows instead (Eratosthenes).',
    twist: 'The horizon-dip method is badly fooled by refraction in this thick atmosphere.',
    lessons: ['refraction'],
    briefing: 'brief3',
    successLogs: ['cache3', 'mira4'],
    ready: true,
  },
  {
    n: 4,
    title: 'The Long Ellipse',
    idea: 'Elliptical orbits: Kepler’s first and second laws.',
    twist: 'The target’s orbit is clearly oval — oppositions are uneven.',
    lessons: [],
    briefing: null,
    successLogs: [],
    ready: false,
  },
  {
    n: 5,
    title: 'Inward',
    idea: 'An inner planet: greatest elongation and transits across the star.',
    twist: 'An inner planet is never at opposition — there is no retrograde loop to watch at night.',
    lessons: ['inner'],
    briefing: 'brief5',
    successLogs: ['cache5', 'mira5'],
    ready: true,
  },
  { n: 6, title: 'Red Dwarf', idea: 'Tidal locking, a dim star and flares.', twist: 'No normal day and night.', lessons: [], briefing: null, successLogs: [], ready: false },
  { n: 7, title: 'Slingshot', idea: 'Gravity assist from a third planet.', twist: 'The target is too far for the fuel.', lessons: [], briefing: null, successLogs: [], ready: false },
  { n: 8, title: 'Lost Among Stars', idea: 'Stellar parallax: finding where we are.', twist: 'The question is no longer where the planet is, but where we are.', lessons: [], briefing: null, successLogs: [], ready: false },
  { n: 9, title: 'Home', idea: 'The real Solar System: Mars to Earth.', twist: 'The final exam.', lessons: [], briefing: null, successLogs: [], ready: false },
];

export const chapterOf = (n: number) => CHAPTERS.find((c) => c.n === n) ?? CHAPTERS[0];

/** Chapters open in order: each needs the previous playable chapter completed. */
export function chapterUnlocked(s: Pick<GameState, 'campaign'>, n: number) {
  const playable = CHAPTERS.filter((c) => c.ready).map((c) => c.n);
  const i = playable.indexOf(n);
  if (i <= 0) return i === 0;
  return !!s.campaign[playable[i - 1]]?.done;
}
