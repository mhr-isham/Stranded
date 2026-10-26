import { useEffect, useRef } from 'react';

export interface DrawArgs {
  ctx: CanvasRenderingContext2D;
  w: number; // device pixels
  h: number;
  dpr: number;
  now: number; // performance.now()
  dt: number; // seconds since last frame
  canvas: HTMLCanvasElement;
}

interface Props {
  draw: (a: DrawArgs) => void;
  className?: string;
  onPointerDown?: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerMove?: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onPointerUp?: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onWheel?: (e: React.WheelEvent<HTMLCanvasElement>) => void;
  style?: React.CSSProperties;
}

/** Device-pixel-ratio aware canvas that redraws every animation frame. */
export function CanvasView({ draw, className = 'fill-canvas', ...rest }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;

  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d', { alpha: false })!;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.max(1, Math.round(canvas.clientWidth * dpr));
      const ch = Math.max(1, Math.round(canvas.clientHeight * dpr));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      const dt = Math.max(0, Math.min(0.1, (now - last) / 1000));
      last = now;
      drawRef.current({ ctx, w: cw, h: ch, dpr, now, dt, canvas });
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={ref} className={className} {...rest} />;
}

/** Pointer position in canvas device pixels. */
export function canvasPoint(e: { clientX: number; clientY: number; currentTarget: Element }) {
  const r = e.currentTarget.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  return { x: (e.clientX - r.left) * dpr, y: (e.clientY - r.top) * dpr };
}
