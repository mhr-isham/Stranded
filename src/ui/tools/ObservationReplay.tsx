import { useEffect, useState } from 'react';
import { DAY } from '../../engine/constants';
import { clock, subscribeClock } from '../../game/clock';
import { motionDirection, type MotionPoint } from '../../game/observedMotion';
import { useGame } from '../../game/store';
import { fmt } from '../../game/format';

export function ObservationReplay({ points, inner = false, onCursor }: { points: MotionPoint[]; inner?: boolean; onCursor: (day: number) => void }) {
  const [open, setOpen] = useState(false), [index, setIndex] = useState(0), [playing, setPlaying] = useState(false), [trail, setTrail] = useState(false), [speed, setSpeed] = useState(2);
  const selected = points[Math.min(index, Math.max(0, points.length - 1))], prior = points[Math.max(0, Math.min(index, points.length - 1) - 1)];
  useEffect(() => {
    if (!open) return;
    const runId = useGame.getState().runId, paused = clock.paused;
    let changed = false;
    clock.paused = true; clock.emit();
    const unsubscribe = subscribeClock(() => { if (!clock.paused) changed = true; });
    return () => { unsubscribe(); if (!changed && useGame.getState().runId === runId) { clock.paused = paused; clock.emit(); } };
  }, [open]);
  useEffect(() => {
    if (!playing || !open || points.length < 2) return;
    const timer = setInterval(() => setIndex((i) => { if (i >= points.length - 1) { setPlaying(false); return i; } return i + 1; }), 1000 / speed);
    return () => clearInterval(timer);
  }, [playing, open, points.length, speed]);
  useEffect(() => { if (!open) setPlaying(false); }, [open]);
  const gapCount = points.filter((p) => p.gap).length;
  const minX = points[0]?.x ?? 0, maxX = Math.max(minX + 1, points.at(-1)?.x ?? 1);
  const minY = Math.min(...points.map((p) => p.y), 0 === points.length ? 0 : Infinity), maxY = Math.max(...points.map((p) => p.y), 0 === points.length ? 1 : -Infinity);
  const pad = Math.max(.05, (maxY - minY) * .15), X = (x: number) => 43 + (x - minX) / (maxX - minX) * 292, Y = (y: number) => 176 - (y - minY + pad) / (maxY - minY + 2 * pad) * 150;
  const visible = points.slice(0, Math.min(index + 1, points.length));
  const segments: MotionPoint[][] = [];
  for (const point of visible) { if (!segments.length || point.gap) segments.push([]); segments.at(-1)!.push(point); }
  return <details className="measurement-help observation-replay" aria-label="Recorded observation replay" onToggle={(e) => setOpen(e.currentTarget.open)}>
    <summary>Replay my recorded observations</summary>
    <div className="stack">
      <p>Review opens with the expedition paused. The HUD can resume it; replay itself never collects data or advances time. Closing restores the prior pause state unless you changed it.</p>
      {!selected ? <p>Collect tracker sightings to start a replay.</p> : <>
        <label className="row"><input type="checkbox" checked={trail} onChange={(e) => setTrail(e.target.checked)} />Show observed trail</label>
        <div className="row"><button className="btn small" disabled={points.length < 2} onClick={() => { if (index >= points.length - 1) setIndex(0); setPlaying(!playing); }}>{playing ? 'Pause replay' : 'Play observations'}</button><button className="btn small" onClick={() => { setPlaying(false); setIndex(0); }}>Restart replay</button></div>
        <label className="field">Playback speed<select className="input" value={speed} onChange={(e) => setSpeed(Number(e.target.value))}><option value={1}>1 sighting / second</option><option value={2}>2 sightings / second</option><option value={5}>5 sightings / second</option></select></label>
        <svg viewBox="0 0 350 220" className="recorded-motion-plot" role="img" aria-label="Replay of saved tracker positions">
          <path d="M43 20V176H338" stroke="#8d9bb5" fill="none" />
          {[0, .5, 1].map((f) => <g key={f}><text x={X(minX + f * (maxX - minX))} y="193" textAnchor="middle" fill="#becbe2" fontSize="10">{(minX + f * (maxX - minX)).toFixed(1)}</text><text x="39" y={Y(minY + f * (maxY - minY)) + 3} textAnchor="end" fill="#becbe2" fontSize="10">{(minY + f * (maxY - minY)).toFixed(1)}°</text></g>)}
          <text x="337" y="211" textAnchor="end" fill="#becbe2" fontSize="10">elapsed days</text>
          {trail && segments.filter((p) => p.length > 1).map((part, i) => <polyline key={i} points={part.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')} fill="none" stroke="#6cc4ff" strokeDasharray="3 4" />)}
          {visible.filter((p) => p.gap).map((p) => <text key={`gap:${p.at}`} x={X(p.x)} y="17" textAnchor="middle" fill="#ffc46b" fontSize="10">gap</text>)}
          {visible.map((p) => <circle key={p.at} cx={X(p.x)} cy={Y(p.y)} r={p.at === selected.at ? 5 : 2.5} fill={p.at === selected.at ? '#fff4d0' : '#6cc4ff'}><title>Elapsed day {p.x.toFixed(3)} · {p.y.toFixed(3)}°</title></circle>)}
        </svg>
        <label className="field">Observation in replay<input type="range" min={0} max={Math.max(0, points.length - 1)} step={1} value={Math.min(index, points.length - 1)} onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }} /></label>
        <div role="status">Sighting {Math.min(index + 1, points.length)} / {points.length} · elapsed day {fmt(selected.at / DAY, 3)} · {fmt(selected.y, 3)}°</div>
        {index > 0 && prior && <div>{inner ? 'Recorded elongation change' : 'Recorded longitude change'}: {fmt(selected.y - prior.y, 3)}° over {fmt((selected.at - prior.at) / DAY, 3)} days. {inner ? '' : motionDirection(selected.y - prior.y) === 'east' ? 'Eastward net change.' : motionDirection(selected.y - prior.y) === 'west' ? 'Westward net change.' : 'Direction unresolved at this readout step.'}{selected.gap ? ' A gap separates these sightings; the intervening path was not recorded.' : ''}</div>}
        <button className="btn small" onClick={() => onCursor(selected.x)}>Use this recorded date as chart cursor</button>
      </>}
      <div className="faint">{points.length} saved positions · {gapCount} gap{gapCount === 1 ? '' : 's'} longer than the normal sampling interval. Dotted connectors are visual guides between nearby sightings; positions between dots were not measured. Trails break across gaps.</div>
    </div>
  </details>;
}
