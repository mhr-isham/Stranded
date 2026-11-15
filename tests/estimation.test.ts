import { beforeEach, describe, expect, it } from 'vitest';
import { DAY, DEG } from '../src/engine/constants';
import { ESTIMATION_DRILLS, estimationScenario, estimateFeedback, validEstimate } from '../src/game/estimation';
import { commitReadingPrediction, resolveReadingPredictions, unwrapPositions } from '../src/game/readingPredictions';
import { useGame } from '../src/game/store';
import { exerciseRange, schoolExerciseComplete } from '../src/ui/tutorial/schoolPractice';
import { STEPS } from '../src/ui/tutorial/steps';

describe('estimation teaching models', () => {
  it('provides finite, changing examples for all seven skills', () => {
    for (const drill of ESTIMATION_DRILLS) {
      const first = estimationScenario(drill.id, 0);
      for (let variant = 0; variant < 6; variant++) {
        const scenario = estimationScenario(drill.id, variant);
        expect(Number.isFinite(scenario.reference)).toBe(true);
        expect(scenario.range).toBeGreaterThan(0);
        expect(scenario.data.length).toBeGreaterThan(1);
      }
      expect(estimationScenario(drill.id, 1).reference).not.toBe(first.reference);
    }
  });
  it('uses appropriate units, square-root scaling and uncertainty propagation', () => {
    expect(estimationScenario('ratio').reference).toBeCloseTo(1.6 * Math.sqrt(2));
    const travel = estimationScenario('scale');
    expect(travel.reference - travel.range).toBeCloseTo(1200 / 15 / 24);
    expect(travel.reference + travel.range).toBeCloseTo(1200 / 10 / 24);
    expect(estimationScenario('scatter').reference).toBeCloseTo(2);
    expect(estimationScenario('scatter').range).toBeCloseTo(.005);
    expect(estimationScenario('parallax').reference).toBeCloseTo(30.9397209);
    expect(estimationScenario('interpolate').range).toBeLessThan(estimationScenario('line').range);
  });
  it('compares a bracket with all allowed times, not a secretly chosen exact date', () => {
    const bracket = estimationScenario('bracket');
    expect(estimateFeedback(bracket, bracket.reference, .01)).toContain('excludes');
    expect(estimateFeedback(bracket, bracket.reference, bracket.range)).toContain('not a uniquely');
    expect(estimateFeedback(bracket, bracket.reference, bracket.range * 10)).toContain('broader');
    expect(validEstimate(NaN, 1)).toBe(false);
    expect(validEstimate(1, Infinity)).toBe(false);
    expect(validEstimate(1, 0)).toBe(false);
  });
});

beforeEach(() => {
  useGame.getState().newGame(316, { difficulty: 'cadet', freeRoam: true, sound: false, survival: false, formulas: true });
  useGame.setState({ phase: 'play', training: {}, schoolSession: { id: 'estimate-pendulum', ...exerciseRange('estimate-pendulum'), completedSteps: [], assisted: false }, tutorial: { ...useGame.getState().tutorial, active: true } });
});

describe('predictions from observations', () => {
  it('locks the guess and waits for a new kept timing at the committed length', () => {
    const add = useGame.getState().addReading;
    add({ key: 'g', value: 9, at: 0, pendulum: { length: 2, period: 2.8 } });
    add({ key: 'g', value: 9, at: 1, pendulum: { length: 1, period: 2 } });
    expect(commitReadingPrediction('pendulum', 2.8, .2, 2)).toBe(true);
    expect(commitReadingPrediction('pendulum', 99, 10, 2)).toBe(false);
    resolveReadingPredictions();
    expect(useGame.getState().readingPredictions.pendulum?.comparison).toBeUndefined();
    add({ key: 'g', value: 9, at: 2, pendulum: { length: 1, period: 2 } });
    resolveReadingPredictions();
    expect(useGame.getState().readingPredictions.pendulum?.comparison).toBeUndefined();
    add({ key: 'g', value: 9, at: 3, pendulum: { length: 2, period: 2.84 } });
    resolveReadingPredictions();
    expect(useGame.getState().readingPredictions.pendulum).toMatchObject({ value: 2.8, comparison: 2.84 });
    expect(useGame.getState().training['exercise:estimate-pendulum']?.status).toBe('completed');
    expect(useGame.getState().predictions).toEqual([]);
    expect(useGame.getState().penaltyDv).toBe(0);
  });
  it('unwraps star angles and compares only a new observation at the target time', () => {
    useGame.setState({ starObs: [{ at: 0, v: 359 * DEG }, { at: 10 * DAY, v: 1 * DEG }] });
    expect(unwrapPositions(useGame.getState().starObs).map((p) => p.y)).toEqual([359, 361]);
    expect(commitReadingPrediction('star', 363, 1, 24 * DAY)).toBe(true);
    useGame.setState((s) => ({ starObs: [...s.starObs, { at: 24 * DAY + 3600, v: 4 * DEG }] }));
    resolveReadingPredictions();
    expect(useGame.getState().readingPredictions.star?.comparison).toBeUndefined();
    useGame.setState((s) => ({ starObs: [...s.starObs, { at: 24 * DAY, v: 3.9 * DEG }] }));
    resolveReadingPredictions();
    expect(useGame.getState().readingPredictions.star?.comparison).toBeCloseTo(363.9);
  });
  it('does not accept or resolve teaching predictions in a scored expedition', () => {
    useGame.setState((s) => ({ settings: { ...s.settings, freeRoam: false } }));
    expect(commitReadingPrediction('pendulum', 2, .1, 2)).toBe(false);
    resolveReadingPredictions();
    expect(useGame.getState().training).toEqual({});
  });
  it('keeps these opportunities optional in Basic Training but requires a comparison in their own modules', () => {
    expect(schoolExerciseComplete(useGame.getState())).toBe(false);
    const range = exerciseRange('basic');
    useGame.setState({ schoolSession: { id: 'basic', ...range, completedSteps: STEPS.filter((step) => step.done).map((step) => step.id), assisted: false } });
    expect(schoolExerciseComplete(useGame.getState())).toBe(true);
    expect(useGame.getState().readingPredictions).toEqual({});
  });
});
