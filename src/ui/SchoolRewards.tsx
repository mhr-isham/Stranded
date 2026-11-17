import { useEffect, useRef, useState } from 'react';
import { useGame } from '../game/store';
import { backfillSchoolRewards, freshSchoolRewards, SCHOOL_MILESTONES } from '../game/schoolRewards';
import { EXERCISES, recordSchoolMilestone } from '../game/training';
import { LESSONS, type LessonId } from './tutorial/lessons';
import { ESTIMATION_DRILLS } from '../game/estimation';
import { analyzeYear } from '../game/yearObservations';
import { sfx } from '../game/audio';
import { Chart } from './common/Chart';

export function schoolModuleTitle(module: string) {
  const [kind, id] = module.split(':');
  if (kind === 'lesson') return LESSONS[id as LessonId]?.title ?? id;
  if (kind === 'exercise') return EXERCISES.find((e) => e.id === id)?.title ?? id;
  if (kind === 'estimate') return ESTIMATION_DRILLS.find((e) => e.id === id)?.title ?? id;
  return id === 'ascent' ? 'Practice ascent' : id === 'landing' ? 'Practice entry and landing' : (id ?? module);
}
const patchTitle = (module: string) => ({ 'exercise:year': 'Year Investigator', 'exercise:opposition': 'Retrograde Investigator', 'exercise:gravity': 'Pendulum Investigator', 'exercise:radius': 'Horizon Investigator', 'exercise:distance': 'Parallax Explorer' }[module] ?? schoolModuleTitle(module));

/** Profile rewards are observed separately from the restored expedition state. */
export function SchoolRewardFeedback() {
  const s = useGame(), award = s.schoolRewards?.lastAward;
  const seen = useRef(award?.id), [visible, setVisible] = useState<typeof award>();
  useEffect(() => {
    if (!award || seen.current === award.id) return;
    seen.current = award.id; setVisible(award);
    sfx(award.id.startsWith('card:') ? 'good' : 'unlock');
    const timer = setTimeout(() => setVisible(undefined), 4200);
    return () => clearTimeout(timer);
  }, [award]);
  const active = s.tutorial.active && s.settings.freeRoam && !!s.schoolSession;
  const observationCount = s.readings.length + s.starObs.length + s.track.length;
  const year = active ? analyzeYear(s.starObs) : null;
  useEffect(() => {
    if (!active) return;
    const assisted = !!s.schoolSession?.assisted;
    if (observationCount > (s.schoolSession?.initialObservations ?? 0)) recordSchoolMilestone('first-observation', assisted);
    if (year && year.used.length >= 3 && year.baseline > year.used[1].x - year.used[0].x) recordSchoolMilestone('wider-baseline', assisted);
    if (s.readingPredictions.star?.comparison !== undefined) recordSchoolMilestone('predict-star', assisted);
    if (s.readingPredictions.pendulum?.comparison !== undefined) recordSchoolMilestone('predict-pendulum', assisted);
  }, [active, observationCount, year?.used.length, year?.baseline, s.schoolSession?.assisted, s.readingPredictions]);
  if (!visible) return null;
  return <div className="panel panel-pad school-reward-toast" role="status" aria-label="Flight School recognition"><b>{visible.milestone ? `✦ ${SCHOOL_MILESTONES[visible.milestone]}` : visible.id.startsWith('card:') ? `Discovery card updated · ${schoolModuleTitle(visible.module!)}` : `✦ Mission patch earned · ${patchTitle(visible.module!)}`}</b><div>Saved in your Flight School logbook · cosmetic recognition</div></div>;
}

export function SchoolProgress({ completed, total }: { completed: number; total: number }) {
  return <div className="school-attempt-progress" aria-label="Practice goals recorded"><span>{completed} / {total} guided goals recorded this attempt</span><progress max={Math.max(1, total)} value={completed} /><span>Your observations and tested predictions can earn logbook milestones.</span></div>;
}

export function SchoolLogbook() {
  const s = useGame(), rewards = s.schoolRewards ?? freshSchoolRewards();
  const modules = Object.keys(rewards.patches);
  const [selected, setSelected] = useState(rewards.lastAward?.module ?? modules.at(-1) ?? ''), [version, setVersion] = useState<'first' | 'latest'>('latest');
  useEffect(() => {
    const current = useGame.getState(), before = current.schoolRewards ?? freshSchoolRewards();
    const after = backfillSchoolRewards(before, current.training ?? {});
    if (after !== before) useGame.setState({ schoolRewards: after });
  }, []);
  const chosen = selected && rewards.cards[selected] ? selected : modules.at(-1), cards = chosen ? rewards.cards[chosen] : undefined, card = cards?.[version];
  return <details className="panel panel-pad school-logbook" aria-label="Flight School logbook">
    <summary>Mission patches &amp; discovery cards · {modules.length} collected</summary>
    <div className="stack">
      <p>Earn a permanent patch on each module's first completion. Replays keep your first and latest discovery cards. Assisted completions earn the same recognition, with help recorded. These rewards add no expedition score or resources.</p>
      {!modules.length && <div>Choose any lesson or expedition to start your collection. Every module is already open.</div>}
      <div className="school-patch-grid">{modules.map((module) => <button key={module} className="btn school-patch" aria-label={`Inspect patch · ${schoolModuleTitle(module)}`} aria-pressed={chosen === module} onClick={() => { setSelected(module); setVersion('latest'); }}><span className="school-patch-symbol" aria-hidden="true">✦</span><span>{patchTitle(module)}</span></button>)}</div>
      {card && <article className="panel panel-pad stack discovery-card" aria-label="Saved discovery card"><h3>{schoolModuleTitle(card.module)}</h3><div className="faint">{card.kind === 'legacy' ? 'Earlier completion' : card.kind === 'lesson' ? 'Interactive lesson' : `Practice system ${card.seed}`} · {card.assisted ? 'Help recorded' : 'Completed'} · {new Date(card.earnedAt).toLocaleDateString('en-GB')}</div>
        {cards!.first.attempt !== cards!.latest.attempt && <div className="row"><button className="btn small" aria-pressed={version === 'first'} onClick={() => setVersion('first')}>First discovery</button><button className="btn small" aria-pressed={version === 'latest'} onClick={() => setVersion('latest')}>Latest attempt</button></div>}
        {card.plot && card.plot.length > 0 && <><Chart series={[{ pts: card.plot, color: '#ffc46b', kind: 'dots' }]} xLabel={card.xLabel ?? 'record'} yLabel={card.yLabel ?? 'recorded value'} ariaLabel="Archived practice observations" /><div className="faint">Saved overview of recorded samples; large logs are reduced to at most 180 displayed points.</div></>}
        <dl className="kv">{card.summary.map((row, i) => <div className="discovery-row" key={i}><dt>{row.label}</dt><dd>{row.value}</dd></div>)}</dl>
        <div className="faint">A souvenir of practice, not a certification of accuracy. Worksheet prerequisites may have been supplied.</div>
      </article>}
      {Object.keys(rewards.milestones).length > 0 && <div className="stack"><b>Investigation milestones</b>{Object.entries(rewards.milestones).map(([id, value]) => <div key={id}>✦ {SCHOOL_MILESTONES[id]}{value.assisted ? ' · help recorded' : ''}</div>)}</div>}
    </div>
  </details>;
}
