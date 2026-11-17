import { useEffect, useMemo, useRef, useState } from 'react';
import { DEG } from '../../engine/constants';
import { surfaceGravity } from '../../engine/measure';
import { hash32 } from '../../engine/rng';
import { WARPS, clock } from '../../game/clock';
import { fmt } from '../../game/format';
import { currentWorld } from '../../game/sim';
import { useGame } from '../../game/store';
import { paintSky } from '../../render/paint';
import { makeLandscape } from '../../render/terrain';
import { CanvasView, canvasPoint } from '../common/CanvasView';
import { Formula, ReadingsTable, SanityWarning, SendReadings, ToolHeader, outlierNote } from '../common/sheetBits';
import { Modal, useClockState, useGameTime } from '../common/widgets';
import { sfx, setInstrument, stopInstrument } from '../../game/audio';
import { flag } from '../../game/tutorial';
import { explain, makePrediction, resolveNow } from '../../game/predictions';
import { hasChallenge } from '../../game/challenges';
import { useMode } from '../../game/modes';
import { pendulumPeriod } from '../../engine/measure';
import { ANOMALIES, windAt, windBiases, windPush } from '../../game/anomalies';
import type { MeasurementEnvironment } from '../../game/measurementEnvironment';
import { PredictCard } from '../common/Predict';
import { ReadingPredictionPractice } from '../tutorial/ReadingPredictionPractice';
import { toast } from '../common/widgets';

import { pendulumReading } from '../../game/pendulumFeedback';
import { observeSwingMotion, swingMotion, type PendulumTechnique } from '../../game/pendulumTechnique';
import { GravityMeaning, TimingComparison, TechniqueReview } from './PendulumFeedback';

let releaseSerial = 0;
const BOB_R = 0.025; // m

/** The wind gauge by the rig: a careful player checks it before timing. */
function WindGauge() {
  const s = useGame();
  const t = useGameTime(1);
  const v = windAt(s, t);
  const screened = !!s.instrumentSetup?.pendulumScreen;
  const corrected = ANOMALIES[s.settings.difficulty].announce === 'corrected' && !screened;
  return (
    <div className="stack">
    <div className="row between" style={{ fontSize: 13 }}>
      <span className="muted">Wind gauge</span>
      <span className={v > 6 ? 'amber' : ''}>
        {fmt(v, 1)} m/s {v > 6 ? (screened ? '— windscreen fitted' : corrected ? '— ECHO stabilization active' : '— strong') : '— calm'}
      </span>
    </div>
    {v > 6 && s.settings.difficulty === 'cadet' && corrected && <div className="muted" style={{ fontSize: 12 }}>
      Wind pushes the bob sideways. Cadet assistance steadies the rig here; check your length and timing, and compare repeat readings.
    </div>}
    </div>
  );
}

export function Pendulum() {
  const { system: sys, catalog } = currentWorld();
  const land = useMemo(() => makeLandscape(sys.seed, sys.hillHeight), [sys]);
  const g = surfaceGravity(sys);
  const addReading = useGame((s) => s.addReading);
  const gravityReadings = useGame((s) => s.readings).filter((r) => r.key === 'g' && r.kept);
  const keptG = gravityReadings.map((r) => r.value);
  const latest = gravityReadings.at(-1);
  const estimate = useGame((s) => s.sheet.g);
  useClockState();

  const [nominal, setNominal] = useState(1.5); // m, the coarse knob setting
  // The true length differs from the knob by a hidden knot/attachment offset.
  const trueL = nominal + ((hash32(sys.seed, Math.round(nominal * 100)) / 4294967296) * 3 - 1.5) / 100;
  const [lRead, setLRead] = useState<number | null>(null);
  const [amp, setAmp] = useState(6);
  const [taps, setTaps] = useState(0);
  const [running, setRunning] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [ask, setAsk] = useState<null | { time: number; environment: MeasurementEnvironment; technique: PendulumTechnique }>(null);
  const [nInput, setNInput] = useState('');
  const [result, setResult] = useState<null | { g: number; T: number; N: number; time: number; L: number; amp: number; environment: MeasurementEnvironment; technique: PendulumTechnique }>(null);

  const phys = useRef({ th: 0, om: 0, swinging: false, dragging: false, releaseAngle: 0, releaseId: '', trail: [] as { x: number; y: number }[] });
  const watch = useRef({ start: 0, running: false, motion: swingMotion() });
  const timingTechnique = useRef<PendulumTechnique>({ source: 'manual', releaseId: '', angle: 0, turns: 0 });
  const timingConditions = useRef<MeasurementEnvironment | null>(null);
  const screen = !!useGame((s) => s.instrumentSetup?.pendulumScreen);

  useEffect(() => {
    clock.realtime = true;
    clock.emit();
    return () => {
      stopInstrument();
      clock.realtime = false;
      clock.emit();
    };
  }, []);

  useEffect(() => setLRead(null), [nominal]);
  useEffect(() => {
    if (!celebrate) return;
    const timer = setTimeout(() => setCelebrate(false), 3200);
    return () => clearTimeout(timer);
  }, [celebrate]);

  // Stopwatch display.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed(Math.max(0, (performance.now() - watch.current.start) / 1000)), 31);
    return () => clearInterval(id);
  }, [running]);

  const lastFrame = useRef<number | null>(null);

  useEffect(() => {
    const visibility = () => {
      lastFrame.current = null;
      if (!document.hidden || !watch.current.running) return;
      watch.current.running = false;
      phys.current.swinging = false;
      setRunning(false);
      setInterrupted(true);
      setElapsed(0);
      setTaps(0);
      stopInstrument();
      toast('Timing interrupted while the game was hidden. Release the bob and time again.');
    };
    document.addEventListener('visibilitychange', visibility);
    return () => document.removeEventListener('visibilitychange', visibility);
  }, []);

  const toggleWatch = () => {
    // Worn stopwatch challenge: the button registers up to 0.2 s late.
    const lag = hasChallenge(useGame.getState(), 'stopwatch') ? Math.random() * 200 : 0;
    if (!watch.current.running) {
      const s = useGame.getState();
      timingConditions.current = { instrument: 'pendulum', at: clock.t, rawValue: 0, wind: { speed: windAt(s, clock.t), protection: s.instrumentSetup?.pendulumScreen ? 'windscreen' : ANOMALIES[s.settings.difficulty].announce === 'corrected' ? 'echo' : 'none' } };
      watch.current = { start: performance.now() + lag, running: true, motion: swingMotion(phys.current.om) };
      timingTechnique.current = { source: 'manual', releaseId: phys.current.releaseId, angle: phys.current.releaseAngle, turns: 0 };
      setTaps(0);
      setElapsed(0);
      setRunning(true);
      setInterrupted(false);
      setResult(null);
      sfx('click');
    } else {
      const time = Math.max(0, (performance.now() + lag - watch.current.start) / 1000);
      watch.current.running = false;
      setRunning(false);
      setElapsed(time);
      setNInput(taps ? String(taps) : '');
      const environment = timingConditions.current!;
      const endSpeed = windAt(useGame.getState(), clock.t);
      setAsk({ time, technique: { ...timingTechnique.current, turns: watch.current.motion.turns }, environment: { ...environment, wind: { ...environment.wind!, endSpeed, changed: Math.abs(endSpeed - environment.wind!.speed) > .1 } } });
      flag('pend-timed');
      sfx('click');
    }
  };
  const tap = () => {
    if (watch.current.running) {
      setTaps((n) => n + 1);
      sfx('tick');
    }
  };

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.repeat || ask || (e.target instanceof HTMLElement && (e.target.closest('input, textarea, select, button, summary, a, [role="button"], [role="link"]') || e.target.isContentEditable))) return;
      if (e.code === 'Space') {
        e.preventDefault();
        toggleWatch();
      } else if (e.code === 'KeyC' || e.code === 'Enter') tap();
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  });

  const release = () => {
    phys.current.th = amp * DEG;
    phys.current.om = 0;
    phys.current.releaseAngle = amp;
    phys.current.releaseId = `${Date.now()}:${++releaseSerial}`;
    phys.current.swinging = true;
    phys.current.trail = [];
    sfx('metal');
    flag('pend-released');
  };
  const stopSwing = () => {
    sfx('metal');
    phys.current.swinging = false;
    phys.current.th = 0;
    phys.current.om = 0;
    phys.current.releaseAngle = 0;
  };

  const layout = (w: number, h: number) => {
    // Leave room for the HUD on top and the stopwatch below.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const top = (hudHeight() + 14) * dpr;
    const bottom = 140 * dpr;
    const ppm = (h - top - bottom) / 3.3;
    return { px: w / 2, py: top, ppm };
  };

  return (
    <div className="tool">
      <div className="tool-stage">
        <CanvasView
          onPointerDown={(e) => {
            if (phys.current.swinging || watch.current.running || ask) return;
            phys.current.dragging = true;
            (e.target as Element).setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!phys.current.dragging) return;
            const p = canvasPoint(e);
            const c = e.currentTarget;
            const { px, py } = layout(c.width, c.height);
            const a = Math.atan2(p.x - px, p.y - py) / DEG;
            const clamped = Math.max(-35, Math.min(35, a));
            phys.current.th = clamped * DEG;
            setAmp(Math.round(Math.abs(clamped) * 2) / 2);
          }}
          onPointerUp={() => {
            if (!phys.current.dragging) return;
            phys.current.dragging = false;
            if (Math.abs(phys.current.th) > 0.5 * DEG) {
              phys.current.om = 0;
              phys.current.releaseAngle = Math.abs(phys.current.th / DEG);
              phys.current.releaseId = `${Date.now()}:${++releaseSerial}`;
              phys.current.swinging = true;
              phys.current.trail = [];
              sfx('metal');
              flag('pend-released');
            }
          }}
          onPointerCancel={() => { phys.current.dragging = false; }}
          draw={({ ctx, w, h, dpr, now, dt: frameDt }) => {
            // The swing keeps real time, like the stopwatch: a slow frame must not slow it
            // down (the canvas caps each frame at 0.1 s, which made g come out low).
            const dt = lastFrame.current === null ? frameDt : Math.min(2, Math.max(0, (now - lastFrame.current) / 1000));
            lastFrame.current = now;
            paintSky(ctx, { az: 143 * DEG, alt: 25 * DEG, fov: 80 * DEG, w, h }, sys, catalog, land, clock.t, now, dpr);
            ctx.fillStyle = 'rgba(4,6,12,0.35)';
            ctx.fillRect(0, 0, w, h);
            const P = phys.current;
            const tw = clock.t;
            const push = windBiases(useGame.getState(), tw, screen) ? windPush(windAt(useGame.getState(), tw)) : 0;
            const tilt = Math.atan(push);
            if (!P.swinging && !P.dragging) P.th = tilt;
            // RK4 integration of the full (non-linear) pendulum.
            if (P.swinging) {
              const n = Math.max(1, Math.ceil(dt * 600));
              const hstep = dt / n;
              // A strong steady wind pushes the bob sideways: the swing centres off vertical and
              // quickens, as if gravity were a little stronger (anomaly, harder modes only).
              const gEff = g * Math.sqrt(1 + push * push);
              const f = (th: number) => (-gEff / trueL) * Math.sin(th - tilt);
              for (let i = 0; i < n; i++) {
                const k1t = P.om;
                const k1o = f(P.th);
                const k2t = P.om + (hstep / 2) * k1o;
                const k2o = f(P.th + (hstep / 2) * k1t);
                const k3t = P.om + (hstep / 2) * k2o;
                const k3o = f(P.th + (hstep / 2) * k2t);
                const k4t = P.om + hstep * k3o;
                const k4o = f(P.th + hstep * k3t);
                P.th += (hstep / 6) * (k1t + 2 * k2t + 2 * k3t + k4t);
                P.om += (hstep / 6) * (k1o + 2 * k2o + 2 * k3o + k4o);
                if (watch.current.running) observeSwingMotion(watch.current.motion, P.om);
              }
            }
            const { px, py, ppm } = layout(w, h);
            if (screen) {
              ctx.fillStyle = 'rgba(112,151,179,.12)';
              ctx.fillRect(px - 1.18 * ppm, py + .7 * ppm, 2.36 * ppm, 2.5 * ppm);
              ctx.strokeStyle = 'rgba(134,180,207,.25)';
              ctx.lineWidth = dpr;
              for (let seam = .9; seam < 3.2; seam += .35) {
                ctx.beginPath(); ctx.moveTo(px - 1.18 * ppm, py + seam * ppm); ctx.lineTo(px + 1.18 * ppm, py + seam * ppm); ctx.stroke();
              }
              ctx.fillStyle = 'rgba(112,151,179,.35)';
              ctx.strokeStyle = '#86b4cf';
              ctx.lineWidth = 2 * dpr;
              for (const side of [-1, 1]) {
                const x = px + side * 1.18 * ppm;
                ctx.fillRect(x - .08 * ppm, py + .7 * ppm, .16 * ppm, 2.5 * ppm);
                ctx.strokeRect(x - .08 * ppm, py + .7 * ppm, .16 * ppm, 2.5 * ppm);
              }
            }
            setInstrument('pendulum', P.swinging ? Math.min(0.6, Math.abs(P.om) * 0.8) : 0, Math.min(1, Math.abs(P.th) / (20 * DEG)));
            // Ground under the rig.
            const gy = py + 3.25 * ppm;
            const gr = ctx.createLinearGradient(0, gy - 10 * dpr, 0, h);
            gr.addColorStop(0, 'rgba(40,32,26,0.95)');
            gr.addColorStop(1, 'rgba(12,10,8,1)');
            ctx.fillStyle = gr;
            ctx.fillRect(0, gy, w, h - gy);
            // Timber A-frame with a steel crossbar.
            const beam = (x1: number, y1: number, x2: number, y2: number, wpx: number) => {
              const g2 = ctx.createLinearGradient(x1 - wpx, 0, x1 + wpx, 0);
              g2.addColorStop(0, '#5b3f26');
              g2.addColorStop(0.5, '#8a6440');
              g2.addColorStop(1, '#4a321e');
              ctx.strokeStyle = g2;
              ctx.lineWidth = wpx;
              ctx.lineCap = 'round';
              ctx.beginPath();
              ctx.moveTo(x1, y1);
              ctx.lineTo(x2, y2);
              ctx.stroke();
            };
            beam(px - 0.95 * ppm, gy, px - 0.22 * ppm, py, 10 * dpr);
            beam(px + 0.95 * ppm, gy, px + 0.22 * ppm, py, 10 * dpr);
            ctx.strokeStyle = '#aab4c6';
            ctx.lineWidth = 7 * dpr;
            ctx.beginPath();
            ctx.moveTo(px - 0.35 * ppm, py);
            ctx.lineTo(px + 0.35 * ppm, py);
            ctx.stroke();
            ctx.fillStyle = '#dfe6f2';
            ctx.beginPath();
            ctx.arc(px, py, 5 * dpr, 0, Math.PI * 2);
            ctx.fill();
            // Protractor.
            ctx.strokeStyle = 'rgba(255,255,255,0.25)';
            ctx.lineWidth = dpr;
            const pr = 0.45 * ppm;
            for (let a = -30; a <= 30; a += 2) {
              const len = a % 10 === 0 ? 14 : a % 5 === 0 ? 9 : 5;
              const s = Math.sin(a * DEG);
              const c = Math.cos(a * DEG);
              ctx.beginPath();
              ctx.moveTo(px + s * pr, py + c * pr);
              ctx.lineTo(px + s * (pr + len * dpr), py + c * (pr + len * dpr));
              ctx.stroke();
              if (a % 10 === 0) {
                ctx.fillStyle = 'rgba(255,255,255,0.5)';
                ctx.font = `${10 * dpr}px Inter`;
                ctx.textAlign = 'center';
                ctx.fillText(`${Math.abs(a)}°`, px + s * (pr + 26 * dpr), py + c * (pr + 26 * dpr) + 3 * dpr);
              }
            }
            // String and bob.
            const bx = px + Math.sin(P.th) * trueL * ppm;
            const by = py + Math.cos(P.th) * trueL * ppm;
            P.trail.push({ x: bx, y: by });
            if (P.trail.length > 18) P.trail.shift();
            P.trail.forEach((q, i) => {
              ctx.fillStyle = `rgba(255,200,110,${(i / P.trail.length) * 0.12})`;
              ctx.beginPath();
              ctx.arc(q.x, q.y, BOB_R * ppm, 0, Math.PI * 2);
              ctx.fill();
            });
            ctx.strokeStyle = 'rgba(235,235,225,0.9)';
            ctx.lineWidth = 1.5 * dpr;
            ctx.beginPath();
            ctx.moveTo(px, py);
            ctx.lineTo(bx, by);
            ctx.stroke();
            const r = Math.max(8 * dpr, BOB_R * ppm);
            const grad = ctx.createRadialGradient(bx - r * 0.35, by - r * 0.35, r * 0.1, bx, by, r);
            grad.addColorStop(0, '#fff1c4');
            grad.addColorStop(0.35, '#e2b25a');
            grad.addColorStop(1, '#6b4a17');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(bx, by, r, 0, Math.PI * 2);
            ctx.fill();
            // Soft shadow on the ground.
            ctx.fillStyle = 'rgba(0,0,0,0.45)';
            ctx.beginPath();
            ctx.ellipse(bx, py + 3.25 * ppm + 4 * dpr, r * 2.2, r * 0.45, 0, 0, Math.PI * 2);
            ctx.fill();
            void now;
          }}
        />
        {celebrate && <div className="panel panel-pad pendulum-milestone" role="status" aria-label="Twenty-swing celebration"><b>✦ Twenty-swing observation kept</b><div>Technique milestone · cosmetic · 0 score points</div></div>}
        <div className="panel panel-pad stage-bottom" style={{ padding: '8px 12px' }} data-tut="pend-watch">
          <div className="pendulum-clock" aria-label="Pendulum clock status">
            <b>Rig &amp; watch: real time</b>
            <span>{clock.paused ? 'Expedition paused' : 'Expedition: 1×'} · saved warp: {WARPS[clock.warpIndex].label}</span>
          </div>
          <div className="row" style={{ justifyContent: 'center', gap: 10, flexWrap: 'nowrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="readout" style={{ minWidth: 120, fontSize: 24 }}>{fmtWatch(elapsed)}</div>
              <div className="muted" style={{ fontSize: 12 }}>full swings tapped: {taps}</div>
            </div>
            <button className={`btn big ${running ? 'danger' : 'primary'}`} onClick={toggleWatch} style={{ minWidth: 86, padding: '10px 14px' }}>
              {running ? 'Stop' : 'Start'}
            </button>
            <button className="btn big" onClick={tap} disabled={!running} style={{ padding: '10px 14px' }}>
              +1
            </button>
          </div>
          {interrupted && <div className="amber" role="status" style={{ fontSize: 11, textAlign: 'center' }}>Timing interrupted while hidden. Release the bob and time again.</div>}
          <div className="faint hide-phone" style={{ fontSize: 11, textAlign: 'center', marginTop: 4 }}>
            Space = start/stop · C = count a swing
          </div>
        </div>
      </div>

      <div className="tool-side">
        <ToolHeader title="Pendulum rig" sub="Surface gravity from the period of a pendulum. Operate the rig and stopwatch at real time." />
        <details className="panel panel-pad measurement-help"><summary>Time while measuring</summary><p>The bob and stopwatch use real elapsed time, even when the expedition is paused. An unpaused expedition advances one game second per real second here, consuming its usual air/time. Warp controls are disabled while using the rig.</p><p>Leaving the rig restores the saved warp setting; the expedition keeps its current pause/resume state. Leaving during timing abandons that unfinished timing.</p></details>
        <div className="panel panel-pad stack" aria-label="Pendulum conditions">
          <b>Wind protection</b>
          <button className="btn small" aria-pressed={screen} disabled={running || !!ask} onClick={() => { const s = useGame.getState(); s.set({ instrumentSetup: { ...s.instrumentSetup, pendulumScreen: !screen } }); stopSwing(); }}>{screen ? 'Remove windscreen' : 'Fit windscreen'}</button>
          <div className="muted" style={{ fontSize: 12 }}>{screen ? 'The fitted screen shelters the bob from the modeled crosswind. Length, timing and release-angle errors still need care.' : 'A folding windscreen is in the instrument kit. Fit it before timing, or return in calmer conditions.'}</div>
          <details className="measurement-help"><summary>Conditions and methods</summary><p>A steady wind tilts the swing and can bias gravity high. Compare sheltered and exposed timings at the same length, or return to camp and use the clock to wait for calmer conditions. Average independent timings for random scatter; shared ruler or counting errors need separate care.</p></details>
        </div>
        <div className="panel panel-pad stack">
          <b>1 · Set the string length</b>
          <input data-tut="pend-length" type="range" min={0.6} max={3} step={0.1} aria-label="String length setting" value={nominal} onChange={(e) => { stopSwing(); setNominal(Number(e.target.value)); }} disabled={running || !!ask} />
          <div className="muted" style={{ fontSize: 13 }}>Knob setting ≈ {fmt(nominal, 1)} m — the exact length depends on the knot. Measure it:</div>
          <b>2 · Measure it on the scale</b>
          <div data-tut="pend-scale">
            <Scale trueL={trueL} nominal={nominal} value={lRead} disabled={running || !!ask} onChange={(v) => (setLRead(v), flag('pend-measured'))} />
          </div>
          <div className="row between">
            <span className="muted">Your reading (pivot → bob centre)</span>
            <span className="readout small">{lRead === null ? '—' : `${fmt(lRead, 4)} m`}</span>
          </div>
          <b>3 · Release and time it</b>
          <div className="row" data-tut="pend-release">
            <span className="muted" style={{ fontSize: 13 }}>Release angle {fmt(amp, 1)}°</span>
            <input type="range" aria-label="Release angle" disabled={running || !!ask} min={1} max={30} step={0.5} value={amp} onChange={(e) => setAmp(Number(e.target.value))} style={{ flex: 1 }} />
          </div>
          <div className="row" data-tut="pend-release">
            <button className="btn primary" onClick={release} disabled={running || !!ask}>
              Release
            </button>
            <button className="btn" onClick={stopSwing} disabled={running || !!ask}>
              Stop pendulum
            </button>
          </div>
          <div className="hint">
            Start the watch as the bob passes one end, count full swings (there and back), stop on the same end. More swings → smaller error. Big
            release angles make the swing slower than the simple formula predicts.
          </div>
          <Formula>g = 4π² L / T²,  T = time / N</Formula>
          <div className="faint">Manual start/stop and swing counting · mouse, touch or keyboard</div>
          <TimingComparison period={result?.T ?? latest?.pendulum?.period} swings={result?.N ?? latest?.pendulum?.swings} source={result ? 'Your current timing' : 'Your latest kept timing'} />
          <WindGauge />
        </div>

        {result && (
          <div className="panel panel-pad stack" data-tut="pend-result">
            <b>Result</b>
            <dl className="kv">
              <dt>Time for {result.N} swings</dt>
              <dd>{fmt(result.time, 2)} s</dd>
              <dt>Period T</dt>
              <dd>{fmt(result.T, 4)} s</dd>
              <dt>Length L</dt>
              <dd>{fmt(result.L, 4)} m</dd>
              <dt>Gravity g</dt>
              <dd className="blue">{fmt(result.g, 4)} m/s²</dd>
            </dl>
            <div className="muted" style={{ fontSize: 12 }}>Instrument result with {result.environment.wind?.protection === 'windscreen' ? 'your windscreen' : result.environment.wind?.protection === 'echo' ? 'ECHO physical stabilization' : 'an exposed rig'}; no numerical wind correction was applied.</div>
            <GravityMeaning value={result.g} source="This instrument result" />
            <SanityWarning
              attempt={result}
              msgs={[
                (result.g < 2 || result.g > 40) && 'That is not a plausible gravity for a planet you can stand on. Did you enter the right number of swings?',
                result.N < 5 && 'Fewer than 5 swings: your reaction time dominates this reading. Time more swings for a better result.',
                result.amp > 15 && `A ${fmt(result.amp, 0)}° release makes the swing slower than the formula assumes, so this g is too small.`,
                result.environment.wind?.changed && 'Wind conditions changed during this timing. Repeat in stable conditions or fit the windscreen.',
                outlierNote(result.g, keptG, 0.08),
              ]}
            />
            <div className="row">
              <button
                className="btn primary"
                onClick={() => {
                  const already = (useGame.getState().pendulumMilestones ?? []).includes('twentySwings');
                  addReading({ key: 'g', value: result.g, at: result.environment.at, note: `L ${fmt(result.L, 3)} m · ${result.N} sw · ${fmt(result.amp, 0)}°`, pendulum: { length: result.L, period: result.T, swings: result.N, time: result.time, technique: result.technique }, environment: result.environment });
                  setResult(null);
                  const earned = !already && useGame.getState().pendulumMilestones.includes('twentySwings');
                  if (earned) setCelebrate(true);
                  sfx(earned ? 'unlock' : 'good');
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

        <div className="panel panel-pad" data-tut="pend-log">
          <b>Gravity log</b>
          <ReadingsTable k="g" />
          <SendReadings k="g" tut="pend-send" />
          {(estimate || latest) && <GravityMeaning value={(estimate ?? latest)!.value} sigma={estimate?.sigma} source={estimate ? 'Your progress-sheet estimate' : 'Your latest kept reading'} />}
        </div>
        <TechniqueReview />
        <ReadingPredictionPractice kind="pendulum" currentLength={lRead} resultPending={!!result || running || !!ask} />
        {keptG.length > 0 && !running && !ask && <PendulumPrediction nominal={nominal} setNominal={setNominal} keptG={keptG} g={g} />}
      </div>

      {ask && (
        <Modal>
          <div data-tut="pend-count">
          <h2>How many full swings?</h2>
          <p className="muted">
            You timed {fmt(ask.time, 2)} s. A full swing is there and back. {taps ? `You tapped ${taps}.` : ''}
          </p>
          <input className="input" autoFocus inputMode="numeric" value={nInput} onChange={(e) => setNInput(e.target.value.replace(/\D/g, ''))} />
          {lRead === null && <p className="amber" style={{ fontSize: 13 }}>You haven’t measured the string length yet — cancel, measure it on the scale, then time the swings again.</p>}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn" onClick={() => setAsk(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={lRead === null || !pendulumReading(lRead, ask.time, Number(nInput))}
              onClick={() => {
                const N = Number(nInput);
                const reading = lRead === null ? null : pendulumReading(lRead, ask.time, N);
                if (!reading) return;
                setResult({ N, T: reading.period, time: ask.time, L: lRead!, amp: ask.technique.angle, technique: ask.technique, g: reading.gravity, environment: { ...ask.environment, rawValue: reading.gravity } });
                setAsk(null);
                flag('pend-result');
              }}
            >
              Calculate g
            </button>
          </div>
        </div>
        </Modal>
      )}
    </div>
  );
}

let hudPx = 0;
export function hudHeight() {
  if (!hudPx) hudPx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--hud-h')) || 70;
  return hudPx;
}
window.addEventListener('resize', () => (hudPx = 0));

const fmtWatch = (s: number) => {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${(s - m * 60).toFixed(2).padStart(5, '0')}`;
};

/** A magnified ruler at the bob: drag the hairline onto the bob's centre. */
function Scale({ trueL, nominal, value, onChange, disabled }: { trueL: number; nominal: number; value: number | null; onChange: (v: number) => void; disabled: boolean }) {
  const span = 0.1; // m shown
  const x0 = nominal - span / 2;
  const toX = (L: number, w: number) => ((L - x0) / span) * w;
  const drag = useRef(false);
  const set = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = canvasPoint(e);
    onChange(x0 + (p.x / e.currentTarget.width) * span);
  };
  return (
    <div style={{ height: 96, position: 'relative', borderRadius: 10, overflow: 'hidden', border: '1px solid var(--panel-border)' }}>
      <CanvasView
        aria-label="Length scale; align the hairline with the bob centre" aria-disabled={disabled}
        onPointerDown={(e) => {
          if (disabled) return;
          drag.current = true;
          (e.target as Element).setPointerCapture(e.pointerId);
          set(e);
        }}
        onPointerMove={(e) => !disabled && drag.current && set(e)}
        onPointerUp={() => (drag.current = false)}
        onPointerCancel={() => (drag.current = false)}
        draw={({ ctx, w, h, dpr }) => {
          ctx.fillStyle = '#e9dcc0';
          ctx.fillRect(0, 0, w, h);
          // Ruler ticks (mm).
          ctx.fillStyle = '#2b2116';
          ctx.font = `${10 * dpr}px JetBrains Mono`;
          ctx.textAlign = 'center';
          for (let mm = Math.ceil(x0 * 1000); mm <= (x0 + span) * 1000; mm++) {
            const x = toX(mm / 1000, w);
            const len = mm % 10 === 0 ? 0.36 : mm % 5 === 0 ? 0.24 : 0.14;
            ctx.fillRect(x - 0.5 * dpr, 0, dpr, h * len);
            if (mm % 10 === 0) ctx.fillText((mm / 1000).toFixed(2), x, h * 0.48);
          }
          // String and bob seen against the ruler.
          const by = h * 0.74;
          const bx = toX(trueL, w);
          ctx.strokeStyle = '#444';
          ctx.lineWidth = 1.2 * dpr;
          ctx.beginPath();
          ctx.moveTo(0, by);
          ctx.lineTo(bx, by);
          ctx.stroke();
          const r = (BOB_R / span) * w;
          const grad = ctx.createRadialGradient(bx - r * 0.3, by - r * 0.3, 1, bx, by, r);
          grad.addColorStop(0, '#fff1c4');
          grad.addColorStop(0.4, '#d9a64e');
          grad.addColorStop(1, '#6b4a17');
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(bx, by, Math.min(r, h * 0.24), 0, Math.PI * 2);
          ctx.fill();
          if (value !== null) {
            const x = toX(value, w);
            ctx.fillStyle = '#e02f4a';
            ctx.fillRect(x - 0.75 * dpr, 0, 1.5 * dpr, h);
          }
        }}
      />
    </div>
  );
}

/** Knot offset of the string at a knob setting (the same hidden offset the rig uses). */
const knotL = (seed: number, nominal: number) => nominal + ((hash32(seed, Math.round(nominal * 100)) / 4294967296) * 3 - 1.5) / 100;

/** "Use a ratio": predict the swing time at a new length before trying it. */
function PendulumPrediction({ nominal, setNominal, keptG, g }: { nominal: number; setNominal: (v: number) => void; keptG: number[]; g: number }) {
  const { system: sys } = currentWorld();
  const preds = useGame((s) => s.predictions).filter((p) => p.kind === 'pendulum');
  const tutorial = useGame((s) => s.tutorial.active);
  const mode = useMode();
  const [shown, setShown] = useState<string | null>(null);
  if (tutorial || preds.length >= 2) {
    const last = preds[preds.length - 1];
    return last?.result && shown === last.id ? (
      <div className="panel panel-pad">
        <div className="hint">{explain(last, mode.coaching)}</div>
      </div>
    ) : null;
  }
  const k = nominal >= 2.4 ? 0.25 : nominal <= 0.75 ? 4 : nominal >= 1.5 ? 0.5 : 2;
  const L2 = Math.round(nominal * k * 10) / 10;
  const gMean = keptG.reduce((a, b) => a + b, 0) / keptG.length;
  const own = 2 * Math.PI * Math.sqrt(L2 / gMean);
  const last = preds[preds.length - 1] ?? null;
  return (
    <div className="panel panel-pad stack">
      {last?.result && shown === last.id && <div className="hint">{explain(last, mode.coaching)}</div>}
      <PredictCard
        kind="pendulum"
        question={
          <>
            Your string is set to about <b>{fmt(nominal, 1)} m</b>. If you set it to <b>{fmt(L2, 1)} m</b> ({k > 1 ? `${k}×` : `1/${1 / k}`} the length), how long
            will one full swing take? Predict first, then try it.
          </>
        }
        helper={`Use a ratio: swing time grows with the square root of the length. ${k > 1 ? `${k}× longer` : `${1 / k}× shorter`} means √${k > 1 ? k : 1 / k} = ${fmt(Math.sqrt(k > 1 ? k : 1 / k), 2)}× ${k > 1 ? 'slower' : 'faster'}.`}
        pts={[]}
        axis="y"
        xMax={0}
        xLabel=""
        yLabel=""
        ownFit={{ value: own }}
        sigma0={0.1}
        sigmaMax={1}
        pending={null}
        last={null}
        onCommit={(value, sigma) => {
          const id = makePrediction({ kind: 'pendulum', made: clock.t, due: clock.t, value, sigma, at: L2 });
          const truth = pendulumPeriod(g, knotL(sys.seed, L2), 3 * DEG);
          resolveNow(id, truth);
          setShown(id);
          setNominal(L2);
          toast(`String set to ${fmt(L2, 1)} m — release it and time it yourself.`);
        }}
      />
    </div>
  );
}
