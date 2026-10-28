import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useGame, type Settings } from '../../game/store';
import { world } from '../../game/world';
import { clock, subscribeClock } from '../../game/clock';

/** A dialog. Closes on the backdrop, Esc or its ✕ when it has `onClose`; `top` puts it above the tutorial card. */
export function Modal({ children, onClose, top }: { children: ReactNode; onClose?: () => void; top?: boolean }) {
  useEffect(() => {
    if (!onClose) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [onClose]);
  // Rendered at the top of the page, so no parent's stacking (the HUD's) can bury it.
  return createPortal(
    <div className={`modal-back ${top ? 'top' : ''}`} onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal panel">
        {onClose && (
          <button type="button" className="modal-x btn ghost small" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function Toggle({ on, onChange, label, sub }: { on: boolean; onChange: (v: boolean) => void; label: ReactNode; sub?: ReactNode }) {
  return (
    <button type="button" className="toggle btn ghost" style={{ width: '100%', borderRadius: 0, padding: '10px 0' }} onClick={() => onChange(!on)}>
      <span style={{ textAlign: 'left' }}>
        <div style={{ fontWeight: 600 }}>{label}</div>
        {sub && <div className="muted" style={{ fontSize: 12, fontWeight: 400, whiteSpace: 'normal' }}>{sub}</div>}
      </span>
      <span className={`switch ${on ? 'on' : ''}`} />
    </button>
  );
}

/** Re-render at most `hz` times per second with the current game time. */
export function useGameTime(hz = 8) {
  const [t, setT] = useState(clock.t);
  useEffect(() => {
    const id = setInterval(() => setT(clock.t), 1000 / hz);
    return () => clearInterval(id);
  }, [hz]);
  return t;
}

/** Re-render when warp / pause state changes. */
export function useClockState() {
  return useSyncExternalStore(
    subscribeClock,
    () => `${clock.warpIndex}:${clock.paused}:${clock.realtime}`,
  );
}

let toastSetter: ((s: string | null) => void) | null = null;
export function toast(msg: string) {
  toastSetter?.(msg);
}
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    toastSetter = setMsg;
    return () => void (toastSetter = null);
  }, []);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(id);
  }, [msg]);
  return msg ? <div className="toast panel">{msg}</div> : null;
}

/**
 * Start a run. Building a solvable system can take a few seconds (the hard
 * chapters reject many), so say so on screen first instead of freezing.
 */
export function startRun(seed: number, settings: Settings, chapter = 1) {
  const el = document.createElement('div');
  el.className = 'charting';
  el.textContent = 'Charting a new star system…';
  document.body.appendChild(el);
  requestAnimationFrame(() =>
    setTimeout(() => {
      try {
        world(seed, settings.difficulty, chapter);
        useGame.getState().newGame(seed, settings, chapter);
      } finally {
        el.remove();
      }
    }, 30),
  );
}
