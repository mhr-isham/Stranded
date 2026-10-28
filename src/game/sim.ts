// Advances game time and runs everything that happens "on its own": the
// tracker's nightly logs, the rover's drive, survival upkeep and the
// life-support deadline.

import { nearestOpposition as nearestOpp } from '../engine/ephemeris';
import { flareAt } from '../engine/flares';
import { ARCSEC, DAY, DEG } from '../engine/constants';
import { giantLongitude, giantMoonOffset, moonOffset, targetLongitude, targetSkyLimits } from '../engine/measure';
import { eclLon, localFrame, toHorizontal, topocentric } from '../engine/sky';
import { norm } from '../engine/vec';
import { hash32 } from '../engine/rng';
import { clock } from './clock';
import { ECHO } from './echo';
import { activeMission, missionsFor } from './missions';
import { MISSION_CODEX } from './codex';
import { sfx } from './audio';
import { WARPS } from './clock';
import { useGame, type GameState, type TimedValue } from './store';
import { isCloudy, lifeSupportEnd, survivalDay } from './survival';
import { world } from './world';
import { variantOf } from '../engine/chapters';
import { resolvePredictions } from './predictions';
import { advanceSurface } from './surface';

const TRACK_RES = 0.01 * DEG; // tracker reading resolution
const MOON_RES = 0.5 * ARCSEC;

let missionTimer = 0;

/** Which version of the solve chain the current system needs. */
export const currentVariant = () => variantOf(currentWorld().system.features);

export function currentWorld() {
  const s = useGame.getState();
  return world(s.seed, s.settings.difficulty, s.chapter);
}

/** Can the tracker see the blue planet right now? */
export function targetObservable(t: number, minAlt?: number) {
  const s = useGame.getState();
  const { system: sys } = currentWorld();
  const lim = targetSkyLimits(sys);
  const f = localFrame(sys, t, sys.site);
  const sunAlt = toHorizontal(topocentric(sys, 'star', t, sys.site), f).alt;
  const alt = toHorizontal(topocentric(sys, 'target', t, sys.site), f).alt;
  const cloudy = s.settings.survival && isCloudy(s.seed, t);
  const flare = !!flareAt(sys, t);
  return { ok: sunAlt < lim.sun && alt > (minAlt ?? lim.track) && !cloudy && !flare, sunAlt, alt, cloudy, flare, lim };
}

/** Chapter 7: can the giant be seen right now (dark sky, high enough, no clouds)? */
export function giantObservable(t: number) {
  const s = useGame.getState();
  const { system: sys } = currentWorld();
  if (!sys.giant) return false;
  const f = localFrame(sys, t, sys.site);
  const sunAlt = toHorizontal(topocentric(sys, 'star', t, sys.site), f).alt;
  const alt = toHorizontal(topocentric(sys, 'giant', t, sys.site), f).alt;
  return sunAlt < -12 * DEG && alt > 12 * DEG && !(s.settings.survival && isCloudy(s.seed, t));
}

export function advance(dtReal: number) {
  const s = useGame.getState();
  if (s.phase !== 'play') return;
  const t1 = Math.min(clock.t + clock.rate * Math.min(dtReal, 0.1), clock.stopAt);
  if (t1 >= clock.stopAt && clock.stopAt !== Infinity) {
    clock.stopAt = Infinity;
    clock.warpIndex = Math.min(clock.warpIndex, 3);
    if (clock.pauseAtStop) clock.paused = true;
    clock.pauseAtStop = false;
    clock.emit();
  }
  stepTo(t1, dtReal);
}

/**
 * Jump game time forward to `target` at once, still processing everything
 * that happens on the way (tracker logs, rover arrival, survival upkeep).
 */
export function fastForward(target: number) {
  let guard = 0;
  while (clock.t < target - 1 && useGame.getState().phase === 'play' && guard++ < 5000) {
    stepTo(Math.min(target, clock.t + 2 * DAY), 0);
  }
  clock.emit();
}

function stepTo(t1Wanted: number, dtReal: number) {
  const s = useGame.getState();
  const { system: sys, solarDay } = currentWorld();
  const t0 = clock.t;
  let t1 = t1Wanted;
  // The tutorial never runs out of air: it is about learning, not pressure.
  const end = s.tutorial.active ? Infinity : lifeSupportEnd(s, sys);
  if (t1 >= end) {
    t1 = end;
    clock.t = t1;
    clock.paused = true;
    useGame.setState({ phase: 'results', outcome: null });
    return;
  }
  clock.t = t1;

  const patch: Partial<GameState> = {};

  // Tracker samples eight times per local day.
  // A locked planet has no solar day: log once per 24 hours instead.
  const logDay = Number.isFinite(solarDay) ? solarDay : DAY;
  const step = logDay / 8;
  if (s.trackOn || s.moonTrackOn) {
    const track: TimedValue[] = [];
    const moon: TimedValue[] = [];
    let lastNight = s.lastNightLog;
    for (let k = Math.floor(t0 / step) + 1; k * step <= t1; k++) {
      const t = k * step;
      const obs = targetObservable(t);
      if (!obs.ok) continue;
      const night = Math.floor(t / logDay);
      // A locked planet has no nights: the tracker logs at every sample.
      if (s.trackOn && (night > lastNight || sys.features.locked)) {
        lastNight = night;
        track.push({ at: t, v: Math.round(targetLongitude(sys, t, sys.site) / TRACK_RES) * TRACK_RES });
      }
      if (s.moonTrackOn && sys.features.moon) moon.push({ at: t, v: Math.round(moonOffset(sys, t, sys.site) / MOON_RES) * MOON_RES });
    }
    if (track.length) {
      patch.track = [...s.track, ...track];
      patch.lastNightLog = lastNight;
    }
    if (moon.length) patch.moonTrack = [...s.moonTrack, ...moon];
  }

  // Chapter 7: the giant tracker logs the giant nightly and its moon eight times a day.
  if (s.trackGOn && sys.giant) {
    const trackG: TimedValue[] = [];
    const moonG: TimedValue[] = [];
    let lastG = s.trackG.length ? Math.floor(s.trackG[s.trackG.length - 1].at / logDay) : -1;
    for (let k = Math.floor(t0 / step) + 1; k * step <= t1; k++) {
      const t = k * step;
      if (!giantObservable(t)) continue;
      const night = Math.floor(t / logDay);
      if (night > lastG) {
        lastG = night;
        trackG.push({ at: t, v: Math.round(giantLongitude(sys, t, sys.site) / TRACK_RES) * TRACK_RES });
      }
      moonG.push({ at: t, v: Math.round(giantMoonOffset(sys, t, sys.site) / MOON_RES) * MOON_RES });
    }
    if (trackG.length) patch.trackG = [...s.trackG, ...trackG];
    if (moonG.length) patch.moonTrackG = [...s.moonTrackG, ...moonG];
  }

  // Chapter 5 solar camera: once an hour while the star is up, log the planet's
  // offset from the star's centre when it is crossing the disk (a transit).
  if (s.sunCamOn && sys.features.inner) {
    const log: TimedValue[] = [];
    for (let k = Math.floor(t0 / 3600) + 1; k * 3600 <= t1; k++) {
      const t = k * 3600;
      const sv = topocentric(sys, 'star', t, sys.site);
      const tv = topocentric(sys, 'target', t, sys.site);
      if (norm(tv) > norm(sv)) continue;
      if (toHorizontal(sv, localFrame(sys, t, sys.site)).alt < 3 * DEG) continue;
      let off = eclLon(tv) - eclLon(sv);
      if (off > Math.PI) off -= 2 * Math.PI;
      if (off < -Math.PI) off += 2 * Math.PI;
      if (Math.abs(off) > Math.asin(sys.star.radius / norm(sv))) continue;
      // Seeing blurs the limb and the dot: about ±4″ per reading.
      const u1 = (hash32(sys.seed, k, 0x5e) + 1) / 4294967297;
      const u2 = hash32(sys.seed, k, 0x5f) / 4294967296;
      const jitter = 4 * ARCSEC * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      log.push({ at: t, v: Math.round((off + jitter) / ARCSEC) * ARCSEC });
    }
    if (log.length) patch.sunLog = [...s.sunLog, ...log];
  }

  // Rover arrival.
  if (s.rover.arriveAt > t0 && s.rover.arriveAt <= t1) {
    patch.rover = { ...s.rover, dist: s.rover.target };
    s.say(ECHO.roverArrived);
  }

  // Survival upkeep, once per day.
  if (s.settings.survival) {
    const d0 = Math.floor(t0 / DAY);
    const d1 = Math.floor(t1 / DAY);
    if (d1 > d0) Object.assign(patch, survivalDay({ ...s, ...patch }, sys, d0, d1));
  }

  Object.assign(patch, advanceSurface({ ...s, ...patch }, sys, t0, t1));
  if (Object.keys(patch).length) useGame.setState(patch);
  resolvePredictions(t1);

  // Story beats tied to time.
  const life = (end - t1) / end;
  if (life < 0.15) s.say(ECHO.lowLife);
  if (!sys.features.inner) {
    if (s.track.length > 6) {
      const n = s.track.length;
      if (s.track[n - 1].v < s.track[n - 2].v) s.say(ECHO.retrograde);
    }
    if (s.identified && Math.abs(t1 - nearestOpposition(t1)) < 25 * DAY) s.say(ECHO.parallax);
  } else if (s.identified) {
    // An inner planet: warn (coaching modes) when it is about to cross the star.
    const k = Math.round((t1 - sys.firstOpposition) / sys.synodic);
    const conj = sys.firstOpposition + k * sys.synodic;
    if (conj > t1 && conj - t1 < 3 * DAY) s.say({ ...ECHO.transitSoon, id: `transitSoon-${k}` });
  }
  if (sys.features.locked && !s.tutorial.active) {
    s.say(ECHO.lockedSky);
    if (flareAt(sys, t1)) s.say(ECHO.flare);
  }
  if (s.missionsDone.includes('year') && !s.logs.includes('relay') && !s.tutorial.active) s.say(ECHO.relayHint);
  if (s.identified && !s.names.target && !s.tutorial.active && s.missionsDone.includes('identify')) s.say(ECHO.nameIt);

  missionTimer += dtReal;
  if (missionTimer > 0.4 && !s.tutorial.active) {
    missionTimer = 0;
    checkMissions();
  }
}

function nearestOpposition(t: number) {
  return nearestOpp(currentWorld().system, t);
}

/** Mark finished missions and introduce the next one. */
export function checkMissions() {
  const s = useGame.getState();
  const done = missionsFor(s).filter((m) => m.done(s) && !s.missionsDone.includes(m.id)).map((m) => m.id);
  if (done.length) {
    useGame.setState({ missionsDone: [...s.missionsDone, ...done] });
    for (const id of done) if (MISSION_CODEX[id]) useGame.getState().unlock('codex', MISSION_CODEX[id]);
    sfx('unlock');
  }
  const next = activeMission(useGame.getState());
  if (next && ECHO[next.id]) s.say(ECHO[next.id]);
}

/**
 * Spend game time on an action (climbing, salvaging): fast-forward to the end,
 * then call onDone. Everything that happens meanwhile is simulated normally.
 */
export function spendTime(duration: number, onDone: () => void) {
  const target = clock.t + duration;
  const prev = clock.warpIndex;
  clock.stopAt = target;
  clock.warpIndex = duration > 2 * DAY ? WARPS.length - 2 : duration > 6 * 3600 ? 5 : 3;
  clock.paused = false;
  clock.emit();
  const id = setInterval(() => {
    if (clock.t >= target - 1 || useGame.getState().phase !== 'play') {
      clearInterval(id);
      clock.warpIndex = prev;
      clock.emit();
      onDone();
    }
  }, 50);
}
