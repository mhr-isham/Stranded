import { useState } from 'react';
import { cadetGuidanceEnabled, dismissCadetOffer, isCadetExpedition, walkthroughFor } from '../game/cadetGuidance';
import { activeMission, missionsFor, type Mission } from '../game/missions';
import { readingStats, useGame } from '../game/store';
import { Equation } from './common/Equation';

/** A tool only shows help for its current objective; all tools stay accessible. */
export function CadetGoal({ inTool = false }: { inTool?: boolean }) {
  const s = useGame();
  const m = activeMission(s);
  if (!isCadetExpedition(s)) return null;
  if (!cadetGuidanceEnabled(s)) return inTool ? null : (
    <div className="missions panel panel-pad">
      <button className="btn small" onClick={() => s.set({ settings: { ...s.settings, cadetGuidance: true } })}>Show next goal</button>
    </div>
  );
  if (inTool && m?.screen !== s.screen) {
    const key = s.screen === 'pendulum' ? 'g' : s.screen === 'hill' ? 'R1' : null;
    const stats = key ? readingStats(s.readings, key) : null;
    if (!stats || stats.n < 3) return null;
    return <section className="panel panel-pad stack" aria-label="Measurement next step">
      <div>{stats.n} readings kept. Review their spread and instrument limits, then send the average with your uncertainty to the progress sheet.</div>
      <details><summary>What does the scatter tell me?</summary>
        <p className="hint">Scatter shows how repeatable your measurements are. The standard error describes uncertainty in their average from random variation. Shared errors in alignment, length or conditions can affect every reading together, so matching readings can still be inaccurate.</p>
      </details>
      <button className="btn small" onClick={() => s.go('hub')}>Back to current goal</button>
    </section>;
  }
  return <GoalCard key={`${s.runId}-${m?.id}`} mission={m} inTool={inTool} />;
}

function GoalCard({ mission: m, inTool }: { mission: Mission | null; inTool: boolean }) {
  const s = useGame();
  const [why, setWhy] = useState(false);
  const [method, setMethod] = useState(false);
  const [step, setStep] = useState<number | null>(null);
  const [all, setAll] = useState(false);
  const help = s.cadetHelp ?? { warnings: {}, offered: [] };
  const offer = !!m && (help.warnings[m.id] ?? 0) >= 3 && !help.offered.includes(m.id);
  const steps = m ? walkthroughFor(m) : [];
  return (
    <section className={`${inTool ? '' : 'missions '}panel panel-pad stack cadet-goal`} aria-label="Cadet guidance">
      <div className="row between">
        <span className="meter-label">Next goal · optional guidance</span>
        <button className="btn small ghost" onClick={() => s.set({ settings: { ...s.settings, cadetGuidance: false }, echo: s.echo.filter((l) => !l.coach) })}>Hide guidance</button>
      </div>
      <div style={{ fontSize: 15 }}>{m?.short ?? 'Choose your departure in the launch planner.'}</div>
      <div className="row">
        <button className="btn small" aria-expanded={why} onClick={() => setWhy(!why)}>Why this matters</button>
        <button className="btn small" aria-expanded={method} onClick={() => setMethod(!method)}>How do I do this?</button>
      </div>
      {why && <div className="hint"><Equation text={m?.why ?? 'Your flight plan turns the model built from your measurements into a journey.'} /></div>}
      {method && <div className="stack">
        <div className="hint">{m?.goal ?? 'Open the launch planner and compare the predicted routes, fuel and departure dates.'}</div>
        {m && <button className="btn small" onClick={() => { setStep(0); dismissCadetOffer(m.id); }}>Walk me through it</button>}
      </div>}
      {offer && <div className="callout tip" style={{ margin: 0 }}>
        <div>Several attempts raised measurement warnings. Would a walkthrough help?</div>
        <div className="row">
          <button className="btn small" onClick={() => { dismissCadetOffer(m!.id); setMethod(true); setStep(0); }}>Show walkthrough</button>
          <button className="btn small ghost" onClick={() => dismissCadetOffer(m!.id)}>I’ll keep exploring</button>
        </div>
      </div>}
      {step !== null && steps.length > 0 && <div className="callout tip" style={{ margin: 0 }}>
        <div className="meter-label">Walkthrough · {step + 1} / {steps.length}</div>
        <div>{steps[step]}</div>
        <div className="row">
          {step > 0 && <button className="btn small" onClick={() => setStep(step - 1)}>Previous step</button>}
          {step < steps.length - 1 && <button className="btn small" onClick={() => setStep(step + 1)}>Next step</button>}
          <button className="btn small ghost" onClick={() => setStep(null)}>Close walkthrough</button>
        </div>
      </div>}
      {!inTool && <button className="btn small primary" onClick={() => s.go(m?.screen ?? 'launch')}>Open the tool</button>}
      {!inTool && <>
        <button className="btn small ghost" aria-expanded={all} onClick={() => setAll(!all)}>Expedition overview</button>
        {all && <div className="stack">
          <div className="faint" style={{ fontSize: 12 }}>Explore in any order. The highlighted goal is a suggestion.</div>
          {missionsFor(s).map((goal) => <button key={goal.id} className="btn small ghost" onClick={() => goal.screen && s.go(goal.screen)}>
            {goal.done(s) ? '✓ ' : ''}{goal.title}
          </button>)}
        </div>}
      </>}
    </section>
  );
}
