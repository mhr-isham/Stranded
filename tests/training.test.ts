import { beforeEach, describe, expect, it } from 'vitest';
import { EXERCISES, TRAINING_GROUPS, recommendedTraining, recordTraining } from '../src/game/training';
import { LESSON_IDS } from '../src/ui/tutorial/lessons';
import { exerciseRange, finishSchoolExercise, schoolExerciseComplete } from '../src/ui/tutorial/schoolPractice';
import { STEPS } from '../src/ui/tutorial/steps';
import { useGame } from '../src/game/store';
import { leaveFlightPractice, practiceSnapshot } from '../src/ui/common/flightPractice';
import { clock } from '../src/game/clock';

beforeEach(() => {
  useGame.getState().newGame(316, { difficulty: 'navigator', sound: false, survival: false, formulas: true });
  useGame.setState({ training: {}, schoolSession: null, schoolOpen: null });
});

describe('Flight School library', () => {
  it('indexes every current lesson exactly once and bounds every independent exercise', () => {
    const lessons = TRAINING_GROUPS.flatMap((group) => [...group.lessons]);
    expect([...lessons].sort()).toEqual([...LESSON_IDS].sort());
    expect(new Set(lessons).size).toBe(LESSON_IDS.length);
    for (const exercise of EXERCISES) {
      const range = exerciseRange(exercise.id);
      expect(STEPS[range.start].id).toBe(exercise.first);
      expect(STEPS[range.end].id).toBe(exercise.last);
      expect(range.end).toBeGreaterThanOrEqual(range.start);
    }
  });

  it('remembers skipped/completed modules across new runs without treating viewed content as completed', () => {
    recordTraining('lesson:pendulum', 'started');
    expect(useGame.getState().training['lesson:pendulum']?.status).toBe('started');
    recordTraining('lesson:pendulum', 'skipped');
    recordTraining('lesson:estimate', 'completed');
    useGame.getState().newGame(44, useGame.getState().settings);
    expect(useGame.getState().training['lesson:pendulum']?.status).toBe('skipped');
    recordTraining('lesson:estimate', 'started');
    expect(useGame.getState().training['lesson:estimate']?.status).toBe('completed');
  });

  it('offers chapter recommendations without requiring completion or skipping to unlock play', () => {
    expect(recommendedTraining(1)).toContain('exercise:gravity');
    expect(recommendedTraining(2)).toContain('lesson:flyby');
    expect(recommendedTraining(9)).toEqual([]);
    expect(EXERCISES.find((m) => m.id === 'planning')).toBeDefined();
  });

  it('restores expedition/time while retaining training and lesson records', () => {
    useGame.setState({ phase: 'play', schoolOpen: {}, sheet: { g: { value: 9.81, sigma: .2 } } });
    clock.t = 123;
    const back = practiceSnapshot();
    useGame.getState().newGame(316, { difficulty: 'cadet', sound: false, survival: false, formulas: true, freeRoam: true });
    useGame.setState({ practiceReturn: back, tutorial: { active: true, step: 0, flags: [], lessons: ['pendulum'] } });
    recordTraining('exercise:gravity', 'completed', true);
    leaveFlightPractice();
    expect(clock.t).toBe(123);
    expect(useGame.getState().sheet.g?.value).toBe(9.81);
    expect(useGame.getState().settings.difficulty).toBe('navigator');
    expect(useGame.getState().tutorial.active).toBe(false);
    expect(useGame.getState().tutorial.lessons).toContain('pendulum');
    expect(useGame.getState().training['exercise:gravity']).toMatchObject({ status: 'completed', assisted: true });
    expect(useGame.getState().schoolOpen).toEqual({});
  });

  it('does not record a completed exercise while its required steps are missing', () => {
    const range = exerciseRange('gravity');
    useGame.setState({ schoolSession: { id: 'gravity', ...range, completedSteps: [], assisted: false } });
    expect(schoolExerciseComplete(useGame.getState())).toBe(false);
    finishSchoolExercise();
    expect(useGame.getState().training['exercise:gravity']).toBeUndefined();
    useGame.setState({ schoolSession: { ...useGame.getState().schoolSession!, completedSteps: STEPS.slice(range.start, range.end + 1).filter((step) => step.done).map((step) => step.id) } });
    expect(schoolExerciseComplete(useGame.getState())).toBe(true);
  });
});
