import { useMemo, useRef, useState } from 'react';
import { DAY, DEG } from '../../engine/constants';
import { fmt } from '../../game/format';
import { useMode } from '../../game/modes';
import { sfx } from '../../game/audio';
import { useGame } from '../../game/store';
import { keepRadiusFieldNote, prepareRadiusComparison, radiusComparisonCurrent, radiusOutcome, radiusSources, RADIUS_RELATIONS, type RadiusComparison, type RadiusFieldNote, type RadiusRelation, type RadiusTakeaway } from '../../game/radiusCrossCheck';

const relationText = (relation: RadiusRelation) => relation === 'linked'
  ? 'These results are linked through calibration. Agreement is not independent corroboration.'
  : relation === 'separate' ? 'You report separate observations and calibrations. Shared atmospheric or survey errors may still affect both.'
  : 'The relationship between calibrations is uncertain. Treat this as a comparison of stated ranges, not independent confirmation.';
const takeawayText = (note: Pick<RadiusFieldNote, 'comparison' | 'takeaway'>) => note.takeaway === 'ranges'
  ? `${radiusOutcome(note.comparison)}. This describes the entered ranges, not which result is correct.`
  : note.takeaway === 'conditions' ? relationText(note.comparison.relation) : 'More independent observations or better-characterized conditions would help interpret this comparison.';

export function RadiusCrossCheck() {
  const s = useGame(), mode = useMode();
  const sources = useMemo(() => radiusSources(s), [s.readings, s.shadows]);
  const [hillId, setHillId] = useState<string | null>(null), [capture, setCapture] = useState<string | null>(null);
  const [hillError, setHillError] = useState(''), [shadowError, setShadowError] = useState('');
  const [relation, setRelation] = useState<RadiusRelation>('unknown');
  const [preview, setPreview] = useState<RadiusComparison | null>(null), [takeaway, setTakeaway] = useState<RadiusTakeaway | null>(null);
  const [text, setText] = useState(''), [notice, setNotice] = useState('');
  const reveal = useRef<HTMLDivElement>(null);
  const hill = sources.hills.find((r) => r.id === (hillId ?? sources.hills[0]?.id));
  const shadow = sources.shadows.find((a) => a.pair.rover.capture === (capture ?? sources.shadows[0]?.pair.rover.capture));
  const entered = !!hill && !!shadow && [Number(hillError), Number(shadowError)].every((n) => Number.isFinite(n) && n > 0);
  const current = !!preview && radiusComparisonCurrent(s, preview);
  function changed() { const savedWords = !!text.trim() && !!s.radiusFieldNote && text.trim() === s.radiusFieldNote.text; if (savedWords) setText(''); setPreview(null); setTakeaway(null); setNotice(savedWords ? 'Your saved words remain in the Codex. This comparison starts a fresh draft.' : ''); }
  const kept = s.radiusFieldNote?.runId === s.runId;
  return <details className="panel panel-pad radius-cross-check" aria-label="Two-method radius cross-check">
    <summary><span>Optional · compare hill and shadow measurements</span>{kept && <span className="radius-note-chip">Field note kept</span>}</summary>
    <div className="stack radius-cross-check-body">
      <div><span className="meter-label">TWO WAYS OF SEEING A WORLD</span><h3>Do your measurements tell the same story?</h3><p>Choose one observation from each method and state their uncertainties. Different results can be just as interesting as matching ones.</p></div>
      {!sources.hills.length && <div className="radius-empty"><b>A hill observation is needed</b><p>Keep a horizon reading with its height and observing conditions. A worksheet value or an older entry without method records cannot identify that observation.</p>{s.screen !== 'hill' && <button className="btn small" onClick={() => s.go('hill')}>Open the hill instrument</button>}</div>}
      {!sources.shadows.length && <div className="radius-empty"><b>A paired shadow observation is needed</b><p>Keep both marks from a synchronized near-noon capture. Either radius method can still be used on its own.</p>{s.screen !== 'gnomon' && <button className="btn small" onClick={() => s.go('gnomon')}>Open noon shadows</button>}</div>}
      {sources.hills.length > 0 && sources.shadows.length > 0 && <form className="stack" onSubmit={(e) => {
        e.preventDefault();
        const next = entered ? prepareRadiusComparison(s, hill!.id, shadow!.pair.rover.capture!, Number(hillError) * 1000, Number(shadowError) * 1000, relation) : null;
        if (!next) { setNotice('Choose both observations and positive finite uncertainties.'); return; }
        setHillId(hill!.id); setCapture(shadow!.pair.rover.capture!); setPreview(next); setTakeaway(null); setNotice('');
        requestAnimationFrame(() => reveal.current?.scrollIntoView({ block: 'nearest' }));
      }}>
        <div className="radius-source-grid">
          <div className="radius-source hill"><span className="meter-label">HILL · HORIZON DIP</span>
            <label>Kept hill observation<select className="input" aria-label="Hill observation for cross-check" value={hill?.id ?? ''} onChange={(e) => { setHillId(e.target.value); setHillError(''); changed(); }}>{!hill && <option value="">Choose another kept observation</option>}{sources.hills.map((r, i) => <option key={r.id} value={r.id}>{i + 1} · {r.environment!.horizon!.station} · day {fmt(r.at / DAY, 3)} · {fmt(r.value / 1000, 0)} km</option>)}</select></label>
            {hill && <strong>{fmt(hill.value / 1000, 0)} <small>km</small></strong>}
            <label>My hill uncertainty (km)<input className="input" aria-label="Hill uncertainty for cross-check in kilometres" type="number" min="0" step="any" inputMode="decimal" value={hillError} onChange={(e) => { setHillError(e.target.value); changed(); }} /></label>
          </div>
          <div className="radius-source shadow"><span className="meter-label">TWO STICKS · NOON SHADOWS</span>
            <label>Paired shadow observation<select className="input" aria-label="Shadow observation for cross-check" value={shadow?.pair.rover.capture ?? ''} onChange={(e) => { setCapture(e.target.value); setShadowError(''); changed(); }}>{!shadow && <option value="">Choose another paired observation</option>}{sources.shadows.map((a, i) => <option key={a.pair.rover.capture} value={a.pair.rover.capture}>{i + 1} · day {fmt(a.pair.rover.at / DAY, 3)} · {fmt(a.pair.rover.dist / 1000, 0)} km baseline</option>)}</select></label>
            {shadow && <strong>{fmt(shadow.result.radius / 1000, 0)} <small>km</small></strong>}
            <label>My shadow uncertainty (km)<input className="input" aria-label="Shadow uncertainty for cross-check in kilometres" type="number" min="0" step="any" inputMode="decimal" value={shadowError} onChange={(e) => { setShadowError(e.target.value); changed(); }} /></label>
            {mode.sanity && shadow && <button type="button" className="btn small ghost" onClick={() => { setShadowError(String(Number((shadow.result.sigma / 1000).toPrecision(6)))); changed(); }}>Use recorded shadow error estimate</button>}
          </div>
        </div>
        <label className="stack">How are the methods related?<select className="input" aria-label="Relationship between radius calibrations" value={relation} onChange={(e) => { setRelation(e.target.value as RadiusRelation); changed(); }}>{Object.entries(RADIUS_RELATIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
        <button className="btn primary" disabled={!entered} type="submit">Compare my stated ranges</button>
      </form>}
      {preview && !current && <div role="status" className="radius-empty">The source observations were revised, excluded or removed. Compare the current records before keeping a field note. Your earlier saved note remains unchanged.</div>}
      {preview && current && <div className="stack radius-comparison-reveal" ref={reveal} aria-label="Requested radius comparison">
        <div className="radius-comparison-verdict"><b>{radiusOutcome(preview)}</b><p>Overlap does not confirm the true radius. Separation does not identify which measurement or model needs changing.</p></div>
        <RadiusRangePlot comparison={preview} />
        <p>{relationText(preview.relation)} No combined average or confidence score is assigned.</p>
        <details><summary>What the recorded evidence shows</summary><RadiusEvidence comparison={preview} /></details>
        <div className="radius-keep-note stack"><span className="meter-label">A DISCOVERY WORTH KEEPING · OPTIONAL</span><b>What would you like to remember?</b>
          <div className="row radius-takeaways" role="group" aria-label="Choose a field-note takeaway">{([['ranges', 'How the ranges compare'], ['conditions', 'Shared errors matter'], ['more-evidence', 'I want more evidence']] as const).map(([id, label]) => <button type="button" className={`btn small ${takeaway === id ? 'primary' : ''}`} key={id} aria-pressed={takeaway === id} onClick={() => { setTakeaway(id); setNotice(''); }}>{label}</button>)}</div>
          {takeaway && <p>{takeawayText({ comparison: preview, takeaway })}</p>}
          <details><summary>Add your own words</summary><label className="stack">My field note (optional)<textarea className="input" aria-label="My radius cross-check field note" maxLength={600} rows={3} value={text} onChange={(e) => setText(e.target.value)} /></label></details>
          <button className="btn" disabled={!takeaway} onClick={() => {
            const saved = keepRadiusFieldNote(preview, takeaway!, text);
            if (!saved.ok) return setNotice(saved.reason);
            if (!saved.unchanged) sfx(saved.first ? 'unlock' : 'log');
            setNotice(saved.unchanged ? 'This field note is already kept.' : saved.first ? 'Field discovery kept · two ways of seeing a world. Read it again in the Codex.' : 'Field note updated. Your expedition’s recognition is unchanged.');
          }}>{kept ? 'Update my expedition field note' : 'Keep my field discovery'}</button>
          <div className="faint">One cosmetic discovery per expedition, for any comparison outcome. Revising it gives no extra score, fuel, hints or verification uses.</div>
        </div>
      </div>}
      {notice && <div role="status" className="radius-note-status">{notice}</div>}
      {kept && <button className="btn small ghost" onClick={() => s.go('codex')}>Read my field discovery in the Codex</button>}
    </div>
  </details>;
}

export function RadiusRangePlot({ comparison: c }: { comparison: RadiusComparison }) {
  const min = Math.min(c.hillRange[0], c.shadowRange[0]) / 1000, max = Math.max(c.hillRange[1], c.shadowRange[1]) / 1000;
  const width = Math.max(1e-6, max - min, Math.abs(max) * 1e-8), low = Math.max(0, min - width * .08), high = max + width * .08;
  const x = (metres: number) => 28 + (metres / 1000 - low) / (high - low) * 344;
  const rows = [{ label: 'HILL', y: 64, value: c.hillRadius, sigma: c.hillSigma, range: c.hillRange, color: '#8bd3ff' }, { label: 'SHADOWS', y: 139, value: c.shadowRadius, sigma: c.shadowSigma, range: c.shadowRange, color: '#ffd08a' }];
  return <figure className="radius-range-figure"><svg viewBox="0 0 400 218" role="img" aria-label={`Your stated radius ranges in kilometres. Hill ${fmt(c.hillRadius / 1000, 2)} plus or minus ${fmt(c.hillSigma / 1000, 2)}; shadows ${fmt(c.shadowRadius / 1000, 2)} plus or minus ${fmt(c.shadowSigma / 1000, 2)}. ${radiusOutcome(c)}.`}>
    {Array.from({ length: 5 }, (_, i) => { const value = low + (high - low) * i / 4, X = 28 + 344 * i / 4; return <g key={i}><line x1={X} y1="38" x2={X} y2="172" stroke="#ffffff12" /><text x={X} y="199" textAnchor="middle" fill="#9ab1c6" fontSize="15">{fmt(value, value < 100 ? 1 : 0)}</text></g>; })}
    {rows.map((r) => <g key={r.label}><text x="28" y={r.y - 23} fill={r.color} fontSize="13" letterSpacing="1">{r.label}</text><line x1={x(r.range[0])} x2={x(r.range[1])} y1={r.y} y2={r.y} stroke={r.color} strokeWidth="8" strokeLinecap="round" opacity=".65" />{r.range.map((v, i) => <line key={i} x1={x(v)} x2={x(v)} y1={r.y - 10} y2={r.y + 10} stroke={r.color} strokeWidth="2" />)}<circle cx={x(r.value)} cy={r.y} r="7" fill={r.color} stroke="#0d1724" strokeWidth="2" /><text x="372" y={r.y - 23} textAnchor="end" fill="#cfdeea" fontSize="14">{fmt(r.value / 1000, 1)} ± {fmt(r.sigma / 1000, 1)} km</text></g>)}
  </svg><figcaption>Bars show your entered ± ranges on one radius scale (km), not calibrated confidence intervals. Physical radius starts at zero.</figcaption></figure>;
}

function RadiusEvidence({ comparison: c }: { comparison: RadiusComparison }) {
  const h = c.hill.environment!.horizon!, correction = h.correction;
  return <div className="radius-evidence stack">
    <p><b>Hill:</b> {h.station}, eye height {fmt(h.height, 1)} m · expedition day {fmt(c.hill.at / DAY + 1, 4)}. Apparent dip {fmt(h.rawAngle / DEG, 4)}°; used dip {fmt(h.usedAngle / DEG, 4)}°.</p>
    <p>{correction ? `Recorded ${correction.source === 'player' ? 'player' : 'ECHO humidity'} correction: k ${fmt(correction.k, 3)} ± ${fmt(correction.sigmaK, 3)}; shared radius contribution ±${fmt(correction.sigmaValue / 1000, 2)} km.` : 'No refraction correction was recorded for this hill calculation.'}{h.legacyCompensated ? ' This is a legacy compensated sight; its original uncompensated dip was not captured.' : ''}</p>
    <p><b>Shadows:</b> synchronized capture on expedition day {fmt(c.rover.at / DAY + 1, 4)} · local solar day {c.rover.solarDay! + 1}. Camp {fmt(c.camp.length!, 3)} ± {fmt(c.camp.sigmaLength!, 3)} m; rover {fmt(c.rover.length!, 3)} ± {fmt(c.rover.sigmaLength!, 3)} m. Baseline {fmt(c.rover.dist / 1000, 1)} ± {fmt(c.rover.sigmaBaseline! / 1000, 2)} km.</p>
    <p>{c.camp.refraction ? `Shared player-entered shadow coefficient: k ${fmt(c.camp.refraction.k, 3)} ± ${fmt(c.camp.refraction.sigmaK, 3)}.` : 'Apparent high-Sun shadows were used; refraction was not removed.'} Recorded-input working error estimate: ±{fmt(c.shadowWorkingError / 1000, 2)} km, including the timing allowance. This is not calibrated confidence.</p>
    {(c.hillSigma < (correction?.sigmaValue ?? 0) || c.shadowSigma < c.shadowWorkingError) && <p>Your entered range is smaller than at least one recorded model/input error estimate. Keep that limitation in mind; changing a displayed range does not improve an observation.</p>}
    <p>These methods use different observations, but atmosphere, leveling, length calibration or using one result to choose the other’s correction can connect their errors. Repeating algebra or re-marking one image does not provide another independent method.</p>
    <p>The comparison uses one kept hill observation, not a standard error obtained by averaging unlike stations. No worksheet value or generated true radius enters it. Nothing here proves which method is correct.</p>
  </div>;
}

export function RadiusFieldNotes() {
  const s = useGame(), [selected, setSelected] = useState(0);
  const available = [{ label: 'This expedition', note: s.radiusFieldNote }, { label: 'First discovery', note: s.radiusDiscoveries?.first }, { label: 'Latest field note', note: s.radiusDiscoveries?.latest }];
  const notes = available.filter((v, i, all) => v.note && !all.slice(0, i).some((prior) => prior.note?.runId === v.note!.runId && prior.note?.comparison.fingerprint === v.note!.comparison.fingerprint && prior.note?.takeaway === v.note!.takeaway && prior.note?.text === v.note!.text));
  if (!notes.length) return null;
  const activeIndex = Math.min(selected, notes.length - 1), chosen = notes[activeIndex], note = chosen.note!;
  const changed = note.runId === s.runId && !radiusComparisonCurrent(s, note.comparison);
  return <section className="panel panel-pad stack radius-field-notes" aria-label="Saved radius field discoveries">
    <div className="row between"><span className="meter-label">FIELD DISCOVERY</span><span className="radius-note-chip">Two methods explored</span></div><h2>Two ways of seeing a world</h2>
    <p>A souvenir of your investigation. First and latest discoveries stay with your profile; your expedition’s note can be revised without earning another reward.</p>
    {notes.length > 1 && <div className="row radius-note-tabs" role="group" aria-label="Choose a saved radius discovery">{notes.map((v, i) => <button key={v.label} className="btn small" aria-pressed={activeIndex === i} onClick={() => setSelected(i)}>{v.label}</button>)}</div>}
    <article className="stack" aria-label="Saved two-method field note"><div className="faint">{note.practice ? 'Flight School practice' : 'Expedition'} · seed {note.seed} · chapter {note.chapter} · {note.difficulty} · {new Date(note.updatedAt).toLocaleDateString('en-GB')}</div>
      <b>{radiusOutcome(note.comparison)}</b><RadiusRangePlot comparison={note.comparison} /><p>{takeawayText(note)}</p>
      {note.text && <blockquote style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{note.text}</blockquote>}
      {changed && <p className="faint">This saved snapshot is unchanged. Its source observations have since been revised, excluded or removed from the current log.</p>}
      <details><summary>Inspect the saved observations</summary><RadiusEvidence comparison={note.comparison} /></details>
    </article>
  </section>;
}
