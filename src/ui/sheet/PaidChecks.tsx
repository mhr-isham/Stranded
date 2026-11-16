import { useMemo, useState } from 'react';
import type { Estimate, QuantityKey } from '../../engine/chain';
import { DAY } from '../../engine/constants';
import { useGame } from '../../game/store';
import { countText, useMode } from '../../game/modes';
import { currentWorld } from '../../game/sim';
import { evidenceStamp, requestVerification, VERIFICATION_COST, type VerificationKind, type VerificationRecord } from '../../game/verification';
import { showQuantity } from '../../game/format';
import { sfx } from '../../game/audio';

export function PaidChecks({ quantity, estimate }: { quantity: QuantityKey; estimate: Estimate }) {
  const s = useGame(), mode = useMode();
  const [error, setError] = useState('');
  const stamp = useMemo(() => evidenceStamp(s), [s.sheet, s.readings, s.starObs, s.oppPicks, s.oppPicksG, s.moonTrack, s.moonTrackG, s.track, s.starPar, s.shadows]);
  if (mode.verifies <= 0) return null;
  const remaining = Math.max(0, mode.verifies - s.checksUsed);
  const enoughFuel = currentWorld().system.fuelDv - s.penaltyDv >= VERIFICATION_COST;
  const valid = Number.isFinite(estimate.value) && Number.isFinite(estimate.sigma) && estimate.sigma > 0;
  const history = (s.verificationHistory ?? []).filter((r) => r.key === quantity);
  const run = (kind: VerificationKind) => {
    const result = requestVerification(quantity, kind);
    setError(result.ok ? '' : result.reason);
    sfx(result.ok ? kind === 'sensors' ? result.record.good ? 'good' : 'bad' : 'radio' : 'bad');
  };
  return <section className="stack paid-checks" aria-label="Paid ECHO checks">
    <hr className="sep" /><b>ECHO paid checks</b>
    <div className="muted" style={{ fontSize: 12 }}>Each action costs {VERIFICATION_COST} m/s of flight reserve. Shared allowance: {countText(remaining)} remaining.</div>
    {s.checksUsed > (s.verificationHistory?.length ?? 0) && <div className="faint" style={{ fontSize: 12 }}>Earlier paid checks have no saved result records. Their spent uses still count.</div>}
    <button className="btn small" disabled={!valid || !enoughFuel || remaining <= 0} onClick={() => run('evidence')}>Review my evidence</button>
    <div className="faint" style={{ fontSize: 12 }}>Uses your kept observations, calculations and recorded conditions. It does not consult hidden truth.</div>
    <button className="btn small amber" disabled={!valid || !enoughFuel || remaining <= 0} onClick={() => run('sensors')}>Verify against ship sensors</button>
    <div className="faint" style={{ fontSize: 12 }}>Paid exception: compares your entry with the true value and reports agreement with your error bar, without revealing the exact value.</div>
    {!enoughFuel && <div className="muted" style={{ fontSize: 12 }}>Less than {VERIFICATION_COST} m/s of flight reserve remains.</div>}
    {error && <div className="hint" role="status">{error}</div>}
    {history.at(-1) && <SavedCheck record={history.at(-1)!} estimate={estimate} stamp={stamp} />}
    {history.length > 1 && <details className="measurement-help"><summary>Earlier paid checks ({history.length - 1})</summary>{history.slice(0, -1).reverse().map((r) => <SavedCheck key={r.id} record={r} estimate={estimate} stamp={stamp} />)}</details>}
  </section>;
}

function SavedCheck({ record, estimate, stamp }: { record: VerificationRecord; estimate: Estimate; stamp: string }) {
  const mode = useMode();
  const stale = record.value !== estimate.value || record.sigma !== estimate.sigma || record.estimateAt !== estimate.at || (record.kind === 'evidence' && record.evidenceStamp !== stamp);
  return <section className="panel-inset stack" aria-label="Saved ECHO result">
    <b>{record.kind === 'sensors' ? 'Ship-sensor verification' : 'Evidence review'}</b>
    <div className="faint" style={{ fontSize: 12 }}>Checked {showQuantity(record.key, record.value, record.sigma)} · expedition day {(record.at / DAY + 1).toFixed(3)}.</div>
    {stale && <div className="callout warn">The entry or supporting records have changed. This saved result describes the earlier snapshot.</div>}
    <ul>{record.facts.map((fact, i) => <li key={i}>{fact}</li>)}</ul>
    {record.why.length > 0 && <details open={mode.name === 'Stargazer'}><summary>Why this matters</summary>{record.why.map((why, i) => <p key={i}>{why}</p>)}</details>}
    {record.next.length > 0 && <details open={mode.name === 'Stargazer'}><summary>How to investigate</summary>{record.next.map((next, i) => <p key={i}>{next}</p>)}</details>}
  </section>;
}
