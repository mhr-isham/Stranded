import { useEffect, useRef, useState } from 'react';
import { DAY, HOUR } from '../../engine/constants';
import { sfx } from '../../game/audio';
import { clock } from '../../game/clock';
import { currentWorld, fastForward } from '../../game/sim';
import { useGame, type EclipseImage } from '../../game/store';
import { lifeSupportEnd } from '../../game/survival';
import { dayNumber } from '../../game/time';
import { useClockState, useGameTime } from '../common/widgets';

export interface EclipseView { image: EclipseImage | null; reason: string }

const CAPTION: Record<EclipseImage, string> = {
  steady: 'Moonlight steady.',
  dim: 'Moonlight is dimmer, with a soft shading across the disk.',
  shadow: 'A dark shadow cuts across the moon.',
  dark: 'The disk has gone dark.',
};

const stamp = (at: number) => {
  const h = Math.floor(at % DAY / HOUR), m = Math.floor(at % HOUR / 60);
  return `Day ${dayNumber(at)} · ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

export function EclipseWatch({ read, centre, widen, close }:
{ read: (at: number) => EclipseView; centre: () => void; widen: () => void; close: () => void }) {
  const t = useGameTime(5);
  useClockState();
  const records = useGame((s) => s.eclipseSightings);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState('');
  const panel = useRef<HTMLElement>(null);
  useEffect(() => { panel.current?.focus(); }, []);
  const view = read(t);
  const canStep = !clock.realtime && !Number.isFinite(clock.stopAt);
  const timingSpeed = clock.rate <= 60;

  function step(minutes: number) {
    if (clock.realtime || Number.isFinite(clock.stopAt)) return;
    const s = useGame.getState();
    if (s.phase !== 'play') return;
    const at = clock.t + minutes * 60;
    if (at >= lifeSupportEnd(s, currentWorld().system)) { setMessage('Supplies run out before this wait ends.'); return; }
    clock.paused = true;
    fastForward(at);
  }

  function keepFrame() {
    const s = useGame.getState(), at = clock.t, live = read(at);
    if (s.phase !== 'play' || clock.rate > 60 || !live.image) return;
    const existing = s.eclipseSightings ?? [];
    const recorded = { at, image: live.image, note: note.trim() };
    useGame.setState({ eclipseSightings: [...existing.filter((r) => r.at !== at), recorded].sort((a, b) => a.at - b.at) });
    setMessage(existing.some((r) => r.at === at) ? 'Sighting updated.' : 'Moon sighting kept.');
    setNote('');
    sfx('shutter');
  }

  return <section ref={panel} tabIndex={-1} className="panel panel-pad stack moon-watch" aria-label="Lunar eclipse watch">
    <div className="row between"><b>Lunar eclipse watch</b><button className="btn small" onClick={close}>Back to moon chart</button></div>
    <div className="panel-inset eclipse-image-status" data-image={view.image ?? 'blocked'}>
      <b role="status">{view.image ? CAPTION[view.image] : view.reason}</b>
      <div className="mono muted">{stamp(t)}</div>
    </div>
    <div className="row moon-watch-controls">
      <button className="btn primary" disabled={!view.image || !timingSpeed} onClick={keepFrame}>Keep moon sighting</button>
      <div className="row" role="group" aria-label="Step eclipse watch time">
        {[5, 30, 180].map((minutes) => <button key={minutes} className="btn small" disabled={!canStep} onClick={() => step(minutes)}>{minutes < 60 ? `+${minutes} min` : '+3 h'}</button>)}
      </div>
    </div>
    {!canStep && <div className="faint">Finish or cancel the current clock stop before stepping.</div>}
    {!timingSpeed && <div className="faint">Hold the view or slow the clock to keep a frame.</div>}
    <div className="row">
      <button className="btn small" onClick={centre}>Centre on the moon</button>
      <button className="btn small" onClick={widen}>Widen field</button>
      {!clock.paused && <button className="btn small" onClick={() => { clock.paused = true; clock.emit(); }}>Hold this view</button>}
    </div>
    <label className="field">Observation note (optional)<input maxLength={160} className="input" value={note} onChange={(e) => setNote(e.target.value)} /></label>
    {message && <div aria-live="polite" className="muted">{message}</div>}
    <details className="measurement-help"><summary>What am I seeing?</summary>
      <p>The blue planet blocks some of the star in the penumbra and all of its direct light in the umbra. The moon can enter that shadow while it is still beside the planet in our sky. During an occultation, the planet instead blocks our view of the moon.</p>
      <p>Watch for gradual dimming or a dark edge moving across the disk. Step slowly near a change and keep the frames you see. Steps use expedition time and supplies.</p>
      <p>The simulated moon follows a coplanar orbit, so eclipses recur more often than on Earth. The image shows direct starlight. A copper-red eclipse on Earth can come from light bent through Earth’s atmosphere, which this instrument model does not simulate.</p>
    </details>
    {!!records?.length && <details className="measurement-help"><summary>Eclipse log ({records.length})</summary>
      <div className="stack">{records.slice().reverse().map((r) => <div key={r.at} className="panel-inset">
        <b>{stamp(r.at)}</b><div>{CAPTION[r.image]}</div>{r.note && <div className="muted">{r.note}</div>}
      </div>)}</div>
    </details>}
  </section>;
}
