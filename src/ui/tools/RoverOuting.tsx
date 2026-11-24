import { useEffect, useRef, useState } from 'react';
import { DAY, DEG } from '../../engine/constants';
import { topocentric } from '../../engine/sky';
import { sfx } from '../../game/audio';
import { clock } from '../../game/clock';
import { hasChallenge } from '../../game/challenges';
import { fmt } from '../../game/format';
import { outingArrival, roverTrackForecast, roverWindows, type RoverOuting } from '../../game/roverOuting';
import { currentWorld, spendTime } from '../../game/sim';
import { useGame } from '../../game/store';
import { lifeSupportEnd } from '../../game/survival';
import { dayNumber, hhmm } from '../../game/time';
import { useGameTime } from '../common/widgets';

function windowTitle(plan: RoverOuting) {
  return `Day ${dayNumber(plan.at)} · around ${hhmm(plan.localHour)} local`;
}

function remainingTime(seconds: number) {
  return seconds >= DAY ? `${fmt(seconds / DAY, 1)} d` : `${fmt(Math.max(0, seconds) / 3600, 1)} h`;
}

export function OutingPlanner() {
  const s = useGame();
  const { system, solarDay } = currentWorld();
  const [distance, setDistance] = useState(() => {
    const planned = s.roverOuting?.distance ?? (s.rover.target || s.rover.dist || 500_000);
    return Math.max(500, Math.min(6000, Math.round(planned / 100_000) * 100));
  });
  const [day, setDay] = useState('');
  const [windows, setWindows] = useState<RoverOuting[]>([]);
  const [notice, setNotice] = useState('');
  if (s.tutorial.active || !s.identified || system.features.locked || system.giant || hasChallenge(s, 'handFit')) return null;

  function search() {
    const current = useGame.getState(), now = clock.t;
    const requestedDay = day.trim() === '' ? undefined : Number(day) - 1;
    if (requestedDay !== undefined && (!Number.isSafeInteger(requestedDay) || requestedDay < Math.floor(now / DAY))) {
      setWindows([]);
      setNotice('Choose today or a later expedition day.');
      return;
    }
    const model = roverTrackForecast(current.track, now, solarDay);
    if (!model) {
      setWindows([]);
      setNotice('Keep the tracker running for at least three recent sights across different times. This forecast needs both sky coordinates.');
      return;
    }
    const metres = distance * 1000, arrival = outingArrival(current, metres, now);
    const endAt = lifeSupportEnd(current, system);
    if (arrival >= Math.min(model.until, endAt)) {
      setWindows([]);
      setNotice('The rover would arrive beyond this forecast. Try a nearer site or plan again after deployment.');
      return;
    }
    const next = roverWindows({ sys: system, track: current.track, solarDay, sunNow: topocentric(system, 'star', now, system.site),
      now, readyAt: arrival, endAt, distance: metres, requestedDay });
    setWindows(next);
    setNotice(next.length ? '' : 'No useful window in this part of the track. Try a nearer site, a different day, or collect a fresh sight.');
  }

  function save(plan: RoverOuting) {
    const current = useGame.getState(), now = clock.t;
    const hasSource = plan.observedTo <= now &&
      current.track.some(sight => sight.at === plan.observedFrom) &&
      current.track.some(sight => sight.at === plan.observedTo);
    if (!hasSource || plan.at <= now || outingArrival(current, plan.distance, now) > plan.at || lifeSupportEnd(current, system) <= plan.at) {
      setWindows([]);
      setNotice('That slot is no longer reachable. Check for a new window.');
      return;
    }
    current.set({ roverOuting: plan });
    setWindows([]);
    sfx('log');
  }

  return <details className="measurement-help outing-planner">
    <summary>Plan a rover-camera outing{s.roverOuting && s.roverOuting.capturedAt === undefined ? ' · plan saved' : ''}</summary>
    <div className="stack">
      <p>Use your recent track to find a time when both cameras could see the blue planet.</p>
      <form className="stack" onSubmit={e => { e.preventDefault(); search(); }}>
        <div className="outing-fields">
          <label className="field">Rover site (km east)
            <input className="input" type="number" inputMode="numeric" min={500} max={6000} step={100} required
              value={Number.isFinite(distance) ? distance : ''} onChange={e => { setDistance(e.target.valueAsNumber); setWindows([]); setNotice(''); }} />
          </label>
          <label className="field">Expedition day (optional)
            <input className="input" type="number" inputMode="numeric" min={1} step={1} placeholder="Next available"
              value={day} onChange={e => { setDay(e.target.value); setWindows([]); setNotice(''); }} />
          </label>
        </div>
        <button className="btn small" type="submit">Find camera windows</button>
      </form>
      {notice && <p className="muted" role="status">{notice}</p>}
      {windows.length > 0 && <div className="stack" aria-label="Suggested camera windows">
        <p className="muted">{windows[0].observations} tracked sights · weather checked on arrival</p>
        {windows.map(plan => <div className="outing-ticket stack" key={plan.at}>
          <b>{windowTitle(plan)}</b>
          <span>{fmt((plan.end - plan.start) / 3600, 1)} h window · estimated altitude {fmt(plan.lowerAltitude / DEG, 0)}° or higher at both sites*</span>
          <button type="button" className="btn small primary" onClick={() => save(plan)}>Save this outing</button>
        </div>)}
        <p className="muted">*Estimate after a drift allowance. Accuracy depends on how steadily the planet’s track continues.</p>
      </div>}
      {s.roverOuting && <div className="outing-ticket stack">
        <b>{s.roverOuting.capturedAt !== undefined ? 'Paired images captured' : 'Saved camera outing'}</b>
        <span>{windowTitle(s.roverOuting)} · {fmt(s.roverOuting.distance / 1000, 0)} km east</span>
        <button className="btn small" onClick={() => s.go('rover')}>Open rover camera</button>
      </div>}
      <details className="measurement-help"><summary>Forecast details</summary>
        <p>The forecast projects a short trend from your saved longitude and latitude. The survey and local solar clock estimate where the target will clear both horizons in dark enough sky. It allows for spread and changes in your recent drift. Camera readiness is checked live, including clouds, flares and reference stars.</p>
      </details>
    </div>
  </details>;
}

export function SavedOuting({ useSite, target, driving }: { useSite: (km: number) => void; target: number; driving: boolean }) {
  const s = useGame(), t = useGameTime(2);
  const [waiting, setWaiting] = useState(false);
  const cancel = useRef<null | (() => void)>(null);
  useEffect(() => () => cancel.current?.(), []);
  const plan = s.roverOuting;
  if (!plan || s.tutorial.active) return null;
  const captured = plan.capturedAt !== undefined;
  const passed = t > plan.end;
  const onSite = !driving && s.rover.dist === plan.distance;
  const enRoute = driving && s.rover.target === plan.distance;
  const scheduled = plan.at > t && (onSite || enRoute && s.rover.arriveAt <= plan.at);
  const canWait = scheduled && plan.at < lifeSupportEnd(s, currentWorld().system) && !waiting && !Number.isFinite(clock.stopAt);
  const title = captured ? 'Outing captured' : passed ? 'Planned window passed' : t >= plan.start ? 'Planned camera window' : 'Saved camera outing';
  return <section className="panel panel-pad stack outing-ticket" aria-label="Saved rover outing">
    <div className="row between"><b>{title}</b>{!captured && !passed && <span className="muted">{t < plan.start ? `Opens in ${remainingTime(plan.start - t)}` : `${remainingTime(plan.end - t)} left`}</span>}</div>
    <div>{windowTitle(plan)} · {fmt(plan.distance / 1000, 0)} km east</div>
    <div className="muted">{captured ? 'You captured the simultaneous views. Open the comparator to mark the shift.'
      : passed ? 'You can still take a pair whenever both cameras have a usable view.'
      : onSite ? 'Rover in position. Use the live camera panel to check the view.'
      : enRoute ? 'Rover headed to the planned site.'
      : 'Set the planned site on the route control, then send the rover.'}</div>
    {!captured && !passed && <div className="row">
      {!driving && !onSite && target * 1000 !== plan.distance && <button className="btn small" onClick={() => useSite(plan.distance / 1000)}>Set planned site</button>}
      {scheduled && <button className="btn small" disabled={!canWait} onClick={() => {
        const current = useGame.getState();
        const estimate = current.roverOuting;
        if (estimate !== plan || Number.isFinite(clock.stopAt) || clock.t >= plan.at || plan.at >= lifeSupportEnd(current, currentWorld().system)) return;
        const safeTrip = current.rover.arriveAt > clock.t
          ? current.rover.target === plan.distance && current.rover.arriveAt <= plan.at
          : current.rover.dist === plan.distance;
        if (!safeTrip) return;
        setWaiting(true);
        cancel.current = spendTime(plan.at - clock.t, () => { cancel.current = null; setWaiting(false); }, { pauseOnArrival: true });
      }}>Wait to planned time</button>}
      {waiting && <button className="btn small" onClick={() => { cancel.current?.(); cancel.current = null; setWaiting(false); }}>Stop waiting</button>}
    </div>}
    <details className="measurement-help"><summary>Outing details</summary>
      <p>Based on {plan.observations} sightings from day {dayNumber(plan.observedFrom)} to day {dayNumber(plan.observedTo)}. The forecast allows {fmt(plan.margin / DEG, 1)}° for tracked drift. Waiting uses expedition time and supplies.</p>
      <button className="btn small ghost" onClick={() => { cancel.current?.(); cancel.current = null; setWaiting(false); s.set({ roverOuting: null }); }}>Clear outing</button>
    </details>
  </section>;
}
