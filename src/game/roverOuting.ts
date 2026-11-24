import { DAY, DEG, TAU } from '../engine/constants';
import { parallaxSite } from '../engine/measure';
import { eclToEq, eqToEcl, localFrame, meridianAngle, toHorizontal } from '../engine/sky';
import type { StarSystem } from '../engine/types';
import type { Vec3 } from '../engine/vec';
import type { GameState, TimedValue } from './store';
import { yearPoints } from './yearObservations';
import { opticalLimits } from './observing';

export interface RoverWindow {
  start: number;
  end: number;
  at: number;
  lowerAltitude: number;
  margin: number;
  localHour: number;
}
export interface RoverOuting extends RoverWindow {
  distance: number;
  observations: number;
  observedFrom: number;
  observedTo: number;
  capturedAt?: number;
}

export const roverSpeed = (s: Pick<GameState, 'settings' | 'survival'>) =>
  (s.settings.survival && s.survival.upgrades.includes('rover') ? 700_000 : 400_000) *
  (s.settings.challenges?.includes('rover') ? .5 : 1);

const angularDirection = (lon: number, lat: number): Vec3 =>
  [Math.cos(lat) * Math.cos(lon), Math.cos(lat) * Math.sin(lon), Math.sin(lat)];

function fitAxis(points: { x: number; y: number }[]) {
  const count = points.length;
  const xMean = points.reduce((sum, p) => sum + p.x, 0) / count;
  const yMean = points.reduce((sum, p) => sum + p.y, 0) / count;
  const xSquare = points.reduce((sum, p) => sum + (p.x - xMean) ** 2, 0);
  const rate = points.reduce((sum, p) => sum + (p.x - xMean) * (p.y - yMean), 0) / xSquare;
  const predict = (x: number) => yMean + rate * (x - xMean);
  const first = points[0], last = points.at(-1)!, middle = points[count - 2];
  const scatter = Math.max(...points.map((p) => Math.abs(p.y - predict(p.x))));
  const rateChange = Math.abs(rate - (last.y - middle.y) / (last.x - middle.x));
  return { predict, allowance: (x: number) => .02 + scatter + rateChange * Math.max(0, x - last.x, (last.x - first.x) / 4) };
}

/** Short, local trend from saved two-coordinate sightings. Never projects a generated planet orbit. */
export function roverTrackForecast(track: TimedValue[], now: number, period: number) {
  if (!Number.isFinite(period) || period <= 0) return null;
  const points = yearPoints(track.filter((o) => o.at <= now && o.at >= now - 8 * DAY &&
    o.source !== 'echo' && Number.isFinite(o.skyLatitude) && Math.abs(o.skyLatitude!) <= Math.PI / 2))
    .filter((p, i, all) => i === 0 || p.x !== all[i - 1].x).slice(-6);
  if (points.length < 3) return null;
  const start = points[0].observation.at, latest = points.at(-1)!.observation.at;
  const span = latest - start;
  if (span < period / 2 || now - latest > Math.min(2 * DAY, 2 * period)) return null;
  const lon = fitAxis(points.map(p => ({ x: (p.observation.at - latest) / DAY, y: p.y })));
  const lat = fitAxis(points.map(p => ({ x: (p.observation.at - latest) / DAY, y: p.observation.skyLatitude! / DEG })));
  const until = latest + Math.min(8 * DAY, 6 * period, 2 * span);
  return {
    count: points.length, start, latest, until,
    at(time: number) {
      const x = (time - latest) / DAY, latitude = lat.predict(x);
      if (time < latest || time > until || Math.abs(latitude) > 90) return null;
      const margin = (lon.allowance(x) + lat.allowance(x) + .25) * DEG;
      if (!Number.isFinite(margin) || margin > 10 * DEG) return null;
      return { direction: angularDirection(lon.predict(x) * DEG, latitude * DEG), margin };
    },
  };
}

/** Survey geometry and the local solar clock provide the frame. The Sun's
 * current declination is held fixed for the short horizon. No future weather,
 * flare, reference-field availability or actual target ephemeris is sampled. */
interface WindowSearch {
  sys: StarSystem;
  track: TimedValue[];
  solarDay: number;
  sunNow: Vec3;
  now: number;
  readyAt: number;
  endAt: number;
  distance: number;
  requestedDay?: number;
}

export function roverWindows({ sys, track, solarDay, sunNow, now, readyAt, endAt, distance, requestedDay }: WindowSearch): RoverOuting[] {
  if (sys.features.locked || sys.giant || !Number.isFinite(distance) || distance < 500_000 || distance > 6_000_000) return [];
  const model = roverTrackForecast(track, now, solarDay);
  if (!model) return [];
  const sites = [sys.site, parallaxSite(sys, sys.site, distance)];
  const { minAlt = 0, maxSun = -12 * DEG } = opticalLimits(sys, 'parallax');
  const [sx, sy, sz] = eclToEq(sunNow, sys.home.obliquity);
  const sunLongitude = Math.atan2(sy, sx), sunLatitude = Math.atan2(sz, Math.hypot(sx, sy));
  const step = Math.min(600, solarDay / 120);
  const first = Math.ceil(Math.max(now + 60, readyAt, requestedDay === undefined ? 0 : requestedDay * DAY) / step) * step;
  const end = Math.min(model.until, endAt - step, requestedDay === undefined ? Infinity : (requestedDay + 1) * DAY - step);
  let active: RoverWindow | undefined;
  const windows: RoverWindow[] = [];
  function closeWindow() {
    if (active && active.end - active.start >= 2 * step) windows.push(active);
    active = undefined;
  }
  for (let at = first; at <= end && windows.length < 3; at += step) {
    const target = model.at(at);
    if (!target) { closeWindow(); continue; }
    const sunRA = sunLongitude + TAU * (at - now) * (1 / sys.home.siderealDay - 1 / solarDay);
    const sun = eqToEcl(angularDirection(sunRA, sunLatitude), sys.home.obliquity);
    const frames = sites.map(site => localFrame(sys, at, site));
    const lowerAltitude = Math.min(...frames.map(frame => toHorizontal(target.direction, frame).alt)) - target.margin;
    const brightness = Math.max(...frames.map(frame => toHorizontal(sun, frame).alt));
    if (lowerAltitude <= minAlt || brightness >= maxSun - 2 * DEG) { closeWindow(); continue; }
    const hours = 12 + 24 * (meridianAngle(sys, at, sys.site) - sunRA) / TAU;
    const localHour = ((hours % 24) + 24) % 24;
    if (!active) active = { start: at, end: at, at, lowerAltitude, margin: target.margin, localHour };
    else {
      active.end = at;
      if (lowerAltitude > active.lowerAltitude) Object.assign(active, { at, lowerAltitude, margin: target.margin, localHour });
    }
  }
  closeWindow();
  return windows.slice(0, 3).map(window => ({ ...window, distance, observations: model.count, observedFrom: model.start, observedTo: model.latest }));
}

export const outingArrival = (s: Pick<GameState, 'rover' | 'settings' | 'survival'>, distance: number, now: number) => {
  const underway = s.rover.arriveAt > now;
  const depart = underway ? s.rover.arriveAt : now;
  const start = underway ? s.rover.target : s.rover.dist;
  return depart + Math.abs(distance - start) / roverSpeed(s) * DAY;
};

export function completeOuting(outing: RoverOuting | null | undefined, at: number, distance: number) {
  if (!outing || outing.capturedAt !== undefined || !Number.isFinite(at) || distance !== outing.distance || at < outing.start || at > outing.end) return outing;
  return { ...outing, capturedAt: at };
}
