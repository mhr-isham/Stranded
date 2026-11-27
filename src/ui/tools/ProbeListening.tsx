import { useState } from 'react';
import { DAY, HOUR } from '../../engine/constants';
import { clock } from '../../game/clock';
import { fmt } from '../../game/format';
import { createProbeWindow, MANUAL_HOURS_LIMIT, PROBE_INTERVALS, probeWindowKey, type ProbeWindow } from '../../game/probeListening';
import type { ProbeState } from '../../game/probeState';
import { useGame } from '../../game/store';
import { dayNumber } from '../../game/time';

const cadence = (seconds: number) => seconds < HOUR ? `${seconds / 60} min` : `${seconds / HOUR} h`;
export function probeDate(at: number) {
  const minute = Math.floor((at % DAY) / 60);
  return `Day ${dayNumber(at)} · ${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')} expedition`;
}
const relativeHour = (offset: number) => `${offset > 0 ? '+' : ''}${fmt(offset / HOUR, 2)} h`;

function updateWindows(p: ProbeState, change: (live: ProbeState) => ProbeWindow[] | undefined) {
  const s = useGame.getState();
  const records = s.probeLog ?? [];
  const live = s.probe?.launchedAt === p.launchedAt ? s.probe : records.find((entry) => entry.launchedAt === p.launchedAt);
  if (!live?.windows) return;
  const windows = change(live);
  if (!windows) return;
  const updated = { ...live, windows };
  s.set({
    probe: s.probe?.launchedAt === live.launchedAt ? updated : s.probe,
    probeLog: records.map((entry) => entry.launchedAt === live.launchedAt ? updated : entry),
  });
}

export function ProbeListening({ probe, now, count, nextWindow, canWait, onWait }: {
  probe: ProbeState; now: number; count: number; nextWindow?: ProbeWindow; canWait: boolean; onWait: () => void;
}) {
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [interval, setInterval] = useState<number>(1200);
  const [notice, setNotice] = useState('');
  const lost = probe.crashed && now >= probe.arriveAt;
  const windows = probe.windows;
  function addWindow() {
    if (!start.trim() || !end.trim()) { setNotice('Enter both hour offsets.'); return; }
    updateWindows(probe, (live) => {
      if (live.crashed && clock.t >= live.arriveAt) { setNotice('The signal has been lost.'); return; }
      const result = createProbeWindow(live, clock.t, Number(start), Number(end), interval);
      if (!result.window) { setNotice(result.error ?? 'The window could not be saved.'); return; }
      setNotice('Listening window scheduled.');
      setStart(''); setEnd('');
      return [...live.windows!, { ...result.window, label: 'Manual window' }];
    });
  }
  const status = (window: ProbeWindow) => {
    if (lost && window.end >= probe.arriveAt) return 'Signal lost';
    if (window.end <= now) return 'Complete';
    return window.start <= now ? 'Listening' : 'Scheduled';
  };
  return <section className="panel panel-pad stack probe-listening" aria-label="Probe listening schedule">
    <div className="row between"><b>Listening schedule</b><span className="mono blue">{count} received</span></div>
    <div className="muted">Planned closest approach · <b>{probeDate(probe.arriveAt)}</b></div>
    {windows ? <>
      {lost ? <div className="amber">Signal lost at the planned encounter. Earlier readings are available.</div> :
        nextWindow ? <div className="probe-next">
          <span>Next window <b>{probeDate(nextWindow.start)}</b></span>
          <button type="button" className="btn small" disabled={!canWait} onClick={onWait}>Wait to next window</button>
        </div> : <div className="faint">Scheduled listening runs automatically as expedition time passes.</div>}
      <details className="measurement-help">
        <summary>Listening windows ({windows.length})</summary>
        <div className="stack probe-window-list">
          {windows.length === 0 && <p>No listening windows scheduled.</p>}
          {[...windows].sort((a, b) => a.start - b.start).map((w) => <div className="panel-inset probe-window" key={probeWindowKey(w)}>
            <div className="row between"><b>{w.label ?? 'Listening window'}</b><span className={status(w) === 'Listening' ? 'blue' : 'faint'}>{status(w)}</span></div>
            <span className="mono">{relativeHour(w.start - probe.arriveAt)} to {relativeHour(w.end - probe.arriveAt)} · every {cadence(w.interval)}</span>
            {w.start > now && !lost && <button type="button" className="btn small ghost" aria-label={`Remove ${w.label ?? 'listening window'} at ${relativeHour(w.start - probe.arriveAt)}`}
              onClick={() => updateWindows(probe, (live) => {
                if (clock.t >= w.start || (live.crashed && clock.t >= live.arriveAt)) return;
                return live.windows!.filter((entry) => probeWindowKey(entry) !== probeWindowKey(w));
              })}>Remove</button>}
          </div>)}
        </div>
      </details>
      {!lost && <details className="measurement-help">
        <summary>Add a manual window</summary>
        <form className="stack probe-window-form" onSubmit={(event) => { event.preventDefault(); addWindow(); }}>
          <p>Enter hours relative to the planned pass. Negative hours are before it. The receiver counts overlapping readings at the same time once.</p>
          <div className="probe-window-fields">
            <label className="field">Start offset (h)<input className="input" type="number" step="any" min={-MANUAL_HOURS_LIMIT} max={MANUAL_HOURS_LIMIT} value={start} onChange={(event) => setStart(event.target.value)} /></label>
            <label className="field">End offset (h)<input className="input" type="number" step="any" min={-MANUAL_HOURS_LIMIT} max={MANUAL_HOURS_LIMIT} value={end} onChange={(event) => setEnd(event.target.value)} /></label>
          </div>
          <label className="field">Read every<select className="input" value={interval} onChange={(event) => setInterval(Number(event.target.value))}>
            {PROBE_INTERVALS.map((seconds) => <option value={seconds} key={seconds}>{cadence(seconds)}</option>)}
          </select></label>
          <button className="btn small" type="submit">Schedule window</button>
          {notice && <div className="muted" role="status">{notice}</div>}
        </form>
      </details>}
    </> : <div className="faint">Automatic receiver from an earlier save. Its original record is available after the pass.</div>}
  </section>;
}
