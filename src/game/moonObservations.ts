import { ARCSEC, DAY } from '../engine/constants';
import { moonFit, trackedPhase, type SineFit } from './fits';
import type { TimedValue } from './store';

export interface MoonPoint { x: number; y: number; at: number }
export interface MoonStudy {
  signature: string; from: number; to: number; count: number; mid: number;
  period: number; amplitude: number; sigmaPeriod: number; sigmaAmplitude: number;
  model: 'A' | 'B'; rms: number; plot: { x: number; y: number }[];
}
export const MOON_LOCAL_DAYS = 50;
function samples(observations: TimedValue[]) {
  return observations.filter((o) => Number.isFinite(o.at) && Number.isFinite(o.v)).slice().sort((a, b) => a.at - b.at).filter((o, i, all) => !i || o.at !== all[i - 1].at);
}
function usable(f: SineFit | null): f is SineFit {
  return !!f && [f.period, f.amplitude, f.sigmaAmplitude, f.sigmaPeriod, f.rms].every(Number.isFinite) && f.period >= .4 && f.period <= 60 && f.amplitude > 0 && f.sigmaAmplitude >= 0 && f.sigmaPeriod >= 0;
}

/** Uses only recorded moon/planet data. Manual-fit mode never calls the solver. */
export function analyzeMoon(observations: TimedValue[], planetTrack: TimedValue[], band: [number, number] | null = null, manual = false) {
  const points: MoonPoint[] = samples(observations).map((o) => ({ x: o.at / DAY, y: o.v / ARCSEC, at: o.at }));
  const rangeValid = !band || band.every(Number.isFinite) && band[0] <= band[1];
  const used = rangeValid ? points.filter((p) => !band || p.x >= band[0] && p.x <= band[1]) : [];
  const from = used[0]?.x ?? 0, to = used.at(-1)?.x ?? 0, span = to - from, mid = (from + to) / 2;
  let status = 'Choose at least 12 distinct moon sightings to analyse.';
  let fit: SineFit | null = null, alternative: SineFit | null = null, edgeDays = 0;
  const track = samples(planetTrack), ts = track.map((p) => p.at / DAY);
  const gaps = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b);
  const cadence = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 1;
  const edgeLimit = Math.min(2, 1.25 * cadence);
  const phase = trackedPhase(track);
  const coverage = !!phase && used.every((p) => {
    if (p.x < ts[0]) { edgeDays = Math.max(edgeDays, ts[0] - p.x); return ts[0] - p.x <= edgeLimit; }
    if (p.x > ts.at(-1)!) { edgeDays = Math.max(edgeDays, p.x - ts.at(-1)!); return p.x - ts.at(-1)! <= edgeLimit; }
    const right = ts.findIndex((t) => t >= p.x);
    return right === 0 || Math.abs(ts[right] - p.x) < 1e-9 || ts[right] - ts[right - 1] <= Math.min(4, Math.max(2, 3 * cadence));
  });
  if (!rangeValid) status = 'The start date must be no later than the end date.';
  else if (manual) status = 'Manual-fit challenge: read the chart and enter your own values on the progress sheet.';
  else if (used.length >= 12 && span <= 0) status = 'Distinct observing times are needed to establish a period.';
  else if (used.length >= 12 && span > MOON_LOCAL_DAYS) status = 'This interval exceeds the 50-day limit of the local changing-swing approximation.';
  else if (used.length >= 12 && Math.max(...used.map((p) => p.y)) - Math.min(...used.map((p) => p.y)) < .5 - 1e-9) status = 'These selected readings show no resolved swing at the tracker’s 0.5″ step.';
  else if (used.length >= 12 && !coverage) status = 'The planet tracker does not support a viewing-direction correction across these dates.';
  else if (used.length >= 12) {
    const x = used.map((p) => p.x), y = used.map((p) => p.y);
    const first = moonFit(x, y, .4, 60, phase, true);
    if (usable(first) && x.every((t) => Number.isFinite(first.model(t)))) {
      fit = first;
      // The legacy alternative seeds a second search. Refit it with the same
      // changing-envelope family, including its own uncertainty estimates.
      const seed = first.alternative?.period;
      if (seed && Number.isFinite(seed)) {
        const other = moonFit(x, y, Math.max(.4, seed * .98), Math.min(60, seed * 1.02), phase, true);
        if (usable(other) && x.every((t) => Number.isFinite(other.model(t))) && Math.abs(Math.log(other.period / first.period)) > .15) {
          const mean = y.reduce((a, b) => a + b, 0) / y.length;
          const variance = y.reduce((a, b) => a + (b - mean) ** 2, 0) / y.length;
          if (other.rms ** 2 < first.rms ** 2 + .03 * variance) {
            if (other.rms < first.rms) { fit = other; alternative = first; } else alternative = other;
          }
        }
      }
      status = span < fit.period ? 'Early candidate: the selected interval covers less than one fitted cycle.' : alternative ? 'More than one period remains plausible in these observations.' : 'A candidate orbit fit is available for these dates.';
    } else status = 'These selected observations do not produce a finite orbit fit.';
  }
  return { points, used, from, to, span, mid, fit, alternative, status, manual, edgeDays, coverage, invalid: observations.length - points.length };
}
export type MoonAnalysis = ReturnType<typeof analyzeMoon>;

export function moonStudy(a: MoonAnalysis, model: 'A' | 'B'): MoonStudy | null {
  const f = model === 'B' ? a.alternative : a.fit;
  if (!f || !a.used.length || a.manual) return null;
  const plot = a.used.length <= 180 ? a.used : Array.from({ length: 180 }, (_, i) => a.used[Math.round(i * (a.used.length - 1) / 179)]);
  return { signature: `${a.from}:${a.to}:${a.used.length}:${f.period}:${f.amplitude}`, from: a.from, to: a.to, count: a.used.length, mid: a.mid, period: f.period, amplitude: f.amplitude, sigmaPeriod: f.sigmaPeriod, sigmaAmplitude: f.sigmaAmplitude, model, rms: f.rms, plot: plot.map(({ x, y }) => ({ x, y })) };
}
