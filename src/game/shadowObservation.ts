import { DEG, TAU } from '../engine/constants';
import { orbitAngle, planetPos, solarDay } from '../engine/ephemeris';
import { eclToEq, localFrame, meridianAngle, toHorizontal, topocentric } from '../engine/sky';
import type { Site, StarSystem } from '../engine/types';

export const SHADOW_STICK = 2;
export const SHADOW_MAX = 12;
export interface ShadowReading {
  site: 'camp' | 'rover'; at: number; alt: number; dist: number;
  /** Older records remain readable but cannot establish synchronized provenance. */
  capture?: string; position?: Site; solarDay?: number; solarHours?: number;
  length?: number; sigmaLength?: number; direction?: -1 | 1;
  sigmaBaseline?: number; refraction?: { k: number; sigmaK: number };
}
export interface ShadowView {
  position: Site; altitude: number; sunRadius: number; length: number;
  direction: -1 | 1; hours: number; day: number;
}
export interface ShadowCapture { id: string; at: number; baseline: number; sigmaBaseline: number; camp: ShadowView; rover: ShadowView }

/** Unwrapped apparent solar rotation, not Earth UTC days. Coordinates are
 * acquisition provenance only; radius inference never uses their latitude gap. */
export function shadowSolarClock(sys: StarSystem, t: number, site = sys.site) {
  const phase = (at: number) => {
    const p = planetPos(sys.home, at), v = eclToEq([-p[0], -p[1], -p[2]], sys.home.obliquity);
    const ra = Math.atan2(v[1], v[0]), mean = orbitAngle(sys.home, at) + Math.PI;
    const unwrapped = ra + TAU * Math.round((mean - ra) / TAU);
    return (meridianAngle(sys, at, site) - unwrapped) / TAU;
  };
  const turns = phase(t), hourAngle = TAU * (turns - Math.round(turns));
  return { turns, hours: ((12 + turns * 24) % 24 + 24) % 24, hourAngle, day: Math.floor(turns + .5) - Math.floor(phase(0) + .5) };
}
export function shadowAvailable(sys: StarSystem) {
  const day = solarDay(sys);
  return !sys.features.locked && Number.isFinite(day) && day > 0 && Number.isFinite(sys.site.lat) && Math.abs(sys.site.lat) < 85 * DEG;
}
export function nextShadowNoon(sys: StarSystem, t: number) {
  if (!shadowAvailable(sys) || !Number.isFinite(t)) return null;
  const target = Math.floor(shadowSolarClock(sys, t).turns + 1e-8) + 1;
  let lo = t, hi = t + solarDay(sys) * 1.6;
  if (shadowSolarClock(sys, hi).turns < target) return null;
  for (let i = 0; i < 55; i++) { const mid = (lo + hi) / 2; if (shadowSolarClock(sys, mid).turns < target) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
export function northSite(site: Site, dist: number, radius: number): Site {
  return { lat: site.lat + dist / radius, lon: site.lon };
}
export function northLimit(sys: StarSystem) { return Math.max(0, Math.min(2000e3, (85 * DEG - sys.site.lat) * sys.home.radius)); }
/** Same high-Sun refraction law as the original instrument; k=0 stays zero. */
export function apparentShadowAltitude(geometric: number, k: number) {
  return geometric + (geometric > 2 * DEG ? k * 2 / 60 * DEG / Math.tan(geometric) : 0);
}
export function correctedShadowAltitude(apparent: number, k: number) {
  if (![apparent, k].every(Number.isFinite) || apparent < 15 * DEG || apparent >= Math.PI / 2 || k < 0 || k > .85) return null;
  let lo = 10 * DEG, hi = Math.PI / 2;
  for (let i = 0; i < 45; i++) { const m = (lo + hi) / 2; if (apparentShadowAltitude(m, k) < apparent) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
export function shadowView(sys: StarSystem, at: number, position: Site): ShadowView {
  const vector = topocentric(sys, 'star', at, position), h = toHorizontal(vector, localFrame(sys, at, position));
  const altitude = apparentShadowAltitude(h.alt, sys.features.refraction);
  const c = shadowSolarClock(sys, at, position);
  return { position: { ...position }, altitude, sunRadius: Math.asin(sys.star.radius / Math.hypot(...vector)),
    length: altitude > 0 ? SHADOW_STICK / Math.tan(altitude) : Infinity,
    direction: Math.cos(h.az) > 0 ? -1 : 1, hours: c.hours, day: c.day };
}
export function makeShadowCapture(sys: StarSystem, at: number, baseline: number, sigmaBaseline: number, id: string) {
  if (!shadowAvailable(sys) || ![at, baseline, sigmaBaseline].every(Number.isFinite) || baseline <= 0 || baseline > northLimit(sys) || sigmaBaseline <= 0) return null;
  const camp = shadowView(sys, at, sys.site), rover = shadowView(sys, at, northSite(sys.site, baseline, sys.home.radius));
  if ([camp, rover].some((v) => v.altitude < 15 * DEG || v.altitude > 89.5 * DEG || !Number.isFinite(v.length) || v.length > SHADOW_MAX)) return null;
  return { id, at, baseline, sigmaBaseline, camp, rover } satisfies ShadowCapture;
}
export function markedShadow(c: ShadowCapture, site: 'camp' | 'rover', length: number, sigmaLength: number, refraction?: { k: number; sigmaK: number }): ShadowReading | null {
  if (![length, sigmaLength].every(Number.isFinite) || length <= 0 || length > SHADOW_MAX || sigmaLength <= 0 || (refraction && (![refraction.k, refraction.sigmaK].every(Number.isFinite) || refraction.k < 0 || refraction.k > .85 || refraction.sigmaK <= 0))) return null;
  const v = c[site], alt = Math.atan2(SHADOW_STICK, length);
  if (alt < 15 * DEG || alt > 89.5 * DEG) return null;
  return { site, at: c.at, dist: site === 'rover' ? c.baseline : 0, alt, capture: c.id, position: { ...v.position }, solarDay: v.day, solarHours: v.hours,
    length, sigmaLength, direction: v.direction, sigmaBaseline: c.sigmaBaseline, ...(refraction ? { refraction: { ...refraction } } : {}) };
}
const valid = (r: ShadowReading) => !!r.capture && !!r.position && [r.at, r.alt, r.dist, r.length, r.sigmaLength, r.sigmaBaseline, r.solarDay, r.solarHours, r.position.lat, r.position.lon].every((n) => typeof n === 'number' && Number.isFinite(n)) && r.length! > 0 && r.length! <= SHADOW_MAX && r.sigmaLength! > 0 && r.sigmaBaseline! > 0 && (r.direction === 1 || r.direction === -1);

/** Uses marked lengths, compass directions, clock and entered uncertainties.
 * Never uses the hidden radius, latitude separation or the correct star angle. */
export function compareShadows(records: ShadowReading[]) {
  const clean = records.filter(valid);
  const pairs: { camp: ShadowReading; rover: ShadowReading }[] = [];
  for (const rover of clean.filter((r) => r.site === 'rover' && r.dist > 0)) {
    const camp = clean.slice().reverse().find((r) => r.site === 'camp' && r.capture === rover.capture && r.at === rover.at && r.solarDay === rover.solarDay && Math.abs(r.position!.lon - rover.position!.lon) < 1e-8);
    if (camp) pairs.push({ camp, rover });
  }
  const pair = pairs.reverse().sort((a, b) => b.rover.at - a.rover.at)[0];
  if (!pair) return { pair: null, result: null, status: 'Capture both sites, then mark and keep each shadow from that pair.' };
  const { camp: c, rover: r } = pair;
  const hour = (p: ShadowReading) => Math.abs(p.solarHours! - 12) * Math.PI / 12;
  if ([c, r].some((p) => hour(p) > Math.PI / 48 + 1e-9)) return { pair, result: null, status: 'These views are more than 15 local solar minutes from noon. Keep them as observations; take a new pair closer to noon.' };
  if (JSON.stringify(c.refraction ?? null) !== JSON.stringify(r.refraction ?? null) || c.sigmaBaseline !== r.sigmaBaseline) return { pair, result: null, status: 'Use the same baseline and shared refraction assumptions for both marks; revise a mark to match.' };
  const k = c.refraction?.k ?? 0, sigmaK = c.refraction?.sigmaK ?? 0;
  const angle = (p: ShadowReading, coeff = k) => { const alt = correctedShadowAltitude(Math.atan2(SHADOW_STICK, p.length!), coeff); return alt === null ? NaN : p.direction! * (Math.PI / 2 - alt); };
  const zC = angle(c), zR = angle(r), delta = Math.abs(zR - zC);
  if (!Number.isFinite(delta) || delta < .05 * DEG) return { pair, result: null, status: 'The marked angular difference is unresolved. Check both marks or try a longer baseline.' };
  // Bounded departure from a meridian altitude: cos(z_noon) <= cos(z) + (1-cos H).
  const allowance = (p: ShadowReading, z: number) => Math.abs(z) - Math.acos(Math.min(1, Math.cos(z) + 1 - Math.cos(hour(p))));
  if ([c, r].some((p) => Math.abs(angle(p)) <= hour(p))) return { pair, result: null, status: 'Near-overhead light makes the shadow direction uncertain away from noon. Capture closer to noon or in another season.' };
  const timingAngle = Math.max(0, allowance(c, zC)) + Math.max(0, allowance(r, zR));
  if (timingAngle >= delta) return { pair, result: null, status: 'The timing allowance is as large as the angle difference. Take a pair closer to local noon.' };
  const radius = r.dist / delta;
  const derivative = (p: ShadowReading) => {
    const eps = Math.max(1e-6, p.length! * 1e-5);
    return Math.abs((angle({ ...p, length: p.length! + eps }) - angle({ ...p, length: p.length! - eps })) / (2 * eps));
  };
  const marking = radius / delta * Math.hypot(derivative(c) * c.sigmaLength!, derivative(r) * r.sigmaLength!);
  const baseline = c.sigmaBaseline! / delta;
  const stepK = 1e-5, low = Math.max(0, k - stepK), high = Math.min(.85, k + stepK);
  const dDelta = Math.abs((Math.abs(angle(r, high) - angle(c, high)) - Math.abs(angle(r, low) - angle(c, low))) / (high - low));
  const refraction = radius / delta * dDelta * sigmaK;
  // Treat timing as a bound, not another independently sampled standard error.
  const timing = r.dist / (delta - timingAngle) - radius;
  const sigma = Math.hypot(marking, baseline, refraction) + timing;
  if (![radius, sigma].every(Number.isFinite)) return { pair, result: null, status: 'The entered lengths or uncertainties do not support a finite radius estimate.' };
  return { pair, result: { radius, sigma, delta, zCamp: zC, zRover: zR, marking, baseline, refraction, timing, timingAngle }, status: 'A radius estimate is available from your marked shadows.' };
}
