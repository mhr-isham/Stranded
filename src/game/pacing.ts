import { completedActs, currentAct } from './acts';
import type { GameState, Settings } from './store';

export const PACING_ACTS = ['Opening', 'Ground', 'Sky', 'Blue Planet', 'Moon', 'Flight'] as const;
export type PacingAct = typeof PACING_ACTS[number];
type Milestone = 'camp' | 'ground' | 'sky' | 'bluePlanet' | 'moon' | 'planner' | 'launch' | 'landing' | 'debrief';
export const PACING_MILESTONES: readonly [Milestone, string][] = [
  ['camp', 'Camp reached'], ['ground', 'Ground complete'], ['sky', 'Sky complete'],
  ['bluePlanet', 'Blue Planet complete'], ['moon', 'Moon complete'], ['planner', 'First usable planner visit'],
  ['launch', 'First launch attempt'], ['landing', 'Destination landing recorded'], ['debrief', 'Debrief reached'],
];

export interface PacingBucket {
  foregroundMs: number;
  noInputMs: number;
  scheduledMs: number;
  warpMs: number;
  activities: Record<string, number>;
}

export interface PacingRecord {
  version: 1;
  seed: number;
  mode: 'cadet' | 'navigator';
  survival: boolean;
  stopped: boolean;
  buckets: Partial<Record<PacingAct, PacingBucket>>;
  milestones: Partial<Record<Milestone, number>>;
}

export const canRecordPacing = (settings: Settings, chapter: number) =>
  chapter === 1 && !settings.freeRoam && !settings.flightPractice && (settings.difficulty === 'cadet' || settings.difficulty === 'navigator');

export function createPacingRecord(settings: Settings, chapter: number, seed: number): PacingRecord | null {
  if (!settings.pacingStudy || !canRecordPacing(settings, chapter)) return null;
  return { version: 1, seed, mode: settings.difficulty as PacingRecord['mode'], survival: settings.survival, stopped: false, buckets: {}, milestones: {} };
}

export const totalForeground = (record: PacingRecord) => Object.values(record.buckets).reduce((sum, row) => sum + row.foregroundMs, 0);

export function pacingContext(s: GameState) {
  if (s.tutorial.active || s.settings.freeRoam || s.settings.flightPractice || s.schoolOpen || s.phase === 'title' ||
    (s.phase === 'results' && s.debriefSeen)) return null;
  if (s.phase === 'intro' || s.phase === 'prologue') return { act: 'Opening' as const, activity: s.phase === 'intro' ? 'Briefing' : 'Opening landing' };
  if (s.phase === 'ascent' || s.phase === 'flight' || s.phase === 'landing') return {
    act: 'Flight' as const,
    activity: s.phase === 'ascent' ? 'Ascent controls' : s.phase === 'landing' ? 'Destination landing' : 'Transfer view',
  };
  const pending = s.phase === 'play' && completedActs(s).find((n) => !s.actsSeen.includes(n));
  const act = PACING_ACTS[pending || currentAct(s).n];
  const activity = s.phase === 'hop' ? 'Surface hop' : s.phase === 'results' ? 'Outcome and rewind choice'
    : s.storyQueue.length ? 'Story scene' : pending ? 'Act card' : s.screen;
  return { act, activity };
}

export function samplePacing(record: PacingRecord, s: GameState, dt: number, idle: number, rate: number, scheduled: boolean) {
  if (record.stopped || s.tutorial.active || s.settings.freeRoam || s.settings.flightPractice || s.schoolOpen || s.phase === 'title') return false;
  let changed = false;
  const context = pacingContext(s);
  const alreadyFinished = record.milestones.debrief !== undefined;
  if (context && dt > 0 && !alreadyFinished) {
    const row = record.buckets[context.act] ??= { foregroundMs: 0, noInputMs: 0, scheduledMs: 0, warpMs: 0, activities: {} };
    changed = true;
    row.foregroundMs += dt;
    row.noInputMs += Math.max(0, Math.min(dt, idle - 60_000));
    if (rate > 0 && scheduled && s.phase === 'play') row.scheduledMs += dt;
    else if (rate > 1 && s.phase === 'play') row.warpMs += dt;
    row.activities[context.activity] = (row.activities[context.activity] ?? 0) + dt;
  }
  const mark = (key: Milestone, yes: boolean) => {
    if (!yes || record.milestones[key] !== undefined) return;
    record.milestones[key] = totalForeground(record);
    changed = true;
  };
  mark('camp', !['prologue', 'intro'].includes(s.phase));
  const done = completedActs(s);
  const actEnds = ['ground', 'sky', 'bluePlanet', 'moon'] as const;
  actEnds.forEach((key, index) => mark(key, done.includes(index + 1)));
  mark('planner', s.missionsDone.includes('plan'));
  mark('launch', ['ascent', 'flight', 'landing'].includes(s.phase) || (s.phase === 'results' && !!s.outcome));
  mark('landing', !!s.arrival);
  mark('debrief', s.phase === 'results' && s.debriefSeen);
  return changed;
}
