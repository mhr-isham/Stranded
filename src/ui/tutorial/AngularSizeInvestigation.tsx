import { useState } from 'react';
import { ARCSEC } from '../../engine/constants';
import { variantOf } from '../../engine/chapters';
import { interpretAngularSize } from '../../game/micrometer';
import { observationDay } from '../../game/distanceScale';
import { currentWorld, fastForward } from '../../game/sim';
import { clock } from '../../game/clock';
import { useGame } from '../../game/store';

export function AngularSizeInvestigation() {
  const s = useGame(), [selected, setSelected] = useState<string | null>(null), [error, setError] = useState('');
  if (!s.tutorial.active || !s.settings.freeRoam || !['size', 'basic'].includes(s.schoolSession?.id ?? '')) return null;
  const readings = s.readings.filter((r) => r.key === 'alpha2' && r.kept && Number.isFinite(r.value));
  const reading = readings.find((r) => r.id === selected) ?? readings.at(-1);
  const sigma = Number(error), result = reading && error !== '' && Number.isFinite(sigma) && sigma > 0 ? interpretAngularSize(s.sheet, variantOf(currentWorld().system.features), { value: reading.value, sigma: sigma * ARCSEC, at: reading.at }) : null;
  return <section className="panel panel-pad stack" aria-label="Flight School angular-size investigation">
    <div className="meter-label">Optional interpretation · unscored</div><h3>From a disk to a world</h3>
    <button className="btn small" onClick={() => { fastForward(clock.t + 60); clock.paused = true; clock.emit(); }}>Next practice sighting (+60 s)</button>
    <div className="faint">This advances practice time, not your saved expedition. Recheck the image and conditions. Different times can still share seeing and alignment errors.</div>
    {!reading ? <p>Keep a diameter reading first. Place the wires yourself; the controls never snap them to a true edge.</p> : <>
      <label className="field">Diameter sighting<select className="input" value={reading.id} onChange={(e) => { setSelected(e.target.value); setError(''); }}>{readings.map((r, i) => <option key={r.id} value={r.id}>#{i + 1} · {observationDay(r.at)} · {(r.value / ARCSEC).toFixed(3)}″</option>)}</select></label>
      <label className="field">My angular uncertainty (arcsec)<input className="input" type="number" step="any" min="0" value={error} onChange={(e) => setError(e.target.value)} /></label>
      {result ? <>
        <dl className="kv"><dt>Model separation at this sighting</dt><dd>{(result.distance / 1e9).toFixed(3)} million km</dd><dt>Inferred physical radius</dt><dd>{(result.radius / 1000).toFixed(1)} ± {(result.sigma / 1000).toFixed(1)} km</dd><dt>From distance/model inputs</dt><dd>±{(result.sigmaModel / 1000).toFixed(1)} km</dd><dt>From your angular uncertainty</dt><dd>±{(result.sigmaAngle / 1000).toFixed(1)} km</dd></dl>
        <div className="faint">Diameter observed {observationDay(result.at)}. Distance anchor {observationDay(result.anchorAt)}{result.assumedAnchor ? ' · assumed alignment date because its observation date is missing' : ''}. The model transports the distance to the diameter date.</div>
        <button className="btn small primary" disabled={!reading.micrometer} onClick={() => {
          const current = useGame.getState();
          current.set({ readings: current.readings.map((r) => r.id === reading.id && r.micrometer ? { ...r, micrometer: { ...r.micrometer, interpretation: result } } : r) });
        }}>Save my size interpretation</button>
        {reading.micrometer?.interpretation && <div role="status">Interpretation saved with this sighting for your discovery card. Re-marking and logging it again clears the old interpretation.</div>}
        <p className="faint">First-order propagation treats the entered inputs as independent. Shared edge judgement, alignment offsets and an inadequate orbit model can remain. A fine wire step is not an error estimate.</p>
      </> : <p>Enter a positive angular range smaller than the diameter. A dated distance and the orbital periods/alignment model are needed to transport that distance. The focused size exercise supplies labelled prerequisites; Basic Training can return here after building its model.</p>}
    </>}
    <details className="measurement-help"><summary>What should I compare?</summary><p>With the same angular diameter, twice the model distance means twice the physical radius. Repeatability of the wire placement addresses only part of the uncertainty: the distance scale also contributes.</p><p>Keep nearby compatible observations for a local average. Do not interpret widely separated angular sizes as scatter around one unchanging disk. Dates and conditions let you make that choice.</p></details>
    <div className="faint">Nothing here is required to send your diameter or finish the exercise. Interpretation uses your entered model and selected reading, not hidden correct values.</div>
  </section>;
}
