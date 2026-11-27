// Chapter 4 fits the blue planet's orbit to sightings from the moving camp world.

import { useEffect, useMemo, useRef, useState } from 'react';
import { DAY, DEG } from '../../engine/constants';
import { fitOrbit, type OrbitFit, type OrbitObs } from '../../engine/orbitfit';
import { fmt } from '../../game/format';
import { useGame } from '../../game/store';
import { currentWorld } from '../../game/sim';
import { Formula, SendToSheet } from '../common/sheetBits';
import { toast } from '../common/widgets';
import { OrbitComparison, OrbitPlot } from './OrbitComparison';

interface OrbitSnapshot {
  circle: OrbitFit | null;
  ellipse: OrbitFit;
  obs: OrbitObs[];
  year: number;
  opposition: number;
  guess?: number;
}

export function OrbitPanel() {
  const s = useGame();
  const [fit, setFit] = useState<OrbitSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [night, setNight] = useState(0);
  const pending = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(pending.current), []);
  const year = s.sheet.P1?.value;
  const opposition = s.sheet.tOpp?.value;
  const obs = useMemo(() => s.track
    .filter((o) => Number.isFinite(o.at) && Number.isFinite(o.v))
    .map((o) => ({ t: o.at, lon: o.v })).sort((a, b) => a.t - b.t), [s.track]);
  const span = obs.length ? (obs.at(-1)!.t - obs[0].t) / DAY : 0;
  const picks = [...new Set(s.oppPicks.filter(Number.isFinite))].sort((a, b) => a - b);
  const candidate = year && picks.length >= 2 ? 1 / (1 / year - (picks.length - 1) / (picks.at(-1)! - picks[0])) : undefined;
  const guess = candidate !== undefined && Number.isFinite(candidate) && candidate > 0 ? candidate : undefined;
  const haveInputs = year !== undefined && Number.isFinite(year) && year > 0 && opposition !== undefined && Number.isFinite(opposition);
  const enough = haveInputs && obs.length >= 12 && span > 0.6 * (guess ?? 1.8 * year) / DAY;
  const circleOnly = !!currentWorld().system.giant;
  const latest = !!fit && fit.obs === obs && fit.year === year && fit.opposition === opposition && fit.guess === guess;

  const run = () => {
    if (!enough || busy || year === undefined || opposition === undefined) return;
    setBusy(true);
    // Give the busy state a frame to render before fitting.
    pending.current = setTimeout(() => {
      const circle = fitOrbit(obs, year, opposition, guess, true);
      const ellipse = circleOnly ? circle : fitOrbit(obs, year, opposition, guess);
      setBusy(false);
      if (!ellipse) return toast('The fit did not converge. Try a longer series of sightings.');
      setFit({ circle, ellipse, obs, year, opposition, guess });
      setNight(0);
      setComparing(false);
    }, 30);
  };
  const ellipse = fit?.ellipse;
  const comparison = fit?.circle && comparing && !circleOnly ? fit.circle : undefined;

  return <section className="panel panel-pad stack" aria-label="Orbit fit">
    <b>Orbit fit</b>
    <div className="muted">Use your tracker sightings to map the planet’s path around the star.</div>
    {!haveInputs && <div className="amber">Add your year P₁ and an opposition date t₀ to the sheet first.</div>}
    <div className="row between">
      <span className="muted">Sightings logged</span><span className="mono">{obs.length} over {fmt(span, 0)} days</span>
    </div>
    {!enough && haveInputs &&
      <div className="hint">The fit needs at least 12 nights spread over most of an orbit. Keep the tracker running.</div>}
    <button className={`btn${fit ? '' : ' primary'}`} disabled={!enough || busy} onClick={run}>
      {busy ? 'Fitting…' : fit ? 'Refit the orbit' : 'Fit the orbit'}
    </button>
    {fit && ellipse && <>
      {!latest && <p className="faint">This fit uses an earlier snapshot. Refit to include your latest sightings or sheet values.</p>}
      <div className={`orbit-workspace${comparison ? ' comparing' : ''}`}>
        <div className="stack orbit-model">
          <OrbitPlot fit={ellipse} start={fit.obs[0].t} circle={comparison} night={comparison ? fit.obs[night].t : undefined} circleOnly={circleOnly} />
          {!circleOnly && fit.circle && <button className="btn small" type="button" aria-expanded={comparing}
            aria-controls={comparing ? 'orbit-comparison' : undefined} onClick={() => setComparing(!comparing)}>
            {comparing ? 'Close model comparison' : 'Compare circle and ellipse'}
          </button>}
        </div>
        {comparison && <OrbitComparison obs={fit.obs} circle={comparison} ellipse={ellipse} index={night} onPick={setNight} />}
      </div>
      <dl className="kv orbit-summary">
        <dt>Period P₂</dt><dd className="blue">{fmt(ellipse.P2 / DAY, 2)} ± {fmt(ellipse.sigmaP2 / DAY, 2)} days</dd>
        {!circleOnly && <>
          <dt>Eccentricity e</dt><dd className="blue">{fmt(ellipse.e, 4)} ± {fmt(ellipse.sigmaE, 4)}</dd>
          <dt>Perihelion ϖ</dt><dd className="blue">{fmt(ellipse.wPeri / DEG, 1)}° ± {fmt(ellipse.sigmaW / DEG, 1)}°</dd>
        </>}
      </dl>
      <div className="orbit-sheet-fields">
        <SendToSheet k="Porb" value={ellipse.P2} spread={ellipse.sigmaP2} />
        {!circleOnly && <>
          <SendToSheet k="ecc" value={ellipse.e} spread={ellipse.sigmaE} />
          <SendToSheet k="wPeri" value={ellipse.wPeri} spread={ellipse.sigmaW} />
        </>}
      </div>
      {!circleOnly &&
        <details className="measurement-help">
          <summary>Orbit scale</summary>
          <p>Perihelion is measured from the home planet’s fitted direction at opposition.</p>
          <p>Closest and farthest distances: {fmt((1 - ellipse.e) * (ellipse.P2 / fit.year) ** (2 / 3), 3)}–{fmt((1 + ellipse.e) * (ellipse.P2 / fit.year) ** (2 / 3), 3)} times our orbit radius.</p>
          <Formula>a₂ = a₁ (P₂/P₁)^⅔, r = a₂(1 − e²) / (1 + e cos(θ − ϖ))</Formula>
        </details>}
    </>}
  </section>;
}
