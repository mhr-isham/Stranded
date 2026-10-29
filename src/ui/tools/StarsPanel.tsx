// Chapter 8: where are we? Three nearby stars wobble against the far
// background once a year; the wobble gives their distances, with our own
// orbit as the baseline. Three distances, matched against the Halcyon's
// catalogue, give a navigation fix.

import { useState } from 'react';
import { ARCSEC, DAY, DEG } from '../../engine/constants';
import { deriveAll } from '../../engine/chain';
import { variantOf } from '../../engine/chapters';
import { catalogueOf, fitParallax, LIGHT_YEAR, matchCatalogue, nearStarsOf, parallaxOffset } from '../../engine/nearstars';
import { localFrame, toHorizontal, topocentric } from '../../engine/sky';
import { seeingFactor } from '../../game/challenges';
import { clock } from '../../game/clock';
import { sfx } from '../../game/audio';
import { fmt } from '../../game/format';
import { checkMissions, currentWorld } from '../../game/sim';
import { useGame } from '../../game/store';
import { Chart } from '../common/Chart';
import { Formula, SendToSheet } from '../common/sheetBits';
import { toast, useGameTime } from '../common/widgets';

const KEYS = ['pStarA', 'pStarB', 'pStarC'] as const;

export function StarsPanel() {
  const s = useGame();
  const t = useGameTime(4);
  const { system: sys, catalog } = currentWorld();
  const stars = nearStarsOf(sys);
  const [sel, setSel] = useState(0);
  const st = stars[sel];
  if (!st) return null;
  const f = localFrame(sys, t, sys.site);
  const sunAlt = toHorizontal(topocentric(sys, 'star', t, sys.site), f).alt;
  const alt = toHorizontal(catalog[st.index].dir, f).alt;
  const canLog = sunAlt < -12 * DEG && alt > 15 * DEG;
  const obs = s.starPar.filter((o) => o.i === sel);
  const P1 = s.sheet.P1?.value;
  const fit = P1 ? fitParallax(obs.map((o) => ({ t: o.at, v: o.v })), P1) : null;
  const d = deriveAll(s.sheet, variantOf(sys.features));
  const a1 = d.a1;

  const log = () => {
    // A careful reading at high power: about 0.01″, worse on rough nights.
    const noise = (Math.random() + Math.random() + Math.random() - 1.5) * 0.02 * ARCSEC * seeingFactor(s, clock.t);
    const v = Math.round((parallaxOffset(sys, st, clock.t) + noise) / (0.001 * ARCSEC)) * 0.001 * ARCSEC;
    s.set({ starPar: [...s.starPar, { i: sel, at: clock.t, v }] });
    toast(`${st.name}: ${fmt(v / ARCSEC, 3)}″ logged`);
    sfx('shutter');
  };

  // Distances from the sheet's parallaxes and our orbit radius.
  const ly = KEYS.map((k) => (s.sheet[k] && a1 ? a1.value / Math.tan(s.sheet[k]!.value) / LIGHT_YEAR : null));
  const sg = KEYS.map((k, i) =>
    s.sheet[k] && a1 && ly[i] !== null ? ly[i]! * Math.hypot(s.sheet[k]!.sigma / s.sheet[k]!.value, a1.sigma / a1.value) : null,
  );
  const cat = catalogueOf(sys);
  const match = matchCatalogue(cat, ly, sg);
  const oks = match.filter((m) => m.ok);

  return (
    <div className="stack">
      <div className="panel panel-pad stack">
        <b>Where are we?</b>
        <div className="muted" style={{ fontSize: 13 }}>
          Mira’s star map names three nearby stars. Seen from a moving planet, a near star wobbles to and fro against the far background once a year.
          Log each one every few weeks for most of a year, and fit the wobble with your year P₁.
        </div>
        <div className="row" style={{ gap: 6 }}>
          {stars.map((x, i) => (
            <button key={x.name} className={`btn small ${sel === i ? 'primary' : ''}`} onClick={() => setSel(i)} style={{ flex: 1 }}>
              {x.name} {s.sheet[KEYS[i]] ? '✓' : ''}
            </button>
          ))}
        </div>
        <button className="btn primary" disabled={!canLog} onClick={log}>
          Log {st.name}’s position
        </button>
        {!canLog && (
          <div className="amber" style={{ fontSize: 13 }}>
            {sunAlt >= -12 * DEG ? 'Wait for a dark sky.' : `${st.name} is ${alt < 0 ? 'below the horizon' : 'too low'} right now. Try later tonight — or, if it sits near the star this season, in a few months.`}
          </div>
        )}
        {obs.length > 0 && (
          <Chart
            series={[
              { pts: obs.map((o) => ({ x: o.at / DAY, y: o.v / ARCSEC })), color: '#ffe6b8', kind: 'dots' },
              ...(fit && obs.length
                ? [
                    {
                      pts: Array.from({ length: 200 }, (_, i) => {
                        const x = obs[0].at + ((obs[obs.length - 1].at - obs[0].at) * i) / 199;
                        return { x: x / DAY, y: fit.model(x) / ARCSEC };
                      }),
                      color: '#6cc4ff',
                      kind: 'line' as const,
                    },
                  ]
                : []),
            ]}
            xLabel="day"
            yLabel="offset (″)"
            yFmt={(y) => y.toFixed(2)}
          />
        )}
        {!P1 && obs.length > 0 && <div className="hint">Put your year P₁ on the sheet: the wobble repeats once per year.</div>}
        {fit && obs.length >= 6 && (
          <>
            <dl className="kv">
              <dt>Parallax p</dt>
              <dd className="blue">
                {fmt(fit.parallax / ARCSEC, 4)}″ ± {fmt(fit.sigma / ARCSEC, 4)}″
              </dd>
              <dt>Its own drift (proper motion)</dt>
              <dd>{fmt((fit.pm / ARCSEC) * 365.25 * DAY, 3)}″ per 365 days</dd>
              {a1 && (
                <>
                  <dt>Distance d = a₁ / tan p</dt>
                  <dd className="blue">{fmt(a1.value / Math.tan(fit.parallax) / LIGHT_YEAR, 2)} light-years</dd>
                </>
              )}
            </dl>
            <Formula>d = a₁ / tan p</Formula>
            <SendToSheet k={KEYS[sel]} value={fit.parallax} spread={fit.sigma} />
          </>
        )}
      </div>

      <div className="panel panel-pad stack">
        <b>Navigation fix</b>
        <div className="muted" style={{ fontSize: 13 }}>
          The Halcyon’s catalogue lists four places these three stars can be seen from, each with its own distances. Only one should match yours — within
          your error bars.
        </div>
        <table className="log">
          <thead>
            <tr>
              <th>Place</th>
              {stars.map((x) => (
                <th key={x.name} className="num">
                  {x.name}
                </th>
              ))}
              <th className="num">fit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="blue">You</td>
              {ly.map((v, i) => (
                <td key={i} className="num blue">
                  {v === null ? '—' : `${fmt(v, 1)}±${fmt(sg[i]!, 1)}`}
                </td>
              ))}
              <td />
            </tr>
            {cat.map((c, ci) => (
              <tr key={c.label}>
                <td>{c.label}</td>
                {c.ly.map((v, i) => (
                  <td key={i} className="num">
                    {fmt(v, 1)}
                  </td>
                ))}
                <td className={`num ${match[ci].ok ? 'green' : 'faint'}`}>{match[ci].n === 3 ? (match[ci].ok ? '✓' : '✗') : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {ly.every((v) => v !== null) && (
          <div style={{ fontSize: 13 }}>
            {oks.length === 1 ? (
              <span className="green">Exactly one place fits: {oks[0].label}.</span>
            ) : oks.length === 0 ? (
              <span className="amber">No place fits. One of your parallaxes, or its error bar, is off.</span>
            ) : (
              <span className="amber">{oks.length} places fit — your error bars are too wide to tell them apart. Log more nights.</span>
            )}
          </div>
        )}
        {oks.length === 1 && s.navFix !== oks[0].label && (
          <button
            className="btn primary"
            onClick={() => {
              s.set({ navFix: oks[0].label });
              sfx('good');
              setTimeout(checkMissions, 0);
            }}
          >
            Confirm the fix: {oks[0].label}
          </button>
        )}
        {s.navFix && <div className="green">Fix confirmed: {s.navFix}.</div>}
      </div>
    </div>
  );
}
