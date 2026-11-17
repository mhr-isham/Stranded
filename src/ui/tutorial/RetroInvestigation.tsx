import { useEffect, useState } from 'react';
import { DAY } from '../../engine/constants';
import { clock } from '../../game/clock';
import { fastForward } from '../../game/sim';
import { useGame } from '../../game/store';
import { recordSchoolMilestone } from '../../game/training';
import { resolveMotionPrediction, type MotionDirection } from '../../game/observedMotion';
import { fmt } from '../../game/format';

export function RetroInvestigation() {
  const s = useGame(), [choice, setChoice] = useState<MotionDirection>('east');
  const active = s.tutorial.active && s.settings.freeRoam && ['basic', 'opposition', 'synodic'].includes(s.schoolSession?.id ?? '');
  useEffect(() => {
    if (!active || !s.retroStudy || s.retroStudy.result) return;
    const resolved = resolveMotionPrediction(s.retroStudy, s.track);
    if (resolved !== s.retroStudy) { useGame.setState({ retroStudy: resolved }); recordSchoolMilestone('predict-motion', !!s.schoolSession?.assisted); }
  }, [active, s.retroStudy, s.track, s.schoolSession?.assisted]);
  if (!active) return null;
  const study = s.retroStudy, last = s.track.filter((p) => Number.isFinite(p.at) && Number.isFinite(p.v)).slice().sort((a, b) => a.at - b.at).at(-1);
  return <section className="panel panel-pad stack retro-investigation" aria-label="Flight School motion investigation">
    <div className="meter-label">Optional investigation · unscored</div><h3>Which way will it move next?</h3>
    <p>Inspect the last sightings or replay your log. Commit a direction, collect more nights, then compare with the next recorded position. Guessing differently is a useful result too.</p>
    {!study ? <><label className="field">My next-position prediction<select className="input" value={choice} onChange={(e) => setChoice(e.target.value as MotionDirection)}><option value="east">Eastward net change</option><option value="west">Westward net change</option><option value="unresolved">Too small to resolve</option></select></label>
      <button className="btn primary" disabled={!last} onClick={() => { if (last) s.set({ retroStudy: { anchorAt: last.at, anchorValue: last.v, prediction: choice } }); }}>Commit motion prediction</button></> : <>
      <div>Your committed prediction: {study.prediction === 'unresolved' ? 'too small to resolve' : `${study.prediction}ward`} from the sighting on day {fmt(study.anchorAt / DAY, 3)}.</div>
      {!study.result ? <><button className="btn primary" onClick={() => { const now = useGame.getState(); now.set({ trackOn: true }); fastForward(clock.t + 3 * DAY); clock.paused = true; clock.emit(); }}>Collect another three days</button><div className="faint">This advances practice time and uses the normal visibility/weather gates. If no new sighting is possible, collect more nights.</div></> : <><div className="callout tip" role="status">The next saved sighting changed by {fmt(study.result.delta, 3)}° over {fmt((study.result.at - study.anchorAt) / DAY, 3)} days: {study.result.direction === 'unresolved' ? 'direction unresolved at this readout step' : `${study.result.direction}ward net change`}. {study.result.direction === study.prediction ? 'Your prediction agrees with this comparison.' : 'The comparison differs from your prediction. Inspect what changed.'} This compares recorded positions, not a hidden perfect path.</div><button className="btn small" onClick={() => s.set({ retroStudy: null })}>Try another motion prediction</button></>}
    </>}
    <details className="measurement-help"><summary>Turning points and opposition</summary><p>In an outer-planet track, increasing longitude is eastward and decreasing longitude is westward. A turning point is where that direction changes. Opposition occurs within the backward interval, when the planet lies opposite the star; it is distinct from either turning point.</p><p>Near-circular examples often place opposition near the loop's middle. Eccentric orbits and uneven observations can make it asymmetric. Use the record to choose a date and an honest uncertainty rather than assuming an exact midpoint.</p></details>
  </section>;
}
