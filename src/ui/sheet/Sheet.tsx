import { useState } from 'react';
import { DERIVED, EDGES, PRIMARY_KEYS, QUANTITY_INFO, deriveAll, truthValues, type PrimaryKey, type QuantityKey } from '../../engine/chain';
import { scoreQuantity } from '../../engine/scoring';
import { sfx } from '../../game/audio';
import { fmt, fromDisplay, sig, toDisplay } from '../../game/format';
import { checkMissions, currentWorld } from '../../game/sim';
import { readingStats, useGame, type Screen } from '../../game/store';
import { HINTS, NODE_INFO } from './nodeInfo';
import { flag } from '../../game/tutorial';
import { countText, useMode } from '../../game/modes';

// Constellation layout: columns follow the solve chain from measurements to the launch.
const POS: Record<QuantityKey | 'launch', [number, number]> = {
  g: [0, 0.5],
  R1: [0, 1.5],
  P1: [0, 2.7],
  S2: [0, 3.7],
  tOpp: [0, 4.7],
  dPar: [0, 5.8],
  alpha2: [0, 6.9],
  thetaM: [0, 7.9],
  Pm: [0, 8.9],
  M1: [1.3, 1],
  P2: [1.1, 3.2],
  ratio: [2.1, 3.6],
  a1: [2.6, 5.2],
  a2: [3.4, 4.3],
  Mstar: [3.6, 2.6],
  R2: [2.4, 6.9],
  aM: [2.2, 8.2],
  M2: [3.4, 8.2],
  launch: [4.6, 5],
};
const LAUNCH_INPUTS: QuantityKey[] = ['M1', 'Mstar', 'a1', 'a2', 'tOpp', 'M2', 'R2'];

export function Sheet() {
  const s = useGame();
  const { system: sys } = currentWorld();
  const [sel, setSel] = useState<QuantityKey | 'launch'>('g');
  const derived = deriveAll(s.sheet);
  const est = (k: QuantityKey) => (PRIMARY_KEYS as readonly string[]).includes(k) ? s.sheet[k as PrimaryKey] : derived[k as keyof typeof derived];
  const relErr = (k: QuantityKey) => {
    const e = est(k);
    if (!e) return null;
    if (k === 'tOpp') return e.sigma / sys.synodic;
    return Math.abs(e.sigma / e.value);
  };
  // Wide screens get the chain laid out left-to-right instead of top-to-bottom.
  const wide = window.innerWidth > 860 && window.innerWidth > window.innerHeight;
  const pos = (k: QuantityKey | 'launch'): [number, number] => (wide ? [POS[k][1], POS[k][0] * 1.25] : POS[k]);
  const vb = wide ? '-0.6 -0.6 10.2 6.6' : '-0.6 -0.4 5.8 10';
  const allLaunch = LAUNCH_INPUTS.every((k) => est(k));

  return (
    <div className="tool">
      <div className="tool-stage" style={{ background: 'radial-gradient(ellipse at 40% 40%, #0c1630 0%, #05070f 70%)' }}>
        <svg data-tut="sheet-map" viewBox={vb} preserveAspectRatio="xMidYMid meet" style={{ position: 'absolute', inset: 'calc(64px + var(--safe-top)) 8px 80px 8px', width: 'calc(100% - 16px)', height: 'calc(100% - 150px)' }}>
          <defs>
            <filter id="glow" x="-1" y="-1" width="3" height="3">
              <feGaussianBlur stdDeviation="0.08" />
            </filter>
            <radialGradient id="star" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#ffffff" />
              <stop offset="40%" stopColor="#9fd6ff" />
              <stop offset="100%" stopColor="#2a7fd4" stopOpacity="0" />
            </radialGradient>
          </defs>
          {/* Constellation lines */}
          {(Object.keys(EDGES) as (keyof typeof EDGES)[]).flatMap((k) =>
            EDGES[k].map((src) => {
              const lit = !!est(k) && !!est(src);
              return <line key={`${src}-${k}`} x1={pos(src)[0]} y1={pos(src)[1]} x2={pos(k)[0]} y2={pos(k)[1]} stroke={lit ? 'rgba(140,200,255,0.55)' : 'rgba(140,160,200,0.13)'} strokeWidth={lit ? 0.025 : 0.015} strokeDasharray={lit ? undefined : '0.06 0.06'} />;
            }),
          )}
          {LAUNCH_INPUTS.map((k) => (
            <line key={`L-${k}`} x1={pos(k)[0]} y1={pos(k)[1]} x2={pos('launch')[0]} y2={pos('launch')[1]} stroke={est(k) ? 'rgba(255,196,107,0.45)' : 'rgba(255,196,107,0.1)'} strokeWidth={0.018} strokeDasharray={est(k) ? undefined : '0.06 0.06'} />
          ))}
          {/* Stars */}
          {(Object.keys(POS) as (QuantityKey | 'launch')[]).map((k) => {
            const [x, y] = pos(k);
            const isLaunch = k === 'launch';
            const e = isLaunch ? null : relErr(k);
            const lit = isLaunch ? allLaunch : e !== null;
            // A sharper star means a smaller error bar.
            const fuzz = e === null ? 0.12 : Math.max(0.1, Math.min(0.42, 0.1 + 0.08 * (Math.log10(Math.max(e, 1e-5)) + 4)));
            const selected = sel === k;
            return (
              <g key={k} data-tut={`sheet-node-${k}`} onClick={() => (setSel(k), sfx('click'), flag(`sheet-node-${k}`))} style={{ cursor: 'pointer' }}>
                <circle cx={x} cy={y} r={0.42} fill="transparent" />
                {lit && <circle cx={x} cy={y} r={fuzz * 1.6} fill={isLaunch ? 'rgba(255,196,107,0.5)' : 'url(#star)'} filter="url(#glow)" opacity={0.9} />}
                <circle cx={x} cy={y} r={lit ? 0.07 : 0.05} fill={lit ? (isLaunch ? '#ffc46b' : '#fff') : 'rgba(150,165,200,0.35)'} />
                {selected && <circle cx={x} cy={y} r={0.2} fill="none" stroke="#ffc46b" strokeWidth={0.02} />}
                <text x={x} y={y + 0.36} textAnchor="middle" fontSize={0.2} fill={lit ? '#e8eefc' : 'rgba(150,165,200,0.6)'} fontFamily="Space Grotesk" fontWeight={600}>
                  {isLaunch ? 'LAUNCH' : QUANTITY_INFO[k].symbol}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
      <div className="tool-side">
        <div className="panel panel-pad hide-phone">
          <h2 style={{ fontSize: 16 }}>Progress sheet</h2>
          <div className="muted" style={{ fontSize: 12 }}>
            Every star is a quantity. Measured ones light up; sharper stars have smaller error bars. Lines show what depends on what. Tap a star.
          </div>
        </div>
        {sel === 'launch' ? (
          <div className="panel panel-pad stack">
            <h2>Launch plan</h2>
            <div className="muted" style={{ fontSize: 13 }}>Needs: {LAUNCH_INPUTS.map((k) => QUANTITY_INFO[k].symbol).join(', ')}</div>
            {LAUNCH_INPUTS.map((k) => (
              <div key={k} className="row between" style={{ fontSize: 13 }}>
                <span>{QUANTITY_INFO[k].label}</span>
                <span className={est(k) ? 'green' : 'faint'}>{est(k) ? '✓' : 'missing'}</span>
              </div>
            ))}
            <button className="btn primary" disabled={!allLaunch} onClick={() => s.go('launch')}>
              Open launch planner
            </button>
          </div>
        ) : (
          <NodePanel k={sel} derivedEst={derived} />
        )}
        <Checks />
      </div>
    </div>
  );
}

function NodePanel({ k, derivedEst }: { k: QuantityKey; derivedEst: ReturnType<typeof deriveAll> }) {
  const s = useGame();
  const { system: sys } = currentWorld();
  const info = QUANTITY_INFO[k];
  const node = NODE_INFO[k];
  const isPrimary = (PRIMARY_KEYS as readonly string[]).includes(k);
  const e = isPrimary ? s.sheet[k as PrimaryKey] : derivedEst[k as keyof typeof derivedEst];
  const [hintLevel, setHintLevel] = useState(0);
  const [verdict, setVerdict] = useState<string | null>(null);
  const mode = useMode();
  const maxHints = Math.min(HINTS[k].length, mode.hints);
  const verifiesLeft = mode.verifies - s.checksUsed;
  const stats = isPrimary ? readingStats(s.readings, k as PrimaryKey) : null;

  const edit = (field: 'value' | 'sigma', text: string) => {
    const v = Number(text);
    if (!Number.isFinite(v)) return;
    const cur = s.sheet[k as PrimaryKey] ?? { value: NaN, sigma: NaN };
    const next = { ...cur, [field]: fromDisplay(k, v) };
    if (Number.isFinite(next.value) && next.sigma > 0) s.setSheet(k as PrimaryKey, next);
    else s.setSheet(k as PrimaryKey, { ...next, sigma: next.sigma > 0 ? next.sigma : Math.abs(next.value) * 0.01 });
    checkMissions();
  };

  const check = () => {
    if (!e || verifiesLeft <= 0) return;
    const truth = truthValues(sys, s.sheet)[k];
    const sc = scoreQuantity(e.value, e.sigma, truth);
    s.set({ penaltyDv: s.penaltyDv + 40, checksUsed: s.checksUsed + 1 });
    setVerdict(sc.inside ? 'ECHO cross-checked with the ship’s damaged sensors: the true value lies INSIDE your error bar.' : sc.z < 2 ? 'Close, but the true value lies just OUTSIDE your error bar.' : 'The true value lies well OUTSIDE your error bar.');
    sfx(sc.inside ? 'good' : 'bad');
  };

  return (
    <div className="panel panel-pad stack" data-tut="sheet-panel">
      <div className="row between">
        <h2>
          {info.symbol} <span className="muted" style={{ fontSize: 14, fontWeight: 500 }}>{info.label}</span>
        </h2>
      </div>
      <div className="muted" style={{ fontSize: 13 }}>{node.what}</div>
      {s.settings.formulas && node.formula && <div className="formula">{node.formula}</div>}

      {isPrimary ? (
        <>
          <div className="row" style={{ alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 1.3 }}>
              <label>Value ({info.unit})</label>
              <input key={`v-${k}-${e?.value}`} className="input" inputMode="decimal" defaultValue={e ? sig(toDisplay(k, e.value), 7) : ''} onBlur={(ev) => edit('value', ev.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>± error</label>
              <input key={`s-${k}-${e?.sigma}`} className="input" inputMode="decimal" defaultValue={e ? sig(toDisplay(k, e.sigma), 3) : ''} onBlur={(ev) => edit('sigma', ev.target.value)} />
            </div>
          </div>
          {stats && (
            <div className="muted" style={{ fontSize: 12 }}>
              Log: {stats.n} kept reading{stats.n > 1 ? 's' : ''}, mean {sig(toDisplay(k, stats.mean), 5)}
              {stats.n > 1 ? `, standard error ±${sig(toDisplay(k, stats.se), 2)}` : ''} {info.unit}
            </div>
          )}
          {node.tool && (
            <button className="btn small" onClick={() => s.go(node.tool as Screen)}>
              Go to {node.toolName}
            </button>
          )}
        </>
      ) : (
        <>
          <div className="readout small">{e ? `${sig(toDisplay(k, e.value), 5)} ± ${sig(toDisplay(k, e.sigma), 2)} ${info.unit}` : 'not yet computable'}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Computed by ECHO from: {DERIVED[k as keyof typeof DERIVED].inputs.map((i) => QUANTITY_INFO[i].symbol).join(', ')}. Errors propagate
            automatically.
          </div>
          {e && <div className="muted" style={{ fontSize: 12 }}>Relative error: {fmt((100 * e.sigma) / Math.abs(e.value), 2)}%</div>}
        </>
      )}

      <hr className="sep" />
      <div data-tut="sheet-hints" className="stack">
      {maxHints > 0 ? (
        <>
          <div className="row between">
            <b style={{ fontSize: 13 }}>Hints</b>
            <span className="faint" style={{ fontSize: 12 }}>{mode.hintsCost ? 'each costs score' : 'free in this mode'}</span>
          </div>
          {HINTS[k].slice(0, hintLevel).map((h, i) => (
            <div key={i} className="hint">{h}</div>
          ))}
          {hintLevel < maxHints && (
            <button
              className="btn small"
              onClick={() => {
                setHintLevel(hintLevel + 1);
                if (mode.hintsCost) s.set({ hintsUsed: s.hintsUsed + 1 });
              }}
            >
              {['Nudge me', 'How is it measured?', 'Show me the first step'][hintLevel]}
            </button>
          )}
        </>
      ) : (
        <div className="faint" style={{ fontSize: 12 }}>No hints in {mode.name} mode. The lessons in the Codex are always open.</div>
      )}
      {e && mode.verifies > 0 && (
        <>
          <hr className="sep" />
          <button className="btn small amber" onClick={check} disabled={verifiesLeft <= 0}>
            Ask ECHO to verify (costs 40 m/s of fuel · {countText(verifiesLeft)} left)
          </button>
          {verdict && <div className="hint">{verdict}</div>}
        </>
      )}
      </div>
    </div>
  );
}

/** Free consistency checks: they never reveal the truth, only whether your numbers hang together. */
function Checks() {
  const s = useGame();
  const d = deriveAll(s.sheet);
  const rows: { name: string; text: string; ok: boolean | null }[] = [];
  if (d.M1 && s.sheet.R1) {
    const rho = d.M1.value / ((4 / 3) * Math.PI * s.sheet.R1.value ** 3) / 1000;
    rows.push({ name: 'Home planet density', text: `${fmt(rho, 2)} g/cm³ (rocky worlds: 3–8)`, ok: rho > 3 && rho < 8 });
  }
  if (d.M2 && d.R2) {
    const rho = d.M2.value / ((4 / 3) * Math.PI * d.R2.value ** 3) / 1000;
    rows.push({ name: 'Blue planet density', text: `${fmt(rho, 2)} g/cm³ (rocky worlds: 3–8)`, ok: rho > 3 && rho < 8 });
  }
  if (d.Mstar) {
    const m = d.Mstar.value / 1.989e30;
    rows.push({ name: 'Star mass', text: `${fmt(m, 2)} solar masses (stars like this: 0.5–1.5)`, ok: m > 0.5 && m < 1.5 });
  }
  const g = s.sheet.g?.value;
  if (g) rows.push({ name: 'Escape speed estimate', text: s.sheet.R1 ? `${fmt(Math.sqrt(2 * g * s.sheet.R1.value) / 1000, 2)} km/s` : 'needs R₁', ok: null });
  if (!rows.length) return null;
  return (
    <div className="panel panel-pad stack" data-tut="sheet-checks">
      <b>Consistency checks</b>
      <div className="faint" style={{ fontSize: 12 }}>Free. They never reveal the truth — only whether your numbers hang together.</div>
      {rows.map((r) => (
        <div key={r.name} className="row between" style={{ fontSize: 13 }}>
          <span>{r.name}</span>
          <span className={r.ok === null ? 'mono' : r.ok ? 'mono green' : 'mono red'}>{r.text}</span>
        </div>
      ))}
    </div>
  );
}
