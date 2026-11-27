import { DAY } from '../../engine/constants';
import { useGame } from '../../game/store';
import { RELAY_SIGHTING_STEP, relayMotion } from '../../game/relayObservation';
import { sightingChange } from '../../game/skyObservation';
import { Chart } from '../common/Chart';

export function RelayWatch({ scope, canKeep, canStep, canRead, followLabel, reason, coaching, onScope, onKeep, onStep, onZoom, onRead }: {
  scope: boolean; canKeep: boolean; canStep: boolean; canRead: boolean; followLabel: string; reason: string; coaching: boolean;
  onScope: () => void; onKeep: () => void; onStep: () => void; onZoom: () => void; onRead: () => void;
}) {
  const notes = useGame((s) => s.skySightings);
  const tag = useGame((s) => s.relayTag);
  const { points, total, span, shift, motion } = relayMotion(notes ?? []);
  const track = points.length >= 2 && <div className="relay-track">
    <Chart ariaLabel="Motion from your telescope sightings" series={[{
      pts: points.map((p) => ({ x: (p.at - points[0].at) / 60, y: sightingChange(points[0], p) })),
      color: '#6cc4ff', kind: 'dots',
    }]} height={145} xLabel="minutes from first sighting" yLabel="shift against stars (°)" />
  </div>;
  return <section className="panel-inset relay-watch stack" aria-label="Moving-light watch">
    <div className="row between"><b>Moving-light watch</b><span className="faint">{total} telescope sighting{total === 1 ? '' : 's'}</span></div>
    {tag ? <>
      <div className="relay-tag stack">
        <span className="meter-label">Hull registration recovered</span>
        <strong className="mono">{tag.mark}</strong>
        <div className="relay-signal" aria-hidden="true">{tag.signal.map((sample, i) => <i key={i} style={{ height: `${Math.round(sample * 100)}%` }} />)}</div>
        <span className="faint">Optical tag · expedition day {(tag.at / DAY + 1).toFixed(3)}</span>
      </div>
      {track && <details className="measurement-help"><summary>Review recorded motion</summary>{track}</details>}
    </> : <>
      {!scope ? <button className="btn small" onClick={onScope}>{followLabel}</button> :
        <div className="row">
          <button className="btn small" disabled={!canKeep} onClick={onKeep}>Keep telescope sighting</button>
          <button className="btn small ghost" disabled={!canStep} onClick={onStep}>Wait {RELAY_SIGHTING_STEP} s</button>
        </div>}
      {span > 0 && <span className="mono">{shift.toFixed(2)}° across {Math.round(span)} s</span>}
      <div className={motion ? 'blue' : 'muted'}>{motion ? 'Motion recorded against the background stars.' : 'Record three separated telescope sightings during one pass.'}</div>
      {motion && <div className="row">
        <button className="btn small" onClick={onZoom}>Zoom on selected light</button>
        <button className="btn small primary" onClick={onRead} disabled={!canRead}>Read hull tag</button>
      </div>}
      {reason && <p className="faint">{reason}</p>}
      {track}
      {coaching && <details className="measurement-help"><summary>How do I follow it?</summary>
        <p>Keep the light near the crosshair. Wait briefly between sightings and check how far your pointings have moved across the star chart. The mount follows as long as the light stays visible.</p>
        <p>The hull tag returns a coded series of glints. At high zoom, the reader can isolate its signal from the surrounding field.</p>
      </details>}
    </>}
  </section>;
}
