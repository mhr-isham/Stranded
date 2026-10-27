// Chapter 2: weigh the moonless blue planet with a flyby. Choose how close
// the probe should pass (using your own measured radius), launch it, then read
// its radio Doppler speed — far away and at closest approach — and its radar
// altitude. Energy: v_peak² − v∞² = 2GM₂/r_peri.

import { useState } from 'react';
import { DAY, HOUR } from '../../engine/constants';
import { deriveAll } from '../../engine/chain';
import { flybySpeedAt, PROBE_COST, probeTransitDays } from '../../engine/probe';
import { hash32 } from '../../engine/rng';
import { sfx } from '../../game/audio';
import { clock } from '../../game/clock';
import { fmt } from '../../game/format';
import { useMode } from '../../game/modes';
import { launchProbe } from '../../game/probeState';
import { currentVariant, currentWorld } from '../../game/sim';
import { useGame } from '../../game/store';
import { Chart } from '../common/Chart';
import { Formula, SanityWarning, SendToSheet, ToolHeader } from '../common/sheetBits';
import { toast, useGameTime } from '../common/widgets';

const MAX_PROBES = 2;
const NOISE = 0.0015; // relative scatter of one Doppler speed sample

function gauss(seed: number, i: number) {
  const u1 = (hash32(seed, i, 0xd1) + 1) / 4294967297;
  const u2 = hash32(seed, i, 0xd2) / 4294967296;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function ProbeBay() {
  const { system: sys } = currentWorld();
  const s = useGame();
  const t = useGameTime(4);
  const mode = useMode();
  const R2 = deriveAll(s.sheet, currentVariant()).R2;
  const [aimR, setAimR] = useState(2.5); // in units of your R₂
  const [band, setBand] = useState<[number, number] | null>(null);
  const p = s.probe;
  const launched = s.probesLaunched;
  const arrived = p && t >= p.arriveAt;

  const launch = () => {
    if (!R2) return toast('Measure the blue planet’s radius R₂ first — the aim is in planet radii.');
    const aim = aimR * R2.value;
    useGame.setState({ ...launchProbe(sys, s, aim, clock.t), probesLaunched: launched + 1 });
    sfx('launch');
    toast(`Probe away — ${fmt(probeTransitDays(sys), 0)} days to the blue planet.`);
  };

  // Doppler samples every 20 minutes for ±36 h, and every 2 minutes within 3 h of closest approach.
  const times = [...Array.from({ length: 100 }, (_, i) => -36 + i / 3), ...Array.from({ length: 181 }, (_, i) => -3 + i / 30), ...Array.from({ length: 100 }, (_, i) => 3 + (i + 1) / 3)];
  const samples = p && arrived && !p.crashed
    ? times.map((hrs, i) => {
        const v = flybySpeedAt(sys, { vInf: p.vInf, rPeri: p.rPeri, vPeak: p.vPeak, deflection: 0, crashed: false }, hrs * HOUR);
        return { x: hrs, y: (v * (1 + NOISE * gauss(Math.round(p.launchedAt), i))) / 1000 };
      })
    : [];
  const sel = band ? samples.filter((q) => q.x >= band[0] && q.x <= band[1]) : [];
  const mean = sel.length ? sel.reduce((a, q) => a + q.y, 0) / sel.length : null;
  const se = sel.length > 1 && mean !== null ? Math.sqrt(sel.reduce((a, q) => a + (q.y - mean) ** 2, 0) / (sel.length - 1) / sel.length) : undefined;
  const peak = sel.length ? Math.max(...sel.map((q) => q.y)) : null;
  // Radar altimeter: height above the cloud tops at closest approach, ±10 km.
  const altKm = p && !p.crashed ? (p.rPeri - sys.target.radius) / 1000 + 10 * gauss(Math.round(p.launchedAt), 999) : null;

  return (
    <div className="tool">
      <div className="tool-stage" style={{ background: 'radial-gradient(ellipse at 50% 40%, #142040 0%, #05070f 70%)' }}>
        <div style={{ position: 'absolute', inset: 'calc(80px + var(--safe-top)) 16px 100px 16px', display: 'grid', placeItems: 'center' }}>
          {samples.length > 0 ? (
            <div style={{ width: '100%', maxWidth: 760 }}>
              <Chart
                series={[{ pts: samples, color: '#6cc4ff', kind: 'dots', faded: (q) => !!band && (q.x < band[0] || q.x > band[1]) }]}
                xLabel="hours from closest approach"
                yLabel="probe speed (km/s)"
                band={band}
                onBand={setBand}
                brushMode="band"
                height={300}
                yFmt={(y) => y.toFixed(2)}
              />
              <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>
                Drag across the chart to select samples: a flat stretch far from the peak for v∞, or the top of the peak for vₚ.
              </div>
            </div>
          ) : (
            <div className="muted" style={{ textAlign: 'center', maxWidth: 420 }}>
              {!p
                ? 'The probe sits on its rail beside the ship. Its radio will report its speed all the way through the flyby.'
                : p.crashed && arrived
                  ? 'Signal lost at closest approach. The probe hit the planet — it was aimed too close.'
                  : `Probe in flight. Closest approach on day ${fmt(p.arriveAt / DAY, 1)}.`}
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
            <input type="range" min={1.05} max={6} step={0.05} value={aimR} onChange={(e) => setAimR(Number(e.target.value))} style={{ flex: 1 }} disabled={!!p && !arrived} />
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
              aimR < 1.25 && 'Very close: with ±6% navigation scatter and the error in your R₂, the probe may hit the planet.',
              aimR > 4 && 'Far away: the speed-up will be small, so the mass will be imprecise.',
            ]}
          />
          {mode.coaching && <div className="hint">Closer gives a bigger speed-up and a better mass, but risks a crash. Around 2–3 planet radii is a good start.</div>}
          <button className="btn primary" disabled={!R2 || launched >= MAX_PROBES || (!!p && !arrived)} onClick={launch}>
            Launch probe
          </button>
        </div>

        {p && arrived && !p.crashed && (
          <div className="panel panel-pad stack">
            <b>2 · Read the flyby</b>
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
                <SendToSheet k="vInf" value={mean * 1000} spread={se !== undefined ? se * 1000 : undefined} />
                <b style={{ fontSize: 13 }}>Peak speed vₚ (use the top of the peak)</b>
                <SendToSheet k="vPeak" value={peak! * 1000} spread={NOISE * peak! * 1000} />
              </>
            ) : (
              <div className="faint" style={{ fontSize: 13 }}>Select part of the chart.</div>
            )}
            <b style={{ marginTop: 6 }}>3 · Radar altimeter</b>
            <div className="muted" style={{ fontSize: 13 }}>
              At closest approach the probe was <b>{fmt(altKm!, 0)} ± 10 km</b> above the cloud tops. Add the planet’s radius to get rₚ from its centre.
            </div>
            {R2 && altKm !== null && (
              <>
                <div className="faint" style={{ fontSize: 12 }}>
                  rₚ = your R₂ + altitude = {fmt(R2.value / 1000, 0)} + {fmt(altKm, 0)} = {fmt(R2.value / 1000 + altKm, 0)} km (error ≈ ±
                  {fmt(Math.hypot(R2.sigma / 1000, 10), 0)} km)
                </div>
                <SendToSheet k="rPeri" value={R2.value + altKm * 1000} spread={Math.hypot(R2.sigma, 10e3)} />
              </>
            )}
            <Formula>M₂ = rₚ (vₚ² − v∞²) / (2G)</Formula>
          </div>
        )}
      </div>
    </div>
  );
}
