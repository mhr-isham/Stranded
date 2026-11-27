import { useEffect, useRef, useState } from 'react';
import { DEG, HOUR, DAY } from '../../engine/constants';
import { beaconSolarFrame, beaconSunVisible, nextBeaconEclipse, type BeaconEclipseWindow } from '../../engine/solarEclipse';
import type { StarSystem } from '../../engine/types';
import { unit } from '../../engine/vec';
import { dayNumber } from '../../game/time';
import { starRGB } from '../../render/paint';
import { drawScope, SEEING } from '../../render/telescope';
import { CanvasView } from '../common/CanvasView';
import { Modal } from '../common/widgets';

const caption = { transit: 'Transit', partial: 'Partial eclipse', annular: 'Annular eclipse', total: 'Total eclipse' };

function timeLabel(t: number) {
  const hh = String(Math.floor(t % DAY / HOUR)).padStart(2, '0');
  const mm = String(Math.floor(t % HOUR / 60)).padStart(2, '0');
  return `Day ${dayNumber(t)} · ${hh}:${mm}`;
}

export function BeaconEclipseWatch({ system, arrivalAt, close }: { system: StarSystem; arrivalAt: number; close: () => void }) {
  const [window, setWindow] = useState<BeaconEclipseWindow | null>(() => nextBeaconEclipse(system, arrivalAt));
  const [at, setAt] = useState(() => window?.from ?? arrivalAt);
  const [running, setRunning] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const frame = beaconSolarFrame(system, at);
  const usable = beaconSunVisible(frame);
  const total = frame.overlap?.kind === 'total';

  useEffect(() => {
    if (!running || !window) return;
    const timer = setInterval(() => {
      setAt((t) => {
        const overlap = beaconSolarFrame(system, t).overlap;
        const seconds = overlap && overlap.covered > .94 ? 10 : 60;
        return Math.min(window.to, t + seconds);
      });
    }, 100);
    return () => clearInterval(timer);
  }, [running, window, system]);

  useEffect(() => { if (window && at >= window.to) setRunning(false); }, [at, window]);

  function step(seconds: number) {
    if (!window) return;
    setRunning(false);
    setAt((t) => Math.min(window.to, Math.max(window.from, t + seconds)));
  }

  function next() {
    if (!window) return;
    setRunning(false);
    const found = nextBeaconEclipse(system, window.to + 5 * 60);
    setWindow(found);
    if (found) setAt(found.from);
  }

  return <Modal onClose={close} className="beacon-eclipse-dialog">
    <section className="stack beacon-eclipse" aria-label="Beacon eclipse watch">
      <h2 ref={heading} tabIndex={-1}>Beacon eclipse watch</h2>
      {window ? <>
        <div className="beacon-eclipse-frame">
          <CanvasView role="img" aria-label="Beacon camera view of the stellar disk" draw={({ ctx, w, h, dpr }) => {
            if (!usable) { ctx.fillStyle = '#060b13'; ctx.fillRect(0, 0, w, h); return; }
            const fov = Math.max(1.2 * DEG, 5.05 * frame.starRadius, 2.35 * frame.moon.radius) * Math.max(1, w / h);
            drawScope(ctx, { center: unit(frame.star), fov, w, h }, {
              seed: system.seed, sunDir: unit(frame.star), sunRadius: frame.starRadius, starColor: starRGB(system),
              targetDir: null, targetRadius: 0, moonDir: null, moonRadius: 0, skyBrightness: 0, seeing: SEEING, realTime: 0,
              filter: true, solarDiscs: frame.overlap ? [frame.moon] : [], solarCorona: total,
            }, dpr);
          }} />
        </div>
        <div className="row between beacon-eclipse-status">
          <span role="status">{usable ? frame.overlap ? caption[frame.overlap.kind] : 'Clear filtered disk' : 'Star below the beacon’s viewing horizon'}</span>
          <span className="mono muted">{timeLabel(at)}</span>
        </div>
        <input className="beacon-eclipse-slider" type="range" min={0} max={window.to - window.from} step={30} value={at - window.from}
          aria-label="Eclipse preview time" aria-valuetext={timeLabel(at)} onChange={(event) => { setRunning(false); setAt(window.from + Number(event.target.value)); }} />
        <div className="row beacon-eclipse-controls">
          <button className="btn small" disabled={at <= window.from} onClick={() => step(-5 * 60)}>−5 min</button>
          <button className="btn primary small" disabled={at >= window.to && !running} onClick={() => setRunning((p) => !p)}>{running ? 'Pause passage' : 'Play passage'}</button>
          <button className="btn small" disabled={at >= window.to} onClick={() => step(5 * 60)}>+5 min</button>
          <button className="btn small" onClick={next}>Next eclipse</button>
        </div>
        <div className="faint">{total ? 'The beacon switches to its low-light camera during totality. The corona is illustrated.' : 'Solar-filter camera · post-landing preview'}</div>
      </> : <div className="panel-inset">No daytime passage found from this beacon in the scanned interval.</div>}
      <details className="measurement-help"><summary>About this view</summary>
        <p>The beacon is on the equator of the destination planet. The moon can cover some of the star, leave a ring when it appears smaller, or hide the disk when it appears larger. The camera uses the apparent sizes from that location.</p>
        <p>This preview starts after arrival and follows the game’s coplanar orbits. It uses its own clock.</p>
      </details>
    </section>
  </Modal>;
}
