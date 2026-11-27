import { useEffect, useMemo, useRef, useState } from 'react';
import { ARCSEC, DAY, HOUR } from '../../engine/constants';
import { nearStarsOf, parallaxOffset } from '../../engine/nearstars';
import { clock } from '../../game/clock';
import { sfx } from '../../game/audio';
import { confirmStellarFix } from '../../game/foldNavigation';
import { fmt } from '../../game/format';
import { modeOf } from '../../game/modes';
import { opticalStatus } from '../../game/observing';
import { currentWorld, spendTime } from '../../game/sim';
import { discriminatingStar, stellarEvidence } from '../../game/stellarFix';
import { useGame } from '../../game/store';
import { lifeSupportEnd } from '../../game/survival';
import { Chart } from '../common/Chart';
import { Formula } from '../common/sheetBits';
import { toast, useGameTime } from '../common/widgets';
import { MeasurementSources } from '../common/MeasurementSources';
import { ObservingStatus } from '../common/ObservingStatus';

export function StarsPanel({ selected, choose, point }: { selected: number; choose: (index: number) => void; point: (index: number) => void }) {
  const s = useGame();
  const t = useGameTime(4);
  const { system: sys, catalog } = currentWorld();
  const stars = nearStarsOf(sys);
  const [place, setPlace] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [waiting, setWaiting] = useState(false);
  const cancelWait = useRef<(() => void) | null>(null);
  useEffect(() => () => cancelWait.current?.(), []);
  const evidence = useMemo(() => stellarEvidence(s, sys), [s.starPar, s.sheet, sys]);
  const st = stars[selected];
  if (!st) return null;

  const direction = catalog[st.index].dir;
  const status = opticalStatus(sys, s, t, 'nearby-star', { direction });
  const { epochs, span, fit } = evidence.stars[selected];
  const observedToday = epochs.some(o => Math.floor(o.t / DAY) === Math.floor(t / DAY));
  const P1 = s.sheet.P1?.value;
  const fitted = evidence.stars.filter(star => star.fit).length;
  const allowCoaching = modeOf(s.settings.difficulty).coaching
    && (s.settings.difficulty !== 'cadet' || s.settings.cadetGuidance !== false)
    && (!s.settings.freeRoam || s.settings.freeRoamGuidance);
  const refine = allowCoaching ? discriminatingStar(evidence) : null;

  const log = () => {
    const current = useGame.getState();
    const now = clock.t;
    const live = opticalStatus(sys, current, now, 'nearby-star', { direction });
    if (!live.ok) return toast(live.reason);
    if (current.starPar.some(o => o.i === selected && Math.floor(o.at / DAY) === Math.floor(now / DAY))) return toast('This star already has a position for today.');
    const noise = (Math.random() + Math.random() + Math.random() - 1.5) * .02 * ARCSEC * live.seeing;
    const v = Math.round((parallaxOffset(sys, st, now) + noise) / (.001 * ARCSEC)) * .001 * ARCSEC;
    current.set({ starPar: [...current.starPar, { i: selected, at: now, v, source: 'tracker',
      environment: { instrument: 'telescope', at: now, rawValue: v, seeing: { factor: live.seeing, frozen: false } } }] });
    setMessage('');
    point(selected);
    sfx('shutter');
  };

  const wait = (days: number) => {
    const s = useGame.getState();
    const now = clock.t;
    const start = Math.max(now + HOUR, days ? now + days * DAY : Math.floor(now / DAY) * DAY + (observedToday ? DAY : 0));
    const end = Math.min(start + 150 * DAY, lifeSupportEnd(s, sys, now) - HOUR);
    let at = start;
    while (at < end && !opticalStatus(sys, s, at, 'nearby-star', { direction }).ok) at += HOUR;
    if (at >= end) return toast('No clear view found before the search limit or supplies deadline.');
    setWaiting(true);
    cancelWait.current = spendTime(at - now, () => {
      cancelWait.current = null;
      setWaiting(false);
      point(selected);
    }, { pauseOnArrival: true });
  };

  const summary = !evidence.ready ? 'Three usable stellar fits and an orbit size are needed.'
    : evidence.matches.length === 1 ? 'One catalogue entry fits the measurements.'
      : evidence.matches.length === 0 ? 'The current ranges do not fit any catalogue entry.'
        : `${evidence.matches.length} locations still fit. More evidence is needed.`;

  return <div className="stack">
    <section className="panel panel-pad stack" aria-label="Stellar survey">
      <div className="row between"><b>Stellar survey</b><span className="muted">{fitted}/3 fitted</span></div>
      <p className="stellar-note">Catch how each star shifts against the background across your planet’s year.</p>
      <div className="stellar-targets" role="group" aria-label="Survey targets">
        {stars.map((star, i) => <button type="button" key={star.name} className={`btn small ${selected === i ? 'primary' : ''}`}
          aria-pressed={selected === i} disabled={waiting} onClick={() => choose(i)}>{star.name}</button>)}
      </div>
      <div className="row between">
        <button className="btn primary" disabled={!status.ok || observedToday || waiting} onClick={log}>Log {st.name}’s position</button>
        <button className="btn small" disabled={waiting} onClick={() => point(selected)}>Centre in sky</button>
      </div>
      <ObservingStatus status={status} />
      {waiting ? <button className="btn small" onClick={() => {
        cancelWait.current?.(); cancelWait.current = null; setWaiting(false);
      }}>Stop waiting</button> : <div className="row">
        <button className="btn small" onClick={() => wait(0)}>Next clear view</button>
        <button className="btn small" onClick={() => wait(21)}>View in 3+ weeks</button>
      </div>}
      <div className="stellar-note">{epochs.length} observing {epochs.length === 1 ? 'day' : 'days'} · {fmt(span / DAY, 0)} days covered{observedToday ? ' · Today logged' : ''}</div>
      {epochs.length > 0 && <Chart ariaLabel={`Recorded ${st.name} positions`} series={[
        { pts: epochs.map(o => ({ x: o.t / DAY + 1, y: o.v / ARCSEC })), color: '#ffe6b8', kind: 'dots' },
        ...(fit ? [{ pts: Array.from({ length: 121 }, (_, i) => {
          const x = epochs[0].t + span * i / 120;
          return { x: x / DAY + 1, y: fit.model(x) / ARCSEC };
        }), color: '#76dccc', kind: 'line' as const }] : []),
      ]} xLabel="expedition day" yLabel="offset (″)" yFmt={y => y.toFixed(3)} />}
      {fit && <div className="stellar-fit"><span>Measured parallax</span><b>{fmt(fit.parallax / ARCSEC, 4)}″ ± {fmt(fit.sigma / ARCSEC, 4)}″</b></div>}
      {!P1 && <div className="amber stellar-note">Log your planet’s year on the sheet to fit the wobble.</div>}
      <details className="measurement-help">
        <summary>Observation log and method</summary>
        <p>Use at least six observing days across more than half a home orbit. Spreading the readings out helps separate the repeating shift from the star’s steady drift.</p>
        {fit && <p>Estimated steady drift · {fmt(fit.pm * 365.25 * DAY / ARCSEC, 3)}″ per Earth year</p>}
        <Formula>d = a₁ / tan p</Formula>
        <MeasurementSources instrument="stars" />
        {epochs.length > 0 && <table className="log"><thead><tr><th>Expedition day</th><th>Offset (″)</th></tr></thead>
          <tbody>{epochs.map(o => <tr key={o.t}><td>{fmt(o.t / DAY + 1, 2)}</td><td>{fmt(o.v / ARCSEC, 3)}</td></tr>)}</tbody></table>}
      </details>
    </section>
    <section className="panel panel-pad stack" aria-label="Mira’s catalogue">
      <div className="row between"><b>Mira’s catalogue</b><span className="muted">Light-years</span></div>
      <div className="stellar-catalogue" role="group" aria-label="Choose a catalogue location">
        <div className="stellar-row stellar-row-head"><span>Location</span>{stars.map(star => <span key={star.name}>{star.name}</span>)}</div>
        <div className="stellar-row stellar-your-range"><b>Your range</b>{evidence.stars.map((star, i) => <span key={i}>{star.distance
          ? Number.isFinite(star.distance.high) ? `${fmt(star.distance.low, 2)}–${fmt(star.distance.high, 2)}` : `≥ ${fmt(star.distance.low, 2)}` : '—'}</span>)}</div>
        {evidence.catalogue.map(row => <button className="btn stellar-row" key={row.label} aria-pressed={place === row.label} onClick={() => {
          setPlace(row.label); setMessage('');
        }}><b>{row.label}</b>{row.ly.map((value, i) => <span key={i}>{fmt(value, 2)}</span>)}</button>)}
      </div>
      <p className={`stellar-note ${evidence.ready && evidence.matches.length !== 1 ? 'amber' : ''}`}>{summary}</p>
      {!evidence.orbit && <p className="stellar-note">For orbit size, record your year, the blue planet’s synodic period, an opposition date and a dated parallax distance on the sheet.</p>}
      {refine !== null && <div className="callout tip stellar-note">
        <b>ECHO</b> · A sighting of {stars[refine].name} from a new part of the orbit could help separate the remaining places.
        {selected !== refine && <button className="btn small" disabled={waiting} onClick={() => choose(refine)}>Select {stars[refine].name}</button>}
      </div>}
      <details className="measurement-help"><summary>How the fit is checked</summary>
        <p>The ranges use two estimated standard errors for parallax and orbit size. All three stars must fit using the same orbit size. The catalogue lists candidate locations with their expected distances.</p>
      </details>
      <button className="btn primary" disabled={!place || !evidence.ready || evidence.matches.length !== 1 || waiting} onClick={() => {
        if (place) setMessage(confirmStellarFix(place) ?? '');
      }}>Confirm location fix</button>
      {message && <p className="amber stellar-note" role="status">{message}</p>}
    </section>
  </div>;
}
