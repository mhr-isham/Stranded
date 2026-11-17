import { useMemo, useState } from 'react';
import { ARCSEC } from '../../engine/constants';
import { radiusFromAngle } from '../../game/micrometer';
import { useGame } from '../../game/store';
import { Equation } from '../common/Equation';
import { useLessonArtifact } from './lessonArtifact';

export function AngularSizeLab() {
  const formulas = useGame((s) => s.settings.formulas);
  const [distance, setDistance] = useState(80), [angle, setAngle] = useState(30), [distanceError, setDistanceError] = useState(2), [angleError, setAngleError] = useState(.5);
  const [records, setRecords] = useState<{ distance: number; angle: number; distanceError: number; angleError: number; radius: number; sigma: number }[]>([]);
  const result = radiusFromAngle(distance * 1e9, distanceError * 1e9, angle * ARCSEC, angleError * ARCSEC)!;
  const planetX = 50 + distance * 2, radiusPixels = result.radius * 4e-6;
  const share = result.sigma > 0 ? 100 * (result.sigmaModel / result.sigma) ** 2 : 0;
  const artifact = useMemo(() => records.length ? {
    summary: [{ label: 'Source', value: 'Hypothetical angular-size calculations; not expedition measurements' }, ...records.map((r, i) => ({ label: `Teaching calculation ${i + 1}`, value: `d ${r.distance} ± ${r.distanceError} million km; angle ${r.angle} ± ${r.angleError} arcsec; radius ${(r.radius / 1000).toFixed(1)} ± ${(r.sigma / 1000).toFixed(1)} km` }))],
    plot: records.map((r) => ({ x: r.distance, y: r.radius / 1000 })), xLabel: 'teaching distance (million km)', yLabel: 'inferred radius (km)',
  } : undefined, [records]);
  useLessonArtifact(artifact);
  return <section className="stack angular-size-lab" aria-label="Angular size and uncertainty mini expedition">
    <div className="meter-label">Optional Flight School experiment · teaching values</div><h3>Same apparent disk. Different world?</h3>
    <svg viewBox="0 0 620 300" role="img" aria-label="Apparent disk angle and physical planet radius">
      <circle cx="50" cy="140" r="6" fill="#ffc46b" /><text x="20" y="173" fill="#ffc46b" fontSize="13">observer</text>
      <path d={`M50 140L${planetX} ${140 - radiusPixels}M50 140L${planetX} ${140 + radiusPixels}`} stroke="#6cc4ff" fill="none" strokeWidth="2" />
      <circle cx={planetX} cy="140" r={radiusPixels} fill="#2763a1" /><path d={`M${planetX} 140V${140 - radiusPixels}`} stroke="#5be3a4" strokeWidth="3" />
      <text x="15" y="20" fill="#6cc4ff" fontSize="14">Same angle, twice the distance → twice the radius</text><text x={planetX + radiusPixels + 8} y={140 - radiusPixels / 2} fill="#5be3a4" fontSize="14">R</text>
      <text x="150" y="285" fill="#c5d5eb" fontSize="13">distance at the sighting date · angles exaggerated</text>
    </svg>
    <label className="field">Teaching distance · {distance} million km<input aria-label="Teaching size distance" type="range" min="20" max="200" step="1" value={distance} onChange={(e) => setDistance(Number(e.target.value))} /></label>
    <button className="btn small" disabled={distance > 100} onClick={() => setDistance((d) => d * 2)}>Double the distance, keep the angle</button>
    <label className="field">Angular diameter · {angle}″<input aria-label="Teaching angular diameter" type="range" min="5" max="60" step="1" value={angle} onChange={(e) => setAngle(Number(e.target.value))} /></label>
    <label className="field">Distance uncertainty · ±{distanceError} million km<input aria-label="Teaching distance uncertainty" type="range" min="0" max="10" step=".5" value={distanceError} onChange={(e) => setDistanceError(Number(e.target.value))} /></label>
    <label className="field">Angular uncertainty · ±{angleError}″<input aria-label="Teaching angular uncertainty" type="range" min="0" max="3" step=".1" value={angleError} onChange={(e) => setAngleError(Number(e.target.value))} /></label>
    <dl className="kv"><dt>Inferred physical radius</dt><dd data-size-radius={result.radius}>{(result.radius / 1000).toFixed(1)} ± {(result.sigma / 1000).toFixed(1)} km</dd><dt>Distance contribution</dt><dd>±{(result.sigmaModel / 1000).toFixed(1)} km</dd><dt>Angular contribution</dt><dd>±{(result.sigmaAngle / 1000).toFixed(1)} km</dd></dl>
    <div className="faint">Distance: {share.toFixed(0)}% of this estimated variance. Angle: {result.sigma > 0 ? (100 - share).toFixed(0) : '0'}%. Contributions combine in quadrature, not by adding their percentages of the radius.</div>
    {formulas && <Equation tex={'R=d(t_\\alpha)\\tan(\\alpha/2) \\\\ \\sigma_R^2\\approx[\\tan(\\alpha/2)\\sigma_d]^2+\\left[\\frac{d}{2\\cos^2(\\alpha/2)}\\sigma_\\alpha\\right]^2'} />}
    <button className="btn small primary" onClick={() => setRecords((rows) => [...rows.slice(-3), { distance, angle, distanceError, angleError, radius: result.radius, sigma: result.sigma }])}>Keep teaching size calculation</button>
    {records.length > 0 && <div aria-label="Kept teaching size calculations">{records.map((r, i) => <div key={i}>Case {i + 1} · {r.distance} million km · {r.angle}″ · radius {(r.radius / 1000).toFixed(1)} ± {(r.sigma / 1000).toFixed(1)} km</div>)}</div>}
    <p className="faint">Hypothetical spherical worlds, exaggerated diagram and first-order independent-input uncertainty. Doubling distance with the same apparent disk describes a larger inferred world, not a real planet suddenly growing. Real seeing, shared limb judgement and alignment can add errors. These calculations never enter your expedition sheet.</p>
  </section>;
}
