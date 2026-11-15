import { useMemo, useState } from 'react';
import { ESTIMATION_DRILLS, estimationScenario, estimateFeedback, validEstimate, type EstimationId } from '../../game/estimation';
import { recordTraining } from '../../game/training';
import { Modal } from '../common/widgets';
import { Equation } from '../common/Equation';

export function EstimationWorkshop({ id, onClose }: { id: EstimationId; onClose: () => void }) {
  const [variant, setVariant] = useState(0);
  const [value, setValue] = useState('');
  const [range, setRange] = useState('');
  const [committed, setCommitted] = useState<{ value: number; range: number } | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [hint, setHint] = useState(false);
  const [usedHint, setUsedHint] = useState(false);
  const scenario = useMemo(() => estimationScenario(id, variant), [id, variant]);
  const title = ESTIMATION_DRILLS.find((drill) => drill.id === id)!.title;
  const ready = value.trim() !== '' && range.trim() !== '' && validEstimate(Number(value), Number(range));
  const format = (n: number) => Number(n.toPrecision(5)).toString();
  return <Modal onClose={onClose}>
    <section className="estimation-workshop stack" role="region" aria-label="Estimation exercise">
      <div className="meter-label">Unscored practice · example {variant % 6 + 1} / 6</div>
      <h2>{title}</h2>
      <p className="muted">{scenario.question}</p>
      <p className="faint" style={{ fontSize: 12 }}>These are teaching data. Commit an estimate before revealing the worked comparison. Completion records practice, regardless of accuracy.</p>
      <table className="log"><thead><tr><th>Information</th><th>Observation</th></tr></thead><tbody>{scenario.data.map((row) => <tr key={row.label}><td>{row.label}</td><td>{row.value}</td></tr>)}</tbody></table>
      {!committed ? <>
        <div className="row"><label className="field">Your estimate ({scenario.unit})<input className="input" inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} /></label>
          <label className="field">± range ({scenario.unit})<input className="input" inputMode="decimal" value={range} onChange={(e) => setRange(e.target.value)} /></label></div>
        <button className="btn primary" disabled={!ready} onClick={() => setCommitted({ value: Number(value), range: Number(range) })}>Commit estimate</button>
        <button className="btn small ghost" onClick={() => { setHint(!hint); setUsedHint(true); }}>Show a reasoning hint</button>
        {hint && <div className="hint">{scenario.hint}<Equation tex={scenario.tex} /></div>}
      </> : <>
        <div className="callout tip">Your committed estimate: {format(committed.value)} ± {format(committed.range)} {scenario.unit}.</div>
        {!revealed && <button className="btn primary" onClick={() => setRevealed(true)}>Reveal worked comparison</button>}
        {revealed && <>
          <div className="callout tip" role="status"><b>Worked comparison</b><div>{format(scenario.reference)} ± {format(scenario.range)} {scenario.unit}{scenario.bounds ? ' · observational bounds' : ' · illustrative model range'}.</div>
            <p>{estimateFeedback(scenario, committed.value, committed.range)}</p></div>
          <RangeComparison value={committed.value} range={committed.range} reference={scenario.reference} referenceRange={scenario.range} />
          <Equation tex={scenario.tex} /><p>{scenario.explanation}</p>
          <p className="faint" style={{ fontSize: 12 }}>A worked model is one way to reason from the stated data. A different justified uncertainty can be reasonable; this exercise awards no points.</p>
          <div className="row"><button className="btn primary" onClick={() => { recordTraining(`estimate:${id}`, 'completed', usedHint); onClose(); }}>Finish exercise</button>
            <button className="btn" onClick={() => { recordTraining(`estimate:${id}`, 'completed', usedHint); setVariant(variant + 1); setValue(''); setRange(''); setCommitted(null); setRevealed(false); setHint(false); setUsedHint(false); }}>Try another example</button></div>
        </>}
      </>}
    </section>
  </Modal>;
}

function RangeComparison({ value, range, reference, referenceRange }: { value: number; range: number; reference: number; referenceRange: number }) {
  const low = Math.min(value - range, reference - referenceRange), high = Math.max(value + range, reference + referenceRange);
  const span = Math.max(1e-8, high - low), x = (n: number) => 28 + (n - low) / span * 504;
  return <div><svg className="estimate-ranges" viewBox="0 0 560 104" role="img" aria-label="Your interval compared with the worked interval">
    <text x="28" y="16" fill="#ffc46b" fontSize="12">Your interval</text><path d={`M${x(value - range)} 32H${x(value + range)}`} stroke="#ffc46b" strokeWidth="8" /><circle cx={x(value)} cy="32" r="6" fill="#fff0bf" />
    <text x="28" y="62" fill="#6cc4ff" fontSize="12">Worked comparison</text><path d={`M${x(reference - referenceRange)} 78H${x(reference + referenceRange)}`} stroke="#6cc4ff" strokeWidth="8" /><circle cx={x(reference)} cy="78" r="6" fill="#e2f6ff" />
  </svg></div>;
}
