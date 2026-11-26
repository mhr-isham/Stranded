import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { clock, subscribeClock } from '../../game/clock';
import { expeditionTimeline, scheduledEvents, type ScheduledEvent } from '../../game/scheduledEvents';
import { currentWorld, spendTime } from '../../game/sim';
import { useGame } from '../../game/store';
import { lifeSupportEnd } from '../../game/survival';
import { dayNumber } from '../../game/time';
import { ConstellationSketchpad } from './ConstellationSketchpad';
import { Modal, toast } from './widgets';

function durationLabel(seconds: number) {
  const minutes = Math.ceil(Math.max(0, seconds) / 60);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor(minutes % 1440 / 60);
  const remainder = minutes % 60;
  if (days) return hours ? `${days} d ${hours} h` : `${days} d`;
  if (hours) return remainder ? `${hours} h ${remainder} min` : `${hours} h`;
  return `${minutes} min`;
}

const matches = (a: ScheduledEvent, b: ScheduledEvent) => a.id === b.id && a.at === b.at && a.label === b.label;

export function EventMenu({ open, onClose, now, supplyEnd, launchWindow, onOpenLaunch }: {
  open: boolean; onClose: () => void; now: number; supplyEnd: number; launchWindow?: number; onOpenLaunch: () => void;
}) {
  const state = useGame();
  const [view, setView] = useState<'events' | 'timeline' | 'sketch'>('events');
  const [selected, setSelected] = useState<ScheduledEvent | null>(null);
  const [active, setActive] = useState<ScheduledEvent | null>(null);
  const cancel = useRef<null | (() => void)>(null);
  const menu = useRef<HTMLDivElement>(null);
  const events = open || active ? scheduledEvents(state, now) : [];
  const chosen = selected ? events.find(event => matches(event, selected)) : undefined;

  function stopWait() {
    cancel.current?.();
    cancel.current = null;
    setActive(null);
  }

  useEffect(() => () => cancel.current?.(), []);
  useEffect(() => {
    if (!open) return;
    const trigger = document.activeElement;
    menu.current?.focus();
    return () => { if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus(); };
  }, [open]);
  const activeStillScheduled = active && events.some(event => matches(event, active));
  const stopAt = useSyncExternalStore(subscribeClock, () => clock.stopAt);
  const realtime = clock.realtime;
  useEffect(() => {
    if (active && clock.t < active.at - .001 && (!activeStillScheduled || Math.abs(stopAt - active.at) > .001 || realtime || active.at >= supplyEnd)) {
      stopWait();
    }
  }, [active, activeStillScheduled, stopAt, realtime, supplyEnd]);

  if (!open) return null;
  const alreadyWaiting = Number.isFinite(stopAt);
  const beyondSupplies = !!chosen && chosen.at >= supplyEnd;
  const canWait = !!chosen && !active && !alreadyWaiting && !realtime && !beyondSupplies;

  function waitForEvent() {
    if (!chosen || active || clock.realtime || Number.isFinite(clock.stopAt)) return;
    const current = useGame.getState();
    const liveEvent = scheduledEvents(current, clock.t).find(event => matches(event, chosen));
    if (!liveEvent || current.phase !== 'play' || current.tutorial.active ||
      liveEvent.at >= lifeSupportEnd(current, currentWorld().system)) return;

    setActive(liveEvent);
    cancel.current = spendTime(liveEvent.at - clock.t, () => {
      cancel.current = null;
      setActive(null);
      if (useGame.getState().phase === 'play' && clock.t >= liveEvent.at - .001) toast('Paused at the scheduled time');
    }, { pauseOnArrival: true });
  }

  function close() {
    setView('events');
    onClose();
  }

  function switchView(next: typeof view) {
    setView(next);
    menu.current?.focus();
  }

  const timelineEntries = view === 'timeline' ? expeditionTimeline(state, now, launchWindow) : [];
  return <Modal onClose={close}>
    <div ref={menu} tabIndex={-1} className="stack event-menu" role="region" aria-label="Scheduled events">
      <h2>{view === 'timeline' ? 'Expedition timeline' : view === 'sketch' ? 'Constellation sketchpad' : 'Next event'}</h2>
      {view === 'sketch' ? <>
        <button className="btn small timeline-switch" onClick={() => switchView('events')}>Back to next event</button>
        <ConstellationSketchpad />
      </> : view === 'timeline' ? <>
        <button className="btn small timeline-switch" onClick={() => switchView('events')}>Back to next event</button>
        <p className="muted timeline-intro">See what’s coming up and decide what to do before you get there.</p>
        <dl className="timeline-key">
          <dt>Scheduled</dt><dd>A rover trip or job already underway.</dd>
          <dt>Saved</dt><dd>An observing time you picked. Check conditions when you arrive.</dd>
          <dt>Estimated</dt><dd>A launch date from your navigation sheet. It can shift as your measurements change.</dd>
        </dl>
        {timelineEntries.length ? <ol className="expedition-timeline" aria-label="Upcoming expedition entries">
          {timelineEntries.map(entry => <li className="panel-inset timeline-item" key={entry.id}>
            <div className="row between">
              <span className="timeline-day">Day {dayNumber(entry.at)} <span className="muted">· {entry.at <= now ? 'Now' : `in ${durationLabel(entry.at - now)}`}</span></span>
              <span className={`timeline-kind timeline-kind-${entry.kind.toLowerCase()}`}>{entry.kind}</span>
            </div>
            <b>{entry.label}</b>
            <span className="muted timeline-source">{entry.source}</span>
            {entry.roverBusy && <span className="amber timeline-source">The rover is scheduled to be busy at this time.</span>}
            {entry.at >= supplyEnd && <span className="amber timeline-source">Beyond current supplies.</span>}
            <button className="btn small" onClick={() => {
              if (entry.screen === 'launch') onOpenLaunch();
              else useGame.getState().go(entry.screen);
              close();
            }}>{entry.action}</button>
          </li>)}
        </ol> : <div className="panel-inset">Nothing on the timeline yet. Your trips, jobs and observing plans will appear here.</div>}
      </> : <>
      <div className="muted">Scheduled operations and observing times you saved.</div>
      <button className="btn small timeline-switch" onClick={() => switchView('timeline')}>View timeline</button>
      {active && <div className="panel-inset stack" aria-label="Scheduled wait">
        <b>Waiting · {active.label}</b>
        <span>{durationLabel(active.at - now)} remaining</span>
        <button className="btn small" onClick={() => {
          stopWait();
          clock.paused = true;
          clock.emit();
        }}>Cancel wait</button>
      </div>}
      {!active && (events.length ? <div className="stack" role="group" aria-label="Upcoming schedules">
        {events.map(event => <button key={event.id} type="button" className="btn event-choice"
          aria-pressed={!!chosen && matches(event, chosen)} onClick={() => setSelected(event)}>
          <span><b>{event.label}</b><span className="event-source">{event.source}</span></span>
          <span className="mono">{durationLabel(event.at - now)}</span>
        </button>)}
      </div> : <div className="panel-inset">Nothing scheduled. Rover trips, surface jobs and saved camera outings appear here.</div>)}
      {chosen && !active && <div className="panel-inset stack">
        <span>Wait {durationLabel(chosen.at - now)} and pause on day {dayNumber(chosen.at)}.</span>
        <span className="muted">Normal expedition time and supplies pass while you wait.</span>
        {beyondSupplies && <span className="amber">This is beyond the current supplies deadline.</span>}
        {alreadyWaiting && <span className="muted">Another clock stop is already set.</span>}
        {realtime && <span className="muted">Leave the real-time instrument before using warp.</span>}
        <button className="btn primary" disabled={!canWait} onClick={waitForEvent}>Wait and pause</button>
      </div>}
      <details className="measurement-help">
        <summary>While you wait</summary>
        <p>Review a tool or sketch the sky. Your clock and scheduled stop keep their current settings.</p>
        <div className="row">
          <button className="btn small" onClick={() => { useGame.getState().go('observatory'); close(); }}>Review sky observations</button>
          <button className="btn small" onClick={() => { useGame.getState().go('launch'); close(); }}>Open launch planner</button>
          <button className="btn small" onClick={() => switchView('sketch')}>Open constellation sketchpad</button>
        </div>
      </details>
      </>}
    </div>
  </Modal>;
}
