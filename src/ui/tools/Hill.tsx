import { useEffect, useRef, useState } from 'react';
import { DEG, HOUR } from '../../engine/constants';
import { horizonDip } from '../../engine/measure';
import { useMode } from '../../game/modes';
import { starAltitude } from '../../engine/sky';
import { clock } from '../../game/clock';
import { fmt } from '../../game/format';
import { currentWorld, spendTime } from '../../game/sim';
import { useGame } from '../../game/store';
import { ANOMALIES, humidityCalibration, instrumentHumidK, windAt } from '../../game/anomalies';
import { correctHorizon, type MeasurementEnvironment } from '../../game/measurementEnvironment';
import { css, skyColors } from '../../render/color';
import { sfx, setInstrument, stopInstrument } from '../../game/audio';
import { flag } from '../../game/tutorial';
import { CanvasView } from '../common/CanvasView';
import { Formula, ReadingsTable, SanityWarning, SendReadings, ToolHeader, outlierNote } from '../common/sheetBits';
import { toast, useGameTime } from '../common/widgets';

const EYE = 1.7;

export function Hill() {
  useEffect(() => stopInstrument, []);
  const hillMode = useMode();
  const { system: sys } = currentWorld();
  const s = useGame();
  const t = useGameTime(4);
  const upgrades = s.settings.survival ? s.survival.upgrades : [];
  const tripod = upgrades.includes('tripod');
  const vernier = upgrades.includes('vernier');
  const res = vernier ? 0.001 : 0.005; // degrees per scale division
  const H = sys.hillHeight;
  const stations = [
    { name: 'Camp', h: 0 },
    { name: 'Boulder field', h: Math.round(H * 0.22) },
    { name: 'Saddle', h: Math.round(H * 0.55) },
    { name: 'Summit', h: H },
  ];
  const [at, setAt] = useState(0);
  const [moving, setMoving] = useState(false);
  const [zoom, setZoom] = useState(4);
  const autoAvailable = ANOMALIES[s.settings.difficulty].announce === 'corrected' && (s.settings.rulesetVersion ?? 1) >= 3;
  const legacyCompensated = ANOMALIES[s.settings.difficulty].announce === 'corrected' && !autoAvailable;
  const [treatment, setTreatment] = useState<'raw' | 'auto' | 'manual'>(autoAvailable ? 'auto' : 'raw');
  const [estimateK, setEstimateK] = useState('');
  const [sigmaK, setSigmaK] = useState('');
  const [sampleAt, setSampleAt] = useState<number | null>(null);
  const manualValid = estimateK.trim() !== '' && sigmaK.trim() !== '' && Number(sigmaK) > 0 && !!correctHorizon(1, .001, Number(estimateK), Number(sigmaK));
  const [result, setResult] = useState<null | { theta: number; R: number; h: number; untouched: boolean; environment: MeasurementEnvironment }>(null);
  const keptR = s.readings.filter((r) => r.key === 'R1' && r.kept).map((r) => r.value);
  const view = useRef({ pitch: -0.3, drag: null as null | { y: number; p: number }, brace: 0, sway: 0 });
  const h = stations[at].h + EYE;
  // Thick air (chapter 3) bends the light from the horizon down to the eye, so
  // the horizon looks higher than it is: apparent dip ≈ true dip · √(1 − k).
  // New runs expose the same apparent-angle model before any numerical correction.
  const humidity = instrumentHumidK(s, t);
  const k = Math.min(0.9, sys.features.refraction + humidity);
  const dip = (horizonDip(sys.home.radius, h) * Math.sqrt(1 - k)) / DEG;

  const climb = (i: number) => {
    if (i === at || moving) return;
    const dh = Math.abs(stations[i].h - stations[at].h);
    // Walking out from camp to the foot of the hill (and back) takes time too.
    const walk = at === 0 || i === 0 ? ((s.camp?.hillKm ?? 4) / 4) * HOUR : 0;
    const dur = (dh / 350 + 0.25) * HOUR + walk;
    setMoving(true);
    spendTime(dur, () => {
      setAt(i);
      setMoving(false);
      if (i === stations.length - 1) flag('hill-summit');
      view.current.pitch = -0.3;
      toast(`${stations[i].name}: ${stations[i].h} m above camp`);
    });
  };

  const ppdFor = (hpx: number) => hpx / (4 / zoom);
  const read = () => {
    if (treatment === 'manual' && !manualValid) return;
    const atTime = clock.t;
    const reading = Math.round(view.current.pitch / res) * res;
    const apparent = -reading * DEG;
    if (apparent <= 0) {
      toast('The reading must be below level — the horizon dips downward.');
      return;
    }
    const raw = correctHorizon(h, apparent)!;
    const apply = treatment === 'manual' || (treatment === 'auto' && instrumentHumidK(s, atTime) > 0);
    const calibration = treatment === 'manual' ? { k: Number(estimateK), sigmaK: Number(sigmaK) } : humidityCalibration(s, atTime);
    const used = apply ? correctHorizon(h, apparent, calibration.k, calibration.sigmaK) : raw;
    if (!raw || !used) return toast('The angle or refraction estimate is outside this model. Check the inputs.');
    const environment: MeasurementEnvironment = { instrument: 'horizon', at: atTime, rawValue: raw.radius, horizon: {
      height: h, station: stations[at].name, rawAngle: apparent, usedAngle: used.angle, damp: instrumentHumidK(s, atTime) > 0, legacyCompensated,
      ...(apply ? { correction: { source: treatment === 'manual' ? 'player' : 'echo-humidity', ...calibration, sigmaValue: used.sigmaValue, ...(treatment === 'auto' ? { sampledAt: atTime } : sampleAt !== null ? { sampledAt: sampleAt } : {}) } } : {}),
    } };
    setResult({ theta: used.angle, R: used.radius, h, untouched: Math.abs(view.current.pitch + 0.3) < 1e-9, environment });
    flag('hill-read');
    sfx('measure');
  };

  return (
    <div className="tool">
      <div className="tool-stage" data-tut="hill-stage">
        <CanvasView
          onPointerDown={(e) => {
            sfx('detent');
            (e.target as Element).setPointerCapture(e.pointerId);
            view.current.drag = { y: e.clientY, p: view.current.pitch };
          }}
          onPointerMove={(e) => {
            const d = view.current.drag;
            if (!d) return;
            const c = e.currentTarget;
            const ppd = ppdFor(c.height) / (window.devicePixelRatio || 1);
            // Fine control: drag moves the instrument a quarter of the apparent motion.
            view.current.pitch = d.p + ((e.clientY - d.y) / ppd) * 0.25;
            sfx('detent');
          }}
          onPointerUp={() => (view.current.drag = null)}
          onWheel={(e) => setZoom((z) => Math.max(1, Math.min(60, z * (e.deltaY < 0 ? 1.15 : 0.87))))}
          draw={({ ctx, w, h: hp, dpr, now, dt }) => {
            const wind = windAt(useGame.getState(), clock.t);
            setInstrument('wind', 0.22 + Math.min(0.4, wind / 30) + (at / 3) * 0.15, Math.min(1, wind / 12));
            const V = view.current;
            const tt = now / 1000;
            // Hand sway: smooth, quasi-periodic. Bracing and a tripod steady it.
            V.brace = Math.max(0, V.brace - dt);
            const amp = 0.012 * (tripod ? 0.2 : 1) * (V.brace > 0 ? 0.3 : 1);
            V.sway = amp * (Math.sin(tt * 1.3) + 0.6 * Math.sin(tt * 2.9 + 1) + 0.3 * Math.sin(tt * 7.1 + 2)) / 1.9;
            const ppd = ppdFor(hp);
            const eff = V.pitch + V.sway;
            const yOf = (elev: number) => hp / 2 - (elev - eff) * ppd;
            const sun = starAltitude(sys, clock.t, sys.site) / DEG;
            const col = skyColors(sun, !!sys.features.real);
            const yH = yOf(-dip);
            // Sky.
            const g = ctx.createLinearGradient(0, yH - hp, 0, yH);
            g.addColorStop(0, css(col.zenith));
            g.addColorStop(1, css(col.horizon));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, Math.max(0, yH));
            // Distant plain with haze bands that compress towards the horizon.
            const gg = ctx.createLinearGradient(0, yH, 0, yH + hp * 0.6);
            gg.addColorStop(0, css(col.horizon, 1));
            gg.addColorStop(0.02, css(col.ground, 1));
            gg.addColorStop(1, css([col.ground[0] * 0.6, col.ground[1] * 0.6, col.ground[2] * 0.6]));
            ctx.fillStyle = gg;
            ctx.fillRect(0, Math.max(0, yH), w, hp);
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            for (let k = 1; k < 30; k++) {
              const y = yH + (k * k * 0.0016 * ppd) / Math.max(0.2, zoom / 4);
              if (y > hp) break;
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(w, y);
              ctx.stroke();
            }
            // Instrument reticle (fixed to the instrument, so it does not sway).
            ctx.strokeStyle = 'rgba(255,90,90,0.9)';
            ctx.lineWidth = 1.2 * dpr;
            ctx.beginPath();
            ctx.moveTo(w * 0.15, hp / 2);
            ctx.lineTo(w * 0.45, hp / 2);
            ctx.moveTo(w * 0.55, hp / 2);
            ctx.lineTo(w * 0.85, hp / 2);
            ctx.moveTo(w / 2, hp / 2 - 30 * dpr);
            ctx.lineTo(w / 2, hp / 2 - 8 * dpr);
            ctx.moveTo(w / 2, hp / 2 + 8 * dpr);
            ctx.lineTo(w / 2, hp / 2 + 30 * dpr);
            ctx.stroke();
            // Elevation scale relative to the instrument's own level.
            const step = pickStep(4 / zoom);
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.font = `${11 * dpr}px JetBrains Mono`;
            ctx.textAlign = 'right';
            for (let e = Math.floor((V.pitch - 2 / zoom) / step) * step; e <= V.pitch + 2 / zoom; e += step) {
              const y = hp / 2 - (e - V.pitch) * ppd;
              ctx.fillRect(w - 46 * dpr, y, 14 * dpr, dpr);
              ctx.fillText(`${e.toFixed(step < 0.01 ? 3 : 2)}°`, w - 50 * dpr, y + 4 * dpr);
            }
            // Vignette.
            const v = ctx.createRadialGradient(w / 2, hp / 2, Math.min(w, hp) * 0.35, w / 2, hp / 2, Math.max(w, hp) * 0.75);
            v.addColorStop(0, 'rgba(0,0,0,0)');
            v.addColorStop(1, 'rgba(0,0,0,0.85)');
            ctx.fillStyle = v;
            ctx.fillRect(0, 0, w, hp);
          }}
        />
        <div className="panel panel-pad stage-bottom" style={{ padding: '8px 12px' }} data-tut="hill-controls">
          <div className="meter-label">Instrument pitch</div>
          <PitchReadout view={view} res={res} />
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn small" onClick={() => (view.current.pitch += res)}>
              ▲
            </button>
            <button className="btn small" onClick={() => (view.current.pitch -= res)}>
              ▼
            </button>
            <button className="btn small amber" onPointerDown={() => (view.current.brace = 4)}>
              Brace (hold breath)
            </button>
            <button className="btn small primary" disabled={treatment === 'manual' && !manualValid} onClick={read}>
              Read angle
            </button>
          </div>
        </div>
      </div>
      <div className="tool-side">
        <ToolHeader title="The hill" sub="Measure how far the horizon dips below level. The dip depends on your height and the planet’s radius." />
        <div className="panel panel-pad stack" aria-label="Horizon conditions">
          <b>Air and refraction</b>
          <div className="muted" style={{ fontSize: 13 }}>{legacyCompensated ? 'Legacy compensated sight: this saved expedition removes episodic humidity before displaying the angle. Uncompensated angles are unavailable.' : humidity > 0 ? '🌫 Damp air episode: the distant horizon shimmers.' : 'No episodic damp-air signal. Persistent atmospheric layering may still refract the horizon.'}</div>
          <label className="field">Angle treatment<select className="input" value={treatment} onChange={(e) => setTreatment(e.target.value as typeof treatment)}>
            <option value="raw">Keep the displayed angle</option>
            {autoAvailable && <option value="auto">ECHO humidity compensation</option>}
            <option value="manual">Use my refraction estimate</option>
          </select></label>
          {treatment === 'auto' && <div className="muted" style={{ fontSize: 12 }}>ECHO uses the local air probe during damp episodes, preserving the apparent angle and labeling its calculation. The calibration covers episodic humidity; persistent thick-air layering needs an independent check.</div>}
          {treatment === 'manual' && <>
            <div className="row"><label className="field">Your refraction k<input className="input" inputMode="decimal" value={estimateK} onChange={(e) => { setEstimateK(e.target.value); setSampleAt(null); }} /></label>
              <label className="field">± uncertainty in k<input className="input" inputMode="decimal" value={sigmaK} onChange={(e) => { setSigmaK(e.target.value); setSampleAt(null); }} /></label></div>
            <button className="btn small" onClick={() => { const c = humidityCalibration(s, clock.t); setEstimateK(c.k.toFixed(3)); setSigmaK(c.sigmaK.toFixed(3)); setSampleAt(clock.t); }}>Sample local air</button>
            {sampleAt !== null && <div className="faint" style={{ fontSize: 12 }}>Local sample: expedition day {(sampleAt / 86400 + 1).toFixed(3)}. Re-sample if conditions change. It estimates episodic humidity, not the whole atmosphere.</div>}
            {!manualValid && <div className="muted" style={{ fontSize: 12 }}>Use 0 ≤ k ≤ 0.85 and a positive uncertainty, with k + uncertainty below 0.95.</div>}
          </>}
          <details className="measurement-help"><summary>Conditions and methods</summary>
            <p>Recheck after a damp spell passes. Bracing reduces hand sway; a higher station gives a larger dip and reduces relative aiming error. Neither removes persistent refraction. Time and air continue to pass while you wait.</p>
            <p>If you have a justified refraction estimate, correct the apparent dip and carry its uncertainty. A local humidity sample is not a measurement of a persistent atmospheric layer. Compare with the noon-shadow method when that is available; use independently measured radii to investigate the refraction instead of guessing a correction.</p>
            <Formula>θ_true ≈ θ_apparent / √(1 − k)</Formula>
            <p>For an independently measured reference radius R_ref and known eye height h, compare the predicted geometric dip with your observed dip:</p>
            <Formula>k ≈ 1 − [θ_apparent / arccos(R_ref / (R_ref + h))]²</Formula>
          </details>
        </div>
        {sys.features.refraction > 0 && hillMode.coaching && (
          <div className="callout warn" style={{ margin: 0 }}>
            <b>Thick air</b>
            The horizon shimmers and looks oddly high. Light skimming the ground bends in this dense air — readings here may be badly off.
          </div>
        )}
        <div className="panel panel-pad stack">
          <b>Where are you?</b>
          <div className="stack" data-tut="hill-stations">
            {stations.map((st, i) => (
              <button key={st.name} className={`btn ${i === at ? 'primary' : ''}`} style={{ justifyContent: 'space-between' }} disabled={moving} onClick={() => climb(i)}>
                <span>{st.name}</span>
                <span className="mono">{st.h} m</span>
              </button>
            ))}
          </div>
          {moving && <div className="amber">Climbing…</div>}
          <div className="muted" style={{ fontSize: 13 }}>
            Heights come from the survey markers on the path. Your eye is {EYE} m above the ground. Climbing takes time.
          </div>
          <b>Aim</b>
          <div className="muted" style={{ fontSize: 13 }}>
            Drag the view up/down until the horizon sits exactly on the red crosshair. Zoom in for precision. Your hands shake — brace, wait for a
            still moment, then read.
          </div>
          <div className="row">
            <span className="muted" style={{ fontSize: 13 }}>Zoom {fmt(zoom, 0)}×</span>
            <input type="range" min={1} max={60} step={1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
          </div>
          <Formula>R = h·cos θ / (1 − cos θ)  ≈ 2h / θ²</Formula>
        </div>
        {result && (
          <div className="panel panel-pad stack" data-tut="hill-result">
            <b>Reading</b>
            <dl className="kv">
              <dt>Height h</dt>
              <dd>{fmt(result.h, 1)} m</dd>
              <dt>{result.environment.horizon?.legacyCompensated ? 'Legacy displayed dip' : 'Apparent dip'}</dt>
              <dd>{fmt(result.environment.horizon!.rawAngle / DEG, 4)}°</dd>
              <dt>Dip used in calculation</dt>
              <dd>{fmt(result.theta / DEG, 4)}°</dd>
              <dt>Radius R</dt>
              <dd className="blue">{fmt(result.R / 1000, 0)} km</dd>
            </dl>
            {result.environment.horizon?.correction && <div className="callout tip" style={{ margin: 0 }}>
              <b>{result.environment.horizon.correction.source === 'echo-humidity' ? 'ECHO humidity correction' : 'Your refraction correction'}</b>
              <div>k = {fmt(result.environment.horizon.correction.k, 3)} ± {fmt(result.environment.horizon.correction.sigmaK, 3)}. First-order model contribution to radius uncertainty: ±{fmt(result.environment.horizon.correction.sigmaValue / 1000, 1)} km.</div>
              <div>Uncorrected result: {fmt(result.environment.rawValue / 1000, 0)} km. The model can leave other atmospheric effects unaccounted for.</div>
              {result.environment.horizon.correction.sigmaK / (1 - result.environment.horizon.correction.k) > .15 && <div>The coefficient uncertainty is large for this linear approximation. Evaluate a range of coefficients or use another method before relying on it.</div>}
            </div>}
            <SanityWarning
              attempt={result}
              msgs={[
                result.untouched && 'You haven’t moved the instrument since arriving — the horizon is probably not on the crosshair. Drag the view first.',
                (result.R < 1500e3 || result.R > 20000e3) && 'A planet this size is very unlikely. Check the horizon sits exactly on the red line.',
                result.h - EYE < 100 && 'You are close to the ground: the dip is tiny, so this reading has a huge error. Climb higher.',
                outlierNote(result.R, keptR, 0.1),
              ]}
            />
            <div className="row">
              <button
                className="btn primary"
                onClick={() => {
                  s.addReading({ key: 'R1', value: result.R, at: result.environment.at, note: `${result.environment.horizon!.station} · θ ${fmt(result.theta / DEG, 3)}°`, environment: result.environment });
                  setResult(null);
                  sfx('good');
                }}
              >
                Keep reading
              </button>
              <button className="btn" onClick={() => setResult(null)}>
                Discard
              </button>
            </div>
          </div>
        )}
        <div className="panel panel-pad" data-tut="hill-log">
          <b>Radius log</b>
          <ReadingsTable k="R1" />
          <SendReadings k="R1" tut="hill-send" />
        </div>
      </div>
    </div>
  );
}

function pickStep(spanDeg: number) {
  for (const s of [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5]) if (spanDeg / s <= 12) return s;
  return 1;
}

function PitchReadout({ view, res }: { view: React.MutableRefObject<{ pitch: number }>; res: number }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 80);
    return () => clearInterval(id);
  }, []);
  const v = Math.round(view.current.pitch / res) * res;
  return <div className="readout">{v.toFixed(3)}°</div>;
}
