import { useEffect, useMemo, useRef, useState } from 'react';
import { DEG, HOUR } from '../../engine/constants';
import { sfx } from '../../game/audio';
import { auroraInFrame, auroraView, type AuroraPhoto } from '../../game/auroraWatch';
import { clock } from '../../game/clock';
import { currentWorld, fastForward } from '../../game/sim';
import { useGame } from '../../game/store';
import { lifeSupportEnd } from '../../game/survival';
import { dayNumber } from '../../game/time';
import { altAzFromDir, type Camera } from '../../render/projection';
import type { Landscape } from '../../render/terrain';
import { Modal, useClockState, useGameTime } from '../common/widgets';
import { SkyPhotograph } from './SkyPhotograph';

export function AuroraWatch({ camera, orient, land, phase, close }: {
  camera: () => Camera; orient: (az: number, alt: number) => void;
  land: Landscape; phase: () => number; close: () => void;
}) {
  const t = useGameTime(4);
  useClockState();
  const s = useGame(), { system, catalog } = currentWorld();
  const [preview, setPreview] = useState<AuroraPhoto | null>(null);
  const [message, setMessage] = useState('');
  const panel = useRef<HTMLElement>(null), heading = useRef<HTMLHeadingElement>(null), returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => { panel.current?.focus(); }, []);
  useEffect(() => { if (preview) heading.current?.focus(); }, [preview]);
  const view = auroraView(system, s, land, t, phase());
  const photos = s.auroraPhotos ?? [];
  const frozen = useMemo(() => preview ? auroraView(system, { seed: s.seed, settings: { ...s.settings, survival: false } },
    land, preview.at, preview.phase).ribbons : undefined, [preview, system, s.seed, s.settings, land]);
  const canWait = !clock.realtime && !Number.isFinite(clock.stopAt);

  function show(photo: AuroraPhoto) {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPreview(photo);
  }

  function faceGlow() {
    const live = auroraView(system, useGame.getState(), land, clock.t, phase());
    if (!live.direction) { setMessage(live.reason); return; }
    const { az, alt } = altAzFromDir(live.direction);
    orient(az, Math.max(12 * DEG, Math.min(75 * DEG, alt)));
  }

  function keep() {
    const current = useGame.getState();
    if (current.phase !== 'play' || preview) return;
    const photo = { at: clock.t, phase: phase(), camera: camera() };
    const live = auroraView(system, current, land, photo.at, photo.phase);
    if (!live.direction || !auroraInFrame(live, photo.camera, land)) {
      setMessage(live.direction ? 'Frame the glow before keeping a view.' : live.reason);
      return;
    }
    useGame.setState({ auroraPhotos: [photo, ...(current.auroraPhotos ?? []).filter((p) => p.at !== photo.at)].slice(0, 8) });
    sfx('shutter');
    setMessage('Aurora photograph kept.');
    show(photo);
  }

  function wait() {
    if (clock.realtime || Number.isFinite(clock.stopAt) || useGame.getState().phase !== 'play') return;
    const at = clock.t + 3 * HOUR;
    if (at >= lifeSupportEnd(useGame.getState(), system)) { setMessage('Supplies run out before this wait ends.'); return; }
    clock.paused = true;
    fastForward(at);
  }

  return <section ref={panel} tabIndex={-1} className="panel panel-pad stack moon-watch" aria-label="Aurora watch">
    <div className="row between"><b>Aurora watch</b><button className="btn small" onClick={close}>Back to sky tools</button></div>
    <div role="status" className={`panel-inset aurora-conditions${view.direction ? ' aurora-active' : ''}`}>{view.reason}</div>
    <div className="row moon-watch-controls">
      <button className="btn small" disabled={!view.direction} onClick={faceGlow}>Face the glow</button>
      <button className="btn primary" disabled={!view.direction} onClick={keep}>Keep aurora view</button>
      {!clock.paused && <button className="btn small" onClick={() => { clock.paused = true; clock.emit(); }}>Hold sky</button>}
      <button className="btn small" disabled={!canWait} onClick={wait}>Wait 3 h</button>
    </div>
    {!canWait && <div className="faint">Finish or cancel the current clock stop before waiting.</div>}
    {message && <div className="muted" aria-live="polite">{message}</div>}
    <details className="measurement-help"><summary>About the glow</summary>
      <p>Charged particles guided by the planet’s magnetic field excite gases high in the atmosphere. They trace curtains around the magnetic pole. Stronger space weather can bring the oval farther from the pole. A dark, clear sky helps the glow stand out.</p>
      <p>Drag to frame the curtains, or use the arrow keys to pan. Pinch, scroll, or use + and − to zoom.</p>
    </details>
    {!!photos.length && <details className="measurement-help"><summary>Aurora photos ({photos.length})</summary>
      <div className="stack">{photos.map((p) => <button className="btn small" key={p.at} onClick={() => show(p)}>Aurora · Day {dayNumber(p.at)}</button>)}</div>
    </details>}
    {preview && <Modal onClose={() => { setPreview(null); requestAnimationFrame(() => returnFocus.current?.focus()); }}>
      <section className="stack sky-photograph" aria-label="Aurora photograph">
        <h2 ref={heading} tabIndex={-1}>Aurora photograph</h2>
        <SkyPhotograph at={preview.at} camera={preview.camera} system={system} catalog={catalog} land={land} aurora={frozen} label="Night sky photograph of the aurora" />
        <div className="muted">Day {dayNumber(preview.at)}</div>
      </section>
    </Modal>}
  </section>;
}
