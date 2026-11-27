import { useEffect, useRef, useState } from 'react';
import { DAY, HOUR } from '../../engine/constants';
import { phaseCaption } from '../../engine/planetPhase';
import type { PhaseView } from '../../game/phaseObservation';
import { sfx } from '../../game/audio';
import { clock } from '../../game/clock';
import { currentWorld, fastForward } from '../../game/sim';
import { useGame } from '../../game/store';
import { lifeSupportEnd } from '../../game/survival';
import { dayNumber } from '../../game/time';
import { drawPlanetPhase } from '../../render/planetDisk';
import { CanvasView } from '../common/CanvasView';
import { useClockState, useGameTime } from '../common/widgets';

const dateLabel = (at: number) => {
  const mins = Math.floor((at % DAY) / 60);
  return `Day ${dayNumber(at)} · ${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
};

export function PhaseWatch({ read, onFrame, onClose }: { read: (at: number) => PhaseView; onFrame: () => void; onClose: () => void }) {
  const t = useGameTime(5);
  useClockState();
  const records = useGame((s) => s.phaseSightings);
  const panel = useRef<HTMLElement>(null);
  const [note, setNote] = useState(''), [message, setMessage] = useState('');
  useEffect(() => { panel.current?.focus(); }, []);
  const view = read(t);
  const canHold = !clock.realtime && !Number.isFinite(clock.stopAt);
  const canKeep = clock.rate <= 60 && !!view.sighting;

  function step(hours: number) {
    const s = useGame.getState(), then = clock.t + hours * HOUR;
    if (s.phase !== 'play' || clock.realtime || Number.isFinite(clock.stopAt)) return;
    if (then >= lifeSupportEnd(s, currentWorld().system)) { setMessage('Supplies run out before this wait ends.'); return; }
    clock.paused = true;
    fastForward(then);
    setMessage('');
  }
  function keep() {
    const s = useGame.getState();
    if (s.phase !== 'play' || clock.rate > 60) return;
    const { sighting } = read(clock.t);
    if (!sighting) return;
    const previous = s.phaseSightings ?? [];
    const kept = { ...sighting, note: note.trim() };
    s.set({ phaseSightings: [...previous.filter((p) => p.at !== kept.at), kept].sort((a, b) => a.at - b.at).slice(-8) });
    setMessage('Telescope view kept.'); setNote('');
    sfx('shutter');
  }
  return <section className="panel panel-pad stack phase-watch" ref={panel} tabIndex={-1} aria-label="Planet phase watch">
    <div className="row between"><b>Planet phase watch</b><button className="btn small" onClick={onClose}>Back to Sky</button></div>
    <div className="panel-inset phase-status">
      <b role="status">{view.sighting ? phaseCaption(view.sighting.phase.cosine) : view.reason}</b>
      <div className="mono faint">{dateLabel(t)} expedition</div>
    </div>
    <div className="row">
      <button className="btn small" onClick={onFrame}>Centre and frame</button>
      {!clock.paused && <button className="btn small" disabled={!canHold} onClick={() => {
        if (!clock.realtime && !Number.isFinite(clock.stopAt)) { clock.paused = true; clock.emit(); }
      }}>Hold view</button>}
    </div>
    <div className="row" role="group" aria-label="Step phase watch time">
      <button className="btn small ghost" disabled={!canHold} onClick={() => step(1)}>+1 h</button>
      <button className="btn small ghost" disabled={!canHold} onClick={() => step(24)}>+1 day</button>
    </div>
    <label className="field">Observation note (optional)<input className="input" maxLength={160} value={note} onChange={(event) => setNote(event.target.value)} /></label>
    <button className="btn primary" disabled={!canKeep} onClick={keep}>Keep phase view</button>
    {clock.rate > 60 && <p className="faint">Hold the view or slow the clock to keep it.</p>}
    {message && <div className="muted" role="status">{message}</div>}
    {!!records?.length && <details className="measurement-help phase-gallery">
      <summary>Saved phase views ({records.length})</summary>
      <p>The angle from the star is rounded to the nearest half degree. Compare that angle with the shape in each image.</p>
      <div className="phase-photos">
        {records.slice().reverse().map((record) => <figure className="panel-inset phase-photo" key={record.at}>
          <div className="phase-thumbnail"><CanvasView role="img" aria-label={`${phaseCaption(record.phase.cosine)} inner planet`}
            draw={({ctx, w, h, now}) => {
              ctx.fillStyle = '#060c17'; ctx.fillRect(0, 0, w, h);
              const radius = Math.min(w, h) * 0.41;
              drawPlanetPhase(ctx, record.phase, w / 2, h / 2, radius, radius * record.seeing * 0.54, now, true);
            }} /></div>
          <figcaption>
            <b>{phaseCaption(record.phase.cosine)}</b>
            <span>{record.separation.toFixed(1)}° from the star</span><span className="faint">{dateLabel(record.at)}</span>
            {record.note && <span className="muted">{record.note}</span>}
          </figcaption>
        </figure>)}
      </div>
    </details>}
    <details className="measurement-help"><summary>What changes the shape?</summary>
      <p>Starlight illuminates half the planet. We see different amounts of that half as the planet and our camp world orbit. The bright edge faces the star.</p>
      <p>Some phases are hard to see. A thin crescent can blur together in poor seeing, and near alignment the star can overwhelm the image.</p>
    </details>
  </section>;
}
