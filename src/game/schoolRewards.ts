import { DAY } from '../engine/constants';
import { QUANTITY_INFO, type PrimaryKey } from '../engine/chain';
import { showQuantity, sig } from './format';
import { analyzeYear, yearPoints } from './yearObservations';
import type { GameState } from './store';

export interface DiscoveryArtifact {
  attempt?: string; summary: { label: string; value: string }[];
  plot?: { x: number; y: number }[]; xLabel?: string; yLabel?: string;
}
export interface DiscoveryCard extends DiscoveryArtifact {
  module: string; attempt: string; earnedAt: number; seed: number; assisted: boolean; kind: 'lesson' | 'practice' | 'teaching' | 'legacy';
}
export interface SchoolRewards {
  patches: Record<string, { earnedAt: number; assisted: boolean }>;
  cards: Record<string, { first: DiscoveryCard; latest: DiscoveryCard }>;
  milestones: Record<string, { earnedAt: number; assisted: boolean }>;
  lastAward?: { id: string; module?: string; milestone?: string };
}
export const freshSchoolRewards = (): SchoolRewards => ({ patches: {}, cards: {}, milestones: {} });
export const SCHOOL_MILESTONES: Record<string, string> = {
  'first-observation': 'First field note', 'wider-baseline': 'Observation planner',
  'predict-star': 'Star prediction tested', 'predict-pendulum': 'Swing prediction tested', 'predict-motion': 'Motion prediction tested',
};

const snapshotPlot = (points: { x: number; y: number }[]) => {
  const valid = points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y)).map(({ x, y }) => ({ x, y }));
  return valid.length <= 180 ? valid : Array.from({ length: 180 }, (_, i) => valid[Math.round(i * (valid.length - 1) / 179)]);
};

/** Keeps observed/entered practice work, never the hidden system's correct values. */
export function discoveryCard(s: GameState, module: string, assisted: boolean, artifact?: DiscoveryArtifact): DiscoveryCard {
  const id = module.split(':')[1], isLesson = module.startsWith('lesson:');
  const card: DiscoveryCard = { module, attempt: artifact?.attempt ?? (isLesson ? module : `${module}:${s.runId}`), earnedAt: Date.now(), seed: s.seed, assisted, kind: isLesson ? 'lesson' : artifact ? 'teaching' : 'practice', summary: [] };
  if (artifact) return { ...card, ...artifact, attempt: card.attempt, summary: artifact.summary.slice(0, 18), plot: snapshotPlot(artifact.plot ?? []) };
  if (isLesson) { card.summary = [{ label: 'Practice record', value: 'Interactive lesson completed' }]; return card; }
  if (!((module.startsWith('exercise:') && s.schoolSession?.id === id) || (module.startsWith('flight:') && s.settings.flightPractice === id))) {
    card.summary = [{ label: 'Practice record', value: 'Completion recorded; an instrument snapshot was unavailable.' }]; return card;
  }
  if (id === 'year' || id === 'estimate-star') {
    const a = analyzeYear(s.starObs), early = analyzeYear(a.used.slice(0, 2).map((p) => p.observation));
    card.summary = [{ label: 'Distinct observing dates', value: String(a.used.length) }, { label: 'Recorded time span', value: `${sig(a.baseline, 4)} days` }];
    if (early.fit) card.summary.push({ label: 'First two dates: inferred year', value: `${sig(early.fit.yearDays, 5)} days` });
    if (a.fit) card.summary.push({ label: 'Later record: inferred year', value: `${sig(a.fit.yearDays, 5)} days` });
    card.plot = snapshotPlot(yearPoints(s.starObs)); card.xLabel = 'expedition day'; card.yLabel = 'recorded chart position (°)';
  } else if (id === 'opposition' || id === 'synodic') {
    card.plot = snapshotPlot(yearPoints(s.track)); card.xLabel = 'expedition day'; card.yLabel = 'recorded longitude (°)';
    card.summary = [{ label: 'Tracker sightings', value: String(s.track.length) }, ...s.oppPicks.filter(Number.isFinite).slice(-3).map((at) => ({ label: 'Your marked opposition', value: `day ${sig(at / DAY, 5)}` }))];
    if (s.retroStudy) {
      card.summary.push({ label: 'Committed motion prediction', value: `${s.retroStudy.prediction} from day ${sig(s.retroStudy.anchorAt / DAY, 5)}` });
      if (s.retroStudy.result) card.summary.push({ label: 'Next saved sighting', value: `${sig(s.retroStudy.result.delta, 4)}° · ${s.retroStudy.result.direction} · day ${sig(s.retroStudy.result.at / DAY, 5)}` });
    }
  } else if (module.startsWith('flight:')) {
    card.summary = [{ label: 'Handling configuration', value: s.settings.difficulty }, { label: 'Flight practice', value: assisted ? 'Completed with assistance recorded' : 'Completed' }];
  } else {
    const key: Partial<Record<string, PrimaryKey>> = { gravity: 'g', radius: 'R1', distance: 'dPar', size: 'alpha2', moon: 'Pm', 'estimate-pendulum': 'g' };
    const readings = s.readings.filter((r) => r.kept && (!key[id] || r.key === key[id]) && Number.isFinite(r.value));
    card.summary = readings.slice(-8).map((r) => ({ label: `${QUANTITY_INFO[r.key].symbol} · ${r.pendulum?.technique?.source === 'echo' || r.note.startsWith('ECHO') ? 'ECHO supplied' : 'kept reading'}`, value: `${showQuantity(r.key, r.value)} · ${r.note}` }));
    if (key[id] && readings.length) {
      card.plot = snapshotPlot(readings.map((r, i) => ({ x: i + 1, y: r.value / QUANTITY_INFO[r.key].scale })));
      card.xLabel = 'kept reading'; card.yLabel = `${QUANTITY_INFO[key[id]!].symbol} (${QUANTITY_INFO[key[id]!].unit})`;
    }
  }
  for (const [key, estimate] of Object.entries(s.sheet).slice(0, 10)) if (estimate && Number.isFinite(estimate.value) && Number.isFinite(estimate.sigma)) card.summary.push({ label: `Practice worksheet ${QUANTITY_INFO[key as PrimaryKey].symbol}`, value: showQuantity(key as PrimaryKey, estimate.value, estimate.sigma) });
  const prediction = id === 'estimate-star' ? s.readingPredictions.star : id === 'estimate-pendulum' ? s.readingPredictions.pendulum : undefined;
  if (prediction?.comparison !== undefined) card.summary.unshift({ label: 'Your prediction → observed comparison', value: `${sig(prediction.value, 5)} ± ${sig(prediction.range, 3)} → ${sig(prediction.comparison, 5)} ${id === 'estimate-star' ? '°' : 's'}` });
  card.summary = card.summary.slice(0, 18);
  if (!card.summary.length) card.summary.push({ label: 'Practice record', value: 'Guided practice completed; prerequisites may have been supplied.' });
  return card;
}

export function earnSchoolPatch(rewards: SchoolRewards, card: DiscoveryCard): SchoolRewards {
  const prior = rewards.cards[card.module];
  if (prior?.latest.attempt === card.attempt) return rewards;
  const first = !rewards.patches[card.module];
  return { ...rewards, patches: first ? { ...rewards.patches, [card.module]: { earnedAt: card.earnedAt, assisted: card.assisted } } : rewards.patches,
    cards: { ...rewards.cards, [card.module]: { first: prior?.first ?? card, latest: card } },
    lastAward: first ? { id: `patch:${card.module}`, module: card.module } : { id: `card:${card.module}:${card.attempt}`, module: card.module } };
}
export function earnSchoolMilestone(rewards: SchoolRewards, id: string, assisted: boolean): SchoolRewards {
  if (!SCHOOL_MILESTONES[id] || rewards.milestones[id]) return rewards;
  return { ...rewards, milestones: { ...rewards.milestones, [id]: { earnedAt: Date.now(), assisted } }, lastAward: { id: `milestone:${id}`, milestone: id } };
}

/** Older completion records earn recognition without inventing a missing experiment. */
export function backfillSchoolRewards(rewards: SchoolRewards, history: Record<string, { status: string; updated: number; assisted?: boolean } | undefined>) {
  let next = rewards;
  for (const [module, progress] of Object.entries(history)) if (progress?.status === 'completed' && !next.patches[module]) {
    next = earnSchoolPatch(next, { module, attempt: `legacy:${module}`, earnedAt: progress.updated, seed: 0, assisted: !!progress.assisted, kind: 'legacy', summary: [{ label: 'Earlier completion', value: 'Your remembered completion is recognized. Its observation record was not archived.' }] });
  }
  return next === rewards ? rewards : { ...next, lastAward: rewards.lastAward };
}
