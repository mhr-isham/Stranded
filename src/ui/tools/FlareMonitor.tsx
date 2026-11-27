import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { DAY, HOUR } from '../../engine/constants';
import { sfx } from '../../game/audio';
import { clock, subscribeClock } from '../../game/clock';
import { FLARE_GLOW_THRESHOLD, FLARE_SAMPLE_SECONDS, flareEvidence, flareRisk, glowSamples, readSkyGlow, type GlowSample } from '../../game/flareObservation';
import { currentWorld, spendTime } from '../../game/sim';
import { useGame } from '../../game/store';
import { lifeSupportEnd } from '../../game/survival';
import { dayNumber, hhmm } from '../../game/time';
import { Chart, type Pt } from '../common/Chart';
import { useGameTime } from '../common/widgets';

const durations = [1, 3, 7];
const horizons = [1, 3, 6, 12, 24];
const glowLabel = (value: number | null) => value === null ? 'Cloud gap' : value >= FLARE_GLOW_THRESHOLD ? 'Elevated sky glow' : 'Quiet sky';
const hoursPretty = (seconds: number) => `${(seconds / HOUR).toFixed(1)} h`;
const percent = (p: number) => p > 0 && p < .01 ? '<1%' : p < 1 && p > .99 ? '>99%' : `${Math.round(p * 100)}%`;

function glowSegments(samples: GlowSample[]) {
  const segments: Pt[][] = [];
  let segment: Pt[] = [];
  for (const row of samples) {
    if (row.glow === null) {
      if (segment.length) segments.push(segment);
      segment = [];
    } else segment.push({ x: row.at / DAY + 1, y: row.glow });
  }
  if (segment.length) segments.push(segment);
  return segments;
}

export function FlareMonitor({ onClose }: { onClose: () => void }) {
  const now = useGameTime(4);
  const stopAt = useSyncExternalStore(subscribeClock, () => clock.stopAt);
  const { system } = currentWorld();
  const s = useGame();
  const sessions = s.flareSessions;
  const latest = sessions.at(-1);
  const active = latest && latest.end > now && latest.start <= now ? latest : null;
  const [duration, setDuration] = useState(3);
  const [windowHours, setWindowHours] = useState(6);
  const [showSession, setShowSession] = useState('latest');
  const [message, setMessage] = useState('');
  const panel = useRef<HTMLElement>(null);
  const cancelWait = useRef<(() => void) | null>(null);
  useEffect(() => {
    panel.current?.focus();
    return () => cancelWait.current?.();
  }, []);
  const displayThrough = latest ? Math.min(latest.end, latest.start + Math.floor((now - latest.start) / FLARE_SAMPLE_SECONDS) * FLARE_SAMPLE_SECONDS) : 0;
  const records = useMemo(() => sessions.map((session) => ({ session, samples: glowSamples(system, session, displayThrough) })), [displayThrough, sessions, system]);
  const shown = records.find((r) => String(r.session.start) === showSession) ?? records.at(-1);
  const evidence = useMemo(() => flareEvidence(records.map((r) => r.samples)), [records]);
  const risk = useMemo(() => flareRisk(evidence, windowHours * HOUR), [evidence, windowHours]);
  const glow = readSkyGlow(system, now, s.settings.survival).glow;
  const segments = useMemo(() => glowSegments(shown?.samples ?? []), [shown]);
  const canWait = active && !Number.isFinite(stopAt) && !clock.realtime && active.end < lifeSupportEnd(s, system);

  function start() {
    const state = useGame.getState(), start = clock.t;
    const previous = state.flareSessions.at(-1);
    if (state.phase !== 'play' || (previous && previous.end > start)) return;
    const end = start + duration * DAY;
    if (end >= lifeSupportEnd(state, system)) { setMessage('Choose a shorter session within your remaining supplies.'); return; }
    state.set({ flareSessions: [...state.flareSessions, { start, end, clouds: state.settings.survival }] });
    setShowSession('latest'); setMessage(''); sfx('log');
  }

  function finish() {
    const state = useGame.getState(), last = state.flareSessions.at(-1);
    if (!last || clock.t >= last.end) return;
    cancelWait.current?.();
    cancelWait.current = null;
    const previous = state.flareSessions.slice(0, -1);
    state.set({ flareSessions: clock.t > last.start ? [...previous, { ...last, end: clock.t }] : previous });
    setMessage('Session ended. Your readings are kept.');
  }

  function waitToEnd() {
    const state = useGame.getState(), last = state.flareSessions.at(-1);
    if (!last || state.phase !== 'play' || last.end <= clock.t || Number.isFinite(clock.stopAt) || clock.realtime
      || last.end >= lifeSupportEnd(state, system)) return;
    cancelWait.current = spendTime(last.end - clock.t, () => { cancelWait.current = null; }, { pauseOnArrival: true });
  }

  return <section ref={panel} tabIndex={-1} className="panel panel-pad stack flare-monitor" aria-label="Flare monitor">
    <div className="row between"><b>Flare monitor</b><button className="btn small" onClick={onClose}>Back to Sky</button></div>
    <div className="flare-readout panel-inset">
      <span className="meter-label">CURRENT SKY GLOW</span>
      <strong className="mono">{glow === null ? '—' : `${glow.toFixed(2)}×`}</strong>
      <span className={glow !== null && glow >= FLARE_GLOW_THRESHOLD ? 'amber' : 'muted'}>{glowLabel(glow)}</span>
    </div>
    <div className="faint">Camp’s sensor measures scattered light in the locked night sky. A quiet reading is 1×.</div>

    {active ? <>
      <div className="muted">Recording · {hoursPretty(active.end - now)} left. You can use other tools while it runs.</div>
      <div className="row">
        <button className="btn small" disabled={!canWait} onClick={waitToEnd}>Wait to session end</button>
        <button className="btn small ghost" onClick={finish}>End recording</button>
      </div>
    </> : <>
      <label className="field">Session length<select className="input" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
        {durations.map((days) => <option value={days} key={days}>{days} expedition day{days === 1 ? '' : 's'}</option>)}
      </select></label>
      <button className="btn primary" onClick={start}>Start recording</button>
    </>}
    {message && <div className="muted" role="status">{message}</div>}

    {shown && <>
      {records.length > 1 && <label className="field">Session shown<select className="input" value={showSession} onChange={(e) => setShowSession(e.target.value)}>
        <option value="latest">Latest session</option>
        {records.slice(0, -1).reverse().map(({ session }) => <option value={session.start} key={session.start}>From Day {dayNumber(session.start)} · {hhmm((session.start % DAY) / HOUR)}</option>)}
      </select></label>}
      <div className="flare-record stack">
        <div className="row between"><b>Recorded glow</b><span className="faint">Every 15 min</span></div>
        {segments.length > 0 ? <Chart ariaLabel="Measured sky glow during this session" height={146}
          series={[
            { pts: [{ x: shown.samples[0].at / DAY + 1, y: 1 }, { x: shown.samples.at(-1)!.at / DAY + 1, y: 1 }], kind: 'line', color: 'transparent' },
            ...segments.map((pts) => ({ pts, kind: pts.length > 1 ? 'line' as const : 'dots' as const, color: '#ffb372' })),
          ]}
          xLabel="expedition day" yLabel="sky glow (× quiet)" /> :
          <p className="faint">No clear samples in this session yet.</p>}
        {shown.samples.some((sample) => sample.glow === null) && <div className="faint">Cloud gaps leave blank stretches in the trace.</div>}
      </div>
      <details className="measurement-help flare-risk">
        <summary>Estimate risk for a planned observation</summary>
        <div className="stack">
          <dl className="kv">
            <dt>Starts seen</dt><dd>{evidence.onsetCount}</dd>
            <dt>Clear monitoring time</dt><dd>{hoursPretty(evidence.observedSeconds)}</dd>
            <dt>Quiet time used for the rate</dt><dd>{hoursPretty(evidence.quietSeconds)}</dd>
          </dl>
          <label className="field">Observing window<select className="input" value={windowHours} onChange={(e) => setWindowHours(Number(e.target.value))}>
            {horizons.map((h) => <option value={h} key={h}>{h} hour{h === 1 ? '' : 's'}</option>)}
          </select></label>
          {risk ? <div className="panel-inset stack" aria-label="Flare risk estimate">
            {evidence.onsetCount > 0 ? <><b>About {percent(risk.probability)} chance of a new flare</b>
              <span className="muted">{risk.ratePerDay.toFixed(2)} detected starts per quiet day</span></> :
              <b>No starts recorded yet. Keep watching to narrow the range.</b>}
            <span className="mono">90% range · {percent(risk.lower)} to {percent(risk.upper)}</span>
          </div> : <div className="muted">Keep a clear stretch of readings to estimate a rate.</div>}
          <p>The estimate uses all your sessions and assumes the planned window starts quiet. It treats flare starts as random at a steady average rate. Cloud gaps and stretches already bright supply no new start count. Brief or overlapping events can blend together.</p>
        </div>
      </details>
    </>}
  </section>;
}
