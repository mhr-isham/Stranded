import { useMemo, useState, type ReactNode } from 'react';
import { ARCSEC, DAY } from '../../engine/constants';
import { hasChallenge } from '../../game/challenges';
import { ECHO } from '../../game/echo';
import type { SineFit } from '../../game/fits';
import { fmt } from '../../game/format';
import { analyzeMoon, moonStudy } from '../../game/moonObservations';
import { currentWorld } from '../../game/sim';
import { useGame } from '../../game/store';
import { Chart } from '../common/Chart';
import { Formula, SendToSheet } from '../common/sheetBits';

export function MoonAnalysisPanel({ renderPrediction }: { renderPrediction: (points: { x: number; y: number }[], fit: SineFit | null) => ReactNode }) {
  const s = useGame();
  const [band, setBand] = useState<[number, number] | null>(null);
  const [dates, setDates] = useState(['', '']);
  const [dateError, setDateError] = useState('');
  const [pickB, setPickB] = useState(false);
  const [showB, setShowB] = useState(false);
  const [notice, setNotice] = useState('');
  const manual = hasChallenge(s, 'handFit');
  const a = useMemo(() => analyzeMoon(s.moonTrack, s.track, band, manual), [s.moonTrack, s.track, band, manual]);
  const chosen = pickB && a.alternative ? a.alternative : a.fit;
  const studies = s.moonStudies ?? [];
  const inSchool = s.tutorial.active && (s.schoolSession?.id === 'moon' || s.schoolSession?.id === 'basic');
  function select(next: [number, number] | null) {
    setBand(next); setDates(next ? next.map(String) : ['', '']); setDateError(''); setPickB(false); setNotice('');
  }
  function apply() {
    const next = dates.map(Number) as [number, number];
    if (dates.some((d) => !d.trim()) || !next.every(Number.isFinite) || next[0] > next[1]) {
      setDateError('Enter both expedition days, with start no later than end.'); return;
    }
    select(next);
  }
  function curve(f: SineFit | null) {
    return f && a.used.length ? Array.from({ length: 240 }, (_, i) => {
      const x = a.from + (a.to - a.from) * i / 239; return { x, y: f.model(x) };
    }).filter((p) => Number.isFinite(p.y)) : [];
  }
  if (!currentWorld().system.features.moon) return <div className="panel panel-pad stack"><b>No moon</b><p>This blue planet has no moon to act as a scale. Its mass needs another method, such as the probe bay at camp.</p></div>;
  return <div className="panel panel-pad stack" aria-label="Moon orbit analysis">
    <b>The moon of the blue planet</b>
    {!s.identified ? <div className="amber">Identify the blue planet first.</div> :
      <button data-tut="moon-toggle" className={`btn ${s.moonTrackOn ? '' : 'primary'}`} onClick={() => { s.set({ moonTrackOn: !s.moonTrackOn }); s.say(ECHO.moon); }}>{s.moonTrackOn ? 'Moon auto-log: ON' : 'Log the moon’s offset every few hours'}</button>}
    <p className="muted" style={{ margin: 0 }}>The dots record the moon east (+) or west (−) of the planet. Start with a few weeks of observations.</p>
    <div className="stack" data-tut="moon-chart">
      {a.points.length > 1 && <Chart ariaLabel="Recorded moon offsets and selected orbit fit" series={[
        { pts: a.points, color: '#d9d2c3', kind: 'dots', faded: (p) => !!band && (p.x < band[0] || p.x > band[1]) },
        ...(a.fit ? [{ pts: curve(a.fit), color: '#6cc4ff', kind: 'line' as const }] : []),
        ...(showB && a.alternative ? [{ pts: curve(a.alternative), color: '#b59cff', kind: 'line' as const }] : []),
      ]} xLabel="expedition day" yLabel="moon offset (″)" band={band} onBand={select} brushMode="band" yFmt={(y) => y.toFixed(0)} />}
      <form onSubmit={(e) => { e.preventDefault(); apply(); }} className="stack">
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <label>Start day <input aria-label="Moon start day" className="input" type="number" step="any" value={dates[0]} onChange={(e) => setDates([e.target.value, dates[1]])} style={{ width: 105, maxWidth: '100%' }} /></label>
          <label>End day <input aria-label="Moon end day" className="input" type="number" step="any" value={dates[1]} onChange={(e) => setDates([dates[0], e.target.value])} style={{ width: 105, maxWidth: '100%' }} /></label>
          <button className="btn small" type="submit">Apply dates</button>
        </div>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {[10, 20].map((d) => <button type="button" className="btn small" key={d} disabled={!a.points.length} onClick={() => { const end = a.points.at(-1)!.x; select([Math.max(a.points[0].x, end - d), end]); }}>Last {d} days</button>)}
          <button type="button" className="btn small" onClick={() => select(null)}>All observations</button>
        </div>
        {dateError && <div role="alert" className="amber">{dateError}</div>}
      </form>
      <div aria-live="polite" aria-label="Moon fit status" style={{ fontSize: 13 }}>
        <b>{a.used.length} of {a.points.length} sightings selected</b>{a.used.length > 0 && <> · {fmt(a.span, 2)} days</>}. {a.status}
      </div>
      {band && a.used.length > 1 && <details><summary>Enlarge the selected interval</summary>
        <p className="muted">A closer view of the selected sightings. The complete log remains visible above.</p>
        <Chart ariaLabel="Close view of selected moon sightings" series={[
          { pts: a.used, color: '#d9d2c3', kind: 'dots' },
          ...(a.fit ? [{ pts: curve(a.fit), color: '#6cc4ff', kind: 'line' as const }] : []),
          ...(showB && a.alternative ? [{ pts: curve(a.alternative), color: '#b59cff', kind: 'line' as const }] : []),
        ]} xLabel="selected expedition days" yLabel="moon offset (″)" yFmt={(y) => y.toFixed(0)} />
      </details>}
      {chosen && <>
        <dl className="kv" aria-label="Selected moon fit">
          <dt>Candidate period Pₘ{pickB && a.alternative ? ' (B)' : ' (A)'}</dt><dd>{fmt(chosen.period, 3)} days</dd>
          <dt>Angular half-swing θₘ</dt><dd>{fmt(chosen.amplitude, 2)}″ at day {fmt(a.mid, 2)}</dd>
        </dl>
        <details><summary>Use this fit</summary><div className="stack" style={{ paddingTop: 8 }}>
          <p>Enter your uncertainty for each value. Match the planet’s distance to the angular swing’s date.</p>
          <b>Angular half-swing θₘ</b><SendToSheet k="thetaM" tut="moon-theta-send" value={chosen.amplitude * ARCSEC} at={a.mid * DAY} spread={chosen.sigmaAmplitude * ARCSEC} spreadLabel="Estimated fit error with heuristic model allowances (not calibrated confidence)" />
          <b>Orbital period Pₘ</b><SendToSheet k="Pm" tut="moon-period-send" value={chosen.period * DAY} spread={chosen.sigmaPeriod * DAY} spreadLabel="Estimated fit error with heuristic model allowances (not calibrated confidence)" />
        </div></details>
      </>}
    </div>
    <details onToggle={(e) => setShowB(e.currentTarget.open)}><summary>Analysis details and other candidates</summary><div className="stack" style={{ paddingTop: 8, fontSize: 13 }}>
      <p>The planet’s recorded track corrects our changing viewing direction. A smooth changing-height curve approximates its changing distance locally. The 50-day guard belongs to this approximation; longer observations remain in your log. Faded dots are excluded from this fit, never deleted. Drag the chart or enter exact dates.</p>
      <p>Gaps, short intervals, changing distance and shared tracking errors can leave misleading periods. A good-looking curve is a candidate, not proof. Fit error estimates include heuristic model allowances; they are not calibrated confidence limits. Extra uncertainty may be needed.</p>
      {a.edgeDays > 0 && a.coverage && <p>Viewing direction is extrapolated up to {fmt(a.edgeDays, 2)} days beyond the planet track. This adds a limitation to this fit.</p>}
      {!a.coverage && !manual && <p>Keep the planet tracker running across the moon dates; long gaps or missing coverage prevent the orbital-period correction.</p>}
      {a.invalid > 0 && <p>{a.invalid} invalid or duplicate-timestamp records were excluded from analysis.</p>}
      {a.fit && <p>Model A: Pₘ {fmt(a.fit.period, 3)} d · residual scatter {fmt(a.fit.rms, 3)}″. Its curve is shown only over selected dates.</p>}
      {a.alternative && <>
        <p>Model B: Pₘ {fmt(a.alternative.period, 3)} d · residual scatter {fmt(a.alternative.rms, 3)}″. Both use the same changing-height model and recorded viewing correction, each with its own error estimate. A slightly lower scatter does not establish the true period.</p>
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}><button className={`btn small ${!pickB ? 'primary' : ''}`} onClick={() => setPickB(false)}>Use model A</button><button className={`btn small ${pickB ? 'primary' : ''}`} onClick={() => setPickB(true)}>Use model B</button></div>
        <MoonForecast first={a.fit!} second={a.alternative} end={a.to} />
        <p>Try another interval or collect observations at different spacings. Predictions beyond this interval are uncertain because distance and viewing direction may keep changing.</p>
      </>}
      <Formula>aₘ = d · tan θₘ, M₂ = 4π² aₘ³ / (G Pₘ²)</Formula>
    </div></details>
    {inSchool && <details aria-label="Flight School moon investigation"><summary>Optional Flight School: compare observations</summary><div className="stack" style={{ paddingTop: 8 }}>
      <p>{studies.length === 0 ? '1. Choose a short interval and keep its candidate fit below.' : studies.length === 1 ? '2. Try different dates (or another candidate), then keep a second fit.' : '3. Compare your saved fits. Did the period or angular swing change? You can stop here or try another interval.'}</p>
      <p className="muted">This experiment is optional. You can send your values and complete practice at any time. Your discovery card keeps the saved work when you finish.</p>
      <button className="btn small" disabled={!chosen || studies.length >= 4} onClick={() => {
        const record = moonStudy(a, pickB ? 'B' : 'A'); if (!record) return;
        if (studies.some((p) => p.signature === record.signature)) { setNotice('That fit is already kept. Try different dates or another candidate.'); return; }
        s.set({ moonStudies: [...studies, record].slice(-4) }); setNotice('Fit kept for your practice discovery card.');
      }}>Keep this fit for comparison</button>
      {notice && <div role="status">{notice}</div>}
      {studies.length > 0 && <ul>{studies.map((p, i) => <li key={p.signature}>Fit {i + 1}: days {fmt(p.from, 2)}–{fmt(p.to, 2)}, {p.count} sightings; Pₘ {fmt(p.period, 3)} d; θₘ {fmt(p.amplitude, 2)}″ at day {fmt(p.mid, 2)}.</li>)}</ul>}
      {studies.length >= 2 && <p>Overlapping intervals share observations. Agreement is a useful stability check, not independent confirmation. Different dated angular swings need not match because the planet’s distance changes.</p>}
      {studies.length > 0 && <button className="btn small" onClick={() => { s.set({ moonStudies: [] }); setNotice('Comparison fits cleared; your observations are unchanged.'); }}>Clear comparison fits</button>}
    </div></details>}
    {!s.tutorial.active && a.points.length >= 8 && <details><summary>Optional: predict the next eastern peak</summary>{renderPrediction(a.points, manual ? null : chosen)}</details>}
  </div>;
}

/** Requested, model-only forecasts; never new measurements or a truth verdict. */
function MoonForecast({ first, second, end }: { first: SineFit; second: SineFit; end: number }) {
  const x = Array.from({ length: 160 }, (_, i) => end + 5 * i / 159);
  const finite = x.filter((t) => Number.isFinite(first.model(t)) && Number.isFinite(second.model(t)));
  let best = finite[0];
  for (const t of finite) if (Math.abs(first.model(t) - second.model(t)) > Math.abs(first.model(best) - second.model(best))) best = t;
  return <details><summary>Compare five-day model forecasts</summary>
    <p>These lines project beyond the selected data, starting at day {fmt(end, 2)}. They are not recorded observations. They extend the local distance approximation and planet-track correction, so reliability can fall quickly.</p>
    {finite.length > 1 && <Chart ariaLabel="Uncertain moon model forecasts, no observed samples" series={[
      { pts: finite.map((t) => ({ x: t, y: first.model(t) })), color: '#6cc4ff', kind: 'line' },
      { pts: finite.map((t) => ({ x: t, y: second.model(t) })), color: '#b59cff', kind: 'line' },
    ]} xLabel="expedition day (projection)" yLabel="predicted offset (″)" />}
    {best !== undefined && <p>Within this five-day projection, the candidates differ most near day {fmt(best, 2)}. An observation there may help distinguish them if visibility and precision allow; a single night is not guaranteed to settle the question.</p>}
  </details>;
}
