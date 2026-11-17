import { DAY, DEG } from '../engine/constants';
import type { TimedValue } from './store';

export interface YearPoint { x: number; y: number; observation: TimedValue }
export interface YearFit {
  slope: number; intercept: number; meanX: number; meanY: number; sxx: number;
  yearDays: number; slopeSigma?: number; residualSigma?: number; yearSigma?: number;
}
export interface YearAnalysis {
  points: YearPoint[]; used: YearPoint[]; invalid: number; duplicate: number;
  baseline: number; fit: YearFit | null;
  status: 'empty' | 'dates' | 'baseline' | 'invalid' | 'direction' | 'provisional' | 'scatter';
}

/** Chronological, finite observations only. No world model or true orbital period. */
export function yearPoints(observations: TimedValue[]) {
  const valid = observations.filter((o) => Number.isFinite(o.at) && o.at >= 0 && Number.isFinite(o.v)).slice().sort((a, b) => a.at - b.at);
  const points: YearPoint[] = [];
  let previous: number | undefined, previousAt = -Infinity;
  for (const observation of valid) {
    const raw = observation.v / DEG, reference = previous ?? raw;
    if (!Number.isFinite(raw)) continue;
    const y = raw + 360 * Math.round((reference - raw) / 360);
    if (Number.isFinite(y)) {
      points.push({ x: observation.at / DAY, y, observation });
      if (observation.at !== previousAt) { previous = y; previousAt = observation.at; }
    }
  }
  return points;
}

export function analyzeYear(observations: TimedValue[], band: [number, number] | null = null): YearAnalysis {
  const points = yearPoints(observations), selected = points.filter((p) => !band || (p.x >= band[0] && p.x <= band[1]));
  const used = selected.filter((p, i) => i === 0 || p.x !== selected[i - 1].x);
  const baseline = used.length > 1 ? used.at(-1)!.x - used[0].x : 0;
  const result: YearAnalysis = { points, used, invalid: observations.length - points.length, duplicate: selected.length - used.length, baseline, fit: null, status: !points.length ? 'empty' : used.length < 2 ? 'dates' : 'baseline' };
  // Native observations already require half a day between recordings. Legacy,
  // imported and chart-selected data must meet that same baseline requirement.
  if (used.length < 2 || baseline < .5) return result;
  const x0 = used[0].x, y0 = used[0].y, n = used.length;
  const dx = used.map((p) => p.x - x0), dy = used.map((p) => p.y - y0);
  const mx = dx.reduce((a, b) => a + b, 0) / n, my = dy.reduce((a, b) => a + b, 0) / n;
  const sxx = dx.reduce((sum, x) => sum + (x - mx) ** 2, 0);
  const slope = dx.reduce((sum, x, i) => sum + (x - mx) * (dy[i] - my), 0) / sxx;
  if (![sxx, slope, mx, my].every(Number.isFinite) || sxx <= 0) return { ...result, status: 'invalid' };
  if (slope <= 0) return { ...result, status: 'direction' };
  const meanX = x0 + mx, meanY = y0 + my, intercept = meanY - slope * meanX, yearDays = 360 / slope;
  if (![meanX, meanY, intercept, yearDays, yearDays * DAY].every(Number.isFinite) || yearDays <= 0) return { ...result, status: 'invalid' };
  const fit: YearFit = { slope, intercept, meanX, meanY, sxx, yearDays };
  if (n > 2) {
    const rss = dx.reduce((sum, x, i) => sum + (dy[i] - my - slope * (x - mx)) ** 2, 0);
    const residualSigma = Math.sqrt(rss / (n - 2)), slopeSigma = residualSigma / Math.sqrt(sxx), yearSigma = yearDays * slopeSigma / slope;
    if (![residualSigma, slopeSigma, yearSigma].every(Number.isFinite)) return { ...result, status: 'invalid' };
    fit.residualSigma = residualSigma; fit.slopeSigma = slopeSigma;
    // Near-zero rates need a non-linear/infinite interval, not a small-looking ±.
    if (residualSigma > 1e-10 && slopeSigma / slope < .25 && yearSigma > 0) fit.yearSigma = yearSigma;
  }
  return { ...result, fit, status: n === 2 ? 'provisional' : 'scatter' };
}

export const yearLineAt = (fit: YearFit, day: number) => fit.meanY + fit.slope * (day - fit.meanX);
/** Standard error of the fitted mean under independent, equal-variance scatter. */
export function yearLineError(fit: YearFit, day: number, n: number) {
  return fit.residualSigma === undefined ? null : fit.residualSigma * Math.sqrt(1 / n + (day - fit.meanX) ** 2 / fit.sxx);
}

export function yearFitMessage(a: YearAnalysis) {
  switch (a.status) {
    case 'empty': return 'Keep your first position to begin the investigation.';
    case 'dates': return 'One observing date cannot establish a drift rate. Repeats at the same time add no time baseline.';
    case 'baseline': return 'The selected observations cover less than half a day. Keep them and return on another observing date.';
    case 'invalid': return 'These observations do not support a finite fit. Inspect the selected dates and positions.';
    case 'direction': return 'The selected positions do not establish positive annual drift. Check centring, angle wrap and the chosen dates.';
    case 'provisional': return 'Early estimate: two dates define a line, but cannot establish scatter or a fitted uncertainty. Another observing date can test it.';
    case 'scatter': return 'These dates can test a line. Its scatter describes repeatability; shared errors and a poor model can remain.';
  }
}
