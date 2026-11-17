import { useState } from 'react';
import type { ChainVariant, Primaries } from '../../engine/chain';
import { distanceGeometry, distanceReference, observationDay, type DistanceGeometry } from '../../game/distanceScale';

export function DistanceDiagram({ geometry: g }: { geometry: DistanceGeometry }) {
  const scale = 145 / Math.max(g.a1, g.a2 * (1 + g.eccentricity));
  const X = (x: number) => 250 + x * scale, Y = (y: number) => 170 - y * scale;
  const orbit = Array.from({ length: 97 }, (_, i) => {
    const E = i * Math.PI / 48, x = g.a2 * (Math.cos(E) - g.eccentricity), y = g.a2 * Math.sqrt(1 - g.eccentricity ** 2) * Math.sin(E);
    return `${X(x * Math.cos(g.peri) - y * Math.sin(g.peri))},${Y(x * Math.sin(g.peri) + y * Math.cos(g.peri))}`;
  }).join(' ');
  return <svg className="distance-diagram" viewBox="0 0 500 360" role="img" aria-label="Separation between planets and orbit size around the star">
    <circle cx="250" cy="170" r={g.a1 * scale} fill="none" stroke="#55799c" strokeDasharray="4 5" />
    <polyline points={orbit} fill="none" stroke="#5be3a4" strokeWidth="2" />
    <line x1={X(g.home[0])} y1={Y(g.home[1])} x2={X(g.target[0])} y2={Y(g.target[1])} stroke="#ffc46b" strokeWidth="3" />
    <circle cx="250" cy="170" r="8" fill="#ffdf7d" /><text x="250" y="194" fill="#ffdf7d" fontSize="13" textAnchor="middle">star</text>
    <circle cx={X(g.home[0])} cy={Y(g.home[1])} r="6" fill="#6cf0ff" /><text x={X(g.home[0])} y={Y(g.home[1]) - 13} fill="#6cf0ff" fontSize="13" textAnchor="middle">home</text>
    <circle cx={X(g.target[0])} cy={Y(g.target[1])} r="7" fill="#5be3a4" /><text x={X(g.target[0])} y={Y(g.target[1]) + 24} fill="#5be3a4" fontSize="13" textAnchor="middle">{g.body}</text>
    <text x="12" y="20" fill="#ffc46b" fontSize="13">Orange: separation at {observationDay(g.at)}</text>
    <text x="12" y="342" fill="#5be3a4" fontSize="13">Green: orbit · size {(g.a2 / 1e9).toFixed(2)} million km</text>
  </svg>;
}

export function DistanceContext({ sheet, variant = 'standard' }: { sheet: Primaries; variant?: ChainVariant }) {
  const [open, setOpen] = useState(false), p = sheet.dPar;
  if (!p || !Number.isFinite(p.value)) return null;
  const ref = distanceReference(sheet, variant), g = open ? distanceGeometry(sheet, variant) : null;
  return <section className="distance-context stack" aria-label="Dated distance reference">
    <div className="observation-date">Measured separation · {(p.value / 1e9).toFixed(3)} million km · {ref.recorded ? observationDay(p.at) : 'date not recorded'}</div>
    {!ref.recorded && <div className="faint">Current geometry assumes {observationDay(ref.at)} ({variant === 'slingshot' ? 'giant opposition' : variant === 'inner' ? 'conjunction' : 'opposition'}). Add the observation day on the progress sheet if known.</div>}
    <details className="measurement-help" onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>Optional: measured separation versus orbit size</summary>
      {g ? <><DistanceDiagram geometry={g} /><div className="faint">From your entered model at the observation date. This is not a live camera view or a check against hidden truth.</div><dl className="kv"><dt>Model separation on this date</dt><dd>{(g.separation / 1e9).toFixed(3)} million km</dd><dt>{g.eccentricity ? 'Orbit semi-major axis' : 'Orbit radius'}</dt><dd>{(g.a2 / 1e9).toFixed(3)} million km</dd></dl></> : <p>Add the orbital periods, alignment date and dated distance to draw the geometry from your numbers.</p>}
      <p>The orange separation joins home to the observed body. Orbit size describes a path around the star. Different orbital positions change the separation without changing that orbit size.</p>
      {variant === 'ellipse' && <p>For an ellipse, orbit size is its semi-major axis. Even the body’s distance from the star changes along that same orbit.</p>}
      {variant === 'slingshot' && <p>This parallax observation is of the giant; its green orbit is aG. The blue target’s a₂ is derived separately from its period.</p>}
      <p>The observation date anchors the conversion. Choosing a later departure date does not change when this measurement was made. Flight School offers a separate optional experiment with changing positions.</p>
    </details>
  </section>;
}
