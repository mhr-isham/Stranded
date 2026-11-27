import { RadiusCrossCheck } from '../common/RadiusCrossCheck';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { DAY, DEG } from '../../engine/constants';
import { sfx } from '../../game/audio';
import { clock, subscribeClock } from '../../game/clock';
import { fmt } from '../../game/format';
import { northSurveyLimitKm, northSurveyPlanKm, northSurveyRoute, northSurveySpeed } from '../../game/northSurvey';
import { lifeSupportEnd } from '../../game/survival';
import { NorthSurveyGraphic, NorthSurveyReadout } from './NorthSurvey';
import { opticalWeather } from '../../game/observing';
import { currentWorld, spendTime } from '../../game/sim';
import { useGame } from '../../game/store';
import { hhmm } from '../../game/time';
import { compareShadows, makeShadowCapture, markedShadow, nextShadowNoon, northLimit, northSite, SHADOW_MAX, SHADOW_STICK, shadowAvailable, shadowView, type ShadowCapture, type ShadowView } from '../../game/shadowObservation';
import { Formula, SendToSheet } from '../common/sheetBits';
import { toast, useGameTime } from '../common/widgets';
import { LessonModal } from '../tutorial/Tutorial';

export { northSite } from '../../game/shadowObservation';

export function Gnomon() {
  const s = useGame(), t = useGameTime(8), { system: sys } = currentWorld();
  const [where, setWhere] = useState<'camp' | 'rover'>('camp');
  const [capture, setCapture] = useState<ShadowCapture | null>(null);
  const stopAt = useSyncExternalStore(subscribeClock, () => clock.stopAt);
  const [mark, setMark] = useState<number | null>(null), [sigma, setSigma] = useState('0.01'), [sigmaKm, setSigmaKm] = useState('1');
  const [correct, setCorrect] = useState(false), [k, setK] = useState(''), [sigmaK, setSigmaK] = useState('');
  const [lesson, setLesson] = useState(false), [waiting, setWaiting] = useState(false), [notice, setNotice] = useState('');
  const cancel = useRef<null | (() => void)>(null), pointer = useRef<number | null>(null), serial = useRef(0);
  useEffect(() => {
    const release = () => { pointer.current = null; };
    window.addEventListener('blur', release);
    return () => { window.removeEventListener('blur', release); cancel.current?.(); };
  }, []);
  const noonCycle = shadowAvailable(sys);
  const available = noonCycle && northSurveyLimitKm(sys) >= 200;
  const trip = s.northTrip, km = northSurveyPlanKm(sys, trip);
  const route = northSurveyRoute(sys, s, t);
  const { moving: driving, distance } = route;
  const site = where === 'camp' ? sys.site : northSite(sys.site, distance, sys.home.radius);
  const live = shadowView(sys, t, site), view = capture ? capture[where] : live;
  const comparison = compareShadows(s.shadows), pair = comparison.pair, result = comparison.result;
  const conditions = opticalWeather(sys, s, t), weather = conditions.cloudy, flare = conditions.flare;
  const correctionValid = !correct || k.trim() !== '' && sigmaK.trim() !== '' && Number.isFinite(Number(k)) && Number(k) >= 0 && Number(k) <= .85 && Number.isFinite(Number(sigmaK)) && Number(sigmaK) > 0;
  const markValid = !!capture && mark !== null && mark > 0 && mark <= SHADOW_MAX && Number(sigma) > 0 && Number.isFinite(Number(sigma)) && correctionValid;
  const possible = !driving && trip.dist > 0 && !weather && !flare && makeShadowCapture(sys, t, trip.dist, Number(sigmaKm) * 1000, 'preview');
  const noon = driving ? null : trip.dist > 0 ? route.campNoon : nextShadowNoon(sys, t);
  const speed = northSurveySpeed(s);
  const canWait = (due: number | null) => due !== null && !waiting && !clock.realtime && !Number.isFinite(stopAt)
    && (s.tutorial.active || due < lifeSupportEnd(s, sys));
  const readyCount = capture ? s.shadows.filter((r) => r.capture === capture.id).length : 0;
  const span = Math.min(SHADOW_MAX, Math.max(3, (Number.isFinite(view.length) ? view.length : 5) * 1.35));
  function waitUntil(due: number) {
    const current = useGame.getState();
    if (waiting || due <= clock.t || !Number.isFinite(due) || Number.isFinite(clock.stopAt) || clock.realtime
      || current.phase !== 'play' || (!current.tutorial.active && due >= lifeSupportEnd(current, sys))) return;
    setWaiting(true); const run = s.runId;
    cancel.current = spendTime(due - clock.t, () => {
      cancel.current = null;
      if (useGame.getState().runId !== run || useGame.getState().phase !== 'play') return;
      setWaiting(false); toast('Time advanced · expedition paused');
    }, { pauseOnArrival: true });
  }
  function drive(dist: number) {
    const current = useGame.getState();
    if (waiting || current.northTrip.arriveAt > clock.t) return;
    if (current.rover.dist > 0 || current.rover.target > 0 || current.rover.arriveAt > clock.t) return toast('Bring the parallax rover back to camp first.');
    if (current.surface.roverX !== null || current.surface.task && current.surface.task.done > clock.t && current.surface.task.kind !== 'process') return toast('Bring the surface rover home first.');
    if (!Number.isFinite(dist) || dist < 0 || dist > northLimit(sys)) return toast('That route leaves this instrument’s northward survey area. Choose a shorter route.');
    const start = current.northTrip.dist, duration = Math.abs(dist - start) / northSurveySpeed(current) * DAY;
    if (duration <= 0) return;
    current.set({ northTrip: { ...current.northTrip, dist, from: start, departAt: clock.t, arriveAt: clock.t + duration } });
    setCapture(null); setMark(null); setNotice(''); sfx('radio');
  }
  function freeze() {
    const current = useGame.getState();
    const live = opticalWeather(sys, current, clock.t);
    if (!possible || waiting || current.northTrip.arriveAt > clock.t || live.cloudy || live.flare) return;
    const shot = makeShadowCapture(sys, clock.t, current.northTrip.dist, Number(sigmaKm) * 1000, `${s.runId}:shadow:${clock.t}:${Date.now()}:${++serial.current}`);
    if (!shot) return;
    clock.paused = true; clock.emit();
    setCapture(shot); setWhere('camp'); setMark(null); setNotice('Both views captured at one instant. Mark the centre of each fuzzy shadow tip.'); sfx('shutter');
    requestAnimationFrame(() => document.querySelector('[data-tut="shadow-stage"]')?.scrollIntoView({ block: 'start' }));
  }
  function log() {
    if (!capture || !markValid || mark === null) return;
    const reading = markedShadow(capture, where, mark, Number(sigma), correct ? { k: Number(k), sigmaK: Number(sigmaK) } : undefined);
    if (!reading) return setNotice('Check the marker, uncertainty and high-Sun observing range.');
    const current = useGame.getState(), others = current.shadows.filter((r) => !(r.capture === capture.id && r.site === where));
    current.set({ shadows: [...others, reading] }); sfx('wood');
    setNotice(`${where === 'camp' ? 'Camp' : 'Rover'} mark kept. Re-marking this captured view revises that observation.`);
    if (others.some((r) => r.capture === capture.id && r.site !== where)) requestAnimationFrame(() => document.querySelector('[data-tut="shadow-comparison"]')?.scrollIntoView({ block: 'start' }));
  }
  function choose(next: 'camp' | 'rover') { setWhere(next); setMark(null); pointer.current = null; }
  function point(e: React.PointerEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    setMark(Math.max(0, Math.min(span, Math.round(((e.clientX - rect.left) / rect.width * 600 - 70) / Math.min(460 / span, 90) * 1000) / 1000)));
  }
  return <main className="shadow-screen" aria-label="Two-site shadow expedition">
    <header className="shadow-heading"><div><span className="meter-label">FIELD SCIENCE · TWO SITES, ONE SUN</span><h1>Noon shadows</h1><p>Measure a whole world with two sticks and a rover.</p></div><button className="btn small" onClick={() => setLesson(true)}>How this works</button></header>
    {!available ? <div className="panel panel-pad stack"><b>{noonCycle ? 'No usable northward baseline' : 'No usable noon cycle at this camp'}</b><p>This route needs a repeating local noon and room for a northward baseline. The hill instrument is available for a radius measurement.</p><button className="btn" onClick={() => s.go('hill')}>Open the hill instrument</button></div> : <>
      <div className="shadow-steps" aria-label="Experiment progress"><span className={trip.dist > 0 && !driving ? 'done' : 'active'}>1 · Deploy the rover</span><span className={capture ? 'done' : trip.dist > 0 && !driving ? 'active' : ''}>2 · Capture both views</span><span className={result ? 'done' : capture ? 'active' : ''}>3 · Mark and compare</span></div>
      <div className="shadow-layout">
        <section className="stack shadow-workbench" aria-label="Shadow measurement workbench">
          <section className="panel panel-pad stack shadow-route" aria-label="Northward survey route">
            <NorthSurveyGraphic route={route} />
            {driving ? <p className="faint">{route.returning ? 'Returning to camp.' : 'Rover underway.'} {fmt((trip.arriveAt - t) / DAY, 2)} expedition days left.</p> : null}
            {!s.tutorial.active && <button className="btn small" onClick={() => s.set({ screen: 'map', surfaceMapView: 'north' })}>Open north survey map</button>}
          </section>
          <div className="panel shadow-instrument" data-tut="shadow-stage">
            <div className="shadow-view-header"><div><span className={`shadow-dot ${where}`} /> <b>{where === 'camp' ? 'Camp stick' : 'Rover stick'}</b></div><span className="chip">{capture ? 'FROZEN VIEW' : 'LIVE PREVIEW'}</span></div>
            <div className="row shadow-view-tabs" role="group" aria-label="Choose shadow view"><button className={`btn small ${where === 'camp' ? 'primary' : ''}`} onClick={() => choose('camp')}>Camp view</button><button className={`btn small ${where === 'rover' ? 'primary' : ''}`} disabled={!trip.dist && !capture} onClick={() => choose('rover')}>Rover view</button></div>
            <ShadowInstrument view={view} mark={mark} span={span} obscured={!capture && !!(weather || flare)} disabled={!capture} onKey={(e) => {
              if (!capture || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
              e.preventDefault(); const step = e.shiftKey ? .001 : .01;
              setMark((v) => e.key === 'Home' ? 0 : e.key === 'End' ? span : Math.max(0, Math.min(span, (v ?? 0) + (e.key === 'ArrowLeft' ? -step : step))));
            }} onDown={(e) => { if (!capture || e.button !== 0 || pointer.current !== null) return; pointer.current = e.pointerId; e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.focus(); point(e); }} onMove={(e) => { if (pointer.current === e.pointerId) point(e); }} onEnd={(e) => { if (pointer.current === e.pointerId) pointer.current = null; }} />
            <div className="shadow-view-caption"><span>Local solar time {hhmm(view.hours)} · solar day {view.day + 1}{capture && ` · expedition day ${fmt(capture.at / DAY + 1, 4)}`}</span><span>Shadow points {view.direction === 1 ? 'north' : 'south'} · 2 m vertical stick</span></div>
            {capture ? <div className="shadow-mark-controls"><label>My marker (m)<input className="input" aria-label="Shadow marker position in metres" type="number" min="0" max={span} step="0.001" value={mark ?? ''} onChange={(e) => setMark(e.target.value === '' ? null : Math.max(0, Math.min(span, Number(e.target.value))))} /></label><label>± marking error (m)<input className="input" aria-label="Shadow marking uncertainty in metres" type="number" min="0.001" step="0.001" value={sigma} onChange={(e) => setSigma(e.target.value)} /></label><button className="btn primary" disabled={!markValid} onClick={log}>Keep {where} mark</button></div> : <p className="shadow-instruction">Deploy the rover, then capture both views. You place the marker yourself; no shadow length is filled in for you.</p>}
            {capture && <p className="shadow-instruction">Drag or tap to mark the fuzzy tip’s centre. Arrow keys move 1 cm; Shift moves 1 mm. The error above is your working estimate, not the control’s resolution. {readyCount}/2 views marked.</p>}
          </div>
          <section className="panel panel-pad stack" aria-label="Shadow radius comparison" data-tut="shadow-comparison">
            <div className="row between"><b>Your world, from your marks</b><span className="chip">{result ? 'PAIR READY' : 'OBSERVATIONS'}</span></div>
            <p aria-live="polite">{comparison.status}</p>
            {pair && <div className="shadow-pair-values"><div><span className="meter-label">CAMP</span><strong>{fmt(pair.camp.length!, 3)} m</strong><span>{pair.camp.direction === 1 ? 'north' : 'south'} shadow</span></div><span className="shadow-pair-link">↔</span><div><span className="meter-label">ROVER</span><strong>{fmt(pair.rover.length!, 3)} m</strong><span>{pair.rover.direction === 1 ? 'north' : 'south'} shadow</span></div></div>}
            {result && <><div className="shadow-radius"><span className="meter-label">YOUR INFERRED PLANET RADIUS</span><strong>{fmt(result.radius / 1000, 0)} <small>km</small></strong><span>Baseline {fmt(pair!.rover.dist / 1000, 0)} km · signed-angle difference {fmt(result.delta / DEG, 3)}°.</span></div>
              <details><summary>Use this radius</summary><p>This is an inference from your observations. State your uncertainty before sending it; it can replace the hill result on your sheet.</p><SendToSheet k="R1" value={result.radius} spread={result.sigma} spreadLabel="Propagated entered errors plus a conservative timing allowance (not calibrated confidence)" tut="shadow-send" /></details>
            </>}
            <details><summary>Review dates, angles and uncertainty</summary>
              <p>Capture near local noon on one meridian, with both Sun images high and clear. The two views share a capture instant and local solar day. Opposite shadow directions add the angular separation; same-direction shadows subtract it.</p>
              {pair && <p>Capture at expedition day {fmt(pair.rover.at / DAY + 1, 5)} · local solar day {pair.rover.solarDay! + 1} · {hhmm(pair.rover.solarHours!)} · baseline ±{fmt(pair.rover.sigmaBaseline! / 1000, 3)} km.</p>}
              {result && <dl className="kv"><dt>Signed camp / rover angles</dt><dd>{fmt(result.zCamp / DEG, 3)}° / {fmt(result.zRover / DEG, 3)}°</dd><dt>Marking contribution</dt><dd>±{fmt(result.marking / 1000, 2)} km</dd><dt>Baseline contribution</dt><dd>±{fmt(result.baseline / 1000, 2)} km</dd><dt>Shared refraction contribution</dt><dd>±{fmt(result.refraction / 1000, 2)} km</dd><dt>Conservative timing allowance</dt><dd>{fmt(result.timing / 1000, 2)} km</dd><dt>Combined working estimate</dt><dd>±{fmt(result.sigma / 1000, 2)} km</dd></dl>}
              <p>The numerical estimate combines independent entered marking/baseline errors and a shared refraction coefficient, then adds a timing bound. It does not cover every systematic error, route error or misidentified shadow tip. Re-marking one image is a revision, not independent evidence.</p>
              <Formula>z = atan(shadow / stick), R₁ = d / |zᵣ − z꜀| (signed angles in radians)</Formula>
              <div className="shadow-records">{s.shadows.length ? s.shadows.slice(-8).reverse().map((r, i) => <div key={`${r.capture ?? r.at}:${r.site}:${i}`}><b>{r.site}</b> · expedition day {fmt(r.at / DAY + 1, 4)} · {r.length !== undefined ? `${fmt(r.length, 3)} m · ${r.direction === 1 ? 'north' : 'south'}` : `legacy altitude ${fmt(r.alt / DEG, 3)}°; synchronized provenance unavailable`}</div>) : 'No saved shadow observations yet.'}</div>
            </details>
          </section>
          <RadiusCrossCheck />
        </section>
        <aside className="stack shadow-planning" aria-label="Shadow expedition controls">
          <section className="panel panel-pad stack" data-tut="shadow-route"><span className="meter-label">1 · NORTHWARD SURVEY</span><b>Give the shadows some distance</b><label className="stack">Rover destination · {km} km north<input aria-label="Northward rover distance in kilometres" type="range" min="200" max={northSurveyLimitKm(sys)} step="50" value={km} onChange={(e) => s.set({ northTrip: { ...useGame.getState().northTrip, planKm: Number(e.target.value) } })} /></label><label>± baseline error (km)<input className="input" aria-label="Baseline uncertainty in kilometres" type="number" min="0.001" step="0.1" value={sigmaKm} onChange={(e) => setSigmaKm(e.target.value)} /></label><div className="row" style={{ flexWrap: 'wrap', gap: 6 }}><button className="btn" disabled={driving || waiting || km * 1000 === trip.dist || Number(sigmaKm) <= 0} onClick={() => drive(km * 1000)}>Drive north</button><button className="btn ghost" disabled={driving || waiting || !trip.dist} onClick={() => drive(0)}>Return rover</button></div>
            {driving && <button className="btn small" disabled={!canWait(trip.arriveAt)} onClick={() => waitUntil(trip.arriveAt)}>Wait for rover</button>}
            <details><summary>Plan the route</summary><p>A longer baseline enlarges the angle difference but takes more time. This remote northward survey takes {fmt(speed / 1000, 0)} km per expedition day. It shares the same rover as parallax and surface exploration. Arrival does not take the photographs for you.</p><p>The two 2 m sticks must be vertical and the odometer distance must follow the north–south meridian. The default error fields are editable working assumptions, not certified instrument accuracy. Baseline error is saved with each capture; capture a new pair after changing it.</p></details>
          </section>
          <section className="panel panel-pad stack" data-tut="shadow-capture"><span className="meter-label">2 · ONE MOMENT, TWO VIEWS</span><b>Catch the local noon</b><NorthSurveyReadout route={route} now={t} /><p>The shortest shadow is near noon. Capture pauses expedition time so you can measure both views at your own pace.</p><button className="btn small" disabled={!canWait(noon) || driving} onClick={() => noon && waitUntil(noon)}>{trip.dist > 0 ? 'Wait to next local noon' : 'Wait to next camp noon'}</button><button className="btn primary" disabled={!possible || waiting} onClick={freeze}>{capture ? 'Capture a new pair' : 'Capture both shadow views'}</button>
            <div className="faint">{waiting ? 'Advancing expedition time…' : driving ? 'The rover must arrive before capture.' : !trip.dist ? 'Deploy the rover first.' : flare ? 'Flare glare obscures the instrument; wait for it to pass.' : weather ? 'Cloud blocks the shadow; wait for clear weather.' : !possible ? 'Both views need the Sun 15–89.5° high and a positive baseline uncertainty. Try another noon or season.' : capture ? 'Your frozen views and saved marks keep their original dates and conditions.' : 'Both stations are ready for a paired exposure.'}</div>
            {capture && <button className="btn small ghost" onClick={() => { setCapture(null); setMark(null); setNotice('Live preview restored. Saved marks are unchanged.'); }}>Return to live preview</button>}
          </section>
          <details className="panel panel-pad"><summary>Optional: account for high-Sun refraction</summary><div className="stack" style={{ paddingTop: 10 }}><p>High sunlight reduces refraction; it does not eliminate it. Raw marks are always retained. If you have a justified estimate for the instrument’s high-Sun coefficient, enter it here before keeping both marks.</p><label><input type="checkbox" checked={correct} onChange={(e) => setCorrect(e.target.checked)} /> Apply my shared refraction estimate</label>{correct && <><label>My coefficient k<input className="input" aria-label="Shadow refraction coefficient" type="number" min="0" max="0.85" step="0.01" value={k} onChange={(e) => setK(e.target.value)} /></label><label>± coefficient uncertainty<input className="input" aria-label="Shadow refraction uncertainty" type="number" min="0.001" step="0.01" value={sigmaK} onChange={(e) => setSigmaK(e.target.value)} /></label></>}<p>Both marks must use the same assumptions. This coefficient belongs to the stated shadow model; the hill’s damp-air sample is not automatically its calibration. Re-keep both marks to revise their treatment.</p><Formula>h_apparent = h_geometric + (2k / 60)° cot h_geometric</Formula></div></details>
          <div role="status" className="shadow-notice">{notice}</div>
        </aside>
      </div>
    </>}
    {lesson && <LessonModal id="refraction" onClose={() => setLesson(false)} />}
  </main>;
}

function ShadowInstrument({ view, mark, span, obscured, disabled, onKey, onDown, onMove, onEnd }: { view: ShadowView; mark: number | null; span: number; obscured: boolean; disabled: boolean; onKey: (e: React.KeyboardEvent<SVGSVGElement>) => void; onDown: (e: React.PointerEvent<SVGSVGElement>) => void; onMove: (e: React.PointerEvent<SVGSVGElement>) => void; onEnd: (e: React.PointerEvent<SVGSVGElement>) => void }) {
  const id = useId().replace(/:/g, ''), x0 = 70, ground = 228, scale = Math.min(460 / span, 90);
  const high = view.altitude > 0 && Number.isFinite(view.length), stickTop = ground - SHADOW_STICK * scale;
  const edgeA = high ? SHADOW_STICK / Math.tan(view.altitude + view.sunRadius) : 0, edgeB = high ? SHADOW_STICK / Math.tan(Math.max(.01, view.altitude - view.sunRadius)) : 0;
  return <svg className="shadow-measuring-view" viewBox="0 0 600 320" tabIndex={disabled ? -1 : 0} role="group" aria-label="Shadow measuring instrument; tap or drag the marker, arrows adjust, Shift for fine steps" onKeyDown={onKey} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onEnd} onPointerCancel={onEnd}>
    <defs><linearGradient id={`${id}-sky`} x2="0" y2="1"><stop stopColor={high ? '#18364a' : '#101c32'} /><stop offset="1" stopColor={high ? '#bd9870' : '#273e50'} /></linearGradient><linearGradient id={`${id}-sand`} x2="0" y2="1"><stop stopColor="#77634b" /><stop offset="1" stopColor="#312d29" /></linearGradient><linearGradient id={`${id}-tip`}><stop stopColor="#141e24" stopOpacity=".85" /><stop offset="1" stopColor="#141e24" stopOpacity="0" /></linearGradient><radialGradient id={`${id}-sun`}><stop stopColor="#ffe2a0" stopOpacity=".5" /><stop offset="1" stopColor="#ffe2a0" stopOpacity="0" /></radialGradient></defs>
    <rect width="600" height="320" fill={`url(#${id}-sky)`} />
    <path d="M0 212 L70 185 120 205 197 182 300 202 410 173 489 197 570 170 600 194 V240 H0Z" fill="#35414a" opacity=".45" />
    {high && <><circle cx="28" cy="35" r="70" fill={`url(#${id}-sun)`} /><circle cx="28" cy="35" r="15" fill="#ffe4a0" /><path d="M48 60 L100 135 M64 48 L133 103" stroke="#ffe5a0" opacity=".3" /></>}
    <rect y={ground} width="600" height="92" fill={`url(#${id}-sand)`} />
    <line x1="0" y1={ground} x2="600" y2={ground} stroke="#cab18b" strokeWidth="2" />
    {high && <><path d={`M${x0} ${ground} L${x0 + edgeA * scale} ${ground} L${x0 + edgeA * scale} ${ground + 11} L${x0} ${ground + 5}Z`} fill="#141e24" opacity=".85" /><rect x={x0 + edgeA * scale} y={ground} width={Math.max(1, (edgeB - edgeA) * scale)} height="11" fill={`url(#${id}-tip)`} /><line x1={x0} y1={stickTop} x2={x0 + view.length * scale} y2={ground} stroke="#ffe2a0" opacity=".4" strokeDasharray="6 5" /></>}
    <ellipse cx={x0} cy={ground + 3} rx="17" ry="5" fill="#273136" />
    <rect x={x0 - 4} y={stickTop} width="8" height={ground - stickTop} rx="3" fill="#e4e3cf" /><rect x={x0 - 2} y={stickTop + 2} width="2" height={ground - stickTop - 3} fill="#fff9dd" />
    <text x="86" y="30" fill="#e4e9e8" fontSize="17">2 m stick</text><text x="576" y="30" textAnchor="end" fill="#e4e9e8" fontSize="15">{view.direction === 1 ? 'NORTH →' : 'SOUTH →'}</text>
    <rect x={x0} y="258" width={span * scale} height="22" rx="3" fill="#dacfb6" />
    {Array.from({ length: Math.floor(span * 10) + 1 }, (_, i) => { const x = x0 + i / 10 * scale; return <g key={i}><line x1={x} y1="258" x2={x} y2={i % 10 === 0 ? 277 : i % 5 === 0 ? 272 : 266} stroke="#584c3b" />{i % 10 === 0 && <text x={x} y="303" textAnchor="middle" fill="#ece2cb" fontSize="17">{i / 10} m</text>}</g>; })}
    {obscured && <g><rect width="600" height="320" fill="#26313c" opacity=".94" /><text x="300" y="160" textAnchor="middle" fill="#e0e7ed" fontSize="22">Live view obscured · capture later</text></g>}
    {mark !== null && <g><line x1={x0 + mark * scale} y1="202" x2={x0 + mark * scale} y2="285" stroke="#76d0ff" strokeWidth="3" /><path d={`M${x0 + mark * scale - 9} 191 L${x0 + mark * scale + 9} 191 L${x0 + mark * scale} 203Z`} fill="#76d0ff" /><circle cx={x0 + mark * scale} cy="237" r="16" stroke="#76d0ff" fill="none" opacity=".7" /></g>}
  </svg>;
}
