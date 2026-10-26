import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { clock, subscribeClock } from '../../game/clock';

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal panel">{children}</div>
    </div>
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
