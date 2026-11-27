// Chapter 2: weigh the moonless blue planet with a flyby. Choose how close
// the probe should pass (using your own measured radius), launch it, then read
// its radio Doppler speed — far away and at closest approach — and its radar
// altitude. Energy: v_peak² − v∞² = 2GM₂/r_peri.

import { useMemo, useState, useSyncExternalStore } from 'react';
import { deriveAll } from '../../engine/chain';
import { PROBE_COST, probeTransitDays } from '../../engine/probe';
import { sfx } from '../../game/audio';
import { clock, subscribeClock } from '../../game/clock';
import { fmt } from '../../game/format';
import { useMode } from '../../game/modes';
import { launchProbe } from '../../game/probeState';
import { currentVariant, currentWorld, spendTime } from '../../game/sim';
import { useGame } from '../../game/store';
import { Chart } from '../common/Chart';
import { Formula, SanityWarning, SendToSheet, ToolHeader } from '../common/sheetBits';
import { toast, useGameTime } from '../common/widgets';
import { MeasurementSources } from '../common/MeasurementSources';
import { lifeSupportEnd } from '../../game/survival';
import { PROBE_NOISE, receivedProbeAltitude, receivedProbeSamples } from '../../game/probeListening';
import { ProbeListening, probeDate } from './ProbeListening';

const MAX_PROBES = 2;

/** Signed log scale for the chart: hours near the peak stay wide, days far out still fit. */
const slog = (h: number) => Math.sign(h) * Math.log10(1 + Math.abs(h));
const hoursAt = (x: number) => Math.sign(x) * (10 ** Math.abs(x) - 1);

export function ProbeBay() {
  const { system: sys } = currentWorld();
  const s = useGame();
  const t = useGameTime(4);
  const mode = useMode();
  const R2 = deriveAll(s.sheet, currentVariant()).R2;
  const [aimR, setAimR] = useState(2.5); // in units of your R₂
  const [selection, setSelection] = useState<{ flight: number; band: [number, number] } | null>(null);
  const [shownFlight, setShownFlight] = useState('current');
  const latest = s.probe;
  const records = (s.probeLog ?? []).filter((flight) => flight.launchedAt !== latest?.launchedAt);
  const p = records.find((flight) => String(flight.launchedAt) === shownFlight) ?? latest;
  const band = p && selection?.flight === p.launchedAt ? selection.band : null;
  const crashedCount = (s.probeLog ?? []).filter((q) => q.crashed && q.arriveAt <= t).length;
  const launched = s.probesLaunched - crashedCount;
  const inFlight = !!latest && t < latest.arriveAt;
  const stopAt = useSyncExternalStore(subscribeClock, () => clock.stopAt);
  const lost = !!p?.crashed && t >= p.arriveAt;
  const nextWindow = lost ? undefined : p?.windows?.filter((w) => w.start > t).sort((a, b) => a.start - b.start)[0];
  const canWait = !!nextWindow && !Number.isFinite(stopAt) && !clock.realtime && nextWindow.start < lifeSupportEnd(s, sys);

  const launch = () => {
    const current = useGame.getState();
    if (current.probe && clock.t < current.probe.arriveAt) return;
    const losses = (current.probeLog ?? []).filter((q) => q.crashed && q.arriveAt <= clock.t).length;
    if (current.probesLaunched - losses >= MAX_PROBES) return;
    if (!R2 || !Number.isFinite(R2.value) || R2.value <= 0) return toast('Measure the blue planet’s radius R₂ first.');
    useGame.setState({ ...launchProbe(sys, current, aimR * R2.value, clock.t), probesLaunched: current.probesLaunched + 1 });
    setShownFlight('current');
    setSelection(null);
    sfx('launch');
    sfx('radio');
    toast(`Probe away — ${fmt(probeTransitDays(sys), 0)} days to the blue planet.`);
  };

  function waitToNextWindow() {
    const current = useGame.getState();
    const at = nextWindow?.start;
    if (at === undefined || at <= clock.t || Number.isFinite(clock.stopAt) || clock.realtime
      || current.phase !== 'play' || at >= lifeSupportEnd(current, sys)) return;
    spendTime(at - clock.t, () => {
      if (useGame.getState().phase === 'play' && clock.t >= at) toast('Listening window reached');
    }, { pauseOnArrival: true });
  }

  const samples = useMemo(() => p ? receivedProbeSamples(sys, p, t).map((q) => ({ x: slog(q.hours), y: q.speed / 1000 })) : [], [sys, p, t]);
  const sel = band ? samples.filter((q) => q.x >= band[0] && q.x <= band[1]) : [];
  const mean = sel.length ? sel.reduce((a, q) => a + q.y, 0) / sel.length : null;
  // Use scatter and the observed trend within this band as a local guide.
  // Even a flat-looking band may sit above the asymptotic speed.
  const se =
    sel.length > 1 && mean !== null
      ? Math.max(Math.sqrt(sel.reduce((a, q) => a + (q.y - mean) ** 2, 0) / (sel.length - 1) / sel.length), mean - Math.min(...sel.map((q) => q.y)))
      : undefined;
  const peak = sel.length ? Math.max(...sel.map((q) => q.y)) : null;
  const alt = p ? receivedProbeAltitude(sys, p, t) : null;
  const altKm = alt === null ? null : alt / 1000;

  return (
    <div className="tool probe-bay">
      <div className="tool-stage" style={{ background: 'radial-gradient(ellipse at 50% 40%, #142040 0%, #05070f 70%)' }}>
        <div className="probe-chart-region">
          {samples.length > 0 ? (
            <div style={{ width: '100%', maxWidth: 760 }}>
              <Chart
                ariaLabel="Recorded probe Doppler samples"
                series={[{ pts: samples, color: '#6cc4ff', kind: 'dots', faded: (q) => !!band && (q.x < band[0] || q.x > band[1]) }]}
                xLabel={p?.windows ? "hours from planned pass (log scale)" : "hours from closest approach (log scale)"}
                xFmt={(x) => fmt(hoursAt(x), Math.abs(hoursAt(x)) < 1 ? 2 : 0)}
                yLabel="probe speed (km/s)"
                band={band}
                onBand={(next) => setSelection(next && p ? { flight: p.launchedAt, band: next } : null)}
                brushMode="band"
                height="var(--probe-chart-height, 300px)"
                yFmt={(y) => y.toFixed(2)}
              />
              <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
                Drag across the chart to select samples: a flat stretch far from the peak for v∞, or the top of the peak for vₚ.
              </div>
            </div>
          ) : (
            <div className="muted" style={{ textAlign: 'center', maxWidth: 420 }}>
              {!p
                ? 'Launch the probe to open its receiver and begin listening.'
                : lost
                  ? 'Signal lost at closest approach. The probe hit the planet — it was aimed too close.'
                  : `Waiting for telemetry. Planned pass: ${probeDate(p.arriveAt)}.`}
            </div>
          )}
        </div>
      </div>
      <div className="tool-side">
        <ToolHeader title="Probe bay" sub="No moon here. Weigh the planet by watching something fall past it." />
        <div className="panel panel-pad stack">
          <b>1 · Aim and launch</b>
          <div className="muted" style={{ fontSize: 13 }}>
            Probes left: {MAX_PROBES - launched}. Each launch costs {PROBE_COST} m/s of the ship’s fuel and takes {fmt(probeTransitDays(sys), 0)} days to arrive.
          </div>
          <div className="row">
            <span style={{ fontSize: 13 }}>Closest approach</span>
            <input type="range" aria-label="Probe aim in planet radii" min={1.3} max={6} step={0.05} value={aimR} onChange={(e) => setAimR(Number(e.target.value))} style={{ flex: 1 }} disabled={inFlight} />
            <span className="mono">{fmt(aimR, 2)} R₂</span>
          </div>
          {R2 ? (
            <div className="faint" style={{ fontSize: 12 }}>
              = {fmt((aimR * R2.value) / 1000, 0)} km from the centre, using your R₂ = {fmt(R2.value / 1000, 0)} ± {fmt(R2.sigma / 1000, 0)} km. Navigation scatters the real pass by about ±6%.
            </div>
          ) : (
            <div className="amber" style={{ fontSize: 13 }}>Measure R₂ first (parallax + micrometer): the aim is in planet radii.</div>
          )}
          <SanityWarning
            msgs={[
              aimR <= 1.4 && 'Very close: with ±6% navigation scatter and the error in your R₂, the probe may hit the planet.',
              aimR > 4 && 'Far away: the speed-up will be small, so the mass will be imprecise.',
            ]}
          />
          {mode.coaching && <div className="hint">Closer gives a bigger speed-up and a better mass, but risks a crash. Around 2–3 planet radii is a good start.</div>}
          <button className="btn primary" disabled={!R2 || launched >= MAX_PROBES || inFlight} onClick={launch}>
            Launch probe
          </button>
        </div>

        {records.length > 0 && <label className="field">Flight record<select className="input" value={shownFlight} onChange={(event) => setShownFlight(event.target.value)}>
          <option value="current">Latest probe</option>
          {records.map((flight) => <option key={flight.launchedAt} value={String(flight.launchedAt)}>Launched {probeDate(flight.launchedAt)}</option>)}
        </select></label>}
        {p && <ProbeListening key={p.launchedAt} probe={p} now={t} count={samples.length}
          nextWindow={nextWindow} canWait={canWait} onWait={waitToNextWindow} />}

        {(samples.length > 0 || altKm !== null) && (
          <div className="panel panel-pad stack">
            <b>2 · Read the flyby</b>
            <MeasurementSources instrument="probe" />
            {mean !== null ? (
              <>
                <dl className="kv">
                  <dt>Selected samples</dt>
                  <dd>{sel.length}</dd>
                  <dt>Average speed</dt>
                  <dd>{fmt(mean, 4)} km/s</dd>
                  <dt>Highest sample</dt>
                  <dd>{fmt(peak!, 4)} km/s</dd>
                </dl>
                <b style={{ fontSize: 13 }}>Far-away speed v∞ (use the average of a flat stretch)</b>
                <SendToSheet k="vInf" value={mean * 1000} spread={se !== undefined ? se * 1000 : undefined} spreadLabel="Guide from scatter and drift in this band" />
                <b style={{ fontSize: 13 }}>Peak speed vₚ (use the top of the peak)</b>
                <SendToSheet k="vPeak" value={peak! * 1000} spread={PROBE_NOISE * peak! * 1000} spreadLabel="Modeled scatter of a single speed reading" />
              </>
            ) : (
              <div className="faint" style={{ fontSize: 13 }}>Select part of the chart.</div>
            )}
            {altKm !== null && <>
              <b style={{ marginTop: 6 }}>3 · Radar altimeter</b>
              <div className="muted" style={{ fontSize: 13 }}>
                At closest approach the probe was <b>{fmt(altKm, 0)} ± 10 km</b> above the cloud tops. Add the planet’s radius to get rₚ from its centre.
              </div>
              {R2 && (
                <>
                  <div className="faint" style={{ fontSize: 12 }}>
                    rₚ = your R₂ + altitude = {fmt(R2.value / 1000, 0)} + {fmt(altKm, 0)} = {fmt(R2.value / 1000 + altKm, 0)} km (error ≈ ±
                    {fmt(Math.hypot(R2.sigma / 1000, 10), 0)} km)
                  </div>
                  <SendToSheet k="rPeri" value={R2.value + altKm * 1000} spread={Math.hypot(R2.sigma, 10e3)} />
                </>
              )}
            </>}
            <Formula>M₂ = rₚ (vₚ² − v∞²) / (2G)</Formula>
          </div>
        )}
      </div>
    </div>
  );
}
