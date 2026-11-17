import { DATED_QUANTITIES, distanceReadings, selectedDistanceReading, observationDay } from '../../game/distanceScale';
import { ObservationDate } from './ObservationDate';
import { Equation } from './Equation';
import { Fragment, useEffect, useRef, useState } from 'react';
import { QUANTITY_INFO, type PrimaryKey } from '../../engine/chain';
import { fromDisplay, sig, toDisplay } from '../../game/format';
import { checkMissions } from '../../game/sim';
import { currentMode, useMode } from '../../game/modes';
import { hasChallenge } from '../../game/challenges';
import { readingStats, useGame } from '../../game/store';
import { toast } from './widgets';
import { isCadetExpedition, noteCadetWarning } from '../../game/cadetGuidance';
import { CadetGoal } from '../CadetGoal';
import { MeasurementNotes } from './MeasurementNotes';
import { conditionUncertainty } from '../../game/measurementEnvironment';

/** Table of logged readings for one quantity, with keep/discard toggles. */
export function ReadingsTable({ k, render }: { k: PrimaryKey; render?: (v: number) => string }) {
  const all = useGame((s) => s.readings);
  const readings = all.filter((r) => r.key === k);
  const toggle = useGame((s) => s.toggleReading);
  const remove = useGame((s) => s.removeReading);
  const info = QUANTITY_INFO[k];
  if (!readings.length) return <div className="muted" style={{ fontSize: 13 }}>No readings yet.</div>;
  return (
    <table className="log">
      <thead>
        <tr>
          <th>#</th>
          <th>Note</th>
          <th style={{ textAlign: 'right' }}>{info.symbol} ({info.unit})</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {readings.map((r, i) => <Fragment key={r.id}>
          <tr className={r.kept ? '' : 'off'}>
            <td>{i + 1}</td>
            <td className="muted" style={{ fontSize: 12 }}>{r.note}{DATED_QUANTITIES.includes(k) && <ObservationDate at={r.at} />}</td>
            <td className="num">{render ? render(r.value) : sig(toDisplay(k, r.value), 5)}</td>
            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <button className="btn small ghost" title={r.kept ? 'Exclude from average' : 'Include in average'} onClick={() => toggle(r.id)}>
                {r.kept ? '☑' : '☐'}
              </button>
              <button className="btn small ghost" title="Delete" onClick={() => remove(r.id)}>
                ✕
              </button>
            </td>
          </tr>
          <tr><td colSpan={4}><MeasurementNotes reading={r} /></td></tr>
        </Fragment>)}
      </tbody>
    </table>
  );
}

/**
 * Put a value on the progress sheet. The player always states the error bar
 * themselves; the spread of their own readings is offered as a guide.
 */
export function SendToSheet({ k, value, at, spread, modelContribution = 0, label = 'Send to progress sheet', tut }: { k: PrimaryKey; value: number | null; at?: number; spread?: number; modelContribution?: number; label?: string; tut?: string }) {
  const info = QUANTITY_INFO[k];
  const current = useGame((s) => s.sheet[k]);
  const setSheet = useGame((s) => s.setSheet);
  const [err, setErr] = useState('');
  const mode = useMode();
  if (value === null || !Number.isFinite(value)) return null;
  const errNum = Number(err);
  const ok = err !== '' && Number.isFinite(errNum) && errNum > 0 && fromDisplay(k, errNum) >= modelContribution;
  return (
    <div className="stack" style={{ marginTop: 6 }} data-tut={tut}>
      <div className="row" style={{ alignItems: 'flex-end' }}>
        <div className="field" style={{ flex: 1.3 }}>
          <label>{info.symbol} value</label>
          <div className="input" style={{ background: 'transparent' }}>
            {sig(toDisplay(k, value), 6)} {info.unit}
          </div>
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label>± your error</label>
          <input className="input" inputMode="decimal" placeholder={info.unit} value={err} onChange={(e) => setErr(e.target.value.replace(/[^0-9.]/g, ''))} />
        </div>
      </div>
      {DATED_QUANTITIES.includes(k) && <ObservationDate at={at} label="Sending observation" />}
      {mode.sanity && spread !== undefined && Number.isFinite(spread) && spread > 0 && (
        <div className="muted" style={{ fontSize: 12 }}>
          Standard error from the scatter of your readings: ±{sig(toDisplay(k, spread), 2)} {info.unit}. Systematic errors are not included — that part is up to you.
        </div>
      )}
      {modelContribution > 0 && <div className="stack">
        <div className="muted" style={{ fontSize: 12 }}>Shared condition-model contribution: ±{sig(toDisplay(k, modelContribution), 4)} {info.unit}. Include at least this much; repeats do not average it away. Allow separately for other shared errors.</div>
        <button className="btn small ghost" onClick={() => setErr(String(Math.ceil(toDisplay(k, Math.hypot(Number.isFinite(spread) ? spread! : 0, modelContribution)) * 1e6) / 1e6))}>Use scatter + model estimate</button>
      </div>}
      <button
        className="btn primary"
        disabled={!ok}
        onClick={() => {
          setSheet(k, { value, sigma: fromDisplay(k, errNum), at });
          toast(`${info.symbol} recorded on the progress sheet`);
          checkMissions();
        }}
      >
        {current ? 'Update' : label}
      </button>
    </div>
  );
}

/** Sheet sender for a quantity measured as a list of kept readings. */
export function SendReadings({ k, tut }: { k: PrimaryKey; tut?: string }) {
  const readings = useGame((s) => s.readings);
  const st = readingStats(readings, k);
  const treatments = new Set(readings.filter((r) => r.key === k && r.kept && r.environment).map((r) => {
    const e = r.environment!;
    if (e.wind) return e.wind.protection === 'none' ? 'exposed' : 'protected';
    if (e.horizon) return e.horizon.correction ? 'corrected' : 'displayed';
    return 'optical';
  }));
  if (!st) return null;
  if (k === 'dPar') return <DatedDistanceSender tut={tut} />;
  return (
    <div data-tut={tut}>
      <div className="row between" style={{ marginTop: 8 }}>
        <span className="muted">Average of {st.n} kept</span>
        <span className="readout small">
          {sig(toDisplay(k, st.mean), 5)} {QUANTITY_INFO[k].unit}
        </span>
      </div>
      {treatments.size > 1 && <div className="muted" style={{ fontSize: 12 }}>These kept readings mix treatments or protection. Check their conditions and compatibility before averaging; use the include/exclude controls to choose the observations supporting your estimate.</div>}
      <SendToSheet k={k} value={st.mean} at={st.at} spread={st.n > 1 ? st.se : undefined} modelContribution={conditionUncertainty(readings.filter((r) => r.key === k))} />
    </div>
  );
}

/** Distances from different dates describe different geometry, not repeat noise. */
function DatedDistanceSender({ tut }: { tut?: string }) {
  const readings = useGame((s) => s.readings), [selected, setSelected] = useState<string | null>(null);
  const kept = distanceReadings(readings);
  const chosen = selectedDistanceReading(readings, selected);
  if (!chosen) return null;
  const at = Number.isFinite(chosen.at) ? chosen.at : undefined;
  return <div className="stack" data-tut={tut}>
    <label className="field">Distance observation<select className="input" aria-label="Distance observation" value={chosen.id} onChange={(e) => setSelected(e.target.value)}>{kept.map((r, i) => <option key={r.id} value={r.id}>#{i + 1} · {observationDay(r.at)} · {sig(toDisplay('dPar', r.value), 5)} million km</option>)}</select></label>
    <div className="faint">Send one dated separation. Different observing dates are not averaged into a fictitious single distance; each remains in the log. State the uncertainty for your selected observation.</div>
    <SendToSheet key={chosen.id} k="dPar" value={chosen.value} at={at} />
  </div>;
}

export function ToolHeader({ title, sub }: { title: string; sub: string }) {
  const go = useGame((s) => s.go);
  return (
    <>
    <div className="panel panel-pad">
      <div className="row between">
        <h2>{title}</h2>
        <button className="btn small" onClick={() => go('hub')}>
          ← Camp
        </button>
      </div>
      <div className="muted" style={{ fontSize: 13 }}>{sub}</div>
    </div>
    <CadetGoal inTool />
    </>
  );
}

export function Formula({ children }: { children: string }) {
  const on = useGame((s) => s.settings.formulas);
  return on ? <div className="formula"><Equation text={children} /></div> : null;
}

/** Compare a new reading with the kept ones; returns a warning when it looks off. */
export function outlierNote(value: number, others: number[], tolerance: number) {
  if (others.length < 1 || !currentMode().sanity || hasChallenge(useGame.getState(), 'noSanity')) return null;
  const sorted = [...others].sort((a, b) => a - b);
  const med = sorted[Math.floor(sorted.length / 2)];
  const off = Math.abs(value / med - 1);
  if (off <= tolerance) return null;
  const observation = `This is ${Math.round(off * 100)}% away from your other readings (median ${sig(med, 4)}).`;
  return isCadetExpedition(useGame.getState())
    ? `${observation} Repeat the measurement and check alignment, timing and conditions before deciding which readings to keep. Agreement alone does not establish accuracy.`
    : `${observation} Something may have gone wrong — consider discarding it.`;
}

export function SanityWarning({ msgs, attempt }: { msgs: (string | null | false | undefined)[]; attempt?: object }) {
  const mode = useMode();
  const list = msgs.filter(Boolean) as string[];
  const lastAttempt = useRef<object | undefined>(undefined);
  const hasWarnings = list.length > 0 && mode.sanity;
  useEffect(() => {
    if (attempt && attempt !== lastAttempt.current && hasWarnings) {
      lastAttempt.current = attempt;
      noteCadetWarning();
    }
  }, [attempt, hasWarnings]);
  if (!list.length || !mode.sanity || hasChallenge(useGame.getState(), 'noSanity')) return null;
  return (
    <div className="callout warn" style={{ margin: 0 }}>
      <b>⚠ Suspicious reading</b>
      {list.map((m) => (
        <div key={m}>{m}</div>
      ))}
    </div>
  );
}
