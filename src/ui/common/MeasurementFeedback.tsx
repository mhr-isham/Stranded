import { useEffect, useState, type ReactNode } from 'react';
import { DAY } from '../../engine/constants';
import { QUANTITY_INFO, type PrimaryKey } from '../../engine/chain';
import { sig, toDisplay, fmt } from '../../game/format';
import { fitResiduals, subscribeObservationRecord, readingFingerprint, type ObservationNotice } from '../../game/measurementFeedback';
import { useGame, type Reading } from '../../game/store';
import { Chart } from './Chart';

/** A quiet instrument readout, not an accuracy badge or a progression gate. */
export function EvidenceSignal({ title, children, label }: { title: string; children: ReactNode; label: string }) {
  return <div className="evidence-signal" aria-label={label}>
    <span className="evidence-emblem" aria-hidden="true">✧</span>
    <div><b>{title}</b><div className="evidence-description">{children}</div></div>
  </div>;
}

/** Keep optional plots out of the render loop until requested. */
export function FitInspection({ summary, children }: { summary: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return <details className="measurement-help" onToggle={(e) => setOpen(e.currentTarget.open)}><summary>{summary}</summary>{open && children}</details>;
}

/** Only a recording action while this log is mounted animates/announces.
 * Opening an archive, exclusion, deletion and reload never replay the moment. */
export function ObservationReceipt({ k, readings }: { k: PrimaryKey; readings: Reading[] }) {
  const runId = useGame((s) => s.runId);
  const [activity, setActivity] = useState<ObservationNotice | null>(null);
  useEffect(() => {
    setActivity(null);
    return subscribeObservationRecord((notice) => { if (notice.runId === runId && notice.reading.key === k) setActivity(notice); });
  }, [runId, k]);
  useEffect(() => {
    if (!activity) return;
    const timer = setTimeout(() => setActivity(null), 4200);
    return () => clearTimeout(timer);
  }, [activity]);
  const fresh = activity && readings.find((r) => r.id === activity.reading.id && readingFingerprint(r) === activity.fingerprint);
  const latest = fresh ?? readings.at(-1);
  if (!latest || !Number.isFinite(latest.value)) return <><span className="measurement-announcement" role="status" /></>;
  const info = QUANTITY_INFO[k], active = !!fresh;
  const title = active ? activity!.revised ? 'Observation revised' : 'Observation saved' : 'Latest saved observation';
  return <><span className="measurement-announcement" role="status">{active ? `${title}: ${info.symbol}, ${sig(toDisplay(k, latest.value), 5)} ${info.unit}.` : ''}</span><div key={active ? activity!.fingerprint + latest.id : 'archive'} className={`observation-receipt ${active ? 'recorded' : ''}`} aria-label={`${info.symbol} observation receipt`}>
    <div className="observation-receipt-head"><span aria-hidden="true">✧</span><b>{title}</b><span className="faint">{readings.length} in log</span></div>
    <div className="observation-receipt-value">{sig(toDisplay(k, latest.value), 5)} <span>{info.unit}</span></div>
    <div className="faint">{Number.isFinite(latest.at) && latest.at >= 0 ? `Expedition day ${fmt(latest.at / DAY + 1, 3)}` : 'Observing date not recorded'} · {latest.kept ? 'included in your selection' : 'excluded from your selection'}</div>
    {active && activity!.revised && <div className="faint">This updates the same recorded source.</div>}
  </div></>;
}

/** Requested numerical working; never mounted in a manual-fit challenge. */
export function FitResiduals({ points, model, unit, label }: { points: { x: number; y: number }[]; model: (x: number) => number; unit: string; label: string }) {
  const rows = fitResiduals(points, model);
  if (!rows.length) return null;
  return <div className="stack fit-residuals" aria-label={label}>
    <p>Residual means <b>observed minus fitted</b>: above zero is above the curve; below zero is below it. These are your selected observations, not differences from a hidden correct answer.</p>
    <Chart ariaLabel={`${label} plot`} height={170} series={[
      { pts: [{ x: rows[0].x, y: 0 }, { x: rows.at(-1)!.x, y: 0 }], color: '#8b9db8', kind: 'line' },
      { pts: rows, color: '#ffc46b', kind: 'dots' },
    ]} xLabel="elapsed days" yLabel={`observed − fitted (${unit})`} yFmt={(value) => value === 0 ? '0' : Number(value.toPrecision(2)).toString()} />
    <div className="faint">{rows.length} selected observations · elapsed days {fmt(rows[0].x, 3)}–{fmt(rows.at(-1)!.x, 3)} from expedition start. A close fit can still share calibration errors or use an unsuitable model.</div>
    <details className="measurement-help"><summary>Numerical residuals and units</summary>
      <div className="residual-table-scroll"><table className="log"><thead><tr><th>Day</th><th>Observed ({unit})</th><th>Fitted ({unit})</th><th>Difference ({unit})</th></tr></thead><tbody>{rows.slice(-80).map((r, i) => <tr key={i}><td>{fmt(r.x, 3)}</td><td>{sig(r.observed, 5)}</td><td>{sig(r.fitted, 5)}</td><td>{sig(r.y, 4)}</td></tr>)}</tbody></table></div>
      {rows.length > 80 && <p>Latest 80 selected observations shown here. The plot uses all {rows.length}; the original observation log is preserved.</p>}
    </details>
  </div>;
}
