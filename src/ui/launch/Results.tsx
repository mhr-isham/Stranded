import { useEffect, useMemo, useState } from 'react';
import { DERIVED_KEYS, PRIMARY_KEYS, QUANTITY_INFO, deriveAll, truthValues, type Primaries, type QuantityKey } from '../../engine/chain';
import { DAY } from '../../engine/constants';
import { simulateLaunch } from '../../engine/launch';
import { modelFromPrimaries, planTransfer } from '../../engine/planner';
import { gradeRun, scoreQuantity } from '../../engine/scoring';
import { sfx } from '../../game/audio';
import { fmt, sig, toDisplay } from '../../game/format';
import { currentWorld } from '../../game/sim';
import { useGame } from '../../game/store';
import { lifeSupportEnd } from '../../game/survival';
import { evaluateAchievements, ACHIEVEMENTS } from '../../game/achievements';
import { toast } from '../common/widgets';
import { hasPrelaunch, rewindToLaunch } from '../../game/checkpoints';
import { countText, modeOf } from '../../game/modes';

const OUTCOME_TEXT: Record<string, { title: string; text: string; cls: string; echo: string }> = {
  success: {
    title: 'Safe in orbit',
    text: 'You reached the blue planet with your own numbers.',
    cls: 'green',
    echo: 'Orbit confirmed. The beacon is directly below us. Whoever set it up, they were waiting a long time for someone to measure their way here.',
  },
  flyby: {
    title: 'Flyby',
    text: 'You reached the blue planet but could not brake into orbit.',
    cls: 'amber',
    echo: 'We passed close enough to see the clouds. Then we kept going.',
  },
  lost: {
    title: 'Lost in space',
    text: 'Course corrections ate the fuel before arrival.',
    cls: 'red',
    echo: 'Tanks dry. The blue planet is ahead of us and getting no closer. I’ll keep the beacon logged. Someone always finds the beacon.',
  },
  'no-escape': {
    title: 'Could not escape',
    text: 'The burn was not enough to leave the planet.',
    cls: 'red',
    echo: 'We climbed, and the planet pulled harder than our numbers said it would. We’re coming back down.',
  },
  expired: {
    title: 'Life support exhausted',
    text: 'The air ran out before launch.',
    cls: 'red',
    echo: 'Moving everyone to deep cryo on the last of the power. Someone will find the beacon. Someone always finds the beacon.',
  },
};

function EchoQuote({ text }: { text: string }) {
  return (
    <div className="muted" style={{ fontStyle: 'italic', fontSize: 14, margin: '10px auto 0', maxWidth: 560 }}>
      <span className="mono blue" style={{ fontStyle: 'normal', fontSize: 11, letterSpacing: '0.14em', marginRight: 6 }}>
        ECHO
      </span>
      “{text}”
    </div>
  );
}

/**
 * After a failed flight, modes with rewinds offer one before the debrief: the
 * debrief shows the true values, so seeing it ends the chance to rewind.
 */
export function Results() {
  const s = useGame();
  const mode = modeOf(s.settings.difficulty);
  const kind = s.outcome?.result.outcome ?? 'expired';
  const canRewind = !s.tutorial.active && kind !== 'success' && kind !== 'expired' && !s.debriefSeen && s.rewindsUsed < mode.rewinds && hasPrelaunch();
  if (!canRewind) return <Debrief />;
  const info = OUTCOME_TEXT[kind];
  const left = mode.rewinds - s.rewindsUsed;
  return (
    <div className="screen scroll" style={{ background: 'radial-gradient(ellipse at 50% 0%, #10204a 0%, #05070f 65%)' }}>
      <div style={{ maxWidth: 560, margin: '0 auto', padding: 'calc(48px + var(--safe-top)) 14px 40px' }} className="stack">
        <div className="panel panel-pad stack" style={{ textAlign: 'center' }}>
          <div className="meter-label">Flight failed · system #{s.seed}</div>
          <h1 className={info.cls} style={{ fontSize: 'clamp(28px, 6vw, 42px)', margin: '4px 0' }}>
            {info.title}
          </h1>
          <div className="muted">{info.text}</div>
          <EchoQuote text={info.echo} />
          <p style={{ margin: '8px 0 0', fontSize: 14 }}>
            ECHO kept the ship’s state from just before launch. You can go back to the launch planner, re-check your numbers and take more
            measurements — the clock goes back too.
          </p>
          <button className="btn primary big" onClick={() => rewindToLaunch()}>
            ⟲ Rewind to the launch planner
          </button>
          <div className="faint" style={{ fontSize: 12 }}>
            {countText(left)} rewind{left === 1 ? '' : 's'} left in {mode.name}
            {mode.rewindPenalty ? ` · costs ${mode.rewindPenalty} points` : ' · no score cost'}
          </div>
          <hr className="sep" />
          <button className="btn" onClick={() => useGame.setState({ debriefSeen: true })}>
            See the full debrief
          </button>
          <div className="faint" style={{ fontSize: 12 }}>The debrief shows the true values, so it ends this run — no rewinds after it.</div>
        </div>
      </div>
    </div>
  );
}

function Debrief() {
  const s = useGame();
  const mode = modeOf(s.settings.difficulty);
  const { system: sys } = currentWorld();
  const outcome = s.outcome;
  const kind = outcome?.result.outcome ?? 'expired';
  const info = OUTCOME_TEXT[kind];
  const sheet: Primaries = outcome?.sheet ?? s.sheet;
  const truth = truthValues(sys, sheet);
  const derived = deriveAll(sheet);
  const rows = ([...PRIMARY_KEYS, ...DERIVED_KEYS] as QuantityKey[]).map((k) => {
    const e = (sheet as Record<string, { value: number; sigma: number } | undefined>)[k] ?? (derived as Record<string, { value: number; sigma: number } | undefined>)[k];
    return { k, e, sc: e ? scoreQuantity(e.value, e.sigma, truth[k]) : null };
  });
  const measurementPoints = rows.reduce((a, r) => a + (r.sc?.points ?? 0), 0);
  const fuelLeftFraction = outcome ? outcome.result.fuelLeft / sys.fuelDv : 0;
  const end = lifeSupportEnd(s, sys);
  const daysLeftFraction = outcome ? (end - outcome.plan.departTime) / end : 0;
  const grade = gradeRun({ measurementPoints, fuelLeftFraction, daysLeftFraction, hintsUsed: s.hintsUsed, success: kind === 'success', penalty: s.rewindsUsed * mode.rewindPenalty });
  const [copied, setCopied] = useState(false);

  // Error budget: how much correction fuel each measurement cost, found by
  // replacing it with the truth and flying the same departure again.
  const budget = useMemo(() => {
    if (!outcome) return [];
    const base = outcome.result.correctionCost;
    const out: { k: QuantityKey; saved: number }[] = [];
    for (const k of PRIMARY_KEYS) {
      if (!sheet[k]) continue;
      const alt = { ...sheet, [k]: { ...sheet[k]!, value: truth[k] } };
      const m = modelFromPrimaries(alt);
      if (!m) continue;
      const p = planTransfer(m, outcome.plan.departTime, outcome.plan.tof);
      if (!p) continue;
      const r = simulateLaunch(sys, p.plan);
      out.push({ k, saved: base - r.correctionCost });
    }
    return out.sort((a, b) => b.saved - a.saved);
  }, [outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  const earned = useMemo(() => evaluateAchievements(s, sys, kind, rows), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!s.debriefSeen) useGame.setState({ debriefSeen: true });
    earned.forEach((a) => useGame.getState().unlock('achievements', a));
    sfx(kind === 'success' ? 'unlock' : 'bad');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const share = () => {
    const emoji = rows
      .filter((r) => r.sc)
      .map((r) => (r.sc!.inside ? (r.sc!.relSigma < 0.01 ? '🟦' : '🟩') : r.sc!.z < 2 ? '🟨' : '🟥'))
      .join('');
    const text = `STRANDED · system #${s.seed} (${mode.name}${s.settings.survival ? ', survival' : ''}${s.rewindsUsed ? `, ${s.rewindsUsed} rewind` : ''})\n${info.title} · grade ${grade.letter} · ${grade.total} pts\n${emoji}\nfuel left ${fmt(Math.max(0, fuelLeftFraction) * 100, 1)}% · launched day ${outcome ? fmt(outcome.plan.departTime / DAY, 0) : '—'}`;
    void navigator.clipboard?.writeText(text).then(() => setCopied(true));
    toast('Result copied — share it!');
  };

  return (
    <div className="screen scroll" style={{ background: 'radial-gradient(ellipse at 50% 0%, #10204a 0%, #05070f 65%)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'calc(24px + var(--safe-top)) 14px 40px' }} className="stack">
        <div className="panel panel-pad" style={{ textAlign: 'center' }} data-tut="results-grade">
          <div className="meter-label">Mission debrief · system #{s.seed}</div>
          <h1 className={info.cls} style={{ fontSize: 'clamp(30px, 6vw, 48px)', margin: '6px 0' }}>
            {info.title}
          </h1>
          <div className="muted">{info.text}</div>
          {!s.tutorial.active && <EchoQuote text={info.echo} />}
          <div className="row" style={{ justifyContent: 'center', gap: 28, marginTop: 14 }}>
            <div>
              <div style={{ fontFamily: 'var(--display)', fontSize: 64, fontWeight: 700, lineHeight: 1 }} className={grade.letter === 'F' ? 'red' : 'blue'}>
                {grade.letter}
              </div>
              <div className="faint">grade</div>
            </div>
            <dl className="kv" style={{ minWidth: 220 }}>
              <dt>Score</dt>
              <dd>{grade.total}</dd>
              <dt>Measurement points</dt>
              <dd>{measurementPoints}</dd>
              <dt>Fuel left</dt>
              <dd>{outcome ? `${fmt(outcome.result.fuelLeft / 1000, 3)} km/s` : '—'}</dd>
              <dt>Course corrections</dt>
              <dd>{outcome ? `${fmt(outcome.result.correctionCost, 0)} m/s` : '—'}</dd>
              <dt>Hints used</dt>
              <dd>{s.hintsUsed}</dd>
              {s.rewindsUsed > 0 && (
                <>
                  <dt>Rewinds used</dt>
                  <dd>{s.rewindsUsed}</dd>
                </>
              )}
            </dl>
          </div>
          <div className="row" style={{ justifyContent: 'center', marginTop: 16 }}>
            <button className="btn primary" onClick={share}>
              {copied ? 'Copied!' : 'Share result'}
            </button>
            <button className="btn" onClick={() => useGame.getState().newGame(s.seed, s.settings)}>
              Retry this system
            </button>
            <button className="btn" onClick={() => useGame.setState({ phase: 'title', outcome: null })}>
              Title screen
            </button>
          </div>
        </div>

        {budget.length > 0 && (
          <div className="panel panel-pad stack" data-tut="results-budget">
            <h2 style={{ fontSize: 18 }}>Where your fuel went</h2>
            <div className="muted" style={{ fontSize: 13 }}>Correction fuel saved if that one measurement had been perfect:</div>
            {budget.slice(0, 6).map((b) => (
              <div key={b.k} className="row" style={{ gap: 10 }}>
                <span style={{ width: 170, fontSize: 13 }}>{QUANTITY_INFO[b.k].label}</span>
                <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 5 }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, (100 * b.saved) / Math.max(1, budget[0].saved)))}%`, height: '100%', background: 'var(--amber)', borderRadius: 5 }} />
                </div>
                <span className="mono" style={{ width: 80, textAlign: 'right', fontSize: 13 }}>{fmt(Math.max(0, b.saved), 0)} m/s</span>
              </div>
            ))}
          </div>
        )}

        <div className="panel panel-pad" data-tut="results-table">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>Your numbers vs the truth</h2>
          <div className="scroll">
            <table className="log">
              <thead>
                <tr>
                  <th>Quantity</th>
                  <th style={{ textAlign: 'right' }}>You</th>
                  <th style={{ textAlign: 'right' }}>Truth</th>
                  <th style={{ textAlign: 'right' }}>Off by</th>
                  <th style={{ textAlign: 'right' }}>Points</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ k, e, sc }) => (
                  <tr key={k}>
                    <td>
                      {QUANTITY_INFO[k].symbol} <span className="muted">{QUANTITY_INFO[k].label}</span>
                    </td>
                    <td className="num">{e ? `${sig(toDisplay(k, e.value), 5)} ± ${sig(toDisplay(k, e.sigma), 2)}` : '—'}</td>
                    <td className="num">{sig(toDisplay(k, truth[k]), 5)}</td>
                    <td className={`num ${sc ? (sc.inside ? 'green' : sc.z < 2 ? 'amber' : 'red') : ''}`}>{sc ? `${fmt(sc.z, 1)}σ` : ''}</td>
                    <td className="num">{sc?.points ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="faint" style={{ fontSize: 12, marginTop: 8 }}>
            Points reward precise and honest error bars. A tight error bar that misses the truth scores below zero.
          </div>
        </div>

        {earned.length > 0 && (
          <div className="panel panel-pad">
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Achievements</h2>
            <div className="row">
              {earned.map((a) => (
                <span key={a} className="chip" title={ACHIEVEMENTS[a].text}>
                  {ACHIEVEMENTS[a].icon} {ACHIEVEMENTS[a].name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
