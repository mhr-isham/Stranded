import { useEffect, useMemo, useRef, useState } from 'react';
import { DEG } from '../../engine/constants';
import { surfaceGravity } from '../../engine/measure';
import { hash32 } from '../../engine/rng';
import { clock } from '../../game/clock';
import { fmt } from '../../game/format';
import { currentWorld } from '../../game/sim';
import { useGame } from '../../game/store';
import { paintSky } from '../../render/paint';
import { makeLandscape } from '../../render/terrain';
import { CanvasView, canvasPoint } from '../common/CanvasView';
import { Formula, ReadingsTable, SanityWarning, SendReadings, ToolHeader, outlierNote } from '../common/sheetBits';
import { Modal } from '../common/widgets';
import { sfx } from '../../game/audio';
import { flag } from '../../game/tutorial';

const BOB_R = 0.025; // m

export function Pendulum() {
  const { system: sys, catalog } = currentWorld();
  const land = useMemo(() => makeLandscape(sys.seed, sys.hillHeight), [sys]);
  const g = surfaceGravity(sys);
  const addReading = useGame((s) => s.addReading);
  const keptG = useGame((s) => s.readings).filter((r) => r.key === 'g' && r.kept).map((r) => r.value);

  const [nominal, setNominal] = useState(1.5); // m, the coarse knob setting
  // The true length differs from the knob by a hidden knot/attachment offset.
  const trueL = nominal + ((hash32(sys.seed, Math.round(nominal * 100)) / 4294967296) * 3 - 1.5) / 100;
  const [lRead, setLRead] = useState<number | null>(null);
  const [amp, setAmp] = useState(6);
  const [taps, setTaps] = useState(0);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [ask, setAsk] = useState<null | { time: number }>(null);
  const [nInput, setNInput] = useState('');
  const [result, setResult] = useState<null | { g: number; T: number; N: number; time: number }>(null);

  const phys = useRef({ th: 0, om: 0, swinging: false, dragging: false, trail: [] as { x: number; y: number }[] });
  const watch = useRef({ start: 0, running: false });

  useEffect(() => {
    clock.realtime = true;
    clock.emit();
    return () => {
      clock.realtime = false;
      clock.emit();
    };
  }, []);

  useEffect(() => setLRead(null), [nominal]);

  // Stopwatch display.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setElapsed((performance.now() - watch.current.start) / 1000), 31);
    return () => clearInterval(id);
  }, [running]);

  const toggleWatch = () => {
    if (!watch.current.running) {
      watch.current = { start: performance.now(), running: true };
      setTaps(0);
      setElapsed(0);
      setRunning(true);
      setResult(null);
      sfx('click');
    } else {
      const time = (performance.now() - watch.current.start) / 1000;
      watch.current.running = false;
      setRunning(false);
      setElapsed(time);
      setNInput(taps ? String(taps) : '');
      setAsk({ time });
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
      if (e.target instanceof HTMLInputElement) return;
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
    phys.current.swinging = true;
    phys.current.trail = [];
    flag('pend-released');
  };
  const stopSwing = () => {
    phys.current.swinging = false;
    phys.current.th = 0;
    phys.current.om = 0;
  };

  const layout = (w: number, h: number) => {
    // Leave room for the HUD on top and the stopwatch below.
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const top = (hudHeight() + 14) * dpr;
    const bottom = 110 * dpr;
    const ppm = (h - top - bottom) / 3.3;
    return { px: w / 2, py: top, ppm };
  };

  return (
    <div className="tool">
      <div className="tool-stage">
        <CanvasView
          onPointerDown={(e) => {
            if (phys.current.swinging) return;
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
              phys.current.swinging = true;
              phys.current.trail = [];
              flag('pend-released');
            }
          }}
          draw={({ ctx, w, h, dpr, now, dt }) => {
            paintSky(ctx, { az: 143 * DEG, alt: 25 * DEG, fov: 80 * DEG, w, h }, sys, catalog, land, clock.t, now, dpr);
            ctx.fillStyle = 'rgba(4,6,12,0.35)';
            ctx.fillRect(0, 0, w, h);
            const P = phys.current;
            // RK4 integration of the full (non-linear) pendulum.
            if (P.swinging) {
              const n = Math.max(1, Math.ceil(dt * 600));
              const hstep = dt / n;
              const f = (th: number) => (-g / trueL) * Math.sin(th);
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
              }
            }
            const { px, py, ppm } = layout(w, h);
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
        <div className="panel panel-pad stage-bottom" style={{ padding: '8px 12px' }} data-tut="pend-watch">
          <div className="row" style={{ justifyContent: 'center', gap: 10, flexWrap: 'nowrap' }}>
            <div style={{ textAlign: 'center' }}>
              <div className="readout" style={{ minWidth: 120, fontSize: 24 }}>{fmtWatch(elapsed)}</div>
              <div className="muted" style={{ fontSize: 12 }}>swings tapped: {taps}</div>
            </div>
            <button className={`btn big ${running ? 'danger' : 'primary'}`} onClick={toggleWatch} style={{ minWidth: 86, padding: '10px 14px' }}>
              {running ? 'Stop' : 'Start'}
            </button>
            <button className="btn big" onClick={tap} disabled={!running} style={{ padding: '10px 14px' }}>
              +1
            </button>
          </div>
          <div className="faint hide-phone" style={{ fontSize: 11, textAlign: 'center', marginTop: 4 }}>
            Space = start/stop · C = count a swing
          </div>
        </div>
      </div>

      <div className="tool-side">
        <ToolHeader title="Pendulum rig" sub="Surface gravity from the period of a pendulum. Clock runs in real time here." />
        <div className="panel panel-pad stack">
          <b>1 · Set the string length</b>
          <input data-tut="pend-length" type="range" min={0.6} max={3} step={0.1} value={nominal} onChange={(e) => setNominal(Number(e.target.value))} disabled={running} />
          <div className="muted" style={{ fontSize: 13 }}>Knob setting ≈ {fmt(nominal, 1)} m — the exact length depends on the knot. Measure it:</div>
          <b>2 · Measure it on the scale</b>
          <div data-tut="pend-scale">
            <Scale trueL={trueL} nominal={nominal} value={lRead} onChange={(v) => (setLRead(v), flag('pend-measured'))} />
          </div>
          <div className="row between">
            <span className="muted">Your reading (pivot → bob centre)</span>
            <span className="readout small">{lRead === null ? '—' : `${fmt(lRead, 4)} m`}</span>
          </div>
          <b>3 · Release and time it</b>
          <div className="row" data-tut="pend-release">
            <span className="muted" style={{ fontSize: 13 }}>Release angle {fmt(amp, 1)}°</span>
            <input type="range" min={1} max={30} step={0.5} value={amp} onChange={(e) => setAmp(Number(e.target.value))} style={{ flex: 1 }} />
          </div>
          <div className="row" data-tut="pend-release">
            <button className="btn primary" onClick={release}>
              Release
            </button>
            <button className="btn" onClick={stopSwing}>
              Stop pendulum
            </button>
          </div>
          <div className="hint">
            Start the watch as the bob passes one end, count full swings (there and back), stop on the same end. More swings → smaller error. Big
            release angles make the swing slower than the simple formula predicts.
          </div>
          <Formula>g = 4π² L / T²,  T = time / N</Formula>
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
              <dd>{fmt(lRead ?? 0, 4)} m</dd>
              <dt>Gravity g</dt>
              <dd className="blue">{fmt(result.g, 4)} m/s²</dd>
            </dl>
            <SanityWarning
              msgs={[
                (result.g < 2 || result.g > 40) && 'That is not a plausible gravity for a planet you can stand on. Did you enter the right number of swings?',
                result.N < 5 && 'Fewer than 5 swings: your reaction time dominates this reading. Time more swings for a better result.',
                amp > 15 && `A ${fmt(amp, 0)}° release makes the swing slower than the formula assumes, so this g is too small.`,
                outlierNote(result.g, keptG, 0.08),
              ]}
            />
            <div className="row">
              <button
                className="btn primary"
                onClick={() => {
                  addReading({ key: 'g', value: result.g, at: clock.t, note: `L ${fmt(lRead ?? 0, 3)} m · ${result.N} sw · ${fmt(amp, 0)}°` });
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

        <div className="panel panel-pad" data-tut="pend-log">
          <b>Gravity log</b>
          <ReadingsTable k="g" />
          <SendReadings k="g" tut="pend-send" />
        </div>
      </div>

      {ask && (
        <Modal>
          <div data-tut="pend-count" />
          <h2>How many full swings?</h2>
          <p className="muted">
            You timed {fmt(ask.time, 2)} s. A full swing is there and back. {taps ? `You tapped ${taps}.` : ''}
          </p>
          <input className="input" autoFocus inputMode="numeric" value={nInput} onChange={(e) => setNInput(e.target.value.replace(/\D/g, ''))} />
          {lRead === null && <p className="amber" style={{ fontSize: 13 }}>You haven’t measured the string length yet — measure it on the scale first.</p>}
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn" onClick={() => setAsk(null)}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={!Number(nInput) || lRead === null}
              onClick={() => {
                const N = Number(nInput);
                const T = ask.time / N;
                setResult({ N, T, time: ask.time, g: (4 * Math.PI ** 2 * (lRead ?? 0)) / (T * T) });
                setAsk(null);
                flag('pend-result');
              }}
            >
              Calculate g
            </button>
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
function Scale({ trueL, nominal, value, onChange }: { trueL: number; nominal: number; value: number | null; onChange: (v: number) => void }) {
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
        onPointerDown={(e) => {
          drag.current = true;
          (e.target as Element).setPointerCapture(e.pointerId);
          set(e);
        }}
        onPointerMove={(e) => drag.current && set(e)}
        onPointerUp={() => (drag.current = false)}
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
