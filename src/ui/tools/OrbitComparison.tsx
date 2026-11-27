import { useMemo } from 'react';
import { DAY, DEG, TAU } from '../../engine/constants';
import { orbitLongitudeError, type OrbitFit, type OrbitObs } from '../../engine/orbitfit';
import { fmt } from '../../game/format';
import { CanvasView } from '../common/CanvasView';
import { Chart } from '../common/Chart';

const HOME = '#9cadc6', ELLIPSE = '#6cc4ff', CIRCLE = '#ffc46b';
const PATH_STEPS = 150;
const angle = (value: number) => `${value > 0 ? '+' : ''}${fmt(value, 3)}°`;

function sharedPosition(fit: OrbitFit, at: number, reference: number) {
  const [x, y] = fit.orbit(at);
  const rotation = fit.lambda0 - reference;
  return [x * Math.cos(rotation) - y * Math.sin(rotation), x * Math.sin(rotation) + y * Math.cos(rotation)] as const;
}

export function OrbitPlot({ fit, start, circle, night, circleOnly = false }: {
  fit: OrbitFit; start: number; circle?: OrbitFit; night?: number; circleOnly?: boolean;
}) {
  const paths = useMemo(() => [fit, ...(circle ? [circle] : [])].map((model) => ({
    model,
    points: Array.from({ length: PATH_STEPS + 1 }, (_, i) => sharedPosition(model, start + model.P2 * i / PATH_STEPS, fit.lambda0)),
  })), [circle, fit, start]);
  const extent = Math.max(1, ...paths.flatMap(({ points }) => points.map(([x, y]) => Math.hypot(x, y))));
  return <figure className="orbit-model-figure">
    <div className="orbit-model-canvas">
      <CanvasView role="img" aria-label={circle ? 'Fitted circle and ellipse in one orbital frame' : 'Fitted orbit, top-down'}
        draw={({ ctx, w, h, dpr }) => {
          const scale = Math.min(w, h) * 0.44 / extent;
          ctx.fillStyle = '#081320'; ctx.fillRect(0, 0, w, h);
          ctx.save(); ctx.translate(w / 2, h / 2);
          ctx.lineWidth = dpr;
          ctx.strokeStyle = '#304557';
          ctx.beginPath(); ctx.moveTo(-w / 2, 0); ctx.lineTo(w / 2, 0); ctx.moveTo(0, -h / 2); ctx.lineTo(0, h / 2); ctx.stroke();
          ctx.strokeStyle = HOME; ctx.beginPath(); ctx.arc(0, 0, scale, 0, TAU); ctx.stroke();
          for (const { model, points } of paths) {
            ctx.strokeStyle = model === circle ? CIRCLE : ELLIPSE;
            ctx.lineWidth = 1.6 * dpr;
            ctx.setLineDash(model === circle ? [5 * dpr, 4 * dpr] : []);
            ctx.beginPath();
            points.forEach(([x, y], i) => { if (i === 0) ctx.moveTo(x * scale, -y * scale); else ctx.lineTo(x * scale, -y * scale); });
            ctx.stroke();
          }
          ctx.setLineDash([]);
          if (!circleOnly && fit.e > 0.002) {
            const [x, y] = paths[0].points.reduce((nearest, p) =>
              Math.hypot(...p) < Math.hypot(...nearest) ? p : nearest);
            ctx.strokeStyle = '#6cc4ff65'; ctx.lineWidth = dpr;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(x * scale, -y * scale); ctx.stroke();
          }
          ctx.fillStyle = '#ffcf76'; ctx.beginPath(); ctx.arc(0, 0, 4 * dpr, 0, TAU); ctx.fill();
          if (night !== undefined && circle) {
            const [cx, cy] = sharedPosition(circle, night, fit.lambda0);
            const [ex, ey] = sharedPosition(fit, night, fit.lambda0);
            ctx.strokeStyle = CIRCLE; ctx.lineWidth = 2 * dpr;
            ctx.strokeRect(cx * scale - 4 * dpr, -cy * scale - 4 * dpr, 8 * dpr, 8 * dpr);
            ctx.fillStyle = ELLIPSE; ctx.beginPath(); ctx.arc(ex * scale, -ey * scale, 3.4 * dpr, 0, TAU); ctx.fill();
          }
          ctx.restore();
        }} />
    </div>
    <figcaption className="row orbit-model-key">
      <span className="orbit-home-key">Home orbit</span>
      <span className="orbit-ellipse-key">{circleOnly ? 'Fitted orbit' : 'Fitted ellipse'}</span>
      {circle && <span className="orbit-circle-key">Fitted circle</span>}
    </figcaption>
  </figure>;
}

export function OrbitComparison({ obs, circle, ellipse, index, onPick }: {
  obs: OrbitObs[]; circle: OrbitFit; ellipse: OrbitFit; index: number; onPick: (index: number) => void;
}) {
  const errors = useMemo(() => {
    const points = obs.map(({ t, lon }) => ({
      day: t / DAY + 1,
      circle: orbitLongitudeError(lon, circle.predict(t)) / DEG,
      ellipse: orbitLongitudeError(lon, ellipse.predict(t)) / DEG,
    }));
    const rms = (key: 'circle' | 'ellipse') => Math.sqrt(points.reduce((sum, point) => sum + point[key] ** 2, 0) / points.length);
    return { points, circle: rms('circle'), ellipse: rms('ellipse') };
  }, [circle, ellipse, obs]);
  const { points } = errors, selected = points[index];
  function pickDay(day: number) {
    const nearest = points.reduce((best, point, i) => Math.abs(point.day - day) < Math.abs(points[best].day - day) ? i : best, 0);
    onPick(nearest);
  }
  return <div className="panel-inset stack orbit-comparison" id="orbit-comparison">
    <div className="row between">
      <b>Error by night</b><span className="faint">{obs.length} fitted sightings</span>
    </div>
    <div className="faint">Above zero means you saw the planet farther east than the model predicted.</div>
    <Chart ariaLabel="Signed longitude errors by night for the circle and ellipse"
      series={[
        { pts: [{ x: points[0].day, y: 0 }, { x: points.at(-1)!.day, y: 0 }], color: '#697e93', kind: 'line' },
        { pts: points.map((p) => ({ x: p.day, y: p.circle })), color: CIRCLE, kind: 'dots' },
        { pts: points.map((p) => ({ x: p.day, y: p.ellipse })), color: ELLIPSE, kind: 'dots' },
      ]}
      height={172} symmetricY xFmt={(day) => fmt(day, 0)} xLabel="expedition day" yLabel="longitude error (°)" cursor={selected.day} onCursor={pickDay} />
    <label className="field">Inspect a night · Day {fmt(selected.day, 2)}
      <input type="range" min={0} max={points.length - 1} value={index}
        aria-label="Inspect an orbit sighting by night" aria-valuetext={`Day ${fmt(selected.day, 2)}`}
        onChange={(e) => onPick(Number(e.target.value))} />
    </label>
    <dl className="kv orbit-error-values">
      <dt className="amber">Circle that night</dt><dd>{angle(selected.circle)}</dd>
      <dt className="blue">Ellipse that night</dt><dd>{angle(selected.ellipse)}</dd>
      <dt>Overall error (RMS)</dt><dd>{fmt(errors.circle, 3)}° circle · {fmt(errors.ellipse, 3)}° ellipse</dd>
    </dl>
    <p className="faint">Both models used the same sightings. On the orbit view, the square marks the circle’s prediction and the dot marks the ellipse’s prediction.</p>
  </div>;
}
