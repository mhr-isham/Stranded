import { useEffect, useMemo, useState } from 'react';
import { QUANTITY_INFO, deriveAll, derivedFor, keysFor, labelFor, truthValues, type Primaries, type QuantityKey } from '../../engine/chain';
import { variantOf } from '../../engine/chapters';
import { DAY } from '../../engine/constants';
import { simulateLaunch } from '../../engine/launch';
import { bestTransfer, modelFromPrimaries, planTransfer } from '../../engine/planner';
import { gradeRun, scoreQuantity } from '../../engine/scoring';
import { sfx } from '../../game/audio';
import { fmt, sig, toDisplay } from '../../game/format';
import { currentWorld } from '../../game/sim';
import { useGame } from '../../game/store';
import { lifeSupportEnd } from '../../game/survival';
import { evaluateAchievements, ACHIEVEMENTS } from '../../game/achievements';
import { startRun, toast } from '../common/widgets';
import { hasPrelaunch, rewindToLaunch } from '../../game/checkpoints';
import { countText, modeOf } from '../../game/modes';
import { predictionPoints } from '../../game/predictions';
import { nameOf, type AtlasCard } from '../../game/atlas';
import { unlockLog } from '../../game/story';
import { CHAPTERS, chapterOf, chapterUnlocked } from '../../game/campaign';
import { randomSeed } from '../../game/world';
import { CHAPTER_CODEX } from '../../game/codex';
import { ANOMALIES, affectedReadings, sharpEyePoints } from '../../game/anomalies';
import { CHALLENGES, challengeBonus } from '../../game/challenges';
import { probeTruth } from '../../game/probeState';

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
          <div className="muted">{named(info.text)}</div>
          <EchoQuote text={named(info.echo)} />
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
  const variant = variantOf(sys.features);
  const truth = truthValues(sys, sheet, probeTruth(s));
  const derived = deriveAll(sheet, variant);
  // This chapter's measured and derived quantities, each once.
  const rows = [...new Set([...keysFor(variant), ...Object.keys(derivedFor(variant))] as QuantityKey[])].filter((k) => variant !== 'probe' || k !== 'aM').map((k) => {
    const e = (sheet as Record<string, { value: number; sigma: number } | undefined>)[k] ?? (derived as Record<string, { value: number; sigma: number } | undefined>)[k];
    return { k, e, sc: e && Number.isFinite(truth[k]) ? scoreQuantity(e.value, e.sigma, truth[k]) : null };
  });
  const measurementPoints = rows.reduce((a, r) => a + (r.sc?.points ?? 0), 0);
  const fuelLeftFraction = outcome ? outcome.result.fuelLeft / sys.fuelDv : 0;
  const end = lifeSupportEnd(s, sys);
  const daysLeftFraction = outcome ? (end - outcome.plan.departTime) / end : 0;
  const grade = gradeRun({ measurementPoints, fuelLeftFraction, daysLeftFraction, hintsUsed: s.hintsUsed, success: kind === 'success', penalty: s.rewindsUsed * mode.rewindPenalty - landingBonus(s.arrival) - sharpEyePoints(s), predictionPoints: predictionPoints(s), multiplier: challengeBonus(s) });
  const [copied, setCopied] = useState(false);
  const affected = affectedReadings(s);

  // Error budget: how much correction fuel each measurement cost, found by
  // replacing it with the truth and flying the same departure again.
  const budget = useMemo(() => {
    if (!outcome) return [];
    const base = outcome.result.correctionCost;
    const out: { k: QuantityKey; saved: number }[] = [];
    for (const k of keysFor(variant)) {
      if (!sheet[k]) continue;
      const alt = { ...sheet, [k]: { ...sheet[k]!, value: truth[k] } };
      const m = modelFromPrimaries(alt, variant);
      if (!m) continue;
      // A slingshot is replanned as a slingshot (a direct route would cost the same for every row).
      const p = m.giant ? bestTransfer(m, outcome.plan.departTime) : planTransfer(m, outcome.plan.departTime, outcome.plan.tof);
      if (!p) continue;
      const r = simulateLaunch(sys, p.plan);
      out.push({ k, saved: base - r.correctionCost });
    }
    return out.sort((a, b) => b.saved - a.saved);
  }, [outcome]); // eslint-disable-line react-hooks/exhaustive-deps

  const earned = useMemo(() => evaluateAchievements(s, sys, kind, rows), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!s.debriefSeen) useGame.setState({ debriefSeen: true });
    const g0 = useGame.getState();
    // Reaching the beacon: the Halcyon cache and the chapter's journal pages.
    if (kind === 'success') chapterOf(g0.chapter).successLogs.forEach((id) => unlockLog(id));
    if (kind === 'success' && CHAPTER_CODEX[g0.chapter]) g0.unlock('codex', CHAPTER_CODEX[g0.chapter]);
    // Anomalies met in this run get their Codex cards.
    for (const r of affectedReadings(g0)) g0.unlock('codex', r.key === 'g' ? 'windAnom' : 'humidAnom');
    // Campaign progress: chapter done, best grade per mode.
    if (!g0.tutorial.active && !g0.settings.freeRoam) {
      const c = g0.campaign[g0.chapter] ?? { done: false, best: {} };
      const prev = c.best[g0.settings.difficulty];
      const best = !prev || grade.total > prev.score ? { grade: grade.letter, score: grade.total } : prev;
      useGame.setState({ campaign: { ...g0.campaign, [g0.chapter]: { done: c.done || kind === 'success', best: { ...c.best, [g0.settings.difficulty]: best } } } });
    }
    // Every run, success or not, becomes a finished card in the Atlas.
    const g = useGame.getState();
    if (!g.tutorial.active && !g.settings.freeRoam && !g.atlas.some((c) => c.id === g.runId)) {
      const card: AtlasCard = {
        id: g.runId,
        seed: g.seed,
        mode: g.settings.difficulty,
        survival: g.settings.survival,
        date: Date.now(),
        names: g.names,
        outcome: kind,
        grade: grade.letter,
        score: grade.total,
        camp: g.camp,
        predictions: { made: g.predictions.filter((p) => p.result).length, inside: g.predictions.filter((p) => p.result && p.result.z <= 1).length },
        rows: rows.filter((r) => r.e && r.sc).map((r) => ({ k: r.k, value: r.e!.value, sigma: r.e!.sigma, truth: truth[r.k], z: r.sc!.z })),
      };
      useGame.setState({ atlas: [...g.atlas, card] });
    }
    if (!useGame.getState().settings.freeRoam) earned.forEach((a) => useGame.getState().unlock('achievements', a));
    sfx(kind === 'success' ? 'unlock' : 'bad');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const share = () => {
    const emoji = rows
      .filter((r) => r.sc)
      .map((r) => (r.sc!.inside ? (r.sc!.relSigma < 0.01 ? '🟦' : '🟩') : r.sc!.z < 2 ? '🟨' : '🟥'))
      .join('');
    const text = `STRANDED · system #${s.seed} (${mode.name}${s.settings.survival ? ', survival' : ''}${s.rewindsUsed ? `, ${s.rewindsUsed} rewind` : ''})\n${info.title} · grade ${grade.letter} · ${grade.total} pts\n${emoji}\nfuel left ${fmt(Math.max(0, fuelLeftFraction) * 100, 1)}% · launched day ${outcome ? fmt(outcome.plan.departTime / DAY, 0) : '—'}`;
    // Say "copied" only if it was; otherwise offer the text to copy by hand.
    const fallback = () => window.prompt('Copy your result:', text);
    if (!navigator.clipboard) return void fallback();
    navigator.clipboard.writeText(text).then(
      () => {
        setCopied(true);
        toast('Result copied — share it!');
      },
      fallback,
    );
  };

  return (
    <div className="screen scroll" style={{ background: 'radial-gradient(ellipse at 50% 0%, #10204a 0%, #05070f 65%)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'calc(24px + var(--safe-top)) 14px 40px' }} className="stack">
        <div className="panel panel-pad" style={{ textAlign: 'center' }} data-tut="results-grade">
          <div className="meter-label">
            {s.settings.freeRoam ? 'Free Roam · not scored · ' : 'Mission debrief · '}
            {sys.features.real ? 'the Solar System' : s.names.star ? `${nameOf(s.names, 'star')} system` : `system #${s.seed}`}
          </div>
          <h1 className={info.cls} style={{ fontSize: 'clamp(30px, 6vw, 48px)', margin: '6px 0' }}>
            {info.title}
          </h1>
          <div className="muted">{named(info.text)}</div>
          {!s.tutorial.active && <EchoQuote text={named(info.echo)} />}
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
              {s.predictions.some((p) => p.result) && (
                <>
                  <dt>Predictions</dt>
                  <dd>
                    {s.predictions.filter((p) => p.result && p.result.z <= 1).length}/{s.predictions.filter((p) => p.result).length} inside · {predictionPoints(s)} pts
                  </dd>
                </>
              )}
              {s.ascentPenalty !== null && (
                <>
                  <dt>Your ascent vs ECHO’s</dt>
                  <dd className={s.ascentPenalty <= 50 ? 'green' : s.ascentPenalty <= 400 ? 'amber' : 'red'}>
                    {s.ascentPenalty <= 0 ? `${fmt(-s.ascentPenalty, 0)} m/s saved` : `${fmt(s.ascentPenalty, 0)} m/s extra`}
                  </dd>
                </>
              )}
              {s.arrival && s.arrival.landing !== 'skipped' && (
                <>
                  <dt>Landing</dt>
                  <dd>
                    {s.arrival.landing === 'clean' ? 'clean (+60)' : s.arrival.landing === 'rough' ? 'hard (+20)' : 'ECHO took over'}
                  </dd>
                </>
              )}
              {(s.settings.challenges?.length ?? 0) > 0 && (
                <>
                  <dt>Challenges (+{(s.settings.challenges!.length * 5).toFixed(0)}%)</dt>
                  <dd title={s.settings.challenges!.map((c) => CHALLENGES[c].name).join(', ')}>{s.settings.challenges!.map((c) => CHALLENGES[c].icon).join(' ')}</dd>
                </>
              )}
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
            <button className="btn" onClick={() => startRun(s.seed, s.settings, s.chapter)}>
              Retry this system
            </button>
            {kind === 'success' && !s.tutorial.active && !s.settings.freeRoam && CHAPTERS.some((c) => c.n === s.chapter + 1) && chapterUnlocked(s, s.chapter + 1) && (
              <button className="btn primary" onClick={() => startRun(randomSeed(), s.settings, s.chapter + 1)}>
                Chapter {s.chapter + 1}: {chapterOf(s.chapter + 1).title} →
              </button>
            )}
            <button className="btn" onClick={() => useGame.setState({ phase: 'title', outcome: null })}>
              Title screen
            </button>
          </div>
        </div>

        {budget.length > 0 && (
          <div className="panel panel-pad stack" data-tut="results-budget">
            <h2 style={{ fontSize: 18 }}>Where your fuel went</h2>
            <div className="muted" style={{ fontSize: 13 }}>Correction fuel saved if that one measurement had been perfect:</div>
            {budget.every((b) => b.saved < 0.5) && <div className="faint" style={{ fontSize: 13 }}>No single measurement cost a whole m/s: the corrections were small all round.</div>}
            {budget.filter((b) => b.saved >= 0.5).slice(0, 6).map((b) => (
              <div key={b.k} className="row" style={{ gap: 10 }}>
                <span style={{ width: 170, fontSize: 13 }}>{named(labelFor(b.k, variant))}</span>
                <div style={{ flex: 1, height: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 5 }}>
                  <div style={{ width: `${Math.max(0, Math.min(100, (100 * b.saved) / Math.max(1, budget[0].saved)))}%`, height: '100%', background: 'var(--amber)', borderRadius: 5 }} />
                </div>
                <span className="mono" style={{ width: 80, textAlign: 'right', fontSize: 13 }}>{fmt(Math.max(0, b.saved), 0)} m/s</span>
              </div>
            ))}
          </div>
        )}

        {affected.length > 0 && ANOMALIES[s.settings.difficulty].announce !== 'corrected' && (
          <div className="panel panel-pad stack">
            <h2 style={{ fontSize: 18 }}>Anomalies in your data</h2>
            <div className="muted" style={{ fontSize: 13 }}>
              Real effects bent some readings the same way every time. A careful observer spots them — by the wind gauge, by the haze, by readings that
              disagree with the rest — and leaves them out.
            </div>
            {affected.map((r) => (
              <div key={r.id} className="row between" style={{ fontSize: 13 }}>
                <span>
                  {r.key === 'g' ? '🌬 Pendulum on a windy day' : '🌫 Horizon dip on a humid morning'} · day {fmt(r.at / DAY, 1)}
                </span>
                <span className={r.kept ? 'amber' : 'green'}>{r.kept ? 'kept' : 'left out · Sharp Eye +15'}</span>
              </div>
            ))}
            <div className="faint" style={{ fontSize: 12 }}>
              Wind pushes the bob sideways, so it swings faster and g reads high. Humid air bends light from the horizon, so the dip reads small and the
              radius large. Both are in the Codex.
            </div>
          </div>
        )}

        <div className="panel panel-pad" data-tut="results-table">
          <h2 style={{ fontSize: 18, marginBottom: 8 }}>{sys.features.real ? 'Your numbers vs NASA’s' : 'Your numbers vs the truth'}</h2>
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
                      {QUANTITY_INFO[k].symbol} <span className="muted">{named(labelFor(k, variant))}</span>
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

/** A good landing at the beacon is worth a little: the peak of the run. */
function landingBonus(a: { landing: string } | null) {
  if (!a) return 0;
  return a.landing === 'clean' ? 60 : a.landing === 'rough' ? 20 : 0;
}

/** Use the player's (or chapter 9's real) name for the blue planet in debrief text. */
function named(txt: string) {
  const n = useGame.getState().names.target?.trim();
  if (!n) return txt;
  const cap = n.charAt(0).toUpperCase() + n.slice(1);
  return txt.replace(/\bthe blue planet/g, n).replace(/\bThe blue planet/g, cap).replace(/\bBlue planet/g, cap).replace(/\bblue planet/g, n);
}
