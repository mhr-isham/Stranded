import { DAY } from '../../engine/constants';
import { botMeasure, PERFECT } from '../../engine/solver';
import { makeRng } from '../../engine/rng';
import { clock } from '../../game/clock';
import { currentWorld } from '../../game/sim';
import { useGame } from '../../game/store';
import type { GameState } from '../../game/store';
import { darkNightNear, doOpposition, jumpTo, tutorialOppositions } from '../../game/tutorial';
import { EXERCISES, recordTraining, type ExerciseId } from '../../game/training';
import { leaveFlightPractice, practiceSnapshot } from '../common/flightPractice';
import { startRun } from '../common/widgets';
import { STEPS } from './steps';

export function exerciseRange(id: ExerciseId) {
  const exercise = EXERCISES.find((m) => m.id === id)!;
  const start = STEPS.findIndex((step) => step.id === exercise.first);
  const end = STEPS.findIndex((step) => step.id === exercise.last);
  if (start < 0 || end < start) throw new Error(`Invalid training exercise: ${id}`);
  return { start, end };
}

/** Supply only prerequisites, in an isolated unscored teaching system. */
export function prepareExercise(id: ExerciseId) {
  if (id === 'basic' || id === 'gravity' || id === 'radius' || id === 'sky') return;
  const { system: sys } = currentWorld();
  const s = useGame.getState();
  useGame.setState({ identified: true, trackOn: true, moonTrackOn: true });
  const provided = botMeasure(sys, PERFECT, makeRng(812)).primaries;
  if (id === 'sheet') useGame.setState({ sheet: { g: provided.g, R1: provided.R1 } });
  else if (id === 'planning') useGame.setState({ sheet: provided });
  else if (id === 'distance' || id === 'size') useGame.setState({ sheet: { g: provided.g, R1: provided.R1, P1: provided.P1, ...(id === 'size' ? { dPar: provided.dPar } : {}) } });
  else if (id === 'opposition' || id === 'synodic') useGame.setState({ sheet: { P1: provided.P1 } });
  else if (id === 'moon') useGame.setState({ sheet: { P1: provided.P1, dPar: provided.dPar, alpha2: provided.alpha2 } });
  if (id === 'size' || id === 'moon') jumpTo(darkNightNear(tutorialOppositions()[0] + (id === 'moon' ? 20 : 0) * DAY));
  if (id === 'synodic') {
    doOpposition(0);
    jumpTo(tutorialOppositions()[0] + 40 * DAY);
  }
  // Preserve a paused start even after prerequisite log generation.
  clock.paused = true;
  s.set({ savedT: clock.t });
}

export function startSchoolExercise(id: ExerciseId) {
  const s = useGame.getState();
  const back = practiceSnapshot();
  const range = exerciseRange(id);
  recordTraining(`exercise:${id}`, 'started');
  startRun(316, {
    ...s.settings, difficulty: 'cadet', survival: false, formulas: true, challenges: [],
    freeRoam: true, freeRoamGuidance: false, showTruth: false, campaignRun: false, flightPractice: undefined,
  }, 1, () => {
    useGame.setState({
      practiceReturn: back,
      schoolSession: { id, ...range, completedSteps: [], assisted: false },
      tutorial: { active: true, step: range.start, flags: [], lessons: useGame.getState().tutorial.lessons },
      phase: 'play', screen: 'hub', identified: false, storyQueue: [], echo: [],
    });
    prepareExercise(id);
  });
}

export function schoolExerciseComplete(s: GameState) {
  const session = s.schoolSession;
  if (!session) return false;
  const required = STEPS.slice(session.start, session.end + 1).filter((step) => step.done);
  return required.every((step) => session.completedSteps.includes(step.id) || step.done!(s));
}

export function finishSchoolExercise(skip = false) {
  const s = useGame.getState();
  const session = s.schoolSession;
  if (!session || (!skip && !schoolExerciseComplete(s))) return;
  recordTraining(`exercise:${session.id}`, skip ? 'skipped' : 'completed', session.assisted);
  leaveFlightPractice();
}
