// Chapter 4: Kepler's method. The tracker's nightly directions to the blue
// planet, seen from our own moving planet, are enough to find its ellipse —
// period, shape and direction — in units of our own orbit.

import { useState } from 'react';
import { DAY, DEG } from '../../engine/constants';
import { fitOrbit, type OrbitFit } from '../../engine/orbitfit';
import { fmt } from '../../game/format';
import { useGame } from '../../game/store';
import { currentMode } from '../../game/modes';
import { Formula, SendToSheet } from '../common/sheetBits';
import { toast } from '../common/widgets';

export function OrbitPanel() {
  const s = useGame();
  const [fits, setFits] = useState<{ circle: OrbitFit | null; ellipse: OrbitFit | null; n: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const P1 = s.sheet.P1?.value;
  const tOpp = s.sheet.tOpp?.value;
  const obs = s.track.map((o) => ({ t: o.at, lon: o.v }));
  const span = obs.length ? (obs[obs.length - 1].t - obs[0].t) / DAY : 0;
  const picks = [...s.oppPicks].sort((a, b) => a - b);
  const guess = P1 && picks.length >= 2 ? 1 / (1 / P1 - (picks.length - 1) / (picks[picks.length - 1] - picks[0])) : undefined;
  const enough = obs.length >= 12 && P1 && tOpp && span > 0.6 * (guess ?? 1.8 * P1) / DAY;
  const mode = currentMode();

  const run = () => {
    if (!P1 || !tOpp) return;
    setBusy(true);
    // Let the button repaint before the (half-second) fit.
    setTimeout(() => {
      const circle = fitOrbit(obs, P1, tOpp, guess, true);
      const ellipse = fitOrbit(obs, P1, tOpp, guess);
      setFits({ circle, ellipse, n: obs.length });
      setBusy(false);
      if (!ellipse) toast('The fit did not converge — log more nights.');
    }, 30);
  };

  const f = fits?.ellipse;
  const c = fits?.circle;
  return (
    <div className="panel panel-pad stack">
      <b>Orbit fit — Kepler’s method</b>
      <div className="muted" style={{ fontSize: 13 }}>
        Each night the tracker logs <i>which way</i> the blue planet lies. We know our own circle (P₁) and where we both pointed at opposition (t₀). Only one
        ellipse makes all those sight lines meet the planet at the right times — Kepler found Mars’s orbit exactly like this.
      </div>
      {(!P1 || !tOpp) && <div className="amber" style={{ fontSize: 13 }}>Needs your year P₁ and an opposition date t₀ on the sheet first.</div>}
      <div className="row between" style={{ fontSize: 13 }}>
        <span className="muted">Nights logged</span>
        <span className="mono">
          {obs.length} over {fmt(span, 0)} days
        </span>
      </div>
      {!enough && P1 && tOpp && (
        <div className="hint">
          Keep the tracker running. The fit needs at least 12 nights spread over most of an orbit{guess ? ` (about ${fmt((0.6 * guess) / DAY, 0)} days)` : ''}.
        </div>
      )}
      <button className="btn primary" disabled={!enough || busy} onClick={run}>
        {busy ? 'Fitting…' : fits ? `Refit with ${obs.length} nights` : 'Fit the orbit'}
      </button>
      {fits && f && c && (
        <>
          <OrbitPlot fit={f} obsT={obs.map((o) => o.t)} />
          <table className="log">
            <thead>
              <tr>
                <th>Model</th>
                <th className="num">Misfit (rms)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Circle</td>
                <td className="num amber">{fmt(c.rms / DEG, 3)}°</td>
              </tr>
              <tr>
                <td>Ellipse</td>
                <td className="num blue">{fmt(f.rms / DEG, 4)}°</td>
              </tr>
            </tbody>
          </table>
          {mode.coaching && (
            <div className="hint">
              ECHO: a circle misses the sight lines by {fmt(c.rms / f.rms, 0)}× more than the ellipse. This orbit is not a circle — the planet speeds up near the
              star and slows far from it.
            </div>
          )}
          <dl className="kv">
            <dt>Period P₂</dt>
            <dd className="blue">
              {fmt(f.P2 / DAY, 2)} ± {fmt(f.sigmaP2 / DAY, 2)} days
            </dd>
            <dt>Eccentricity e</dt>
            <dd className="blue">
              {fmt(f.e, 4)} ± {fmt(f.sigmaE, 4)}
            </dd>
            <dt>Perihelion ϖ (from opposition)</dt>
            <dd className="blue">
              {fmt(f.wPeri / DEG, 1)}° ± {fmt(f.sigmaW / DEG, 1)}°
            </dd>
            <dt>Closest / farthest from the star</dt>
            <dd>
              {fmt((1 - f.e) * (f.P2 / P1!) ** (2 / 3), 3)} – {fmt((1 + f.e) * (f.P2 / P1!) ** (2 / 3), 3)} a₁
            </dd>
          </dl>
          <Formula>a₂ = a₁ (P₂/P₁)^⅔,   r = a₂(1 − e²) / (1 + e cos(θ − ϖ))</Formula>
          <b>P₂</b>
          <SendToSheet k="Porb" value={f.P2} spread={f.sigmaP2} />
          <b>e</b>
          <SendToSheet k="ecc" value={f.e} spread={f.sigmaE} />
          <b>ϖ</b>
          <SendToSheet k="wPeri" value={f.wPeri} spread={f.sigmaW} />
        </>
      )}
    </div>
  );
}

/** Top-down view in units of our orbit: our circle, the fitted ellipse and the nights you logged. */
function OrbitPlot({ fit, obsT }: { fit: OrbitFit; obsT: number[] }) {
  const N = 160;
  const t0 = obsT[0];
  const ell = Array.from({ length: N + 1 }, (_, i) => fit.orbit(t0 + (fit.P2 * i) / N));
  const R = Math.max(...ell.map((p) => Math.hypot(p[0], p[1])), 1) * 1.08;
  const S = 140 / R;
  const X = (p: [number, number]) => 150 + p[0] * S;
  const Y = (p: [number, number]) => 150 - p[1] * S;
  const path = ell.map((p, i) => `${i ? 'L' : 'M'}${X(p).toFixed(1)},${Y(p).toFixed(1)}`).join(' ');
  // Perihelion: the point of the ellipse closest to the star.
  const rp = ell.reduce((b, p) => (Math.hypot(p[0], p[1]) < Math.hypot(b[0], b[1]) ? p : b), ell[0]);
  const step = Math.max(1, Math.floor(obsT.length / 40));
  return (
    <svg viewBox="0 0 300 300" style={{ width: '100%', maxWidth: 320, alignSelf: 'center' }} role="img" aria-label="Fitted orbit, top-down">
      <circle cx={150} cy={150} r={S} fill="none" stroke="rgba(255,190,120,0.55)" strokeWidth={1.2} />
      <path d={path} fill="none" stroke="#6cc4ff" strokeWidth={1.6} />
      <line x1={150} y1={150} x2={X(rp)} y2={Y(rp)} stroke="rgba(108,196,255,0.4)" strokeDasharray="3 3" />
      <text x={X(rp) + 4} y={Y(rp) - 4} fill="#6cc4ff" fontSize={10}>
        perihelion
      </text>
      {obsT
        .filter((_, i) => i % step === 0)
        .map((t) => {
          const h = fit.home(t);
          const p = fit.orbit(t);
          return (
            <g key={t}>
              <line x1={X(h)} y1={Y(h)} x2={X(p)} y2={Y(p)} stroke="rgba(217,210,195,0.12)" />
              <circle cx={X(p)} cy={Y(p)} r={1.8} fill="#d9d2c3" />
            </g>
          );
        })}
      <circle cx={150} cy={150} r={5} fill="#ffd27a" />
      <text x={8} y={292} fill="rgba(200,215,240,0.7)" fontSize={10}>
        orange: our orbit · blue: fitted ellipse · lines: your sight lines
      </text>
    </svg>
  );
}
