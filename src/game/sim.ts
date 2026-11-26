// Advances game time and runs everything that happens "on its own": the
// tracker's nightly logs, the rover's drive, survival upkeep and the
// life-support deadline.

import { nearestOpposition as nearestOpp } from '../engine/ephemeris';
import { flareAt } from '../engine/flares';
import { ARCSEC, DAY, DEG } from '../engine/constants';
import { giantLongitude, giantMoonOffset, moonOffset, targetLongitude, targetSkyLimits } from '../engine/measure';
import { eclLon, topocentric } from '../engine/sky';
import { norm } from '../engine/vec';
import { hash32 } from '../engine/rng';
import { clock } from './clock';
import { ECHO } from './echo';
import { activeMission, missionsFor } from './missions';
import { isCadetExpedition } from './cadetGuidance';
import { MISSION_CODEX } from './codex';
import { sfx } from './audio';
import { WARPS } from './clock';
import { useGame, type GameState, type TimedValue } from './store';
import { foodRate, lifeSupportEnd, o2Rate, survivalDay } from './survival';
import { world } from './world';
import { variantOf } from '../engine/chapters';
import { resolvePredictions } from './predictions';
import { advanceSurface } from './surface';
import { assessOpticalConditions, opticalStatus } from './observing';

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
  const current = opticalStatus(sys, s, t, 'target-track');
  const status = minAlt === undefined ? current : assessOpticalConditions('target-track', current, { ...current.limits, minAlt });
  return { ...status, alt: status.alt ?? NaN, lim };
}

/** Chapter 7: can the giant be seen right now (dark sky, high enough, no clouds)? */
export function giantObservable(t: number) {
  const s = useGame.getState();
  const { system: sys } = currentWorld();
  if (!sys.giant) return false;
  return opticalStatus(sys, s, t, 'giant-track').ok;
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

/** Settle a completed hop with normal surface activity still in progress. */
export function advanceHopTime(seconds: number) {
  const target = clock.t + seconds;
  while (clock.t < target && useGame.getState().phase === 'hop') {
    stepTo(Math.min(target, (Math.floor(clock.t / DAY) + 1) * DAY), 0, true);
  }
  if (clock.t >= clock.stopAt) {
    if (clock.pauseAtStop) clock.paused = true;
    clock.stopAt = Infinity;
    clock.pauseAtStop = false;
  }
  clock.emit();
  return useGame.getState().phase === 'hop';
}

function stepTo(t1Wanted: number, dtReal: number, hopping = false) {
  const s = useGame.getState();
  const { system: sys, solarDay } = currentWorld();
  const t0 = clock.t;
  // The tutorial never runs out of air: it is about learning, not pressure.
  const end = s.tutorial.active ? Infinity : lifeSupportEnd(s, sys);
  const expires = t1Wanted >= end;
  const t1 = Math.max(t0, Math.min(t1Wanted, end));
  if (expires && !hopping) {
    clock.t = t1;
    clock.paused = true;
    useGame.setState({ phase: 'results', outcome: null, hop: null });
    return;
  }
  clock.t = t1;

  const patch: Partial<GameState> = {};

  // Tracker samples eight times per local day.
  // A locked planet samples eight times per expedition day instead.
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
        const ray = topocentric(sys, 'target', t, sys.site);
        const v = Math.round(targetLongitude(sys, t, sys.site) / TRACK_RES) * TRACK_RES;
        track.push({ at: t, v, skyLatitude: Math.round(Math.asin(ray[2] / norm(ray)) / TRACK_RES) * TRACK_RES, source: 'tracker', environment: { instrument: 'telescope', at: t, rawValue: v, seeing: { factor: obs.seeing, frozen: false } } });
      }
      if (s.moonTrackOn && sys.features.moon) {
        const v = Math.round(moonOffset(sys, t, sys.site) / MOON_RES) * MOON_RES;
        moon.push({ at: t, v, source: 'tracker', environment: { instrument: 'telescope', at: t, rawValue: v, seeing: { factor: obs.seeing, frozen: false } } });
      }
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
      const status = opticalStatus(sys, s, t, 'giant-track');
      if (!status.ok) continue;
      const night = Math.floor(t / logDay);
      if (night > lastG) {
        lastG = night;
        const v = Math.round(giantLongitude(sys, t, sys.site) / TRACK_RES) * TRACK_RES;
        trackG.push({ at: t, v, source: 'tracker', environment: { instrument: 'telescope', at: t, rawValue: v, seeing: { factor: status.seeing, frozen: false } } });
      }
      const v = Math.round(giantMoonOffset(sys, t, sys.site) / MOON_RES) * MOON_RES;
      moonG.push({ at: t, v, source: 'tracker', environment: { instrument: 'telescope', at: t, rawValue: v, seeing: { factor: status.seeing, frozen: false } } });
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
      const status = opticalStatus(sys, s, t, 'solar-camera');
      if (!status.ok) continue;
      let off = eclLon(tv) - eclLon(sv);
      if (off > Math.PI) off -= 2 * Math.PI;
      if (off < -Math.PI) off += 2 * Math.PI;
      if (Math.abs(off) > Math.asin(sys.star.radius / norm(sv))) continue;
      // Seeing blurs the limb and the dot: about ±4″ per reading.
      const u1 = (hash32(sys.seed, k, 0x5e) + 1) / 4294967297;
      const u2 = hash32(sys.seed, k, 0x5f) / 4294967296;
      const jitter = 4 * ARCSEC * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const v = Math.round((off + jitter) / ARCSEC) * ARCSEC;
      log.push({ at: t, v, source: 'tracker', environment: { instrument: 'telescope', at: t, rawValue: v, seeing: { factor: status.seeing, frozen: false } } });
    }
    if (log.length) patch.sunLog = [...s.sunLog, ...log];
  }

  // Rover arrival.
  if (s.rover.arriveAt > t0 && s.rover.arriveAt <= t1) {
    patch.rover = { ...s.rover, dist: s.rover.target };
    s.say(ECHO.roverArrived);
  }

  // Hops debit the actual fraction of a day. Daily upkeep credits this
  // payment so crossing midnight never bills those minutes twice.
  if (s.settings.survival) {
    if (hopping) {
      const days = (t1 - t0) / DAY;
      const air = days * o2Rate(s.survival);
      const food = days * foodRate();
      const paid = s.survival.hopUpkeep;
      patch.survival = { ...s.survival, o2: s.survival.o2 - air, food: s.survival.food - food,
        hopUpkeep: { air: (paid?.air ?? 0) + air, food: (paid?.food ?? 0) + food } };
    }

    const d0 = Math.floor(t0 / DAY);
    const d1 = Math.floor(t1 / DAY);
    if (d1 > d0) Object.assign(patch, survivalDay({ ...s, ...patch }, sys, d0, d1));
  }

  Object.assign(patch, advanceSurface({ ...s, ...patch }, sys, t0, t1));
  if (Object.keys(patch).length) useGame.setState(patch);
  resolvePredictions(t1);

  if (hopping && (expires || (!s.settings.freeRoam && !s.tutorial.active && lifeSupportEnd(useGame.getState(), sys) <= t1))) {
    clock.paused = true;
    useGame.setState({ phase: 'results', hop: null, outcome: null });
    return;
  }
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
  // Cadet offers the method on demand in its goal card, using this chapter's
  // mission text rather than a second, sometimes chapter-1-specific speech.
  if (next && ECHO[next.id] && !isCadetExpedition(s)) s.say(ECHO[next.id]);
}

/**
 * Spend game time on an action (climbing, salvaging): fast-forward to the end,
 * then call onDone. Everything that happens meanwhile is simulated normally.
 */
export function spendTime(duration: number, onDone: () => void, options: { pauseOnArrival?: boolean } = {}) {
  const target = clock.t + duration;
  const runId = useGame.getState().runId;
  const prev = clock.warpIndex, wasPaused = clock.paused;
  clock.stopAt = target;
  clock.pauseAtStop = !!options.pauseOnArrival;
  clock.warpIndex = duration > 2 * DAY ? WARPS.length - 2 : duration > 6 * 3600 ? 5 : 3;
  clock.paused = false;
  clock.emit();
  let done = false;
  const id = setInterval(() => {
    if (useGame.getState().runId !== runId) { clearInterval(id); done = true; return; }
    const arrived = options.pauseOnArrival ? clock.t >= target : clock.t >= target - 1;
    if (arrived || useGame.getState().phase !== 'play') {
      clearInterval(id);
      done = true;
      clock.warpIndex = prev;
      clock.emit();
      onDone();
    }
  }, 50);
  // Callers can abandon a local action without leaving a timer or time warp
  // attached to a tool that is no longer open. Other callers may ignore this.
  return () => {
    clearInterval(id);
    const arrived = !!options.pauseOnArrival && clock.stopAt === Infinity && clock.paused && Math.abs(clock.t - target) < 1;
    if (!done && useGame.getState().runId === runId && (clock.stopAt === target || arrived)) {
      clock.stopAt = Infinity;
      clock.pauseAtStop = false;
      clock.warpIndex = prev;
      if (useGame.getState().phase === 'play') clock.paused = arrived || wasPaused || clock.paused;
      clock.emit();
    }
    done = true;
  };
}
