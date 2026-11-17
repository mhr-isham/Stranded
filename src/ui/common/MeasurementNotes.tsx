import { DAY, DEG } from '../../engine/constants';
import { QUANTITY_INFO } from '../../engine/chain';
import { conditionSummary } from '../../game/measurementEnvironment';
import type { Reading } from '../../game/store';
import { useGame } from '../../game/store';
import { fmt, sig, toDisplay } from '../../game/format';
import { seeingFactor, hasChallenge } from '../../game/challenges';
import { useGameTime } from './widgets';

export function MeasurementNotes({ reading }: { reading: Reading }) {
  const e = reading.environment;
  if (!e) return <div className="faint" style={{ fontSize: 10 }}>{reading.pendulum?.technique?.source === 'echo' ? 'ECHO-supplied timing; manual technique not recorded. Conditions not recorded.' : 'Conditions not recorded'}</div>;
  const info = QUANTITY_INFO[reading.key];
  const value = (v: number) => `${sig(toDisplay(reading.key, v), 5)} ${info.unit}`;
  return <details className="measurement-notes">
    <summary>Conditions &amp; calculation</summary>
    <div>{conditionSummary(e)}</div>
    {reading.pendulum?.swings !== undefined && reading.pendulum.time !== undefined && <div>Manual timing: {reading.pendulum.swings} full swings in {fmt(reading.pendulum.time, 3)} s; period {fmt(reading.pendulum.period, 4)} s; measured length {fmt(reading.pendulum.length, 4)} m.</div>}
    {reading.pendulum?.technique && <div>{reading.pendulum.technique.source === 'echo' ? 'ECHO-supplied timing; manual technique not recorded.' : `Manually started, counted and stopped. Release angle ${fmt(reading.pendulum.technique.angle, 1)}°; motion recorded for technique milestones.`}</div>}
    <div>Captured on expedition day {fmt(e.at / DAY + 1, 3)}.</div>
    <div>Instrument result: {value(e.rawValue)}.</div>
    {e.wind && <div>{e.wind.protection === 'none' ? 'Exposed measurement.' : e.wind.protection === 'echo' ? 'ECHO physically stabilized the rig.' : 'You fitted the windscreen before timing.'} No numerical wind correction was applied.</div>}
    {e.horizon && <>
      <div>{e.horizon.station}, eye height {fmt(e.horizon.height, 1)} m. {e.horizon.legacyCompensated ? 'Legacy displayed dip' : 'Apparent dip'} {fmt(e.horizon.rawAngle / DEG, 4)}°; dip used {fmt(e.horizon.usedAngle / DEG, 4)}°.</div>
      {e.horizon.aim && <div>At capture: {e.horizon.aim.tripod ? 'tripod fitted' : 'hand-held'}, {e.horizon.aim.braced ? 'braced' : 'unbraced'}; scale step {fmt(e.horizon.aim.stepDeg, 3)}°; magnification {fmt(e.horizon.aim.zoom, 1)}×. Stabilization does not remove refraction.</div>}
      {e.horizon.legacyCompensated && <div>The original uncompensated angle was not captured by this legacy sight.</div>}
      {e.horizon.correction && <>
        <div>k = {fmt(e.horizon.correction.k, 3)} ± {fmt(e.horizon.correction.sigmaK, 3)}. Used result: {value(reading.value)}.</div>
        {e.horizon.correction.sampledAt !== undefined && <div>Local air sample: expedition day {fmt(e.horizon.correction.sampledAt / DAY + 1, 3)}.</div>}
        <div>Shared model contribution (first-order): ±{value(e.horizon.correction.sigmaValue)}. Repeating this calibration does not remove its shared uncertainty.</div>
        {e.horizon.correction.source === 'echo-humidity' && <div>Episodic humidity calibration only; persistent layering can remain.</div>}
      </>}
    </>}
    {reading.micrometer && <div>Manual micrometer · live sighting with {reading.micrometer.revisions} revision{reading.micrometer.revisions === 1 ? '' : 's'}. Wire A {fmt(Math.atan(reading.micrometer.wireA) * 648000 / Math.PI, 3)}″, B {fmt(Math.atan(reading.micrometer.wireB) * 648000 / Math.PI, 3)}″; field {fmt(reading.micrometer.field * 648000 / Math.PI, 1)}″. Re-marking this observing instant updates one sighting. Different timestamps alone do not establish independent errors.</div>}
    {e.seeing?.frozen && <div>Repeated marks on this frozen image pair are not independent exposures.</div>}
  </details>;
}

/** An observable image-quality indicator in every mode; advice expands only on request. */
export function SeeingConditions({ frozenAt }: { frozenAt?: number }) {
  const s = useGame();
  const now = useGameTime(2);
  const at = frozenAt ?? now;
  const factor = seeingFactor(s, at);
  return <section className="panel panel-pad stack" aria-label="Telescope conditions">
    <b>{frozenAt !== undefined ? 'Exposure conditions' : 'Image conditions'}</b>
    <div className="muted" style={{ fontSize: 12 }}>{factor > 1.5 ? 'Turbulent air: a broad, unsteady image.' : 'Steadier air: allow for the remaining blur and alignment error.'}{frozenAt !== undefined && ` Frozen pair from expedition day ${(at / DAY + 1).toFixed(3)}.`}</div>
    <details className="measurement-help"><summary>Conditions and methods</summary>
      <p>Try another observing session, or make separate measurements after the image changes. Use their scatter to estimate random repeatability, and allow for edge placement and shared alignment errors.</p>
      <p>Taking more readings cannot remove a systematic offset. Identical repeats or repeated marks on one frozen image do not establish zero uncertainty. A larger apparent disk or a longer parallax baseline can improve relative precision.</p>
      {frozenAt !== undefined && <p>Take a new simultaneous pair for another exposure. Compare nearby sessions: the planet moves, so widely separated dates should not be averaged as if the distance were fixed.</p>}
      {hasChallenge(s, 'seeing') && <p>The bad-seeing season keeps background blur elevated even on otherwise calmer nights. Account for that limitation rather than waiting for a guaranteed perfectly sharp image.</p>}
    </details>
  </section>;
}
