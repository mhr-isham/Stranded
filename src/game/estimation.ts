import { linearFit } from '../engine/solver';

export const ESTIMATION_DRILLS = [
  { id: 'line', title: 'Extend a trend', description: 'Predict a later position from scattered star observations.' },
  { id: 'interpolate', title: 'Estimate between readings', description: 'Interpolate and compare its uncertainty with a longer forecast.' },
  { id: 'ratio', title: 'Scale a swing time', description: 'Use a length ratio and the square-root rule.' },
  { id: 'bracket', title: 'Bracket an event', description: 'Use before/after observations to bound an unknown event time.' },
  { id: 'scale', title: 'Estimate a rover journey', description: 'Round sensibly, convert units and allow for uncertain speed.' },
  { id: 'scatter', title: 'Estimate from repeated timings', description: 'Estimate a mean period and distinguish scatter from shared errors.' },
  { id: 'parallax', title: 'Estimate a distance and its uncertainty', description: 'Use a small parallax angle and propagate measurement errors.' },
] as const;
export type EstimationId = typeof ESTIMATION_DRILLS[number]['id'];
export interface EstimationScenario {
  question: string; unit: string; data: { label: string; value: string }[];
  reference: number; range: number; bounds: boolean; hint: string; explanation: string; tex: string;
}
const f = (value: number) => Number(value.toPrecision(5)).toString();

/** Explicit teaching datasets, with several repeatable variants per exercise. */
export function estimationScenario(id: EstimationId, variant = 0): EstimationScenario {
  const v = ((Math.floor(variant) % 6) + 6) % 6;
  if (id === 'line' || id === 'interpolate') {
    const x = [0, 10, 20];
    const y = x.map((day, i) => 12 + v * 2 + (0.8 + v * .05) * day + [-.2, .3, -.1][i]);
    const at = id === 'line' ? 34 + v * 2 : 8;
    const fit = linearFit(x, y);
    const meanX = 10;
    const residual = y.reduce((sum, value, i) => sum + (value - fit.intercept - fit.slope * x[i]) ** 2, 0);
    const range = Math.sqrt(residual * (1 + 1 / 3 + (at - meanX) ** 2 / 200));
    return { question: `Estimate the star’s position on day ${at}, with a ± range. These are unwrapped positions in a toy constant-drift model.`, unit: '°',
      data: x.map((day, i) => ({ label: `Day ${day}`, value: `${f(y[i])}°` })), reference: fit.intercept + fit.slope * at, range, bounds: false,
      hint: 'Estimate the rise over run, draw a line through the middle of the readings, then read it at the requested day.',
      explanation: 'This comparison uses a line fitted to the displayed data. The example range includes scatter and uncertainty in the fitted rate. Extrapolating farther generally increases it; interpolation stays within the observed baseline. Three points do not establish a precise confidence interval.',
      tex: 'y(t)=a+bt,\\quad b\\approx\\frac{\\Delta y}{\\Delta t}' };
  }
  if (id === 'ratio') {
    const length = .8 + v * .1, period = 1.6 + v * .08, factor = v % 2 ? .5 : 2;
    return { question: 'Estimate one full swing at the new length, with a ± range. Assume small angles and unchanged gravity; the length ratio is known in this teaching example.', unit: 's',
      data: [{ label: 'Original length', value: `${f(length)} m` }, { label: 'Timed period', value: `${f(period)} ± 0.04 s` }, { label: 'New length', value: `${f(length * factor)} m` }],
      reference: period * Math.sqrt(factor), range: .04 * Math.sqrt(factor), bounds: false, hint: 'Period scales with the square root of length. Apply the same scale factor to the period uncertainty.',
      explanation: 'Changing the length by a factor does not change the period by that same factor. This example propagates the given timing uncertainty; real length measurements and release angle can add uncertainty.', tex: 'T_2=T_1\\sqrt{L_2/L_1}' };
  }
  if (id === 'bracket') {
    const lower = 36 + v * 3, upper = lower + 4 + v % 3;
    return { question: 'Estimate when the event began, using a central time and a range that covers the interval allowed by the observations.', unit: 'days',
      data: [{ label: `Day ${lower}`, value: 'Event has not begun' }, { label: `Day ${upper}`, value: 'Event has begun' }], reference: (lower + upper) / 2, range: (upper - lower) / 2, bounds: true,
      hint: 'The observations bound the event between the two dates. A midpoint is a convenient estimate; the data do not identify a unique exact date.',
      explanation: 'This is an observational bracket, not a statistical one-sigma error bar. A narrower interval would exclude event times still allowed by the data. More frequent observations can narrow the bracket.', tex: 't_{\\min}<t_{\\mathrm{event}}\\le t_{\\max}' };
  }
  if (id === 'scale') {
    const distance = 1200 + v * 300, lower = distance / 15 / 24, upper = distance / 10 / 24;
    return { question: 'Estimate the uninterrupted driving time in Earth days, with a range allowed by the speed bounds. Ignore stops, charging and terrain delays in this toy calculation.', unit: 'days',
      data: [{ label: 'Distance', value: `${distance} km` }, { label: 'Speed', value: '10–15 km/h' }, { label: 'Unit reminder', value: '24 hours = 1 Earth day' }], reference: (lower + upper) / 2, range: (upper - lower) / 2, bounds: true,
      hint: 'Distance divided by speed gives hours. Divide by 24 for days. The faster speed gives the shorter travel time.',
      explanation: 'The comparison shows the full interval allowed by the stated speed bounds. Actual expeditions also need time for charging, stops and route conditions. A plausible estimate states its assumptions.', tex: 't=\\frac{D}{v},\\qquad t_{\\min}=\\frac{D}{v_{\\max}},\\quad t_{\\max}=\\frac{D}{v_{\\min}}' };
  }
  if (id === 'scatter') {
    const times = [40.1, 39.9, 40.3, 40.0, 39.7].map((t) => t + v * 1.2);
    const mean = times.reduce((a, b) => a + b, 0) / times.length / 20;
    const se = Math.sqrt(times.reduce((sum, t) => sum + (t / 20 - mean) ** 2, 0) / 4 / 5);
    return { question: 'Estimate the mean period of one full swing, with an uncertainty suggested by the repeatability of these five runs.', unit: 's',
      data: times.map((t, i) => ({ label: `Run ${i + 1} · 20 full swings`, value: `${t.toFixed(1)} s` })), reference: mean, range: se, bounds: false,
      hint: 'Divide each total time by 20, average the periods, then consider the scatter in that average.',
      explanation: 'The example range is the standard error of the mean from these repeated timings. It describes random repeatability only. Shared errors in the string length, stopwatch calibration or counting method do not disappear through averaging.', tex: '\\bar T=\\frac{1}{n}\\sum_i T_i,\\qquad \\sigma_{\\bar T}\\approx s_T/\\sqrt n' };
  }
  const baseline = 3000 + v * 300, angle = 20 + v;
  const distance = baseline * 206264.806 / angle / 1e6;
  return { question: 'Estimate distance in million kilometres and a propagated ± uncertainty. Use the small-angle model and assume independent baseline/angle errors.', unit: 'million km',
    data: [{ label: 'Baseline B', value: `${baseline} ± 20 km` }, { label: 'Parallax p', value: `${angle} ± 1 arcsec` }, { label: 'Conversion', value: '1 radian ≈ 206265 arcsec' }], reference: distance, range: distance * Math.hypot(20 / baseline, 1 / angle), bounds: false,
    hint: 'Convert the angle to radians before dividing the baseline by it. For independent small errors, combine relative uncertainties in quadrature.',
    explanation: 'A small angular shift produces a large distance. Mixing arcseconds and radians causes an error of about 206265 times. This propagated range assumes small independent errors and omits correlated or systematic effects.', tex: 'd\\approx B/p,\\qquad (\\sigma_d/d)^2\\approx(\\sigma_B/B)^2+(\\sigma_p/p)^2' };
}

export const validEstimate = (value: number, range: number) => Number.isFinite(value) && Number.isFinite(range) && Math.abs(value) < 1e9 && range > 0 && range < 1e9;

export function estimateFeedback(scenario: EstimationScenario, value: number, range: number) {
  const covers = scenario.bounds ? value - range <= scenario.reference - scenario.range && value + range >= scenario.reference + scenario.range : Math.abs(value - scenario.reference) <= range;
  if (!covers) return scenario.bounds ? 'Your interval excludes some times still allowed by the observations. Revisit both bounds.' : 'Your range misses this model-based comparison. Revisit the method, units and uncertainty; a miss is useful feedback.';
  if (range > scenario.range * 3) return 'Your range covers the comparison, but is much broader than the example range. Explain what extra uncertainty you allowed, or see whether the data justify narrowing it.';
  return scenario.bounds ? 'Your range covers the observational bounds. Its midpoint is an estimate, not a uniquely determined event time.' : 'Your range includes the comparison. Review the assumptions too: agreement with a model is not proof that every systematic error is absent.';
}
