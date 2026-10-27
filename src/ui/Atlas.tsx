// The Atlas of every system you've measured, your calibration profile, and
// the naming dialog. Names are private: only you see them.

import { useState } from 'react';
import { QUANTITY_INFO } from '../engine/chain';
import { DEFAULT_NAMES, calibration, nameOf, suggestName, type AtlasCard, type SystemNames } from '../game/atlas';
import { sig, toDisplay } from '../game/format';
import { MODES } from '../game/modes';
import { useGame } from '../game/store';
import { Modal } from './common/widgets';

const OUTCOME: Record<string, { label: string; cls: string }> = {
  success: { label: 'Reached orbit', cls: 'green' },
  flyby: { label: 'Flyby', cls: 'amber' },
  lost: { label: 'Lost in space', cls: 'red' },
  'no-escape': { label: 'Couldn’t escape', cls: 'red' },
  expired: { label: 'Air ran out', cls: 'red' },
};

const VERDICT = {
  honest: { text: 'Honest — your ranges mean what they say.', cls: 'green' },
  overconfident: { text: 'Overconfident — your ranges are too narrow. Widen them.', cls: 'red' },
  underconfident: { text: 'Underconfident — your ranges are wider than they need to be; you’re giving away points.', cls: 'amber' },
  'too few': { text: 'Not enough values yet to judge.', cls: 'faint' },
} as const;

/** How often the truth fell inside your ±1σ, overall and per tool. Honest is about 68%. */
export function CalibrationPanel() {
  const atlas = useGame((s) => s.atlas);
  const c = calibration(atlas);
  const Bar = ({ frac, n }: { frac: number; n: number }) => (
    <div className="calib-bar" title={`${Math.round(frac * 100)}% of ${n}`}>
      <div className="calib-band" />
      <div className="calib-ideal" />
      <div className="calib-mark" style={{ left: `${frac * 100}%` }} />
    </div>
  );
  return (
    <div className="panel panel-pad stack">
      <div className="row between">
        <h2 style={{ fontSize: 20 }}>Your calibration</h2>
        <span className="muted" style={{ fontSize: 12 }}>{c.n} values from {atlas.length} run{atlas.length === 1 ? '' : 's'}</span>
      </div>
      <div className="muted" style={{ fontSize: 13 }}>
        If your ± ranges are honest, the truth lands inside them about <b>68%</b> of the time. Much less means overconfident; nearly always means
        your ranges are too wide.
      </div>
      {c.n === 0 ? (
        <div className="faint" style={{ fontSize: 13 }}>Finish an expedition to start your profile.</div>
      ) : (
        <>
          <div className="row between" style={{ alignItems: 'baseline' }}>
            <span style={{ fontFamily: 'var(--display)', fontSize: 36, fontWeight: 700 }}>{Math.round(c.frac * 100)}%</span>
            <span className={VERDICT[c.verdict].cls} style={{ fontSize: 13, textAlign: 'right', maxWidth: '65%' }}>
              {VERDICT[c.verdict].text}
            </span>
          </div>
          <Bar frac={c.frac} n={c.n} />
          <div className="calib-scale">
            <span>0%</span>
            <span>68% honest</span>
            <span>100%</span>
          </div>
          <div className="stack" style={{ gap: 6, marginTop: 6 }}>
            {c.perTool.map((t) => (
              <div key={t.tool} className="calib-row">
                <span style={{ fontSize: 13 }}>{t.tool}</span>
                <Bar frac={t.frac} n={t.n} />
                <span className={`mono ${VERDICT[t.verdict].cls}`} style={{ fontSize: 12, textAlign: 'right' }}>
                  {t.verdict === 'too few' ? `${t.n}` : `${Math.round(t.frac * 100)}%`}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** Every run you finished, success or not. */
export function AtlasGrid() {
  const atlas = useGame((s) => s.atlas);
  const [open, setOpen] = useState<AtlasCard | null>(null);
  return (
    <>
      {atlas.length === 0 ? (
        <div className="faint" style={{ fontSize: 13 }}>Every expedition you finish — even one that fails — adds a card here.</div>
      ) : (
        <div className="atlas-grid">
          {[...atlas].reverse().map((c) => (
            <button key={c.id} className="panel panel-pad atlas-card" onClick={() => setOpen(c)}>
              <div className="row between">
                <b>{c.names.star ? `${nameOf(c.names, 'star')} system` : `System #${c.seed}`}</b>
                <span className="grade">{c.grade}</span>
              </div>
              <div className={`${OUTCOME[c.outcome]?.cls ?? ''}`} style={{ fontSize: 13 }}>
                {OUTCOME[c.outcome]?.label ?? c.outcome}
              </div>
              <div className="faint" style={{ fontSize: 12 }}>
                {MODES[c.mode]?.name ?? c.mode}
                {c.survival ? ' · survival' : ''} · {new Date(c.date).toLocaleDateString()} · {c.score} pts
              </div>
              <div className="faint" style={{ fontSize: 12 }}>
                {c.rows.filter((r) => r.z <= 1).length}/{c.rows.length} values honest
                {c.predictions.made ? ` · predictions ${c.predictions.inside}/${c.predictions.made}` : ''}
              </div>
            </button>
          ))}
        </div>
      )}
      {open && (
        <Modal onClose={() => setOpen(null)}>
          <h2>{open.names.star ? `${nameOf(open.names, 'star')} system` : `System #${open.seed}`}</h2>
          <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
            {nameOf(open.names, 'home')} → {nameOf(open.names, 'target')} · seed {open.seed} · {MODES[open.mode]?.name}
            {open.camp ? ` · camp: ${open.camp.site}` : ''}
          </div>
          <div className="scroll" style={{ maxHeight: 360 }}>
            <table className="log">
              <thead>
                <tr>
                  <th>Quantity</th>
                  <th style={{ textAlign: 'right' }}>You</th>
                  <th style={{ textAlign: 'right' }}>Truth</th>
                  <th style={{ textAlign: 'right' }}>Off by</th>
                </tr>
              </thead>
              <tbody>
                {open.rows.map((r) => (
                  <tr key={r.k}>
                    <td>{QUANTITY_INFO[r.k].symbol}</td>
                    <td className="num">
                      {sig(toDisplay(r.k, r.value), 4)} ± {sig(toDisplay(r.k, r.sigma), 2)}
                    </td>
                    <td className="num">{sig(toDisplay(r.k, r.truth), 4)}</td>
                    <td className={`num ${r.z <= 1 ? 'green' : r.z < 2 ? 'amber' : 'red'}`}>{r.z.toFixed(1)}σ</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
            <button className="btn primary" onClick={() => setOpen(null)}>
              Close
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Name the star, the planets and the moon. Private to this device. */
export function NamesDialog({ onClose }: { onClose: () => void }) {
  const names = useGame((s) => s.names);
  const [draft, setDraft] = useState<SystemNames>({ ...names });
  const FIELDS: { k: keyof SystemNames; label: string }[] = [
    { k: 'star', label: 'The star' },
    { k: 'home', label: 'Your planet (where you landed)' },
    { k: 'target', label: 'The blue planet' },
    { k: 'moon', label: 'Its moon' },
  ];
  return (
    <Modal onClose={onClose}>
      <h2>Name this system</h2>
      <div className="muted" style={{ fontSize: 13, marginBottom: 8 }}>
        Nobody has named these worlds. Your names are used in your Atlas and debrief, and only you see them.
      </div>
      {FIELDS.map((f) => (
        <div key={f.k} className="field" style={{ marginBottom: 8 }}>
          <label>{f.label}</label>
          <div className="row" style={{ gap: 6 }}>
            <input
              className="input"
              maxLength={24}
              placeholder={DEFAULT_NAMES[f.k]}
              value={draft[f.k] ?? ''}
              onChange={(e) => setDraft({ ...draft, [f.k]: e.target.value })}
              style={{ flex: 1 }}
            />
            <button className="btn small" title="Suggest a name" onClick={() => setDraft({ ...draft, [f.k]: suggestName() })}>
              🎲
            </button>
          </div>
        </div>
      ))}
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 8 }}>
        <button className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          onClick={() => {
            const clean: SystemNames = {};
            for (const f of FIELDS) if (draft[f.k]?.trim()) clean[f.k] = draft[f.k]!.trim();
            useGame.setState({ names: clean });
            onClose();
          }}
        >
          Save names
        </button>
      </div>
    </Modal>
  );
}
