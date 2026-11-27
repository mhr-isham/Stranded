import { beforeEach, expect, it } from 'vitest';
import { createPacingRecord, samplePacing, totalForeground } from '../src/game/pacing';
import { useGame } from '../src/game/store';

const settings = { difficulty: 'cadet' as const, survival: false, formulas: true, sound: false, pacingStudy: true };
const game = () => useGame.getState();
beforeEach(() => game().newGame(316, settings));

it('creates a record only for opted-in Chapter 1 Cadet and Navigator expeditions', () => {
  expect(game().pacingRecord?.mode).toBe('cadet');
  expect(createPacingRecord({ ...settings, pacingStudy: false }, 1, 4)).toBeNull();
  expect(createPacingRecord({ ...settings, difficulty: 'legend' }, 1, 4)).toBeNull();
  expect(createPacingRecord({ ...settings, freeRoam: true }, 1, 4)).toBeNull();
  expect(createPacingRecord(settings, 9, 4)).toBeNull();
  expect(createPacingRecord({ ...settings, difficulty: 'navigator' }, 1, 4)?.mode).toBe('navigator');
});

it('records active warp contexts without counting them twice or equating quiet watching to inactivity', () => {
  const record = createPacingRecord(settings, 1, 316)!;
  samplePacing(record, game(), 2000, 2000, 1, false);
  const camp = { ...game(), phase: 'play' as const, screen: 'drive' as const };
  samplePacing(record, camp, 1000, 60_100, 600, true);
  samplePacing(record, camp, 2000, 2000, 60, false);
  samplePacing(record, camp, 3000, 3000, 0, true);
  expect(record.buckets.Ground).toEqual({
    foregroundMs: 6000, scheduledMs: 1000, warpMs: 2000, noInputMs: 100, activities: { drive: 6000 },
  });
  expect(totalForeground(record)).toBe(8000);
  expect(record.milestones.camp).toBeDefined();
  samplePacing(record, { ...camp, phase: 'title' }, 3000, 3000, 1, false);
  samplePacing(record, { ...camp, tutorial: { ...camp.tutorial, active: true } }, 3000, 3000, 1, false);
  expect(totalForeground(record)).toBe(8000);
});

it('records the first milestones and separates a usable planner from launch, landing and debrief', () => {
  const record = createPacingRecord(settings, 1, 316)!;
  const camp = { ...game(), phase: 'play' as const, screen: 'launch' as const, missionsDone: ['plan'] };
  samplePacing(record, camp, 2000, 0, 0, false);
  expect(record.milestones.planner).toBe(2000);
  expect(record.milestones.launch).toBeUndefined();
  samplePacing(record, { ...camp, phase: 'ascent' }, 3000, 0, 0, false);
  samplePacing(record, { ...camp, phase: 'landing' }, 3000, 0, 0, false);
  samplePacing(record, { ...camp, phase: 'results', debriefSeen: true, arrival: { landing: 'clean', site: 'beacon' } }, 1000, 0, 0, false);
  expect(record.milestones).toMatchObject({ planner: 2000, launch: 5000, landing: 8000, debrief: 8000 });
  samplePacing(record, camp, 7000, 0, 0, false);
  expect(totalForeground(record)).toBe(8000);
});
