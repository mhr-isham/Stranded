import { DEG } from '../engine/constants';
import { flareAt } from '../engine/flares';
import { GLARE_LIMIT, GLARE_NOTICE, solarGlare, solarGlareSource } from '../engine/solarGlare';
import { norm } from '../engine/vec';
import { targetSkyLimits } from '../engine/measure';
import { localFrame, starCatalog, toHorizontal, topocentric, type CatalogStar } from '../engine/sky';
import type { Site, StarSystem } from '../engine/types';
import type { Vec3 } from '../engine/vec';
import { limitingMag } from '../render/color';
import { seeingFactor } from './challenges';
import { isCloudy } from './survival';
import type { GameState } from './store';

export type OpticalMethod = 'target-track' | 'giant-track' | 'parallax' | 'diameter' | 'nearby-star' | 'solar-year' | 'locked-year' | 'solar-camera' | 'moon-watch' | 'filtered-view' | 'view' | 'night-view';
type ObserverState = Pick<GameState, 'seed' | 'settings'>;
export interface OpticalConditions {
  at: number; sunAlt: number; alt?: number; cloudy: boolean; flare: boolean;
  seeing: number; solarGlare?: number; referenceVisible: boolean; inField: boolean;
}
export interface OpticalLimits { minAlt?: number; maxSun?: number; minSun?: number; references: boolean; filtered: boolean }
export interface OpticalStatus extends OpticalConditions {
  ok: boolean; code: 'ready' | 'invalid' | 'flare' | 'clouds' | 'low' | 'solar-glare' | 'daylight' | 'twilight' | 'references' | 'field';
  reason: string; limits: OpticalLimits; method: OpticalMethod;
}

/** Weather is common to live optical views; rough seeing affects quality, never
 * availability. Clouds follow the existing survival setting in every mode. */
export function opticalWeather(sys: StarSystem, state: ObserverState, at: number) {
  return { cloudy: !!(state.settings.survival && isCloudy(state.seed, at)), flare: !!flareAt(sys, at), seeing: seeingFactor(state, at) };
}

export function opticalLimits(sys: StarSystem, method: OpticalMethod, horizon = 0): OpticalLimits {
  const lim = targetSkyLimits(sys), base = { references: false, filtered: false };
  switch (method) {
    case 'target-track': return { ...base, minAlt: Math.max(horizon, lim.track), maxSun: lim.sun, references: true };
    case 'giant-track': return { ...base, minAlt: Math.max(horizon, 12 * DEG), maxSun: -12 * DEG, references: true };
    case 'parallax': return { ...base, minAlt: Math.max(horizon, lim.par), maxSun: lim.sun, references: true };
    // A calibrated micrometer can measure a bright disk in twilight, without
    // demanding the tracker's faint reference-star field.
    case 'diameter': return { ...base, minAlt: horizon };
    case 'moon-watch': return { ...base, minAlt: horizon, maxSun: -3 * DEG };
    case 'nearby-star': return { ...base, minAlt: Math.max(horizon, 15 * DEG), maxSun: -12 * DEG, references: true };
    // Keep the existing filtered twilight-year model; it is not a night scan.
    case 'solar-year': return { ...base, minAlt: horizon, minSun: -1 * DEG, maxSun: 8 * DEG, filtered: true };
    case 'locked-year': return { ...base, references: true };
    case 'filtered-view': return { ...base, minAlt: horizon, filtered: true };
    case 'solar-camera': return { ...base, minAlt: Math.max(horizon, 3 * DEG), filtered: true };
    case 'night-view': return { ...base, minAlt: horizon, maxSun: -1.6 * DEG, references: true };
    default: return { ...base, minAlt: horizon };
  }
}

/** One concise, stable priority order for both the UI and the recording action. */
export function assessOpticalConditions(method: OpticalMethod, c: OpticalConditions, limits: OpticalLimits): OpticalStatus {
  let code: OpticalStatus['code'] = 'ready', reason = 'View usable.';
  if (![c.at, c.sunAlt, c.seeing].every(Number.isFinite) || c.at < 0 || c.seeing <= 0 || c.alt !== undefined && !Number.isFinite(c.alt) || [limits.minAlt, limits.minSun, limits.maxSun].some((v) => v !== undefined && !Number.isFinite(v))) { code = 'invalid'; reason = 'The view is not ready. Recheck the instrument.'; }
  else if (c.flare) { code = 'flare'; reason = 'Flare glare — wait for it to fade.'; }
  else if (c.cloudy) { code = 'clouds'; reason = 'Cloud cover — try a clear observing session.'; }
  else if (limits.minAlt !== undefined && (c.alt === undefined || c.alt <= limits.minAlt)) { code = 'low'; reason = limits.minAlt > 0 ? `Target too low — needs altitude above ${Math.round(limits.minAlt / DEG)}°.` : 'Target below the local horizon — wait for it to rise.'; }
  else if (!limits.filtered && (c.solarGlare ?? 0) >= GLARE_LIMIT) { code = 'solar-glare'; reason = 'Solar glare — the star is too close to this sightline. Try again when they separate.'; }
  else if (limits.minSun !== undefined && c.sunAlt <= limits.minSun) { code = 'twilight'; reason = 'Wait for sunrise or sunset to use the filtered year tracker.'; }
  else if (limits.maxSun !== undefined && c.sunAlt >= limits.maxSun) { code = 'daylight'; reason = method === 'solar-year' ? 'Wait for sunrise or sunset to use the filtered year tracker.' : limits.maxSun > -10 * DEG ? 'Sky too bright — try twilight or later.' : 'Sky too bright — wait for a dark sky.'; }
  else if (limits.references && !c.referenceVisible) { code = 'references'; reason = 'No usable reference stars — try a clearer or darker view.'; }
  else if (!c.inField) { code = 'field'; reason = 'Bring the selected light fully into the field.'; }
  if (code === 'ready' && !limits.filtered && (c.solarGlare ?? 0) >= GLARE_NOTICE) reason = 'Solar glare lowers contrast near the star.';
  return { ...c, ok: code === 'ready', code, reason, method, limits };
}

const references = new WeakMap<StarSystem, CatalogStar[]>();
/** A modest reference-field proxy, using the same bright catalogue/daylight
 * model as the wide view. This is not a full sensor/SNR or in-field star fit. */
function referenceStarsVisible(sys: StarSystem, at: number, site: Site, sunAlt: number, horizon: number) {
  let stars = references.get(sys);
  if (!stars) { stars = starCatalog(sys.seed).filter((s) => s.mag < 2.6); references.set(sys, stars); }
  const limit = limitingMag(sunAlt / DEG) - .1, frame = localFrame(sys, at, site);
  return stars.some((star) => star.mag < limit && toHorizontal(star.dir, frame).alt > Math.max(5 * DEG, horizon));
}

/** Pure snapshot of the specified instant/site. Call again at recording time;
 * never apply the live status to already frozen observations. */
export function opticalStatus(sys: StarSystem, state: ObserverState, at: number, method: OpticalMethod, options: {
  site?: Site; direction?: Vec3; horizon?: number; inField?: boolean;
} = {}): OpticalStatus {
  const site = options.site ?? sys.site, horizon = Math.max(0, options.horizon ?? 0);
  const limits = opticalLimits(sys, method, horizon);
  if (!Number.isFinite(at) || at < 0 || method === 'giant-track' && !sys.giant) return assessOpticalConditions(method,
    { at, sunAlt: NaN, seeing: 1, cloudy: false, flare: false, referenceVisible: false, inField: false }, limits);
  const frame = localFrame(sys, at, site);
  const sun = topocentric(sys, 'star', at, site), sunAlt = toHorizontal(sun, frame).alt;
  const body = method === 'giant-track' || method === 'parallax' && sys.giant ? 'giant' : method === 'solar-year' || method === 'solar-camera' || method === 'filtered-view' ? 'star' : 'target';
  const dir = options.direction ?? (method === 'locked-year' || method === 'nearby-star' || method === 'view' || method === 'night-view' ? undefined : topocentric(sys, body, at, site));
  const alt = dir ? toHorizontal(dir, frame).alt : undefined;
  const glare = dir && !limits.filtered ? solarGlare(solarGlareSource(sun, Math.asin(sys.star.radius / norm(sun)), sys.star.luminosity, sunAlt), dir) : 0;
  const c: OpticalConditions = { at, sunAlt, alt, solarGlare: glare, ...opticalWeather(sys, state, at), inField: options.inField ?? true,
    referenceVisible: !limits.references || referenceStarsVisible(sys, at, site, sunAlt, horizon) };
  return assessOpticalConditions(method, c, limits);
}
