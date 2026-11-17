import { RadiusFieldNotes } from './common/RadiusCrossCheck';
import { SchoolLogbook } from './SchoolRewards';
import { useEffect, useState } from 'react';
import type { Difficulty } from '../engine/types';
import { MODES, MODE_ORDER } from '../game/modes';
import { useGame } from '../game/store';
import { EXERCISES, TRAINING_GROUPS, recommendedTraining, recordTraining, type TrainingGroup } from '../game/training';
import { LESSONS, type LessonId } from './tutorial/lessons';
import { LessonModal } from './tutorial/Tutorial';
import { startSchoolExercise } from './tutorial/schoolPractice';
import { startFlightPractice } from './common/flightPractice';
import { Modal } from './common/widgets';
import { clock } from '../game/clock';
import { ESTIMATION_DRILLS, type EstimationId } from '../game/estimation';
import { EstimationWorkshop } from './tutorial/EstimationWorkshop';

export function FlightSchool({ onClose, recommendedChapter }: { onClose: () => void; recommendedChapter?: number }) {
  const s = useGame();
  useEffect(() => {
    const runId = useGame.getState().runId;
    const wasPaused = clock.paused;
    clock.paused = true; clock.emit();
    return () => { if (useGame.getState().runId === runId) { clock.paused = wasPaused; clock.emit(); } };
  }, []);
  const [difficulty, setDifficulty] = useState<Difficulty>(s.settings.difficulty);
  const [group, setGroup] = useState<TrainingGroup | 'all'>('all');
  const [search, setSearch] = useState('');
  const [lesson, setLesson] = useState<LessonId | null>(null);
  const [estimation, setEstimation] = useState<EstimationId | null>(null);
  const recommended = recommendedChapter ? recommendedTraining(recommendedChapter) : [];
  const query = search.trim().toLocaleLowerCase();
  const matches = (title: string) => !query || title.toLocaleLowerCase().includes(query);
  const groups = TRAINING_GROUPS.filter((g) => (group === 'all' || group === g.id) && (
    g.lessons.some((id) => matches(LESSONS[id].title)) || EXERCISES.some((m) => m.group === g.id && matches(m.title)) ||
    (g.id === 'ascent' && matches('Practice ascent')) || (g.id === 'landing' && matches('Practice entry and landing')) ||
    (g.id === 'predictions' && ESTIMATION_DRILLS.some((drill) => matches(drill.title)))
  ));

  const card = (id: string, title: string, description: string, action: () => void, kind: string) => {
    if (!matches(title)) return null;
    const progress = s.training?.[id];
    const viewed = id.startsWith('lesson:') && s.tutorial.lessons.includes(id.slice(7));
    const status = progress?.status === 'completed' ? `Completed${progress.assisted ? ' with help' : ''}` : progress?.status === 'skipped' ? 'Skipped for now' : progress?.status === 'started' || viewed ? id.startsWith('lesson:') ? 'Viewed · not completed' : 'Started' : 'Not started';
    return <article className="school-card panel panel-pad stack" key={id} data-training={id}>
      <div className="row between"><span className="meter-label">{kind}</span>{recommended.includes(id) && <span className="chip">Recommended</span>}</div>
      <h3>{title}</h3><div className="muted" style={{ fontSize: 13 }}>{description}</div>
      <span className={progress?.status === 'completed' ? 'green' : 'faint'} style={{ fontSize: 12 }}>{status}</span>
      <div className="row">
        <button className="btn small primary" onClick={action} aria-label={id.startsWith('flight:') ? title : undefined}>{progress?.status === 'completed' ? 'Repeat' : 'Open'} · {title}</button>
        {id.startsWith('exercise:') && <button className="btn small" onClick={() => startSchoolExercise(id.slice(9) as typeof EXERCISES[number]['id'], Math.floor(Math.random() * 2147483647))}>New system</button>}
        {progress?.status !== 'completed' && <button className="btn small ghost" onClick={() => recordTraining(id, 'skipped')}>Skip for now</button>}
      </div>
    </article>;
  };
  return <>
    <Modal onClose={onClose}>
      <div className="school-library" role="region" aria-label="Flight School library">
        <h2>Flight School</h2>
        <p className="muted">Optional, unscored practice. Every module is available now. Lessons and exercises preserve your expedition; completed and skipped modules are remembered.</p>
        <p className="faint" style={{ fontSize: 12 }}>“Completed” records finishing a lesson or guided exercise, with help labeled. It is not an exam or a requirement to play.</p>
        {recommendedChapter && <div className="callout tip">Recommended for chapter {recommendedChapter}. You can jump into the campaign at any time.</div>}
        <SchoolLogbook />
        <RadiusFieldNotes />
        <div className="school-filters">
          <label className="field">Skill group<select className="input" value={group} onChange={(e) => setGroup(e.target.value as typeof group)}>
            <option value="all">All skills</option>{TRAINING_GROUPS.map((g) => <option key={g.id} value={g.id}>{g.title}</option>)}
          </select></label>
          <label className="field">Find a module<input className="input" type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Pendulum, parallax, flight…" /></label>
        </div>
        {groups.some((g) => g.id === 'ascent' || g.id === 'landing') && <label className="field" style={{ margin: '12px 0' }}>Practice handling · flight drills
          <select className="input" aria-label="Practice handling" value={difficulty} onChange={(e) => setDifficulty(e.target.value as Difficulty)}>
            {MODE_ORDER.map((id) => <option key={id} value={id}>{MODES[id].name}{MODES[id].landingAssist ? ' · landing stabilization' : ' · manual handling'}</option>)}
          </select>
        </label>}
        {groups.length === 0 && <p className="muted" role="status">No modules match. Try another search or skill group.</p>}
        {groups.map((g) => <section key={g.id} className="school-group" aria-label={g.title}>
          <h3>{g.title}</h3>
          <div className="school-grid">
            {EXERCISES.filter((m) => m.group === g.id).map((m) => card(`exercise:${m.id}`, m.title, m.description, () => startSchoolExercise(m.id), 'Guided exercise'))}
            {g.lessons.map((id) => card(`lesson:${id}`, LESSONS[id].title, 'Interactive explanation. Close to return, or use “Got it” to record completion.', () => setLesson(id), 'Interactive lesson'))}
            {g.id === 'predictions' && ESTIMATION_DRILLS.map((drill) => card(`estimate:${drill.id}`, drill.title, drill.description, () => { recordTraining(`estimate:${drill.id}`, 'started'); setEstimation(drill.id); }, 'Estimation exercise'))}
            {g.id === 'ascent' && card('flight:ascent', 'Practice ascent', 'Control pitch and thrust, reach parking orbit and inspect your fuel use.', () => startFlightPractice('ascent', difficulty), 'Flight drill')}
            {g.id === 'landing' && card('flight:landing', 'Practice entry and landing', 'Fly the entry corridor, deploy a parachute and control the touchdown.', () => startFlightPractice('landing', difficulty), 'Flight drill')}
          </div>
        </section>)}
      </div>
    </Modal>
    {lesson && <LessonModal key={lesson} id={lesson} onClose={() => setLesson(null)} />}
    {estimation && <EstimationWorkshop key={estimation} id={estimation} onClose={() => setEstimation(null)} />}
  </>;
}
