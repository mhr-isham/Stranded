import type { ReactNode } from 'react';
import { DAY } from '../../engine/constants';
import { analyzeYear, yearFitMessage, yearLineAt, yearLineError, type YearAnalysis } from '../../game/yearObservations';
import { fmt, sig } from '../../game/format';
import { Chart, type Series } from '../common/Chart';
import { SendToSheet } from '../common/sheetBits';
import { useMode } from '../../game/modes';

export function YearPlot({ analysis: a, manual = false, teaching = false, band, onBand, label = 'Your recorded positions and year fit' }: { analysis: YearAnalysis; manual?: boolean; teaching?: boolean; band?: [number, number] | null; onBand?: (band: [number, number] | null) => void; label?: string }) {
  const { points, used, fit } = a;
  const mode = useMode(), showError = teaching || mode.sanity;
  if (!points.length) return null;
  const series: Series[] = [{ pts: points, color: '#ffc46b', kind: 'dots', faded: (p) => !!band && (p.x < band[0] || p.x > band[1]) }];
  if (fit && !manual) {
    const dates = [used[0].x, used.at(-1)!.x];
    series.push({ pts: dates.map((x) => ({ x, y: yearLineAt(fit, x) })), color: '#6cc4ff', kind: 'line' });
    if (showError && fit.residualSigma && fit.residualSigma > 1e-10) for (const sign of [-1, 1]) series.push({ pts: Array.from({ length: 25 }, (_, i) => {
      const x = dates[0] + (dates[1] - dates[0]) * i / 24;
      return { x, y: yearLineAt(fit, x) + sign * yearLineError(fit, x, used.length)! };
    }), color: '#a3afc4', kind: 'line' });
  }
  return <><Chart series={series} xLabel="expedition day" yLabel="chart position (°)" band={band} onBand={onBand} brushMode="band" ariaLabel={label} />
    <div className="faint">Dots: your recorded positions.{fit && !manual ? ` Blue line: fitted drift.${showError ? ' Grey edges, when visible: uncertainty in the fitted line.' : ''}` : ''}</div>
    {fit && !manual && showError && <details className="measurement-help"><summary>What do the grey edges mean?</summary><p>They show one standard error of the fitted mean, estimated from the scatter around the line. This assumes independent readings with similar random error. Shared offsets and model mismatch are not included; the band is not an interval for a future individual observation.</p></details>}
  </>;
}

export function YearFitDetails({ analysis: a, manual = false, teaching = false, send = false, children }: { analysis: YearAnalysis; manual?: boolean; teaching?: boolean; send?: boolean; children?: ReactNode }) {
  const mode = useMode(), f = a.fit;
  return <div className="stack year-fit-details" aria-label="Year fit assessment">
    <div className="callout tip" role="status">{manual ? 'Manual-fit challenge: use the recorded positions and dates. Automatic fit lines, rates and year values are hidden.' : yearFitMessage(a)}</div>
    <div className="muted">{a.used.length} distinct selected dates · baseline {fmt(a.baseline, 3)} days{a.duplicate ? ` · ${a.duplicate} same-time repeat(s) excluded from the fit` : ''}{a.invalid ? ` · ${a.invalid} invalid record(s) not plotted` : ''}</div>
    {f && !manual && <>
      <dl className="kv"><dt>Measured drift rate</dt><dd>{sig(f.slope, 5)} °/day</dd><dt>Inferred year</dt><dd className="blue">{sig(f.yearDays, 5)} days</dd>
        {(teaching || mode.sanity) && f.slopeSigma !== undefined && <><dt>Rate standard error from scatter</dt><dd>±{sig(f.slopeSigma, 3)} °/day</dd></>}
      </dl>
      {(teaching || mode.sanity) && f.slopeSigma !== undefined && <div className="faint">{(f.residualSigma ?? 0) <= 1e-10 ? 'No measurable scatter in these selected points does not establish zero uncertainty.' : f.yearSigma === undefined ? 'The rate uncertainty is large relative to the rate: a small symmetric year error would be misleading.' : `First-order year standard error from scatter: ±${sig(f.yearSigma, 3)} days. Shared centring errors, angle-wrap ambiguity and model mismatch are additional.`}</div>}
      {send && <SendToSheet k="P1" value={f.yearDays * DAY} spread={f.yearSigma !== undefined ? f.yearSigma * DAY : undefined} />}
    </>}
    {children}
  </div>;
}

export function EarlyYearComparison({ observations }: { observations: Parameters<typeof analyzeYear>[0] }) {
  const all = analyzeYear(observations), early = analyzeYear(all.used.slice(0, 2).map((p) => p.observation));
  if (!early.fit) return <p>Take positions on two different observing dates to get an early estimate. Then return later to test it.</p>;
  return <div className="stack" aria-label="Early and later year estimates"><table className="log year-comparison"><thead><tr><th>Your evidence</th><th>Time span</th><th>Inferred year</th></tr></thead><tbody>
    <tr><td>First two dates</td><td>{fmt(early.baseline, 2)} d</td><td>{fmt(early.fit.yearDays, 2)} d</td></tr>
    <tr><td>Current record</td><td>{fmt(all.baseline, 2)} d</td><td>{all.fit ? `${fmt(all.fit.yearDays, 2)} d` : 'Fit unavailable'}</td></tr>
  </tbody></table><div>{all.used.length > 2 ? 'You have tested the first line with another observing date. A changed estimate or wider scatter is useful evidence too; more data need not improve a poor model.' : 'This early line has no scatter estimate yet. Choose a later observing date, re-centre and log again.'}</div></div>;
}
