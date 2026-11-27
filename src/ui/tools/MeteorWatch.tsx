import { useEffect, useRef, useState } from 'react';
import { HOUR } from '../../engine/constants';
import { sfx } from '../../game/audio';
import { clock, setWarp } from '../../game/clock';
import { exposeMeteorPhoto, METEOR_EXPOSURE, METEOR_PHOTO_LIMIT, meteorWatchStatus, type MeteorPhoto } from '../../game/meteorWatch';
import { currentWorld, fastForward } from '../../game/sim';
import { useGame } from '../../game/store';
import { lifeSupportEnd } from '../../game/survival';
import { dayNumber } from '../../game/time';
import { SkyPhotograph } from './SkyPhotograph';
import type { Camera } from '../../render/projection';
import type { Landscape } from '../../render/terrain';
import { Modal, useClockState, useGameTime } from '../common/widgets';

export function MeteorWatch({ camera, land, pan, zoom, close }: {
  camera: () => Camera; land: Landscape;
  pan: (az: number, alt: number) => void; zoom: (factor: number) => void; close: () => void;
}) {
  const t = useGameTime(4);
  useClockState();
  const s = useGame();
  const { system, catalog } = currentWorld();
  const photos = s.meteorPhotos ?? [];
  const [preview, setPreview] = useState<MeteorPhoto | null>(null);
  const [message, setMessage] = useState('');
  const panel = useRef<HTMLElement>(null), photoHeading = useRef<HTMLHeadingElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  useEffect(() => { panel.current?.focus(); }, []);
  useEffect(() => { if (preview) photoHeading.current?.focus(); }, [preview]);
  const status = meteorWatchStatus(system, s, t);
  const canAdvance = !clock.realtime && !Number.isFinite(clock.stopAt);

  function advanceTo(at: number) {
    const current = useGame.getState();
    if (current.phase !== 'play' || clock.realtime || Number.isFinite(clock.stopAt)) return false;
    if (at >= lifeSupportEnd(current, system)) { setMessage('Supplies run out before this wait ends.'); return false; }
    clock.paused = true;
    fastForward(at);
    return current.runId === useGame.getState().runId && useGame.getState().phase === 'play';
  }

  function showPhoto(photo: MeteorPhoto) {
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setPreview(photo);
  }

  function closePhoto() {
    setPreview(null);
    requestAnimationFrame(() => returnFocus.current?.focus());
  }

  function expose() {
    if (preview) return;
    const current = useGame.getState(), start = clock.t, end = start + METEOR_EXPOSURE;
    const sky = meteorWatchStatus(system, current, start);
    if (!sky.available) { setMessage(sky.text); return; }
    const photo = exposeMeteorPhoto(system, current, camera(), land, start, end);
    if (!advanceTo(end)) return;
    sfx('shutter');
    if (!photo) { setMessage('Exposure finished. No clear streaks crossed this frame.'); return; }
    const existing = useGame.getState().meteorPhotos ?? [];
    useGame.setState({ meteorPhotos: [photo, ...existing.filter((entry) => entry.at !== photo.at)].slice(0, METEOR_PHOTO_LIMIT) });
    setMessage('Meteor photo kept.');
    showPhoto(photo);
  }

  return <section className="panel panel-pad stack moon-watch" ref={panel} tabIndex={-1} aria-label="Meteor watch">
    <div className="row between"><b>Meteor watch</b><button className="btn small" onClick={close}>Back to sky tools</button></div>
    <div role="status" className={`panel-inset meteor-conditions${status.active ? ' meteor-active' : ''}`}>{status.text}</div>
    <div className="row moon-watch-controls">
      <button className="btn primary" disabled={!canAdvance || !status.available} onClick={expose}>Expose photo · 90 s</button>
      <button className="btn small" disabled={!canAdvance} onClick={() => { if (!clock.realtime && !Number.isFinite(clock.stopAt)) setWarp(1); }}>Watch at 1 min/s</button>
      {!clock.paused && <button className="btn small" onClick={() => { clock.paused = true; clock.emit(); }}>Hold sky</button>}
    </div>
    <details className="measurement-help"><summary>Frame and wait</summary>
      <div className="stack">
        <div className="row sky-pan"><button className="btn small" onClick={() => pan(-15, 0)} aria-label="Pan sky left">◀</button><button className="btn small" onClick={() => pan(0, 10)} aria-label="Pan sky up">▲</button><button className="btn small" onClick={() => pan(0, -10)} aria-label="Pan sky down">▼</button><button className="btn small" onClick={() => pan(15, 0)} aria-label="Pan sky right">▶</button></div>
        <div className="row"><button className="btn small" onClick={() => zoom(.8)}>Zoom in</button><button className="btn small" onClick={() => zoom(1.25)}>Zoom out</button><button className="btn small" disabled={!canAdvance} onClick={() => advanceTo(clock.t + 3 * HOUR)}>Wait 3 h</button></div>
        <p>Drag to frame a broad patch of clear sky above the ridge. The camera keeps the current view and collects streaks that cross it over 90 expedition seconds.</p>
      </div>
    </details>
    {!canAdvance && <div className="faint">Finish or cancel the current clock stop before exposing or waiting.</div>}
    {!!message && <div className="muted" aria-live="polite">{message}</div>}
    {!!photos.length && <details className="measurement-help"><summary>Meteor photos ({photos.length})</summary>
      <div className="stack">{photos.map((photo) => <button className="btn small" key={photo.at}
        onClick={() => showPhoto(photo)}>Day {dayNumber(photo.at)} · {photo.trails.length} {photo.trails.length === 1 ? 'streak' : 'streaks'}</button>)}</div>
    </details>}
    <details className="measurement-help"><summary>Why do the trails fan out?</summary>
      <p>Particles from a stream enter the atmosphere on nearly parallel paths. Perspective makes their trails appear to spread from a common point called the radiant. The showers recur as this planet crosses the streams on its orbit.</p>
    </details>
    {preview && <Modal onClose={closePhoto}>
      <section className="stack sky-photograph" aria-label="Meteor photograph">
        <h2 tabIndex={-1} ref={photoHeading}>Meteor photograph</h2>
        <SkyPhotograph at={preview.at} camera={preview.camera} land={land} system={system} catalog={catalog} meteors={preview.trails}
          label={`Night sky photograph with ${preview.trails.length} meteor ${preview.trails.length === 1 ? 'streak' : 'streaks'}`} />
        <div className="muted">Day {dayNumber(preview.at)} · 90 s exposure · {preview.trails.length} {preview.trails.length === 1 ? 'streak' : 'streaks'}</div>
      </section>
    </Modal>}
  </section>;
}
