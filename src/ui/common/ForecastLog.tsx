import { DAY } from '../../engine/constants';
import { predictionGuidance } from '../../game/modes';
import { PREDICTION_KINDS, type Prediction, type PredictionKind } from '../../game/predictions';
import { useGame } from '../../game/store';

const EVIDENCE = {
  star: {
    id: 'year-observations', label: 'star observations',
    check: 'Compare the spacing of the dates you used with how far ahead you forecast.',
    detail: 'A short drift record can turn a small centring offset into a large forecast error. A curved track or a narrow range could also explain the miss. Try a sighting at a separated date and compare it with the trend.',
  },
  retro: {
    id: 'tracker-observations', label: 'planet tracker chart',
    check: 'Look for gaps near the turn and compare your opposition marker with the recorded track.',
    detail: 'A gap can make a turn look earlier or later. If you mirrored the start around opposition, that symmetry is only an approximation. Look for sightings on both sides of a change in direction.',
  },
  moon: {
    id: 'moon-observations', label: 'Moon observations',
    check: 'Check whether the sightings cover more than one eastern crest and whether any crests fall in a gap.',
    detail: 'If you miss a crest, two visible crests may be more than one cycle apart. The apparent rhythm can also shift with the viewing direction. Compare more than one interval of sightings.',
  },
  pendulum: {
    id: 'swing-observations', label: 'swing readings',
    check: 'Check the measured string length and swing count in your kept readings.',
    detail: 'A difference in length, start and stop timing, release angle or wind can shift the measured period. Repeat the swing under similar conditions to see how much the readings vary.',
  },
} satisfies Record<PredictionKind, { id: string; label: string; check: string; detail: string }>;

function goToEvidence(id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: 'start' });
}

function StarDates({ prediction }: { prediction: Prediction }) {
  const observations = useGame((s) => s.starObs);
  const dates = observations.filter((reading) => reading.source !== 'echo' && reading.at <= prediction.made).map((reading) => reading.at);
  if (!dates.length || prediction.at === undefined) return null;
  const first = dates.reduce((min, at) => Math.min(min, at));
  const last = dates.reduce((max, at) => Math.max(max, at));
  return <p>
    The pre-forecast sightings still in your log span {((last - first) / DAY).toFixed(1)} days.
    The target was {(prediction.at - last / DAY).toFixed(1)} days after the latest of those sightings.
  </p>;
}

function ForecastFollowUp({ prediction }: { prediction: Prediction }) {
  const { kind } = prediction;
  const settings = useGame((s) => s.settings);
  const { walkthrough, logEstimate } = predictionGuidance(settings);
  if (!walkthrough && !logEstimate) return null;
  const evidence = EVIDENCE[kind];
  return <details className="measurement-help forecast-follow-up">
    <summary>Ask ECHO what to check</summary>
    <p>{evidence.check}</p>
    {kind === 'star' && <StarDates prediction={prediction} />}
    {walkthrough && <p>{evidence.detail}</p>}
    <p>The comparison alone can’t identify the cause.</p>
    <button type="button" className="btn small ghost" onClick={() => goToEvidence(evidence.id)}>Go to {evidence.label}</button>
  </details>;
}

function describeDifference(p: Prediction, difference: number) {
  const { unit, digits } = PREDICTION_KINDS[p.kind];
  const size = Math.abs(difference);
  const amount = size < 10 ** -digits ? `less than ${(10 ** -digits).toFixed(digits)}` : size.toFixed(digits);
  if (!difference) return 'Matches forecast';
  if (unit === 'day') return `${amount} ${size === 1 ? 'day' : 'days'} ${difference > 0 ? 'later' : 'earlier'}`;
  const direction = unit === 's' ? (difference > 0 ? 'longer' : 'shorter') : (difference > 0 ? 'higher' : 'lower');
  return `${amount}${unit === '°' ? '' : ' '}${unit} ${direction}`;
}

function ForecastComparison({ prediction: p }: { prediction: Prediction }) {
  const result = p.result;
  const { unit, digits } = PREDICTION_KINDS[p.kind];
  const value = p.value.toFixed(digits), range = p.sigma.toFixed(digits);
  const forecast = unit === 'day' ? `Elapsed day ${value} ± ${range} days` : `${value} ± ${range} ${unit}`;
  if (!result) return <div className="forecast-comparison stack">
    <div><b>Your forecast</b> · {forecast} on elapsed day {p.at ?? Math.floor(p.due / DAY)}</div>
    <div className="muted">The window passed without a kept sighting. There’s no comparison for this forecast.</div>
  </div>;

  const difference = result.truth - p.value;
  const reading = result.truth.toFixed(digits);
  const reference = unit === 'day' ? `Elapsed day ${reading}` : `${reading} ${unit}`;
  const span = Math.max(p.sigma * 1.3, Math.abs(difference) * 1.12, Number.EPSILON);
  const inside = result.z <= 1;
  return <div className="forecast-comparison stack">
    <dl className="kv">
      <dt>Your forecast</dt><dd>{forecast}</dd>
      <dt>{p.fieldTrial ? 'Kept reading' : 'Scored event'}</dt><dd>{reference}</dd>
      <dt>Difference</dt><dd>{describeDifference(p, difference)}</dd>
    </dl>
    <div className="field-trial-range" aria-hidden="true">
      <span style={{ width: `${100 * p.sigma / span}%` }} />
      <i style={{ left: `${50 + 50 * (difference / span)}%` }} />
    </div>
    <div className={inside ? 'good' : 'amber'}>{inside ? 'Inside' : 'Outside'} your forecast range{!p.fieldTrial && ` · ${result.points > 0 ? '+' : ''}${result.points} pts`}</div>
    {p.fieldTrial
      ? <div className="faint">{result.observedAt !== undefined && `Kept on elapsed day ${(result.observedAt / DAY).toFixed(2)} · `}Unscored field trial</div>
      : <div className="faint">Simulation time used for scoring. Use your chart to check what the instrument captured around the event.</div>}
    {!inside && <ForecastFollowUp prediction={p} />}
  </div>;
}

export function FieldTrialResult({ prediction }: { prediction: Prediction }) {
  return <div className="evidence-signal field-trial-result">
    <span className="evidence-emblem" aria-hidden="true">✧</span>
    <div className="stack">
      <b role="status">{prediction.kind === 'pendulum' ? 'Swing trial recorded' : 'Sky forecast compared'}</b>
      <ForecastComparison prediction={prediction} />
    </div>
  </div>;
}

export function ForecastLog({ kind, exclude }: { kind: PredictionKind; exclude?: string }) {
  const predictions = useGame((s) => s.predictions);
  const tutorial = useGame((s) => s.tutorial.active);
  if (tutorial) return null;
  const entries = predictions.filter((p) => p.kind === kind && p.id !== exclude && (p.result || p.missed));
  if (!entries.length) return null;
  return <details className="measurement-help forecast-log">
    <summary>Forecast log · {entries.length}</summary>
    <div className="stack">
      {entries.reverse().map((p) => <details key={p.id} className="panel-inset forecast-entry">
        <summary>Set on elapsed day {(p.made / DAY).toFixed(2)} · {p.result ? p.result.z <= 1 ? 'Inside range' : 'Outside range' : 'No kept sighting'}</summary>
        <ForecastComparison prediction={p} />
      </details>)}
    </div>
  </details>;
}
