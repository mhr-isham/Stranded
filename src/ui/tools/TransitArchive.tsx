import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { sfx } from '../../game/audio';
import { clock } from '../../game/clock';
import { fmt } from '../../game/format';
import { useGame } from '../../game/store';
import {
  archiveFollowUp, archiveMarkIssue, archivePrediction, archiveReading, freshArchive, surveyPoints,
  type ArchivePoint, type ArchiveProgress,
} from '../../game/transitArchive';
import { Chart, type Marker } from '../common/Chart';
import { Formula } from '../common/sheetBits';

const START = surveyPoints[0].day;
const END = surveyPoints.at(-1)!.day;
const DEFAULT_PROGRESS = freshArchive();
const KEPLER_SOURCE = 'https://github.com/astropy/astropy-data/blob/6f61d1c13a65615fd265078b80a82df02ece832b/timeseries/kplr010666592-2009131110544_slc.fits';
const PLANET_SOURCE = 'https://exoplanetarchive.ipac.caltech.edu/overview/HAT-P-7';

function ArchiveChart({ points, markers, cursor, onCursor, label }: {
  points: ArchivePoint[]; markers: Marker[]; cursor?: number; onCursor?: (day: number) => void; label: string;
}) {
  return <Chart ariaLabel={label} height="clamp(160px, 30vh, 265px)" brushMode="band" doubleTapReset={false}
    series={[{ pts: points.map(p => ({ x: p.day, y: 100 + p.ppm / 10000 })), color: '#76dccc', kind: 'dots' }]}
    cursor={cursor} onCursor={onCursor} markers={markers}
    xLabel="elapsed days" yLabel="brightness (%)" xFmt={x => x.toFixed(2)} yFmt={y => y.toFixed(2)} />;
}

export default function TransitArchive({ close }: { close: () => void }) {
  const progress = useGame(s => s.transitArchive) ?? DEFAULT_PROGRESS;
  const { marks, tested, discovery } = progress;
  const [cursor, setCursor] = useState(START);
  const [zoom, setZoom] = useState(false);
  const [message, setMessage] = useState('');
  const [receiving, setReceiving] = useState(false);
  const [showSurvey, setShowSurvey] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const title = useRef<HTMLHeadingElement>(null);
  const receipt = useRef<HTMLHeadingElement>(null);
  const observeButton = useRef<HTMLButtonElement>(null);
  const timer = useRef<number | undefined>(undefined);

  const prediction = useMemo(() => archivePrediction(marks), [marks]);
  const followUp = useMemo(() => tested && prediction ? archiveFollowUp(prediction.day) : null, [tested, prediction]);
  const verified = followUp?.detected === true;
  const inspect = zoom
    ? surveyPoints.filter(p => Math.abs(p.day - cursor) <= .22)
    : surveyPoints;
  const survey = inspect.length >= 2 ? inspect : surveyPoints;
  const reading = archiveReading(surveyPoints, cursor);
  const brightness = reading ? `${fmt(100 + reading.ppm / 10000, 3)}% brightness` : 'No reading here';
  const update = (patch: Partial<ArchiveProgress>) => useGame.setState({ transitArchive: { ...progress, ...patch } });
  const mark = (day: number) => setCursor(Math.min(END, Math.max(START, day)));

  useEffect(() => {
    const el = dialog.current!;
    const paused = clock.paused;
    clock.paused = true;
    clock.emit();
    el.showModal();
    title.current?.focus({ preventScroll: true });
    return () => {
      clearTimeout(timer.current);
      el.close();
      clock.paused = paused;
      clock.emit();
    };
  }, []);

  useEffect(() => {
    if (tested) receipt.current?.focus();
  }, [tested]);

  const logDip = () => {
    const issue = archiveMarkIssue(marks, cursor);
    setMessage(issue ?? '');
    if (issue) return;
    update({ marks: [...marks, cursor], tested: false });
    if (marks.length === 1) requestAnimationFrame(() => observeButton.current?.focus());
    sfx('log');
  };

  const predict = () => {
    if (!prediction || receiving) return;
    setReceiving(true);
    sfx('radio');
    timer.current = window.setTimeout(() => {
      const confirmed = archiveFollowUp(prediction.day).detected;
      update({ tested: true, discovery: confirmed && !discovery
        ? { depth: prediction.depth, period: prediction.period } : discovery });
      setReceiving(false);
      sfx(confirmed ? 'unlock' : 'detent');
    }, 650);
  };

  const edit = () => {
    update({ marks: verified ? [] : marks.slice(0, -1), tested: false });
    setMessage('');
    setShowSurvey(false);
    setZoom(false);
    if (verified) setCursor(START);
    title.current?.focus({ preventScroll: true });
  };

  return createPortal(
    <dialog className="transit-archive panel" ref={dialog} aria-labelledby="archive-heading" onCancel={event => { event.preventDefault(); close(); }}>
      <header className="archive-header">
        <div>
          <p className="meter-label">KEPLER OBSERVATION ARCHIVE</p>
          <h2 id="archive-heading" ref={title} tabIndex={-1}>Follow the shadow</h2>
        </div>
        <button className="btn small" onClick={close}>Close archive</button>
      </header>

      {verified && <section className="archive-discovery" aria-label="Archive discovery">
        <div className="archive-star-scene" aria-hidden="true"><div className="archive-star"><i /></div></div>
        <div>
          <p className="meter-label">DISCOVERY LOGGED</p>
          <h3 ref={receipt} tabIndex={-1}>HAT-P-7 b</h3>
          <p>Your forecast caught the shadow of a hot Jupiter in Kepler’s first observing run.</p>
        </div>
      </section>}

      {!tested ? <section className="archive-body stack" aria-label="Survey recording">
        <h3>{marks.length === 0 ? 'Find the first dip' : marks.length === 1 ? 'Find the next dip' : 'Test your prediction'}</h3>
        <p className="muted">{marks.length === 2 ? 'Test the time between your marks against a later Kepler recording.'
          : marks.length === 1 ? 'Find the next dip to the right. Mark near its bottom to measure the gap.'
            : 'Kepler recorded this star’s brightness. Tap near the bottom of a dip or move the cursor below, then record your mark.'}</p>
        <ArchiveChart points={survey} cursor={cursor} onCursor={receiving ? undefined : mark} label="Kepler survey brightness"
          markers={marks.map((day, i) => ({ x: day, color: '#ffc46b', label: i === 0 ? 'First dip' : 'Second dip' }))} />
        <div className="archive-cursor">
          <label htmlFor="archive-cursor">Cursor <span className="mono">Day {fmt(cursor, 2)}</span></label>
          <span>{brightness}</span>
          <input id="archive-cursor" type="range" aria-valuetext={`Day ${fmt(cursor, 2)}, ${brightness}`} min={START} max={END} step="any"
            disabled={receiving} value={cursor} onChange={e => mark(e.target.valueAsNumber)}
            onKeyDown={e => {
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
              e.preventDefault();
              mark(cursor + (e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -.01 : .01));
            }} />
        </div>
        <div className="archive-actions">
          <button className="btn small" aria-pressed={zoom} disabled={receiving} onClick={() => setZoom(!zoom)}>{zoom ? 'Full survey' : 'Zoom near cursor'}</button>
          {marks.length > 0 && <button className="btn small" disabled={receiving} onClick={edit}>Undo last mark</button>}
          {marks.length < 2 && <button className="btn primary" onClick={logDip}>{marks.length ? 'Mark next dip' : 'Mark first dip'}</button>}
        </div>
        {message && <p className="amber" role="status">{message}</p>}
        {marks.length === 2 && (prediction ? <>
          <dl className="archive-stats">
            <div><dt>Your period</dt><dd>{fmt(prediction.period, 2)} days</dd></div>
            <div><dt>Your transit depth</dt><dd>{fmt(prediction.depth, 2)}%</dd></div>
            <div><dt>Expected next dip</dt><dd>Day {fmt(prediction.day, 2)}</dd></div>
          </dl>
          <button className="btn primary big" ref={observeButton} disabled={receiving} onClick={predict}>
            {receiving ? 'Receiving follow-up…' : 'Observe at the predicted time'}
          </button>
          <span className="archive-status" role="status">{receiving ? 'Receiving Kepler readings' : ''}</span>
        </> : <p className="amber" role="status">Those marks put the next dip outside this follow-up record. Adjust your last mark.</p>)}
      </section> : followUp && prediction && <section className="archive-body stack" aria-label="Follow-up recording">
        {!verified && <h3 ref={receipt} tabIndex={-1}>No matching dip in this window</h3>}
        <p className="muted">
          {verified ? `A third dip appeared in the 12-hour window around your prediction for day ${fmt(prediction.day, 2)}.`
            : 'Try centring your survey marks more closely. A small timing error changes where you look for the next dip.'}
        </p>
        {followUp.points.length >= 2 ? <ArchiveChart points={followUp.points} label="Kepler follow-up brightness"
          markers={[{ x: prediction.day, color: '#ffc46b', label: 'Prediction' }]} />
          : <p className="amber">The archive has too few usable readings in this window.</p>}
        {verified && <>
          <dl className="archive-stats">
            <div><dt>Your period</dt><dd>{fmt(prediction.period, 2)} days</dd></div>
            <div><dt>Your transit depth</dt><dd>{fmt(prediction.depth, 2)}%</dd></div>
            <div><dt>Published period</dt><dd>2.20474 days</dd></div>
          </dl>
          <button className="btn small" aria-expanded={showSurvey} onClick={() => setShowSurvey(!showSurvey)}>{showSurvey ? 'Hide your survey marks' : 'See your survey marks'}</button>
          {showSurvey && <ArchiveChart points={surveyPoints} label="Your two Kepler survey marks"
            markers={marks.map((day, i) => ({ x: day, color: '#ffc46b', label: i === 0 ? 'First dip' : 'Second dip' }))} />}
          <details className="measurement-help">
            <summary>Data and method</summary>
            <p>Kepler Q0, data release 25. Short-cadence PDCSAP_FLUX in the archived FITS file was screened for zero quality flags, grouped into 0.01-day bins, and normalized by the median retained flux. Gaps are left blank. Days are relative to the first kept barycentric timestamp, in TDB.</p>
            <p>Your period comes from the time between two marks. Your depth compares the light near those marks with nearby out-of-transit readings. Published transit depths are about 0.67%. Finite cadence, noise, and the chosen marks limit the estimate.</p>
            <Formula>{'Rₚ/R★ ≈ √δ'}</Formula>
            <p>In a simple uniform-brightness model, depth δ as a fraction estimates the squared planet-to-star radius ratio. Limb darkening, grazing geometry, and blended starlight can change that relation. The illustration shows a representative passage.</p>
            <div className="archive-links"><a href={KEPLER_SOURCE} target="_blank" rel="noreferrer">Kepler FITS record via Astropy</a><a href={PLANET_SOURCE} target="_blank" rel="noreferrer">NASA Exoplanet Archive</a></div>
          </details>
        </>}
        <button className={`btn ${verified ? '' : 'primary'}`} onClick={edit}>{verified ? 'Replay the observation' : 'Adjust your marks'}</button>
      </section>}
    </dialog>, document.body);
}
