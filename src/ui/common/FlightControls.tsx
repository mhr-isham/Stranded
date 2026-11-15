import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createFlightInput, flightSensitivity, type FlightAction } from '../../game/flightInput';
import { stopRumble } from '../../game/audio';
import { useGame } from '../../game/store';
import { Modal, Toggle } from './widgets';

export function useFlightControls(onChute?: () => void, initiallyPaused = false) {
  const control = useMemo(createFlightInput, []);
  const input = useRef(control.held);
  const [held, setHeld] = useState({ ...control.held });
  const [paused, setPaused] = useState(initiallyPaused);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const chute = useRef(onChute);
  chute.current = onChute;
  const setControl = useCallback((action: FlightAction, source: string, on: boolean) => {
    if (on && pausedRef.current) return;
    if (control.set(action, source, on)) setHeld({ ...control.held });
  }, [control]);
  const release = useCallback(() => { control.clear(); setHeld({ ...control.held }); stopRumble(); }, [control]);
  const pause = useCallback((value: boolean) => {
    pausedRef.current = value;
    if (value) release();
    setPaused(value);
  }, [release]);
  useEffect(() => {
    const actionFor = (key: string): FlightAction | null =>
      ['arrowleft', 'a'].includes(key) ? 'left' : ['arrowright', 'd'].includes(key) ? 'right' : ['arrowup', 'w', ' '].includes(key) ? 'thrust' : null;
    const key = (e: KeyboardEvent, on: boolean) => {
      const target = e.target as Element | null;
      const k = e.key.toLowerCase();
      if (on && (target?.closest('input, select, textarea, [contenteditable="true"]') || (target?.closest('button') && (k === ' ' || k === 'enter')))) return;
      const action = actionFor(k);
      if (action) { e.preventDefault(); setControl(action, `key-${k}`, on); }
      else if (on && k === 'p' && !e.repeat && !pausedRef.current) chute.current?.();
    };
    const down = (e: KeyboardEvent) => key(e, true);
    const up = (e: KeyboardEvent) => key(e, false);
    const blur = () => pause(true);
    const visibility = () => { if (document.hidden) pause(true); };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', visibility);
      control.clear();
      stopRumble();
    };
  }, [control, pause, setControl]);
  return { input, held, paused, pause, setControl, release };
}

export function FlightButton({ label, action, controls, icon, shortcut, burn = false }: {
  label: string; action: FlightAction; controls: ReturnType<typeof useFlightControls>; icon: string; shortcut: string; burn?: boolean;
}) {
  const set = (source: string, on: boolean) => controls.setControl(action, source, on);
  return <button type="button" className={`flight-button ${burn ? 'flight-burn' : ''} ${controls.held[action] ? 'held' : ''}`}
    aria-label={label} aria-pressed={controls.held[action]} disabled={controls.paused}
    onPointerDown={(e) => { if (e.button !== 0) return; e.currentTarget.setPointerCapture(e.pointerId); set(`pointer-${e.pointerId}`, true); }}
    onPointerUp={(e) => set(`pointer-${e.pointerId}`, false)}
    onPointerCancel={(e) => set(`pointer-${e.pointerId}`, false)}
    onLostPointerCapture={(e) => set(`pointer-${e.pointerId}`, false)}
    onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); set(`button-${e.key}`, true); } }}
    onKeyUp={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); set(`button-${e.key}`, false); } }}
    onBlur={() => { set('button- ', false); set('button-Enter', false); }}
    onContextMenu={(e) => e.preventDefault()}>
    <span className="flight-button-icon" aria-hidden="true">{icon}</span><span>{label}</span><kbd>{shortcut}</kbd>
  </button>;
}

export function FlightToolbar({ title, status, controls, children }: {
  title: string; status: string; controls: ReturnType<typeof useFlightControls>; children: ReactNode;
}) {
  const s = useGame();
  const [help, setHelp] = useState(false);
  const resume = () => { controls.pause(false); document.querySelector<HTMLElement>('.flight-screen')?.focus({ preventScroll: true }); };
  return <>
    <header className="flight-toolbar panel">
      <div><span className="meter-label">{title}</span><span className="flight-status">{status}</span></div>
      <div className="row">
        <button className="btn small" onClick={() => controls.paused ? resume() : controls.pause(true)} aria-label={controls.paused ? 'Resume flight' : 'Pause flight'}>{controls.paused ? '▶ Resume' : 'Ⅱ Pause'}</button>
        <button className="btn small ghost" onClick={() => { controls.pause(true); setHelp(true); }}>Controls</button>
      </div>
    </header>
    {controls.paused && !help && <div className="flight-paused panel" role="status"><span>Flight paused</span><button className="btn small primary" onClick={resume}>Ready to fly</button></div>}
    {help && <Modal onClose={() => setHelp(false)}>
      <h2>Flight controls</h2>
      <p className="muted">Hold a control to steer or burn. Touch supports steering and thrust together. A full release stops that input.</p>
      <dl className="kv"><dt>Steer</dt><dd>← → / A D</dd><dt>Burn</dt><dd>↑ / W / Space</dd><dt>Parachute, during descent</dt><dd>P or its button</dd></dl>
      {children}
      <label className="field">Steering sensitivity · {flightSensitivity(s.settings.flightSensitivity).toFixed(1)}×
        <input type="range" min="0.5" max="1.5" step="0.1" value={flightSensitivity(s.settings.flightSensitivity)} onChange={(e) => s.set({ settings: { ...s.settings, flightSensitivity: Number(e.target.value) } })} />
      </label>
      <Toggle on={s.settings.flightReducedMotion ?? window.matchMedia('(prefers-reduced-motion: reduce)').matches}
        onChange={(value) => s.set({ settings: { ...s.settings, flightReducedMotion: value } })} label="Reduced flight motion" sub="Removes camera shake and entry flashes; keeps the flight instruments and trajectory visible." />
      <p className="faint" style={{ fontSize: 12 }}>Flight pauses when this window loses focus. Close these controls, then resume when ready.</p>
    </Modal>}
  </>;
}

export function FlightAssistDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: () => void }) {
  return <Modal onClose={onCancel}>
    <h2>Continue with ECHO assistance?</h2>
    <p>Your measurements and expedition will be preserved. This journey becomes assisted and will not earn a hard-mode score, grade, achievement or challenge unlock. You can continue the story. Fuel costs and your measured navigation model still determine whether the transfer succeeds.</p>
    <div className="row" style={{ justifyContent: 'flex-end' }}><button className="btn" onClick={onCancel}>Keep manual control</button><button className="btn amber" onClick={onConfirm}>Continue assisted</button></div>
  </Modal>;
}
