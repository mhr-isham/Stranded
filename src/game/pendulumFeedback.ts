/** Interpret player observations only; these helpers never receive a world model. */
export const EARTH_GRAVITY = 9.81; // reference surface gravity, m/s²

export function pendulumReading(length: number, time: number, swings: number) {
  if (![length, time, swings].every(Number.isFinite) || length <= 0 || time <= 0 || !Number.isSafeInteger(swings) || swings < 1) return null;
  const period = time / swings, gravity = 4 * Math.PI ** 2 * length / period ** 2;
  return Number.isFinite(gravity) && gravity > 0 ? { period, gravity } : null;
}

/** A hypothetical total start/stop error, not an estimate of the full uncertainty. */
export function swingTimingBudget(period: number, swings: number, timingError: number) {
  if (![period, swings, timingError].every(Number.isFinite) || period <= 0 || !Number.isSafeInteger(swings) || swings < 1 || timingError <= 0) return null;
  const duration = period * swings, periodError = timingError / swings;
  const fraction = timingError / duration;
  if (![duration, periodError, fraction].every(Number.isFinite) || duration <= 0) return null;
  return { duration, periodError, fraction };
}

export function earthGravityComparison(value: number, sigma?: number) {
  if (!Number.isFinite(value) || value <= 0) return null;
  const ratio = value / EARTH_GRAVITY;
  if (!Number.isFinite(ratio * 100) || ratio <= 0) return null;
  return {
    ratio,
    ratioSigma: sigma !== undefined && Number.isFinite(sigma) && sigma > 0 ? sigma / EARTH_GRAVITY : undefined,
  };
}
