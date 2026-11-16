import { useEffect, useState } from 'react';
import { DAY, DEG } from '../../engine/constants';
import { useGame } from '../../game/store';
import { sightingChange, sightingSeries, skyKey, type SkyLight, type SkyRef, type SkySighting } from '../../game/skyObservation';

export function SkyExplorer({ lights, selected, known, wide, az, alt, field, labels, onLabels, pan, zoom, select, focus, coaching }: {
  lights: SkyLight[]; selected: SkyRef | null; known: boolean; wide: boolean; az: number; alt: number; field: number;
  labels: boolean; onLabels: () => void; pan: (az: number, alt: number) => void; zoom: (factor: number) => void;
  select: (ref: SkyRef) => void; focus: () => void; coaching: boolean;
}) {
  const s = useGame();
  return <section className="panel panel-pad stack sky-explorer" aria-label="Sky exploration controls">
    <b>Explore the sky</b>
    {wide && <>
      <div className="faint">Bearing {((az / DEG % 360 + 360) % 360).toFixed(0)}° · elevation {(alt / DEG).toFixed(0)}° · field {(field / DEG).toFixed(0)}°</div>
      <div className="row sky-pan"><button className="btn small" onClick={() => pan(-15, 0)} aria-label="Pan sky left">◀</button><button className="btn small" onClick={() => pan(0, 10)} aria-label="Pan sky up">▲</button><button className="btn small" onClick={() => pan(0, -10)} aria-label="Pan sky down">▼</button><button className="btn small" onClick={() => pan(15, 0)} aria-label="Pan sky right">▶</button></div>
      <div className="row"><button className="btn small" onClick={() => zoom(.8)}>Zoom in</button><button className="btn small" onClick={() => zoom(1.25)}>Zoom out</button></div>
      <div className="faint">Drag or use arrow keys on the sky. Pinch, scroll, or use + / − to zoom.</div>
      <label className="row"><input type="checkbox" checked={labels} onChange={onLabels} />Show neutral light labels</label>
      <details className="measurement-help"><summary>Lights in this view ({lights.length})</summary>
        <div className="sky-light-list">{lights.map((light) => <button className="btn ghost small" key={light.key} data-sky-light={light.code} aria-pressed={!!selected && skyKey(selected) === light.key} onClick={() => select(light.ref)}>
          <b>{light.ref.kind === 'star' ? 'Our star' : known && light.ref.kind === 'target' ? 'Blue planet' : light.code}</b><span>{light.variation === 'steadier' ? '—' : '≈'} {light.variation} · altitude {(light.alt / DEG).toFixed(0)}°</span>
        </button>)}</div>
        {!lights.length && <p>No selectable comparison lights are visible here. Pan the view or check the observing conditions and time.</p>}
      </details>
    </>}
    {selected && wide && <button className="btn small" onClick={focus}>Centre selected light in wide view</button>}
    <label className="row"><input type="checkbox" checked={!!s.settings.skyReducedFlicker} onChange={(e) => s.set({ settings: { ...s.settings, skyReducedFlicker: e.target.checked } })} />Reduce visual twinkle</label>
    <div className="faint">Text variation cues remain available when visual twinkle is reduced.</div>
    {coaching && <details className="measurement-help"><summary>Help me compare lights</summary><p>Inspect a few lights. Compare their brightness variation, then centre each in the telescope and increase magnification. An extended disk is a useful clue. A steady point alone does not establish its identity.</p><p>Log a light and revisit it against the same background star field. Compare similar dates and pointing accuracy. Changing compass bearings during a night also reflects the turning sky.</p></details>}
  </section>;
}

export function SkyNotebook({ selectedKey, code, canLog, reason, onLog }: { selectedKey?: string; code: string; canLog: boolean; reason: string; onLog: (note: string) => boolean }) {
  const s = useGame(), notes = s.skySightings ?? [];
  const [text, setText] = useState(''), [viewKey, setViewKey] = useState(selectedKey ?? notes[0]?.key ?? ''), [compare, setCompare] = useState(''), [active, setActive] = useState('');
  useEffect(() => { if (selectedKey) { setViewKey(selectedKey); setActive(''); } }, [selectedKey]);
  const names = new Map(notes.map((n) => [n.key, n.code]));
  if (selectedKey) names.set(selectedKey, code);
  const own = notes.filter((n) => n.key === viewKey).sort((a, b) => a.at - b.at);
  const picked = notes.find((n) => n.id === active);
  const first = own[0], last = own.at(-1);
  return <section className="panel panel-pad stack sky-notebook" aria-label="Sky observation notebook">
    <b>Observation notebook</b>
    <div className="muted">Keep sightings, compare lights and revisit your own discoveries. This is optional and unscored.</div>
    <label className="field">What I noticed<input className="input" value={text} maxLength={240} onChange={(e) => setText(e.target.value)} placeholder="Steady? Flickering? A disk?" /></label>
    <button className="btn primary" disabled={!canLog} onClick={() => { if (onLog(text)) setText(''); }}>Log selected light</button>
    {!canLog && <div className="faint">{reason}</div>}
    <div className="faint">Centre the light before logging. The notebook records your pointing against a fixed chart, with a readout step of 0.1° in wide view or 0.005° in the telescope. Aiming and seeing errors are additional. Time and air pass while you wait or use warp.</div>
    {names.size > 0 && <>
      <label className="field">Notebook light<select className="input" value={viewKey} onChange={(e) => { setViewKey(e.target.value); setActive(''); }}>{[...names].map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
      <label className="field">Compare recorded light<select className="input" value={compare === viewKey ? '' : compare} onChange={(e) => { setCompare(e.target.value); setActive(''); }}><option value="">No comparison</option>{[...names].filter(([key]) => key !== viewKey).map(([key, name]) => <option key={key} value={key}>{name}</option>)}</select></label>
    </>}
    {first && last && own.length > 1 && <div className="callout tip">Recorded pointing change: {sightingChange(first, last).toFixed(3)}° over {((last.at - first.at) / DAY).toFixed(3)} days.{last.at === first.at ? ' These are repeat pointings at one simulated time, not a time baseline.' : ' Check centring and repeatability before interpreting this as motion.'}</div>}
    {own.length > 0 && <>
      <SightingPlot notes={notes} own={viewKey} compare={compare !== viewKey ? compare : ''} onPick={setActive} />
      {picked && <div className="hint" role="status">{picked.code} · day {(picked.at / DAY + 1).toFixed(3)} · chart position {picked.lon.toFixed(3)}°, {picked.lat.toFixed(3)}° · {picked.note || 'No written note.'}</div>}
      <div className="faint">Circles: selected light. Squares: comparison. Only your logged pointings are shown; the chart measures change from each light's first sighting. Chart coordinates differ from local compass bearings.</div>
      <details className="measurement-help"><summary>Recorded sightings ({own.length})</summary><table className="log"><thead><tr><th>Day</th><th>Chart position</th><th>Your note</th><th /></tr></thead><tbody>{own.slice().reverse().map((n) => <tr key={n.id}><td>{(n.at / DAY + 1).toFixed(3)}</td><td>{n.lon.toFixed(3)}°, {n.lat.toFixed(3)}°<div className="faint">{n.instrument}</div></td><td>{n.note || '—'}</td><td><button className="btn small ghost" aria-label={`Delete sighting ${n.id}`} onClick={() => s.set({ skySightings: notes.filter((v) => v.id !== n.id) })}>×</button></td></tr>)}</tbody></table></details>
    </>}
    {!own.length && <div className="faint">No sightings for this light yet.</div>}
  </section>;
}

function SightingPlot({ notes, own, compare, onPick }: { notes: SkySighting[]; own: string; compare: string; onPick: (id: string) => void }) {
  const a = sightingSeries(notes, own), b = compare ? sightingSeries(notes, compare) : [], all = [...a, ...b];
  const min = Math.min(...all.map((p) => p.x)), max = Math.max(min + 1, ...all.map((p) => p.x)), top = Math.max(.01, ...all.map((p) => p.y * 1.15));
  const x = (v: number) => 40 + (v - min) / (max - min) * 290, y = (v: number) => 160 - v / top * 135;
  return <svg viewBox="0 0 350 200" className="sighting-plot" role="group" aria-label="Change between your recorded sky pointings">
    <path d="M40 20V160H335" stroke="#8997b0" fill="none" />
    {[0, .5, 1].map((f) => <g key={f}><text x="35" y={y(f * top) + 4} textAnchor="end" fill="#c3cce0" fontSize="10">{(f * top).toFixed(2)}°</text><text x={x(min + f * (max - min))} y="178" textAnchor="middle" fill="#c3cce0" fontSize="10">{(min + f * (max - min)).toFixed(1)}</text></g>)}
    <text x="45" y="14" fill="#c3cce0" fontSize="10">Change from first sighting</text><text x="335" y="194" textAnchor="end" fill="#c3cce0" fontSize="10">expedition day</text>
    {a.map((p) => <circle key={p.id} cx={x(p.x)} cy={y(p.y)} r="5" fill="#ffc46b" stroke="#fff" tabIndex={0} role="button" aria-label={`Inspect sighting on day ${p.x.toFixed(3)}`} onClick={() => onPick(p.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(p.id); } }}><title>Day {p.x.toFixed(3)} · change {p.y.toFixed(3)}°</title></circle>)}
    {b.map((p) => <rect key={p.id} x={x(p.x) - 4} y={y(p.y) - 4} width="8" height="8" fill="#6cc4ff" stroke="#fff" tabIndex={0} role="button" aria-label={`Inspect comparison sighting on day ${p.x.toFixed(3)}`} onClick={() => onPick(p.id)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(p.id); } }}><title>Comparison · day {p.x.toFixed(3)} · change {p.y.toFixed(3)}°</title></rect>)}
  </svg>;
}
