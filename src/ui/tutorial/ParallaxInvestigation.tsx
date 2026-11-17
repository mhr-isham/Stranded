import { useState } from 'react';
import { ARCSEC } from '../../engine/constants';
import { compareParallax, measuredParallax, type JumpDirection } from '../../game/parallaxObservation';
import { recordSchoolMilestone } from '../../game/training';
import { useGame } from '../../game/store';

export function ParallaxInvestigation() {
  const s = useGame(), [choice, setChoice] = useState<JumpDirection>('left');
  if (!s.tutorial.active || !s.settings.freeRoam || !['distance', 'basic'].includes(s.schoolSession?.id ?? '')) return null;
  const pair = s.parallaxPair, prediction = pair?.prediction, result = prediction?.comparison;
  return <section className="panel panel-pad stack" aria-label="Flight School parallax investigation">
    <div className="meter-label">Optional investigation · unscored</div><h3>Which way will the planet jump?</h3>
    <p>From camp A to rover B, predict the main screen direction. Commit while only A has been viewed, then blink, mark both centres and test your idea. You can finish the exercise without doing this.</p>
    {!pair ? <p>Take a synchronized pair first. The comparator starts paused on A.</p> : !prediction ? pair.viewedB ? <p>This pair has already been viewed from B. A fresh pair starts another prediction opportunity; ordinary marking and keeping remain available.</p> : <>
      <label className="field">My parallax jump prediction<select className="input" value={choice} onChange={(e) => setChoice(e.target.value as JumpDirection)}>{(['left', 'right', 'up', 'down', 'unresolved'] as const).map((d) => <option key={d} value={d}>{d === 'unresolved' ? 'No clear direction' : `Mostly ${d}`}</option>)}</select></label>
      <button className="btn small primary" onClick={() => { const current = useGame.getState().parallaxPair; if (current && !current.viewedB && !current.prediction) useGame.setState({ parallaxPair: { ...current, prediction: { direction: choice } } }); }}>Commit parallax prediction</button>
    </> : <>
      <div>Your committed prediction: {prediction.direction === 'unresolved' ? 'no clear direction' : `mostly ${prediction.direction}`}.</div>
      {!result ? <button className="btn small primary" disabled={!measuredParallax(pair)} onClick={() => {
        const current = useGame.getState(), pair = current.parallaxPair;
        if (!pair) return;
        const compared = compareParallax(pair);
        if (compared !== pair) {
          const record = { captureId: pair.id, at: pair.at, projectedBaseline: pair.projectedBaseline, prediction: compared.prediction!.direction, comparison: compared.prediction!.comparison! };
          useGame.setState({ parallaxPair: compared, parallaxInvestigations: [...(current.parallaxInvestigations ?? []).filter((r) => r.captureId !== pair.id).slice(-7), record] });
          recordSchoolMilestone('predict-parallax', !!current.schoolSession?.assisted);
        }
      }}>Compare with my camera marks</button> : <div className="callout tip" role="status">
        Your compared marks shift {(result.shift / ARCSEC).toFixed(3)}″: {result.direction === 'unresolved' ? 'no clear direction at this frozen image’s seeing scale' : `mostly ${result.direction}`}.
        {' '}{result.direction === prediction.direction ? 'Your prediction agrees with these marks.' : 'These marks differ from your prediction; inspect their direction and the image blur.'}
        {' '}This keeps the first comparison you made, even if you later revise the markers. It tests your recorded marks, not hidden orbital truth.
      </div>}
    </>}
    {(s.parallaxInvestigations?.length ?? 0) > 0 && <details className="measurement-help"><summary>My tested pairs · {s.parallaxInvestigations.length} saved</summary>{s.parallaxInvestigations.map((r) => <div key={r.captureId}>Sideways baseline {(r.projectedBaseline / 1000).toFixed(1)} km · marked shift {(r.comparison.shift / ARCSEC).toFixed(3)}″ · predicted {r.prediction}, compared {r.comparison.direction}</div>)}<p>Compare another baseline if you like. Observation time and target distance can also change the shift; a larger drive alone is not a controlled comparison.</p></details>}
    <div className="faint">Screen directions refer to B relative to A. Near-diagonal changes are described by their larger component; shifts within the 1.2″ × seeing-factor blur scale are inconclusive. That scale is a teaching comparison threshold, not a certified error bar.</div>
  </section>;
}
