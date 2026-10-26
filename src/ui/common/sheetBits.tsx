import { useState } from 'react';
import { QUANTITY_INFO, type PrimaryKey } from '../../engine/chain';
import { fromDisplay, sig, toDisplay } from '../../game/format';
import { checkMissions } from '../../game/sim';
import { readingStats, useGame } from '../../game/store';
import { toast } from './widgets';

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
        {readings.map((r, i) => (
          <tr key={r.id} className={r.kept ? '' : 'off'}>
            <td>{i + 1}</td>
            <td className="muted" style={{ fontSize: 12 }}>{r.note}</td>
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
        ))}
      </tbody>
    </table>
  );
}

/**
 * Put a value on the progress sheet. The player always states the error bar
 * themselves; the spread of their own readings is offered as a guide.
 */
export function SendToSheet({ k, value, at, spread, label = 'Send to progress sheet' }: { k: PrimaryKey; value: number | null; at?: number; spread?: number; label?: string }) {
  const info = QUANTITY_INFO[k];
  const current = useGame((s) => s.sheet[k]);
  const setSheet = useGame((s) => s.setSheet);
  const [err, setErr] = useState('');
  if (value === null || !Number.isFinite(value)) return null;
  const errNum = Number(err);
  const ok = err !== '' && errNum > 0;
  return (
    <div className="stack" style={{ marginTop: 6 }}>
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
      {spread !== undefined && Number.isFinite(spread) && spread > 0 && (
        <div className="muted" style={{ fontSize: 12 }}>
          Standard error from the scatter of your readings: ±{sig(toDisplay(k, spread), 2)} {info.unit}. Systematic errors are not included — that part is up to you.
        </div>
      )}
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
export function SendReadings({ k }: { k: PrimaryKey }) {
  const readings = useGame((s) => s.readings);
  const st = readingStats(readings, k);
  if (!st) return null;
  return (
    <div>
      <div className="row between" style={{ marginTop: 8 }}>
        <span className="muted">Average of {st.n} kept</span>
        <span className="readout small">
          {sig(toDisplay(k, st.mean), 5)} {QUANTITY_INFO[k].unit}
        </span>
      </div>
      <SendToSheet k={k} value={st.mean} at={st.at} spread={st.n > 1 ? st.se : undefined} />
    </div>
  );
}

export function ToolHeader({ title, sub }: { title: string; sub: string }) {
  const go = useGame((s) => s.go);
  return (
    <div className="panel panel-pad">
      <div className="row between">
        <h2>{title}</h2>
        <button className="btn small" onClick={() => go('hub')}>
          ← Camp
        </button>
      </div>
      <div className="muted" style={{ fontSize: 13 }}>{sub}</div>
    </div>
  );
}

export function Formula({ children }: { children: string }) {
  const on = useGame((s) => s.settings.formulas);
  return on ? <div className="formula">{children}</div> : null;
}
