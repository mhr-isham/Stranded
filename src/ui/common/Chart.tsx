import { useRef, useState } from 'react';
import { CanvasView, canvasPoint } from './CanvasView';

export interface Pt {
  x: number;
  y: number;
}

export interface Series {
  pts: Pt[];
  color: string;
  kind: 'dots' | 'line';
  faded?: (p: Pt) => boolean;
}

export interface Marker {
  x: number;
  color: string;
  label?: string;
}

interface Props {
  series: Series[];
  markers?: Marker[];
  cursor?: number | null;
  onCursor?: (x: number) => void;
  xLabel: string;
  yLabel: string;
  xFmt?: (x: number) => string;
  yFmt?: (y: number) => string;
  height?: number;
  /** Optional selection band (data x). */
  band?: [number, number] | null;
  onBand?: (b: [number, number] | null) => void;
  brushMode?: 'zoom' | 'band';
}

/**
 * Interactive scatter/line chart. Tap to place the cursor; drag to zoom into
 * a range (or select a band). Double-tap resets zoom.
 */
export function Chart({ series, markers = [], cursor = null, onCursor, xLabel, yLabel, xFmt = (x) => x.toFixed(1), yFmt = (y) => y.toFixed(2), height = 220, band, onBand, brushMode = 'zoom' }: Props) {
  const [zoom, setZoom] = useState<[number, number] | null>(null);
  const drag = useRef<null | { x0: number; x1: number; moved: boolean }>(null);
  const lastTap = useRef(0);
  const geom = useRef({ l: 0, r: 1, xmin: 0, xmax: 1, w: 1 });

  const all = series.flatMap((s) => s.pts);
  let xmin = Math.min(...all.map((p) => p.x));
  let xmax = Math.max(...all.map((p) => p.x));
  if (!all.length) [xmin, xmax] = [0, 1];
  if (xmax - xmin < 1e-9) [xmin, xmax] = [xmin - 1, xmax + 1];
  if (zoom) [xmin, xmax] = zoom;
  const inView = all.filter((p) => p.x >= xmin && p.x <= xmax);
  let ymin = Math.min(...inView.map((p) => p.y));
  let ymax = Math.max(...inView.map((p) => p.y));
  if (!inView.length) [ymin, ymax] = [0, 1];
  const pad = (ymax - ymin) * 0.12 || 1;
  ymin -= pad;
  ymax += pad;

  const toData = (px: number) => {
    const g = geom.current;
    return g.xmin + ((px - g.l) / (g.r - g.l)) * (g.xmax - g.xmin);
  };

  return (
    <div style={{ position: 'relative', height }}>
      <CanvasView
        className="fill-canvas"
        style={{ borderRadius: 10, border: '1px solid var(--panel-border)' }}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture(e.pointerId);
          const x = toData(canvasPoint(e).x);
          drag.current = { x0: x, x1: x, moved: false };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const x = toData(canvasPoint(e).x);
          drag.current.x1 = x;
          if (Math.abs(x - drag.current.x0) > (xmax - xmin) * 0.02) drag.current.moved = true;
        }}
        onPointerUp={() => {
          const d = drag.current;
          drag.current = null;
          if (!d) return;
          if (d.moved) {
            const r: [number, number] = [Math.min(d.x0, d.x1), Math.max(d.x0, d.x1)];
            if (brushMode === 'band') onBand?.(r);
            else setZoom(r);
          } else {
            const now = performance.now();
            if (now - lastTap.current < 300) {
              setZoom(null);
              onBand?.(null);
            } else onCursor?.(d.x0);
            lastTap.current = now;
          }
        }}
        draw={({ ctx, w, h, dpr }) => {
          const l = 52 * dpr;
          const r = w - 10 * dpr;
          const t = 10 * dpr;
          const b = h - 28 * dpr;
          geom.current = { l, r, xmin, xmax, w };
          const X = (x: number) => l + ((x - xmin) / (xmax - xmin)) * (r - l);
          const Y = (y: number) => b - ((y - ymin) / (ymax - ymin)) * (b - t);
          ctx.fillStyle = 'rgba(5,8,16,0.9)';
          ctx.fillRect(0, 0, w, h);
          ctx.font = `${10 * dpr}px JetBrains Mono`;
          ctx.fillStyle = 'rgba(160,175,205,0.8)';
          ctx.strokeStyle = 'rgba(255,255,255,0.06)';
          ctx.lineWidth = dpr;
          ctx.textAlign = 'right';
          for (let i = 0; i <= 4; i++) {
            const y = ymin + ((ymax - ymin) * i) / 4;
            ctx.beginPath();
            ctx.moveTo(l, Y(y));
            ctx.lineTo(r, Y(y));
            ctx.stroke();
            ctx.fillText(yFmt(y), l - 4 * dpr, Y(y) + 3 * dpr);
          }
          ctx.textAlign = 'center';
          for (let i = 0; i <= 5; i++) {
            const x = xmin + ((xmax - xmin) * i) / 5;
            ctx.fillText(xFmt(x), X(x), h - 12 * dpr);
          }
          ctx.fillText(xLabel, (l + r) / 2, h - 1 * dpr);
          ctx.save();
          ctx.translate(10 * dpr, (t + b) / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.fillText(yLabel, 0, 0);
          ctx.restore();

          if (band) {
            ctx.fillStyle = 'rgba(108,196,255,0.10)';
            ctx.fillRect(X(band[0]), t, X(band[1]) - X(band[0]), b - t);
          }
          if (drag.current?.moved) {
            ctx.fillStyle = 'rgba(255,196,107,0.12)';
            ctx.fillRect(X(drag.current.x0), t, X(drag.current.x1) - X(drag.current.x0), b - t);
          }
          ctx.save();
          ctx.beginPath();
          ctx.rect(l, t, r - l, b - t);
          ctx.clip();
          for (const s of series) {
            if (s.kind === 'line') {
              ctx.strokeStyle = s.color;
              ctx.lineWidth = 1.5 * dpr;
              ctx.beginPath();
              s.pts.forEach((p, i) => (i ? ctx.lineTo(X(p.x), Y(p.y)) : ctx.moveTo(X(p.x), Y(p.y))));
              ctx.stroke();
            } else {
              for (const p of s.pts) {
                ctx.fillStyle = s.faded?.(p) ? 'rgba(120,130,150,0.4)' : s.color;
                ctx.beginPath();
                ctx.arc(X(p.x), Y(p.y), 2.4 * dpr, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
          for (const m of markers) {
            ctx.strokeStyle = m.color;
            ctx.setLineDash([5 * dpr, 4 * dpr]);
            ctx.beginPath();
            ctx.moveTo(X(m.x), t);
            ctx.lineTo(X(m.x), b);
            ctx.stroke();
            ctx.setLineDash([]);
            if (m.label) {
              ctx.fillStyle = m.color;
              ctx.textAlign = 'left';
              ctx.fillText(m.label, X(m.x) + 4 * dpr, t + 12 * dpr);
            }
          }
          if (cursor !== null) {
            ctx.strokeStyle = '#ffc46b';
            ctx.lineWidth = 1.5 * dpr;
            ctx.beginPath();
            ctx.moveTo(X(cursor), t);
            ctx.lineTo(X(cursor), b);
            ctx.stroke();
          }
          ctx.restore();
        }}
      />
      {zoom && (
        <button className="btn small" style={{ position: 'absolute', right: 6, top: 6 }} onClick={() => setZoom(null)}>
          Reset zoom
        </button>
      )}
    </div>
  );
}

export function unwrapDeg(vals: number[]) {
  const out: number[] = [];
  let off = 0;
  for (let i = 0; i < vals.length; i++) {
    if (i > 0) {
      const d = vals[i] + off - out[i - 1];
      if (d > 180) off -= 360;
      else if (d < -180) off += 360;
    }
    out.push(vals[i] + off);
  }
  return out;
}
