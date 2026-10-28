// Chapter 7: the giant, measured like a second blue planet — its retrograde
// loops give its synodic period and opposition date (Kepler's method sharpens
// both), and its big moon weighs it. Its mass decides how hard it bends our path.

import { useMemo, useState } from 'react';
import { ARCSEC, DAY, DEG } from '../../engine/constants';
import { fitOrbit, type OrbitFit } from '../../engine/orbitfit';
import { moonSwingFit, sineFit } from '../../game/fits';
import { fmt } from '../../game/format';
import { checkMissions, giantObservable } from '../../game/sim';
import { useGame } from '../../game/store';
import { sfx } from '../../game/audio';
import { Chart, unwrapDeg } from '../common/Chart';
import { Formula, SendToSheet } from '../common/sheetBits';
import { useGameTime } from '../common/widgets';

export function GiantPanel() {
  const s = useGame();
  const t = useGameTime(4);
  const [cursor, setCursor] = useState<number | null>(null);
  const [fit, setFit] = useState<OrbitFit | null>(null);
  const [band, setBand] = useState<[number, number] | null>(null);
  const days = s.trackG.map((o) => o.at / DAY);
  const lon = unwrapDeg(s.trackG.map((o) => o.v / DEG));
  const pts = days.map((x, i) => ({ x, y: lon[i] }));
  const picks = [...s.oppPicksG].sort((a, b) => a - b);
  const Sloop = picks.length >= 2 ? (picks[picks.length - 1] - picks[0]) / (picks.length - 1) : null;
  const P1 = s.sheet.P1?.value;

  const runFit = () => {
    if (!P1 || !picks.length) return;
    const guess = Sloop ? 1 / (1 / P1 - 1 / Sloop) : undefined;
    setFit(fitOrbit(s.trackG.map((o) => ({ t: o.at, lon: o.v })), P1, picks[picks.length - 1], guess, true));
  };
  const SgFit = fit && P1 ? 1 / (1 / P1 - 1 / fit.P2) : null;

  // The giant's moon.
  const mpts = s.moonTrackG.map((o) => ({ x: o.at / DAY, y: o.v / ARCSEC }));
  const used = mpts.filter((p) => !band || (p.x >= band[0] && p.x <= band[1]));
  const span = used.length ? used[used.length - 1].x - used[0].x : 0;
  // The line of sight turns as the giant moves in our sky: the fit uses the giant's own
  // tracked longitude (interpolated, unwrapped) so it finds the moon's true period.
  const lonAt = (d: number) => {
    const tg = s.trackG;
    if (tg.length < 2) return 0;
    // First log at or after d (binary search; the log is in time order).
    let lo = 0;
    let hi = tg.length;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (tg[m].at / DAY < d) lo = m + 1;
      else hi = m;
    }
    const i = Math.min(tg.length - 1, Math.max(1, lo));
    const a = tg[i - 1];
    const b = tg[i];
    let dl = b.v - a.v;
    if (dl > Math.PI) dl -= 2 * Math.PI;
    if (dl < -Math.PI) dl += 2 * Math.PI;
    const f = (d - a.at / DAY) / Math.max(1e-9, (b.at - a.at) / DAY);
    return a.v + dl * f;
  };
  const unwrapFrom = (d0: number) => (d: number) => {
    let x = lonAt(d) - lonAt(d0);
    while (x > Math.PI) x -= 2 * Math.PI;
    while (x < -Math.PI) x += 2 * Math.PI;
    return x;
  };
  const mfit = useMemo(() => {
    if (used.length < 12 || span >= 120) return null;
    const xs = used.map((p) => p.x);
    const ys = used.map((p) => p.y);
    if (s.trackG.length < 2) return sineFit(xs, ys, 2, 200);
    const ph = unwrapFrom(xs[0]);
    // The moon may orbit either way round: keep the better fit.
    const fits = [moonSwingFit(xs, ys, 2, 200, ph), moonSwingFit(xs, ys, 2, 200, (d) => -ph(d))].filter((f) => f !== null);
    return fits.sort((a, b) => a!.rms - b!.rms)[0] ?? null;
    // Refit only when the data or the chosen stretch changes.
  }, [band, s.moonTrackG.length, s.trackG.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const mid = used.length ? 0.5 * (used[0].x + used[used.length - 1].x) : 0;

  return (
    <div className="stack">
      <div className="panel panel-pad stack">
        <b>The giant</b>
        <div className="muted" style={{ fontSize: 13 }}>
          The brightest steady light in the night sky. Its gravity can fling us outwards — if we know where it will be and how heavy it is.
        </div>
        <button className={`btn ${s.trackGOn ? '' : 'primary'}`} onClick={() => (s.set({ trackGOn: !s.trackGOn }), checkMissions())}>
          {s.trackGOn ? 'Giant tracker: ON (nightly, moon 8×/day)' : 'Turn on the giant tracker'}
        </button>
        <div className="muted" style={{ fontSize: 13 }}>
          {giantObservable(t) ? 'Tracking now: the giant is up.' : 'Waiting for the giant in a dark sky.'} Warp time to collect data.
        </div>
        {pts.length > 1 && (
          <Chart
            series={[{ pts, color: '#ffe6b8', kind: 'dots' }]}
            markers={picks.map((p, i) => ({ x: p / DAY, color: '#5be3a4', label: `opp ${i + 1}` }))}
            cursor={cursor}
            onCursor={setCursor}
            xLabel="day"
            yLabel="giant longitude (°)"
            xFmt={(x) => x.toFixed(0)}
            yFmt={(y) => y.toFixed(1)}
          />
        )}
        {cursor !== null && (
          <div className="row between">
            <span className="mono">day {fmt(cursor, 2)}</span>
            <button
              className="btn primary small"
              onClick={() => {
                s.set({ oppPicksG: [...s.oppPicksG, cursor * DAY] });
                setCursor(null);
                sfx('good');
                setTimeout(checkMissions, 0);
              }}
            >
              Mark the giant’s opposition here
            </button>
          </div>
        )}
        {picks.map((p, i) => (
          <div key={p} className="row between">
            <span>
              Opposition {i + 1}: <span className="mono">day {fmt(p / DAY, 2)}</span>
            </span>
            <button className="btn small ghost" onClick={() => s.set({ oppPicksG: s.oppPicksG.filter((x) => x !== p) })}>
              ✕
            </button>
          </div>
        ))}
        {picks.length > 0 && (
          <>
            <b>By eye, from the loops</b>
            <SendToSheet k="tOppG" value={picks[picks.length - 1]} />
            {Sloop && <SendToSheet k="Sg" value={Sloop} label={`Send S_G = ${fmt(Sloop / DAY, 2)} days`} />}
          </>
        )}
      </div>

      {picks.length > 0 && P1 && s.trackG.length >= 12 && (
        <div className="panel panel-pad stack">
          <b>Sharper: Kepler’s method</b>
          <div className="muted" style={{ fontSize: 13 }}>
            Eyeballing the middle of a loop is good to a day or two. A slingshot needs better: the giant has to be exactly where we expect it, years from
            now. Fitting its whole track pins its year and its opposition far more tightly.
          </div>
          <button className="btn" onClick={runFit}>
            {fit ? 'Refit' : 'Fit the giant’s orbit'}
          </button>
          {fit && SgFit && (
            <>
              <dl className="kv">
                <dt>Its year P_G</dt>
                <dd className="blue">{fmt(fit.P2 / DAY, 2)} days</dd>
                <dt>Opposition (fitted)</dt>
                <dd className="blue">
                  day {fmt(fit.tOppFit / DAY, 2)} ± {fmt(fit.sigmaTOpp / DAY, 2)}
                </dd>
                <dt>Synodic period S_G</dt>
                <dd className="blue">{fmt(SgFit / DAY, 2)} days</dd>
              </dl>
              <Formula>1/S_G = 1/P₁ − 1/P_G</Formula>
              <SendToSheet k="tOppG" value={fit.tOppFit} spread={fit.sigmaTOpp} />
              <SendToSheet k="Sg" value={SgFit} spread={(SgFit * SgFit * fit.sigmaP2) / (fit.P2 * fit.P2)} />
            </>
          )}
        </div>
      )}

      <div className="panel panel-pad stack">
        <b>The giant’s moon</b>
        <div className="muted" style={{ fontSize: 13 }}>
          A big moon swings east and west of the giant. Its swing and period weigh the giant with Kepler’s third law, exactly as for the blue planet.
        </div>
        {mpts.length > 1 && (
          <Chart
            series={[
              { pts: mpts, color: '#d9d2c3', kind: 'dots', faded: (p) => !!band && (p.x < band[0] || p.x > band[1]) },
              ...(mfit && used.length
                ? [{ pts: Array.from({ length: 200 }, (_, i) => ({ x: used[0].x + (span * i) / 199, y: mfit.model(used[0].x + (span * i) / 199) })), color: '#ffe6b8', kind: 'line' as const }]
                : []),
            ]}
            xLabel="day"
            yLabel="moon offset (″)"
            band={band}
            onBand={setBand}
            brushMode="band"
            yFmt={(y) => y.toFixed(0)}
          />
        )}
        {mpts.length > 1 && span >= 120 && <div className="amber" style={{ fontSize: 13 }}>Drag across a stretch of at most ~120 days to fit.</div>}
        {mpts.length > 1 && span < 120 && <div className="faint" style={{ fontSize: 12 }}>Best: about two of the moon’s swings (60–100 days) with the giant tracked too — the fit allows for the giant moving across our sky and coming nearer or going away.</div>}
        {mfit && (
          <>
            <dl className="kv">
              <dt>Greatest elongation θ_G</dt>
              <dd className="blue">{fmt(mfit.amplitude, 1)}″</dd>
              <dt>Period P_G(moon)</dt>
              <dd className="blue">{fmt(mfit.period, 3)} days</dd>
            </dl>
            <Formula>M_G = 4π² (d_G tan θ_G)³ / (G P²)</Formula>
            <SendToSheet k="thetaMg" value={mfit.amplitude * ARCSEC} at={mid * DAY} spread={mfit.sigmaAmplitude * ARCSEC} />
            <SendToSheet k="Pmg" value={mfit.period * DAY} spread={mfit.sigmaPeriod * DAY} />
          </>
        )}
      </div>
    </div>
  );
}
