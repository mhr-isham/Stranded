import { useMemo, useState } from 'react';
import { distanceTeachingObservation } from '../../game/distanceScale';
import { useGame } from '../../game/store';
import { Chart } from '../common/Chart';
import { DistanceDiagram } from '../common/DistanceContext';
import { Equation } from '../common/Equation';
import { useLessonArtifact } from './lessonArtifact';

type Observation = NonNullable<ReturnType<typeof distanceTeachingObservation>>;
const EXPECTATIONS = ['Separation changes; orbit size stays the same', 'Orbit size changes; separation stays the same', 'Both stay the same'];

export function DistanceScaleLab() {
  const formulas = useGame((s) => s.settings.formulas);
  const [inner, setInner] = useState(false), [day, setDay] = useState(0), [rough, setRough] = useState(false);
  const [records, setRecords] = useState<Observation[]>([]), [choice, setChoice] = useState(EXPECTATIONS[0]), [prediction, setPrediction] = useState<string | null>(null), [compared, setCompared] = useState(false);
  const base = distanceTeachingObservation(0, inner)!, current = distanceTeachingObservation(day, inner, rough ? 3 : 0)!;
  const unchanged = records.length >= 2 && records.every((r) => Math.abs(r.geometry.a2 / records[0].geometry.a2 - 1) < .00001);
  const artifact = useMemo(() => records.length ? {
    summary: [
      { label: 'Source', value: 'Hypothetical circular teaching system; not expedition measurements' },
      { label: 'Scenario', value: inner ? 'Inner orbit: home 100, target 60 million km' : 'Outer orbit: home 100, target 160 million km' },
      { label: 'Dated teaching observations', value: String(records.length) },
      ...(prediction ? [{ label: 'Your committed expectation', value: prediction }] : []),
      ...(compared ? [{ label: 'Compared result', value: unchanged ? 'Different separations infer the same orbit size' : 'Inferred scales differ; inspect reading error and assumptions' }] : []),
      ...records.map((r) => ({ label: `Teaching day ${r.day.toFixed(3)}`, value: `separation ${(r.p.dPar!.value / 1e9).toFixed(3)} million km; inferred orbit ${(r.geometry.a2 / 1e9).toFixed(3)} million km` })),
    ],
    plot: records.map((r) => ({ x: r.day, y: r.p.dPar!.value / 1e9 })), xLabel: 'teaching day', yLabel: 'teaching separation (million km)',
  } : undefined, [records, inner, prediction, compared, unchanged]);
  useLessonArtifact(artifact);
  return <section className="stack distance-scale-lab" aria-label="Changing distance mini expedition">
    <div className="meter-label">Optional Flight School investigation · teaching model</div>
    <h3>Changing gap. Same orbit?</h3>
    <p>Keep sightings at different positions. Can a changing separation still describe one unchanged orbit? These hypothetical planets follow circular orbits; nothing here advances your expedition.</p>
    <label className="field">Teaching system<select className="input" value={inner ? 'inner' : 'outer'} onChange={(e) => { setInner(e.target.value === 'inner'); setDay(0); setRecords([]); setPrediction(null); setCompared(false); }}><option value="outer">Outer target · orbit radius 160 million km</option><option value="inner">Inner target · orbit radius 60 million km</option></select></label>
    <DistanceDiagram geometry={current.geometry} />
    <label className="field">Teaching observation day · {day.toFixed(3)}<input aria-label="Teaching observation day" type="range" min="0" max={base.synodicDays / 4} step="any" value={day} onChange={(e) => setDay(Number(e.target.value))} /></label>
    <div className="row"><button className="btn small" onClick={() => setDay(0)}>{inner ? 'Conjunction' : 'Opposition'}</button><button className="btn small" onClick={() => setDay(base.synodicDays / 8)}>Later · ⅛ cycle</button><button className="btn small" onClick={() => setDay(base.synodicDays / 4)}>Later · ¼ cycle</button></div>
    <dl className="kv"><dt>Teaching separation now</dt><dd>{(current.p.dPar!.value / 1e9).toFixed(3)} million km</dd><dt>Orbit size inferred from this dated reading</dt><dd>{(current.geometry.a2 / 1e9).toFixed(3)} million km</dd></dl>
    <label className="row"><input type="checkbox" checked={rough} onChange={(e) => setRough(e.target.checked)} />Make the next teaching reading 3% high</label>
    <button className="btn primary" onClick={() => { setRecords((rows) => [...rows.filter((r) => Math.abs(r.day - day) > 1e-7), current].sort((a, b) => a.day - b.day).slice(-6)); setCompared(false); }}>Keep dated teaching observation</button>
    {records.length < 2 && <><label className="field">My expectation<select className="input" value={choice} disabled={!!prediction} onChange={(e) => setChoice(e.target.value)}>{EXPECTATIONS.map((p) => <option key={p}>{p}</option>)}</select></label><button className="btn small" disabled={!!prediction} onClick={() => setPrediction(choice)}>{prediction ? 'Expectation committed' : 'Commit my expectation'}</button></>}
    {prediction && <div className="faint">Your expectation: {prediction}</div>}
    {records.length > 0 && <div className="stack" aria-label="Dated teaching log">{records.map((r) => <div className="distance-teaching-row" key={r.day}>Day {r.day.toFixed(3)} · separation {(r.p.dPar!.value / 1e9).toFixed(3)} · inferred orbit {(r.geometry.a2 / 1e9).toFixed(3)} million km</div>)}</div>}
    {records.length >= 2 && <><Chart series={[{ pts: records.map((r) => ({ x: r.day, y: r.p.dPar!.value / 1e9 })), color: '#ffc46b', kind: 'dots' }, { pts: records.map((r) => ({ x: r.day, y: r.geometry.a2 / 1e9 })), color: '#5be3a4', kind: 'dots' }]} xLabel="teaching day" yLabel="million km" ariaLabel="Dated separations and inferred orbit sizes" /><div className="faint">Orange: teaching separation. Green: inferred orbit size. Dots are your kept teaching observations.</div></>}
    <button className="btn small primary" disabled={records.length < 2} onClick={() => setCompared(true)}>Compare my dated observations</button>
    {compared && <div className="callout tip" role="status">{unchanged ? 'Different separations infer the same orbit size because each reading keeps its date. The changing gap does not mean the orbit expanded.' : 'These inferred orbit sizes differ. A rough reading or inconsistent assumptions can move an inferred scale without the physical orbit changing. Inspect your dated readings; this is useful evidence, not a failed exercise.'} Different dates must not be averaged as if they were repeated measurements of one fixed separation.</div>}
    {formulas && <Equation tex={'d(t)^2=a_1^2+a_2^2-2a_1a_2\\cos\\psi(t) \\\\ a_1=\\frac{d(t)}{\\sqrt{1+r^2-2r\\cos\\psi(t)}},\\quad r=\\frac{a_2}{a_1}'} />}
    <div className="faint">This is a coplanar circular model with known teaching periods and alignment time. Real images must also be observable from both sites. Ellipses use a semi-major axis instead of a constant star–planet radius. Kept teaching records are archived on explicit lesson completion, with no score or fuel benefit.</div>
  </section>;
}
