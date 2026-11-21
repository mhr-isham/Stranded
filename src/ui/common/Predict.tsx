// The prediction card: plot your own data with the future marked, drag your
// guess onto it, set an honest ± range, commit. The estimate helper teaches the
// three moves (extend the line, use a ratio, bracket it); easier modes can show
// the player's own trend line, and warn when a guess ignores their own data.

import { useRef, useState, type ReactNode } from 'react';
import { useMode } from '../../game/modes';
import { useGame } from '../../game/store';
import { PREDICTION_KINDS, explain, type Prediction, type PredictionKind } from '../../game/predictions';
import { LessonModal } from '../tutorial/Tutorial';
import type { Pt } from './Chart';

const W = 380;
const H = 230;
const L = 46;
const R = 12;
const T = 12;
const B = 30;

interface PlotProps {
  pts: Pt[];
  /** 'y': guess a value at a fixed time xT. 'x': guess the time of an event. */
  axis: 'x' | 'y';
  xT?: number;
  xMax: number;
  guess: number | null;
  sigma: number;
  onGuess: (v: number) => void;
  trend?: Pt[] | null;
  truth?: number | null;
  xLabel: string;
  yLabel: string;
}

/** A small SVG plot of the player's data, extended into the future. */
export function PredictPlot({ pts, axis, xT, xMax, guess, sigma, onGuess, trend, truth, xLabel, yLabel }: PlotProps) {
  const svg = useRef<SVGSVGElement>(null);
  const dragging = useRef(false);
  const xs = pts.map((p) => p.x);
  const x0 = Math.min(...xs);
  const xNow = Math.max(...xs);
  const x1 = Math.max(xMax, xNow + 1);
  const ysAll = [...pts.map((p) => p.y), ...(trend ?? []).map((p) => p.y)];
  if (axis === 'y' && guess !== null) ysAll.push(guess - sigma, guess + sigma);
  if (axis === 'y' && truth != null) ysAll.push(truth);
  let y0 = Math.min(...ysAll);
  let y1 = Math.max(...ysAll);
  const pad = (y1 - y0) * 0.15 || 1;
  y0 -= pad;
  y1 += pad;
  const X = (x: number) => L + ((x - x0) / (x1 - x0)) * (W - L - R);
  const Y = (y: number) => H - B - ((y - y0) / (y1 - y0)) * (H - B - T);
  const fromPx = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W;
    const py = ((e.clientY - r.top) / r.height) * H;
    return axis === 'y' ? y0 + ((H - B - py) / (H - B - T)) * (y1 - y0) : Math.max(xNow, x0 + ((px - L) / (W - L - R)) * (x1 - x0));
  };
  const set = (e: React.PointerEvent) => onGuess(fromPx(e));
  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${W} ${H}`}
      className="predict-plot"
      onPointerDown={(e) => {
        (e.target as Element).setPointerCapture?.(e.pointerId);
        dragging.current = true;
        set(e);
      }}
      onPointerMove={(e) => dragging.current && set(e)}
      onPointerUp={() => (dragging.current = false)}
    >
      <rect x={X(xNow)} y={T} width={W - R - X(xNow)} height={H - B - T} fill="rgba(108,196,255,0.06)" />
      <text x={X(xNow) + 6} y={T + 14} fill="#6cc4ff" fontSize={11}>
        future →
      </text>
      <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="rgba(255,255,255,0.15)" />
      <line x1={L} x2={L} y1={T} y2={H - B} stroke="rgba(255,255,255,0.15)" />
      {[0, 0.5, 1].map((f) => (
        <text key={f} x={L - 6} y={Y(y0 + f * (y1 - y0)) + 4} fill="#93a2c3" fontSize={11} textAnchor="end">
          {(y0 + f * (y1 - y0)).toFixed(1)}
        </text>
      ))}
      {[0, 0.5, 1].map((f) => (
        <text key={f} x={X(x0 + f * (x1 - x0))} y={H - 10} fill="#93a2c3" fontSize={11} textAnchor="middle">
          {(x0 + f * (x1 - x0)).toFixed(0)}
        </text>
      ))}
      <text x={W - R} y={H - B - 6} fill="#5d6a88" fontSize={11} textAnchor="end">
        {xLabel}
      </text>
      <text x={L + 4} y={T + 10} fill="#5d6a88" fontSize={11}>
        {yLabel}
      </text>
      {trend && trend.length > 1 && (
        <polyline points={trend.map((p) => `${X(p.x)},${Y(p.y)}`).join(' ')} fill="none" stroke="rgba(108,196,255,0.55)" strokeDasharray="5 4" strokeWidth={1.5} />
      )}
      {pts.map((p, i) => (
        <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={2.6} fill="#ffc46b" />
      ))}
      {axis === 'y' && xT !== undefined && <line x1={X(xT)} x2={X(xT)} y1={T} y2={H - B} stroke="rgba(255,196,107,0.35)" strokeDasharray="3 3" />}
      {guess !== null && axis === 'y' && xT !== undefined && (
        <g>
          <line x1={X(xT)} x2={X(xT)} y1={Y(guess - sigma)} y2={Y(guess + sigma)} stroke="#6cc4ff" strokeWidth={3} />
          <circle cx={X(xT)} cy={Y(guess)} r={6} fill="#6cc4ff" stroke="#fff" strokeWidth={1.5} />
        </g>
      )}
      {guess !== null && axis === 'x' && (
        <g>
          <rect x={X(guess - sigma)} y={T} width={Math.max(2, X(guess + sigma) - X(guess - sigma))} height={H - B - T} fill="rgba(108,196,255,0.16)" />
          <line x1={X(guess)} x2={X(guess)} y1={T} y2={H - B} stroke="#6cc4ff" strokeWidth={2} />
        </g>
      )}
      {truth != null && axis === 'y' && xT !== undefined && <circle cx={X(xT)} cy={Y(truth)} r={5} fill="#5be3a4" />}
      {truth != null && axis === 'x' && <line x1={X(truth)} x2={X(truth)} y1={T} y2={H - B} stroke="#5be3a4" strokeWidth={2} />}
    </svg>
  );
}

interface CardProps {
  kind: PredictionKind;
  fieldTrial?: boolean;
  disabled?: boolean;
  question: ReactNode;
  helper: ReactNode;
  pts: Pt[];
  axis: 'x' | 'y';
  xT?: number;
  xMax: number;
  xLabel: string;
  yLabel: string;
  /** The player's own best-fit prediction (from their data), for the trend line and the "your data says" nudge. */
  ownFit?: { value: number; line?: Pt[] } | null;
  /** Starting ± range. */
  sigma0: number;
  sigmaMax: number;
  pending: Prediction | null;
  last: Prediction | null;
  onCommit: (value: number, sigma: number) => void;
  /** Extra controls (e.g. choosing the target day). */
  extra?: ReactNode;
}

/** A complete prediction: open question, helper, plot, range, commit; or the pending / revealed state. */
export function PredictCard(p: CardProps) {
  const mode = useMode();
  const cadetGuidanceOff = useGame((s) => s.settings.difficulty === 'cadet' && s.settings.cadetGuidance === false && !s.tutorial.active);
  const coaching = mode.coaching && !cadetGuidanceOff;
  const info = PREDICTION_KINDS[p.kind];
  const [entry, setEntry] = useState('');
  const guess = entry.trim() && Number.isFinite(Number(entry)) ? Number(entry) : null;
  const setGuess = (value: number) => setEntry(value.toFixed(info.digits));
  const [sigma, setSigma] = useState(p.sigma0);
  const [trend, setTrend] = useState(false);
  const [lesson, setLesson] = useState(false);
  const fmt = (v: number) => v.toFixed(info.digits);
  const unitText = info.unit === 'day' ? 'days' : info.unit;

  if (p.pending) {
    return (
      <div className="predict panel-inset stack">
        <b>🎯 Your prediction</b>
        <div className="muted" style={{ fontSize: 13 }}>
          {info.unit === 'day' ? `Day ${fmt(p.pending.value)}` : `${fmt(p.pending.value)} ${info.unit}`} ± {fmt(p.pending.sigma)} {unitText}
          {p.pending.at !== undefined && p.kind === 'star' ? ` on day ${p.pending.at.toFixed(0)}` : ''}. ECHO will tell you how it went when the time comes — keep warping.
        </div>
      </div>
    );
  }

  const nudge =
    mode.sanity && coaching && !p.fieldTrial && guess !== null && p.ownFit && Math.abs(guess - p.ownFit.value) > Math.max(3 * sigma, 3 * info.scale)
      ? p.ownFit.value
      : null;

  return (
    <div className="predict panel-inset stack">
      <div className="row between">
        <b>{p.fieldTrial ? 'Set your forecast' : info.title}</b>
        {!p.fieldTrial && <button className="btn small ghost" onClick={() => setLesson(true)}>
          How to estimate
        </button>}
      </div>
      {p.last?.result && (
        <div className="hint" style={{ fontSize: 12 }}>
          Last time: {explain(p.last, false)}
        </div>
      )}
      <div style={{ fontSize: 14 }}>{p.question}</div>
      {coaching && <details className="measurement-help"><summary>Use the log to estimate</summary><p>{p.helper}</p></details>}
      {p.extra}
      {p.pts.length > 0 && (
      <PredictPlot
        pts={p.pts}
        axis={p.axis}
        xT={p.xT}
        xMax={p.xMax}
        guess={guess}
        sigma={sigma}
        onGuess={setGuess}
        trend={trend && p.ownFit?.line ? p.ownFit.line : null}
        xLabel={p.xLabel}
        yLabel={p.yLabel}
      />
      )}
      {p.pts.length > 0 && (
        <div className="faint" style={{ fontSize: 12 }}>
          {p.axis === 'y' ? 'Tap or drag on the dashed line to place your guess.' : 'Tap or drag in the future area to place your guess.'}
        </div>
      )}
      {mode.missions !== 'off' && p.ownFit?.line && (
        <label className="check-line">
          <input type="checkbox" checked={trend} onChange={(e) => setTrend(e.target.checked)} />
          <span>Show the straight line through my readings</span>
        </label>
      )}
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 1 }}>
          <label>Forecast ({info.unit === 'day' ? 'day' : info.unit})</label>
          <input
            className="input"
            inputMode="decimal"
            aria-label={`Forecast (${info.unit})`}
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1.4 }}>
          <label>
            ± range: {fmt(sigma)} {unitText}
          </label>
          <input
            type="range"
            aria-label="Forecast range"
            min={Math.log(info.scale / 10)}
            max={Math.log(p.sigmaMax)}
            step={0.01}
            value={Math.log(sigma)}
            onChange={(e) => setSigma(Math.exp(Number(e.target.value)))}
          />
        </div>
      </div>
      {nudge !== null && (
        <div className="callout warn" style={{ margin: 0 }}>
          <b>Your data says otherwise</b>
          Your own readings point to about {info.unit === 'day' ? `day ${fmt(nudge)}` : `${fmt(nudge)} ${info.unit}`}.{' '}
          <button className="btn small" onClick={() => setGuess(nudge)}>
            Use my data
          </button>
        </div>
      )}
      <button className="btn primary" disabled={p.disabled || guess === null || (p.kind === 'pendulum' && guess <= 0)} onClick={() => guess !== null && p.onCommit(guess, sigma)}>
        {p.fieldTrial ? 'Log forecast' : 'Commit prediction'}
      </button>
      {!p.fieldTrial && <div className="faint" style={{ fontSize: 12 }}>
        Scored like the sheet: a tight range that turns out right scores most; a confident miss loses points; a huge range earns little.
      </div>}
      {lesson && <LessonModal id="estimate" onClose={() => setLesson(false)} />}
    </div>
  );
}

export function FieldTrialResult({ prediction: p }: { prediction: Prediction }) {
  if (!p.result) return null;
  const info = PREDICTION_KINDS[p.kind];
  const difference = p.result.truth - p.value;
  const span = Math.max(p.sigma * 1.3, Math.abs(difference) * 1.12);
  const width = 100 * p.sigma / span;
  const position = 50 + 50 * (difference / span);
  return <div className="evidence-signal field-trial-result" role="status">
    <span className="evidence-emblem" aria-hidden="true">✧</span>
    <div className="stack">
      <b>{p.kind === 'pendulum' ? 'Swing trial recorded' : 'Sky forecast compared'}</b>
      <dl className="kv"><dt>Your forecast</dt><dd>{p.value.toFixed(info.digits)} ± {p.sigma.toFixed(info.digits)} {info.unit}</dd><dt>Your reading</dt><dd>{p.result.truth.toFixed(info.digits)} {info.unit}</dd></dl>
      <div className="field-trial-range" aria-hidden="true"><span style={{ width: `${width}%` }} /><i style={{ left: `${position}%` }} /></div>
      <div className="muted">Reading {p.result.z <= 1 ? 'inside' : 'outside'} your forecast range.</div>
    </div>
  </div>;
}
