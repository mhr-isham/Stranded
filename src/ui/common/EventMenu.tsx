import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { clock, subscribeClock } from '../../game/clock';
import { scheduledEvents, type ScheduledEvent } from '../../game/scheduledEvents';
import { currentWorld, spendTime } from '../../game/sim';
import { useGame } from '../../game/store';
import { lifeSupportEnd } from '../../game/survival';
import { dayNumber } from '../../game/time';
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

export function EventMenu({ open, onClose, now, supplyEnd }: { open: boolean; onClose: () => void; now: number; supplyEnd: number }) {
  const state = useGame();
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

  return <Modal onClose={onClose}>
    <div ref={menu} tabIndex={-1} className="stack event-menu" role="region" aria-label="Scheduled events">
      <h2>Next event</h2>
      <div className="muted">Scheduled operations and observing times you saved.</div>
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
    </div>
  </Modal>;
}
