import { useState } from 'react';
import { comparableTimings, controlledTiming } from '../../game/pendulumTechnique';
import { useGame } from '../../game/store';
import { EARTH_GRAVITY, earthGravityComparison, swingTimingBudget } from '../../game/pendulumFeedback';
import { sig } from '../../game/format';
import { Formula } from '../common/sheetBits';

export function TimingComparison({ period, swings, source }: { period?: number; swings?: number; source: string }) {
  const [error, setError] = useState('0.2');
  const measured = period !== undefined && Number.isFinite(period) && period > 0;
  const T = measured ? period : 2;
  const counts = [...new Set([1, 5, 20, ...(swings && Number.isSafeInteger(swings) && swings > 0 ? [swings] : [])])].sort((a, b) => a - b);
  return <details className="measurement-help pendulum-feedback" aria-label="Swing timing comparison">
    <summary>Why time several swings?</summary>
    <div className="stack">
      <p>Start at one end, count each return to that same end, then stop there. One full swing is there and back. You count the swings; this comparison never counts for you.</p>
      <p>{measured ? `${source}: one full swing took ${sig(T, 4)} s. The rows below project that measured period over different counts.` : 'Until a timed period is available, this example assumes a 2-second period. After measuring, compare using your own period.'}</p>
      <label className="field">Assumed total start/stop error (seconds)<input className="input" type="number" inputMode="decimal" min="0.001" step="0.05" value={error} onChange={(e) => setError(e.target.value)} /></label>
      <div className="faint">An example error for the whole timed interval, not a measurement of your reaction time. Change it to explore the effect. It is not added to your reading automatically.</div>
      {swingTimingBudget(T, 1, Number(error)) ? <table className="log timing-comparison"><thead><tr><th>Full swings</th><th>Total time</th><th>± period</th><th>Timing error</th></tr></thead><tbody>{counts.map((N) => {
        const budget = swingTimingBudget(T, N, Number(error))!;
        return <tr key={N} aria-label={N === swings ? 'Your swing count' : undefined}><td>{N}{N === swings ? ' · yours' : ''}</td><td>{sig(budget.duration, 4)} s</td><td>{sig(budget.periodError, 3)} s</td><td>{sig(budget.fraction * 100, 3)}%</td></tr>;
      })}</tbody></table> : <div>Enter a positive, finite timing error to compare.</div>}
      <Formula>T = t / N,  ΔT = Δt / N</Formula>
      <p>The same total start/stop error is spread across more swings. For small errors, the percentage error in gravity from timing alone is about twice the percentage error in the period.</p>
      <p>This is only the timing contribution. An incorrect swing count, length error, a large release angle or wind can still bias the result. Repeat timings to investigate scatter; shared errors need separate care.</p>
    </div>
  </details>;
}

export function GravityMeaning({ value, sigma, source }: { value: number; sigma?: number; source: string }) {
  const comparison = earthGravityComparison(value, sigma);
  if (!comparison) return null;
  const { ratio, ratioSigma } = comparison;
  return <details className="measurement-help pendulum-feedback" aria-label="Gravity compared with Earth">
    <summary>What would this gravity feel like?</summary>
    <div className="stack">
      <p>{source}: <b>{sig(value, 4)}{ratioSigma !== undefined ? ` ± ${sig(sigma!, 3)}` : ''} m/s²</b>.</p>
      <div className="readout small">{sig(ratio, 3)}{ratioSigma !== undefined ? ` ± ${sig(ratioSigma, 2)}` : ''} × Earth gravity</div>
      <p>Your measurement suggests the same person or object would weigh about <b>{sig(ratio * 100, 3)}% of their Earth weight</b>. Their mass stays the same.</p>
      {ratioSigma !== undefined ? <p>Your stated uncertainty scales to ±{sig(ratioSigma * 100, 3)} percentage points of Earth weight. This scales your estimate; it does not independently verify it.</p> : <p>This reading has no stated uncertainty yet. Send gravity with your ± error to the progress sheet for an uncertainty-aware comparison.</p>}
      <div className="faint">Earth reference: {EARTH_GRAVITY} m/s². The comparison uses your result, not a hidden correct value.</div>
      <Formula>W = mg,  W_here / W_Earth = g_here / g_Earth</Formula>
    </div>
  </details>;
}

/** Requested review of recorded technique; no true gravity or correctness grade. */
export function TechniqueReview() {
  const s = useGame(), timings = comparableTimings(s.readings), latest = s.readings.filter((r) => r.kept && r.key === 'g' && r.pendulum).at(-1);
  const stated = s.sheet.g && Number.isFinite(s.sheet.g.sigma) && s.sheet.g.sigma > 0;
  const earned = (s.pendulumMilestones ?? []).includes('twentySwings');
  const periods = timings.map((r) => r.pendulum!.period);
  return <section className="panel panel-pad stack" aria-label="Pendulum technique">
    <b>Technique &amp; milestones</b>
    {earned && <div className="technique-badge">✦ Twenty-swing observation kept <span>cosmetic · 0 points</span></div>}
    <details className="measurement-help"><summary>Review my technique</summary>
      <div className="stack">
        <div>{latest && controlledTiming(latest) ? '✓ Controlled release recorded: a small angle and a kept manual timing of at least five swings with matching bob motion.' : 'Controlled-release evidence: no qualifying kept timing selected yet. Technique recording is optional; other readings remain usable.'}</div>
        <div>{timings.length >= 3 ? '✓' : '○'} {timings.length} comparable kept timing{timings.length === 1 ? '' : 's'} from separate releases. Three fresh releases form a repeat set.</div>
        {periods.length >= 2 && <div>Your recorded period range: {sig(Math.min(...periods), 4)}–{sig(Math.max(...periods), 4)} s. Comparable timings use lengths within 1% and the same recorded wind protection.</div>}
        <div>{stated ? '✓ Your progress sheet includes a stated gravity uncertainty.' : '○ Gravity uncertainty has not been stated on the progress sheet.'} Stating an error bar is a recorded choice, not proof that it is adequate.</div>
        <p>Small releases and repeat timings help you investigate technique. Repeats still share ruler, setup and other systematic errors. Similar results do not prove the gravity is correct.</p>
        <p>The optional twenty-swing milestone recognizes a kept manual timing at a 1–10° release, with at least twenty full swings and matching recorded bob motion. It is awarded once per expedition or isolated practice run. The motion record checks only this milestone; it never corrects your count or result.</p>
      </div>
    </details>
    <details className="measurement-help"><summary>Timing assistance &amp; scoring</summary><p>Mouse, touch and keyboard operate the same manual watch and counter. There is no automatic swing counter or stop here. These controls do not change scoring or count as ECHO timing assistance.</p><p>ECHO-supplied practice observations are labeled and do not qualify for manual technique milestones. Wind stabilization and your windscreen remain labeled in observation conditions.</p><p>Technique feedback and the milestone add no score, fuel, hint uses or verification charges. Your normal measurement and expedition scoring still applies; this cosmetic milestone cannot be farmed for points.</p></details>
  </section>;
}
