import { useState } from 'react';
import { ARCSEC, DEG } from '../../engine/constants';
import { useGame } from '../../game/store';
import { Equation } from '../common/Equation';

/** Explicit teaching values; never modifies or samples the live expedition. */
export function ParallaxGeometryLab() {
  const formulas = useGame((s) => s.settings.formulas);
  const [angle, setAngle] = useState(90), [baseline, setBaseline] = useState(3000), [distance, setDistance] = useState(80);
  const [kept, setKept] = useState<{ angle: number; baseline: number; projected: number; shift: number }[]>([]);
  const projected = baseline * Math.sin(angle * DEG), shift = projected * 1000 / (distance * 1e9) / ARCSEC;
  const bx = 110 + 95 * Math.cos(angle * DEG), by = 105 + 95 * Math.sin(angle * DEG);
  return <section className="stack parallax-lab" aria-label="Parallax geometry mini expedition">
    <div className="meter-label">Optional Flight School experiment · teaching model</div>
    <h3>Same drive. How much is sideways?</h3>
    <p>Try a drive toward the target, then turn it sideways. Keep the distance and drive length fixed to make a fair comparison.</p>
    <svg viewBox="0 0 560 260" role="img" aria-label="Laser baseline and its sideways component">
      <path d="M110 105H480" stroke="#8191af" strokeDasharray="4 5" />
      <path d={`M110 105L${bx} ${by}L480 105`} fill="none" stroke="#ffc46b" strokeWidth="2" />
      <path d={`M${bx} 105V${by}`} stroke="#5be3a4" strokeWidth="4" />
      <circle cx="110" cy="105" r="6" fill="#6cf0ff" /><circle cx={bx} cy={by} r="6" fill="#ffc46b" /><circle cx="480" cy="105" r="10" fill="#6cc4ff" />
      <text x="95" y="80" fill="#6cf0ff" fontSize="14">A · camp</text><text x={bx + 10} y={by + 24} fill="#ffc46b" fontSize="14">B · rover</text>
      <text x="430" y="80" fill="#6cc4ff" fontSize="14">target</text><text x="255" y="130" fill="#c4d4ed" fontSize="13">sightline →</text>
      <text x="260" y="220" fill="#5be3a4" fontSize="14">Green = sideways baseline</text>
    </svg>
    <label className="field">Drive angle to the sightline · {angle}°<input aria-label="Drive angle to the sightline" type="range" min="0" max="90" step="5" value={angle} onChange={(e) => setAngle(Number(e.target.value))} /></label>
    <div className="row">{[0, 30, 90].map((a) => <button className="btn small" key={a} onClick={() => setAngle(a)}>{a}° · {a === 0 ? 'toward' : a === 90 ? 'sideways' : 'diagonal'}</button>)}</div>
    <label className="field">Teaching laser baseline · {baseline} km<input aria-label="Teaching laser baseline" type="range" min="500" max="6000" step="100" value={baseline} onChange={(e) => setBaseline(Number(e.target.value))} /></label>
    <label className="field">Teaching target distance · {distance} million km<input aria-label="Teaching target distance" type="range" min="30" max="200" step="5" value={distance} onChange={(e) => setDistance(Number(e.target.value))} /></label>
    <dl className="kv"><dt>Sideways baseline</dt><dd>{projected.toFixed(0)} km</dd><dt>Predicted shift in this model</dt><dd>{shift.toFixed(3)}″</dd></dl>
    {formulas && <Equation tex={'B_\\perp=B\\sin\\phi \\\\ p\\approx\\frac{B_\\perp}{d}\\quad (p\\text{ in radians})'} />}
    <div className="callout tip">{angle === 0 ? 'A drive directly toward a distant target changes its range but gives no sideways jump. It cannot determine distance by this parallax method.' : angle === 90 ? 'The whole laser baseline is sideways. For this drive length and target distance, the angular shift is largest.' : `Only ${(Math.sin(angle * DEG) * 100).toFixed(0)}% of this baseline is sideways. Using the full baseline would overestimate distance.`}</div>
    <button className="btn small" onClick={() => setKept((rows) => [...rows.slice(-3), { angle, baseline, projected, shift }])}>Keep teaching comparison</button>
    {kept.length > 0 && <div aria-live="polite">{kept.map((row, i) => <div key={i}>{row.angle}° · laser {row.baseline} km · sideways {row.projected.toFixed(0)} km · shift {row.shift.toFixed(3)}″</div>)}</div>}
    <p className="faint">Exaggerated diagram and distant-target approximation. These chosen teaching values are separate from your expedition. In the game, two cameras expose at the same instant; images from different times also contain orbital motion. Re-marking one frozen pair is not an independent observation.</p>
  </section>;
}
