import { discoveryCard, earnSchoolPatch, earnSchoolMilestone, freshSchoolRewards, type DiscoveryArtifact } from './schoolRewards';
import type { LessonId } from '../ui/tutorial/lessons';
import { useGame } from './store';
import { chapterOf } from './campaign';

export const TRAINING_GROUPS = [
  { id: 'instruments', title: 'Instruments', lessons: ['measure', 'pendulum', 'horizon', 'twinkle', 'year', 'parallax', 'angular', 'moon'] },
  { id: 'predictions', title: 'Predictions and uncertainty', lessons: ['estimate', 'honesty', 'propagation'] },
  { id: 'navigation', title: 'Navigation and planning', lessons: ['mass', 'retrograde', 'synodic', 'kepler', 'deltav', 'hohmann'] },
  { id: 'ascent', title: 'Ascent', lessons: [] },
  { id: 'landing', title: 'Entry and landing', lessons: [] },
  { id: 'advanced', title: 'Advanced chapter techniques', lessons: ['flyby', 'refraction', 'inner', 'ellipse', 'locked', 'slingshot', 'stellar'] },
] as const satisfies readonly { id: string; title: string; lessons: readonly LessonId[] }[];
export type TrainingGroup = typeof TRAINING_GROUPS[number]['id'];

export const EXERCISES = [
  { id: 'basic', group: 'instruments', title: 'Basic Training', first: 'welcome', last: 'graduate', description: 'The complete guided measurement-to-flight journey.' },
  { id: 'gravity', group: 'instruments', title: 'Use the pendulum', first: 'lesson-pendulum', last: 'pend-send', description: 'Measure length, time swings, repeat and state an uncertainty.' },
  { id: 'radius', group: 'instruments', title: 'Read the horizon dip', first: 'lesson-horizon', last: 'hill-send', description: 'Climb, aim, read the dip and measure the planet.' },
  { id: 'sky', group: 'instruments', title: 'Find and track a planet', first: 'lesson-twinkle', last: 'sky-moon', description: 'Identify a steady light and start the trackers.' },
  { id: 'year', group: 'instruments', title: 'Log and fit the year', first: 'lesson-year', last: 'year-send', description: 'Take observations over a baseline and fit the drift.' },
  { id: 'distance', group: 'instruments', title: 'Drive and measure parallax', first: 'lesson-parallax', last: 'rover-send', description: 'Drive the rover, image from two sites and compare positions.' },
  { id: 'size', group: 'instruments', title: 'Use the micrometer', first: 'lesson-angular', last: 'micro-send', description: 'Align the wires, repeat readings and estimate angular size.' },
  { id: 'moon', group: 'instruments', title: 'Fit the moon’s swing', first: 'lesson-moon', last: 'moon-fit', description: 'Select a useful interval and fit the moon’s orbit.' },
  { id: 'sheet', group: 'navigation', title: 'Use the progress sheet', first: 'lesson-mass', last: 'sheet-checks', description: 'Inspect derived values, error propagation and consistency checks.' },
  { id: 'opposition', group: 'navigation', title: 'Mark an opposition', first: 'lesson-retro', last: 'opp-send', description: 'Find the retrograde loop and estimate its middle.' },
  { id: 'synodic', group: 'navigation', title: 'Measure the synodic period', first: 'lesson-synodic', last: 'opp2-send', description: 'Use a second opposition to estimate the repeating interval.' },
  { id: 'planning', group: 'navigation', title: 'Plan a transfer', first: 'lesson-hohmann', last: 'launch-window', description: 'Compare departure dates, flight time, fuel and uncertainty.' },
  { id: 'estimate-pendulum', group: 'predictions', title: 'Predict a measured swing', first: 'pend-send', last: 'pend-send', description: 'Use your timed baseline and a new measured length, commit a range, then time it.' },
  { id: 'estimate-star', group: 'predictions', title: 'Predict from your star logs', first: 'year-send', last: 'year-send', description: 'Log a drift, commit a position and range two weeks ahead, then observe it.' },
] as const satisfies readonly { id: string; group: TrainingGroup; title: string; first: string; last: string; description: string }[];
export type ExerciseId = typeof EXERCISES[number]['id'];
export interface TrainingProgress { status: 'started' | 'completed' | 'skipped'; updated: number; assisted?: boolean }
export type TrainingHistory = Partial<Record<string, TrainingProgress>>;

/** Completion records acknowledge practice, not a test or a campaign gate. */
export function recordTraining(id: string, status: TrainingProgress['status'], assisted = false, artifact?: DiscoveryArtifact) {
  const s = useGame.getState();
  if (s.training?.[id]?.status === 'completed' && status !== 'completed') return;
  useGame.setState({ training: { ...s.training, [id]: { status, updated: Date.now(), ...(assisted ? { assisted: true } : {}) } }, ...(status === 'completed' ? { schoolRewards: earnSchoolPatch(s.schoolRewards ?? freshSchoolRewards(), discoveryCard(s, id, assisted, artifact)) } : {}) });
}

/** Recommendations are optional; all lessons and exercises remain open. */
export function recommendedTraining(chapter: number) {
  const basics = chapter === 1 ? ['lesson:measure', 'exercise:gravity', 'exercise:radius', 'lesson:estimate', 'exercise:planning'] : [];
  return [...basics, ...chapterOf(chapter).lessons.map((id) => `lesson:${id}`)];
}

export function recordSchoolMilestone(id: string, assisted = false) {
  const s = useGame.getState(), before = s.schoolRewards ?? freshSchoolRewards();
  const schoolRewards = earnSchoolMilestone(before, id, assisted);
  if (schoolRewards !== before) useGame.setState({ schoolRewards });
}
