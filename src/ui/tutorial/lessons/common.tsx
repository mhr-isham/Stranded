// Building blocks shared by the interactive lessons.

import { useEffect, useRef, useState, type ReactNode } from 'react';

export function LessonShell({
  kicker,
  title,
  demo,
  children,
  formula,
  keyIdea,
  warn,
  tip,
}: {
  kicker: string;
  title: string;
  demo: ReactNode;
  children: ReactNode;
  formula?: ReactNode;
  keyIdea?: ReactNode;
  warn?: ReactNode;
  tip?: ReactNode;
}) {
  return (
    <div className="lesson">
      <div className="lesson-head">
        <div className="meter-label">{kicker}</div>
        <h2>{title}</h2>
      </div>
      <div className="lesson-grid">
        <div className="lesson-demo">{demo}</div>
        <div className="lesson-text">
          {children}
          {formula && <div className="lesson-formula">{formula}</div>}
          {keyIdea && (
            <div className="callout key">
              <b>Key idea</b>
              <div>{keyIdea}</div>
            </div>
          )}
          {warn && (
            <div className="callout warn">
              <b>⚠ Watch out</b>
              <div>{warn}</div>
            </div>
          )}
          {tip && (
            <div className="callout tip">
              <b>💡 Tip</b>
              <div>{tip}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  fmt = (v) => String(v),
}: {
  label: ReactNode;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  fmt?: (v: number) => string;
}) {
  return (
    <label className="lslider">
      <span className="row between">
        <span>{label}</span>
        <span className="mono blue">{fmt(value)}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  );
}

/** Seconds since mount, updated every animation frame while `running`. */
export function useAnimTime(running = true) {
  const [t, setT] = useState(0);
  const start = useRef(performance.now());
  useEffect(() => {
    if (!running) return;
    let raf = 0;
    const loop = () => {
      setT((performance.now() - start.current) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);
  return t;
}

/** Arrowhead markers for SVG diagrams. Include once per <svg>. */
export function ArrowDefs() {
  return (
    <defs>
      {[
        ['arrow-blue', '#6cc4ff'],
        ['arrow-amber', '#ffc46b'],
        ['arrow-green', '#5be3a4'],
        ['arrow-red', '#ff6b7d'],
        ['arrow-white', '#e8eefc'],
      ].map(([id, c]) => (
        <marker key={id} id={id} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill={c} />
        </marker>
      ))}
    </defs>
  );
}

export const Demo = ({ children, h = 300 }: { children: ReactNode; h?: number }) => (
  <div className="demo-box" style={{ minHeight: h }}>
    {children}
  </div>
);

export const Note = ({ children }: { children: ReactNode }) => <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>{children}</div>;

export const P = ({ children }: { children: ReactNode }) => <p style={{ margin: '0 0 10px' }}>{children}</p>;

export const fmtN = (x: number, d = 2) => (Number.isFinite(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—');
