import { analyzeYear } from '../../game/yearObservations';
import { useEffect, useState } from 'react';
import { DAY } from '../../engine/constants';
import { clock } from '../../game/clock';
import { validEstimate } from '../../game/estimation';
import { commitReadingPrediction, readingPracticeAllowed, resolveReadingPredictions, unwrapPositions, type ReadingPredictionKind } from '../../game/readingPredictions';
import { doPendulum, emitTut, jumpTo, nextDusk } from '../../game/tutorial';
import { useGame } from '../../game/store';
import { PredictPlot } from '../common/Predict';
import { Equation } from '../common/Equation';
import { STEPS } from './steps';

export function ReadingPredictionPractice({ kind, currentLength = null, resultPending = false }: { kind: ReadingPredictionKind; currentLength?: number | null; resultPending?: boolean }) {
  const s = useGame();
  const [value, setValue] = useState('');
  const [range, setRange] = useState('');
  const [hint, setHint] = useState(false);
  const id = STEPS[s.tutorial.step]?.id;
  const active = readingPracticeAllowed(s) && (s.schoolSession?.id === `estimate-${kind}` || (s.schoolSession?.id === 'basic' && id === (kind === 'pendulum' ? 'pend-send' : 'year-send')));
  useEffect(() => { if (active) resolveReadingPredictions(); }, [active, s.readings, s.starObs, s.readingPredictions]);
  if (!active) return null;
  const prediction = s.readingPredictions?.[kind];
  const baseline = prediction?.baseline ?? s.readings.filter((r) => r.kept && r.pendulum).at(-1)?.pendulum;
  const observations = prediction ? s.starObs.filter((o) => prediction.beforeIds.includes(String(o.at))) : s.starObs;
  const points = unwrapPositions(observations);
  const due = prediction?.due ?? (points.length ? nextDusk(Math.max(clock.t, points.at(-1)!.x * DAY) + 14 * DAY) : 0);
  const canCommit = value.trim() !== '' && range.trim() !== '' && validEstimate(Number(value), Number(range)) && (
    kind === 'pendulum' ? !!baseline && currentLength !== null && Math.abs(currentLength / baseline.length - 1) >= .2 && !resultPending : !!analyzeYear(observations).fit
  );
  const completed = prediction?.comparison !== undefined;
  const plotValue = value.trim() && validEstimate(Number(value), Number(range)) ? Number(value) : null;
  const moduleId = `exercise:estimate-${kind}`;
  return <section className="panel panel-pad stack reading-practice" data-tut={`training-prediction-${kind}`} aria-label={`${kind === 'pendulum' ? 'Swing' : 'Star'} prediction practice`}>
    <div className="meter-label">Optional prediction practice · unscored</div>
    <h3>{kind === 'pendulum' ? 'Predict, then time the new length' : 'Predict, then observe the future position'}</h3>
    {kind === 'pendulum' ? <>
      <p className="muted">Keep a baseline reading. Change the string length noticeably, re-measure it on the scale, then commit a predicted full-swing time and ± range before timing the new length.</p>
      {baseline ? <div className="callout tip">Your baseline: {baseline.length.toFixed(3)} m · {baseline.period.toFixed(3)} s per full swing.<br />New measured length: {prediction?.length?.toFixed(3) ?? currentLength?.toFixed(3) ?? 'measure it on the scale'} m.</div> : <>
        <p>No baseline period is logged yet. Time and keep one reading using the rig.</p>
        <button className="btn small" onClick={() => { const session = useGame.getState().schoolSession!; useGame.setState({ schoolSession: { ...session, assisted: true } }); doPendulum(); }}>Use a labeled ECHO baseline</button>
      </>}
    </> : <>
      <p className="muted">Centre and log the star at two or more different dusks. Estimate its position about two weeks beyond your latest observation, with a ± range. Positions are unwrapped across 360°.</p>
      <table className="log"><thead><tr><th>Day</th><th>Logged position</th></tr></thead><tbody>{points.slice(-5).map((p, i) => <tr key={i}><td>{p.x.toFixed(2)}</td><td>{p.y.toFixed(3)}°</td></tr>)}</tbody></table>
      {!prediction && <button className="btn small" onClick={() => { jumpTo(nextDusk(clock.t + (points.length ? 25 : 0) * DAY)); emitTut('scope-star'); }}>Advance to an observing dusk</button>}
      {points.length >= 2 && <>
        <div>Prediction target: day {(due / DAY).toFixed(3)}.</div>
        <PredictPlot pts={points} axis="y" xT={due / DAY} xMax={due / DAY + 2} guess={prediction?.value ?? plotValue} sigma={prediction?.range ?? (validEstimate(0, Number(range)) ? Number(range) : 1)} truth={prediction?.comparison} onGuess={(v) => { if (!prediction && Number.isFinite(v)) setValue(v.toFixed(3)); }} xLabel="day" yLabel="position (°)" />
        {completed && <div className="faint" style={{ fontSize: 12 }}>Blue: your prediction and range. Green: the new observation.</div>}
      </>}
    </>}
    {!prediction ? <>
      <div className="row"><label className="field">Your estimate ({kind === 'pendulum' ? 's' : '°'})<input className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></label>
        <label className="field">± range<input className="input" inputMode="decimal" value={range} onChange={(e) => setRange(e.target.value)} /></label></div>
      <button className="btn primary" disabled={!canCommit} onClick={() => commitReadingPrediction(kind, Number(value), Number(range), kind === 'pendulum' ? currentLength! : due)}>Commit prediction</button>
      <button className="btn small ghost" onClick={() => { setHint(!hint); const session = useGame.getState().schoolSession!; useGame.setState({ schoolSession: { ...session, assisted: true } }); }}>Show reasoning hint</button>
      {hint && <div className="hint">{kind === 'pendulum' ? 'Scale your measured period by the square root of the measured length ratio. Allow for timing, ruler and release-angle errors.' : 'Estimate the rise over run through your own points. Extend it to the target day and allow more uncertainty over a longer forecast.'}<Equation tex={kind === 'pendulum' ? 'T_2=T_1\\sqrt{L_2/L_1}' : 'y(t)=a+bt'} /></div>}
    </> : <>
      <div>Your committed prediction: <b>{prediction.value.toFixed(3)} ± {prediction.range.toFixed(3)} {kind === 'pendulum' ? 's' : '°'}</b>.</div>
      {!completed && (kind === 'pendulum' ? <p>Release and time the new length, then keep the reading. Only a new reading at the committed length will be compared.</p> : <>
        <button className="btn primary" disabled={clock.t > due + 600} onClick={() => { jumpTo(due); emitTut('scope-star'); }}>Advance to prediction time</button>
        <p>Centre and log the star at that paused time. Only a new log within ten simulated minutes of the target is compared.</p>
        {clock.t > due + 600 && <p className="amber">The target window has passed. Try another prediction using your existing logs.</p>}
      </>)}
      {completed && <div className="callout tip" role="status">
        <b>Compared with a new observation</b>
        <div>Observed: {prediction.comparison!.toFixed(3)} {kind === 'pendulum' ? 's' : '°'}. {Math.abs(prediction.comparison! - prediction.value) <= prediction.range ? 'It falls inside your predicted range.' : 'It falls outside your predicted range. Revisit your method and range.'}</div>
        <p>This is a comparison with a noisy reading, not a hidden exact answer. Consider repeatability and shared errors; a very broad range may cover a reading while telling you little.</p>
      </div>}
      <button className="btn small" onClick={() => { const next = { ...s.readingPredictions }; delete next[kind]; useGame.setState({ readingPredictions: next }); setValue(''); setRange(''); }}>Try another prediction</button>
      {completed && <span className="green">Practice recorded{ s.training?.[moduleId]?.assisted ? ' with help' : '' }. You can continue or repeat.</span>}
    </>}
  </section>;
}
