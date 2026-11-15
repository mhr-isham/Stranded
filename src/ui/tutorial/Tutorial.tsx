import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { sfx } from '../../game/audio';
import { anchors, exitTutorial } from '../../game/tutorial';
import { clock, setWarp } from '../../game/clock';
import { useGame } from '../../game/store';
import { LESSONS, type LessonId } from './lessons';
import { STEPS, type TutStep } from './steps';
import { recordTraining } from '../../game/training';
import { finishSchoolExercise, schoolExerciseComplete } from './schoolPractice';
import { leaveFlightPractice } from '../common/flightPractice';

/** Render **bold** markup. */
export function rich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => (part.startsWith('**') ? <b key={i}>{part.slice(2, -2)}</b> : <Fragment key={i}>{part}</Fragment>));
}

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

let lastScroll = 0;

/** Find the on-screen box of a step's target (first visible match), scrolling it into view if needed. */
function targetBox(target: string | undefined, follow = true): Box | null {
  if (!target) return null;
  for (const id of target.split(' ')) {
    if (id.startsWith('anchor:')) {
      const a = anchors.get(id.slice(7));
      if (a && performance.now() - a.at < 600) return { x: a.x - 22, y: a.y - 22, w: 44, h: 44 };
      continue;
    }
    const els = document.querySelectorAll<HTMLElement>(`[data-tut~="${id}"]`);
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) continue;
      if (el.classList.contains('hotspot')) el.setAttribute('data-training-focus', 'true');
      // Keep the target clear of the HUD (top) and the nav bar (bottom).
      const navTop = document.querySelector('nav.nav')?.getBoundingClientRect().top ?? window.innerHeight;
      const hidden = r.top > navTop - 12 || r.bottom < 70 || (r.bottom > navTop && r.height < navTop * 0.5);
      if (follow && hidden && performance.now() - lastScroll > 800) {
        lastScroll = performance.now();
        el.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
      if (r.bottom > 0 && r.top < window.innerHeight) return { x: r.left, y: r.top, w: r.width, h: r.height };
    }
  }
  return null;
}

export function LessonModal({ id, onClose }: { id: LessonId; onClose: () => void }) {
  const L = LESSONS[id];
  useEffect(() => {
    const wasPaused = clock.paused;
    const runId = useGame.getState().runId;
    clock.paused = true;
    clock.emit();
    const s = useGame.getState();
    if (!s.tutorial.lessons.includes(id)) useGame.setState({ tutorial: { ...s.tutorial, lessons: [...s.tutorial.lessons, id] } });
    recordTraining(`lesson:${id}`, 'started');
    return () => { if (useGame.getState().runId === runId) { clock.paused = wasPaused; clock.emit(); } };
  }, [id]);
  // Portal to <body> so the lesson sits above every screen's stacking context.
  return createPortal(
    <div className="lesson-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="lesson-modal panel">
        <div className="row between" style={{ marginBottom: 6 }}>
          <span className="chip">
            {L.icon} Interactive lesson
          </span>
          <button className="btn small ghost" onClick={onClose} aria-label="Close lesson">
            ✕
          </button>
        </div>
        <L.C />
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
          <button className="btn primary" onClick={() => { recordTraining(`lesson:${id}`, 'completed'); onClose(); }}>
            Got it
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

export function Tutorial() {
  const s = useGame();
  const idx = Math.min(s.tutorial.step, STEPS.length - 1);
  const session = s.schoolSession;
  const originalStep = STEPS[idx];
  const predictionKind = session?.id === 'estimate-pendulum' ? 'pendulum' : session?.id === 'estimate-star' ? 'star' : null;
  const step: TutStep = predictionKind ? {
    ...originalStep, title: predictionKind === 'pendulum' ? 'Predict a measured swing' : 'Predict from your star logs',
    target: `training-prediction-${predictionKind}`, screen: predictionKind === 'pendulum' ? 'pendulum' : 'observatory', dim: false, compact: true,
    body: [predictionKind === 'pendulum' ? 'Keep a baseline period using the rig. Measure a different string length, commit your prediction and range, then time and keep a new reading to compare.' : 'Open the Year tab and log the star at two different dusks. Commit a position and range about two weeks ahead, then advance to the target time and log again.'],
    done: (state) => state.readingPredictions[predictionKind]?.comparison !== undefined,
    doIt: undefined, action: undefined, warn: undefined, lesson: undefined,
  } : originalStep;
  const first = session?.start ?? 0;
  const last = session?.end ?? STEPS.length - 1;
  const [box, setBox] = useState<Box | null>(null);
  const [lesson, setLesson] = useState<LessonId | null>(null);
  const [mini, setMini] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [extra, setExtra] = useState<'warn' | 'tip' | null>(null);
  const done = step.done ? step.done(s) : false;
  const advancing = useRef<number | null>(null);

  const goStep = (i: number) => {
    const next = Math.max(first, Math.min(last, i));
    const current = useGame.getState();
    const completedSteps = current.schoolSession && (!step.done || step.done(current))
      ? [...new Set([...current.schoolSession.completedSteps, step.id])] : current.schoolSession?.completedSteps;
    useGame.setState({ tutorial: { ...current.tutorial, step: next, note: undefined }, ...(current.schoolSession ? { schoolSession: { ...current.schoolSession, completedSteps: completedSteps! } } : {}) });
  };

  // Track the target box every frame (things move: canvases, scrolling panels).
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const b = targetBox(step.target, step.followTarget !== false);
      setBox((prev) => (prev && b && Math.abs(prev.x - b.x) < 0.5 && Math.abs(prev.y - b.y) < 0.5 && prev.w === b.w && prev.h === b.h ? prev : b));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [step.target]);

  useEffect(() => () => {
    document.querySelectorAll('.hotspot[data-training-focus]').forEach((el) => el.removeAttribute('data-training-focus'));
  }, [step.target]);

  // Step entry: run its hook, calm the clock and open its lesson.
  useEffect(() => {
    step.onEnter?.();
    if (clock.warpIndex > 3 && clock.stopAt === Infinity) setWarp(3);
    setMini(!!step.compact && window.innerWidth <= 860);
    setExtra(null);
    if (step.autoLesson && step.lesson) setLesson(step.lesson);
    // Scroll the target into view if it lives in a scrolling side panel.
    setTimeout(() => {
      const id = step.target?.split(' ')[0];
      if (step.followTarget !== false && id && !id.startsWith('anchor:')) document.querySelector(`[data-tut~="${id}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }, 250);
  }, [idx]); // eslint-disable-line react-hooks/exhaustive-deps

  // Completed steps advance by themselves after a short celebration.
  useEffect(() => {
    if (!done || !step.done) return;
    sfx('good');
    if (step.noAuto) return;
    advancing.current = window.setTimeout(() => goStep(idx + 1), 1100);
    return () => {
      if (advancing.current) clearTimeout(advancing.current);
    };
  }, [done, idx]); // eslint-disable-line react-hooks/exhaustive-deps

  if (s.phase === 'intro' || s.phase === 'title' || s.phase === 'prologue') return null;

  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const phone = vw <= 860;
  const pad = 6;
  const ring = box && { left: box.x - pad, top: box.y - pad, width: box.w + 2 * pad, height: box.h + 2 * pad };
  const dim = step.dim ?? true;

  // Arrow on the side of the target with the most room.
  let arrow: { left: number; top: number; dir: 'down' | 'up' | 'left' | 'right'; ch: string } | null = null;
  if (box) {
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    if (box.y > 90) arrow = { left: cx - 15, top: box.y - pad - 40, dir: 'down', ch: '▼' };
    else if (box.y + box.h < vh - 120) arrow = { left: cx - 15, top: box.y + box.h + pad + 4, dir: 'up', ch: '▲' };
    else if (box.x > 60) arrow = { left: box.x - pad - 38, top: cy - 18, dir: 'right', ch: '▶' };
    else arrow = { left: box.x + box.w + pad + 6, top: cy - 18, dir: 'left', ch: '◀' };
  }

  // Card placement: away from the target.
  const cardStyle: React.CSSProperties = {};
  const targetLow = box ? box.y + box.h / 2 > vh * 0.5 : false;
  const targetRight = box ? box.x + box.w / 2 > vw * 0.5 : true;
  if (!box && s.phase === 'flight') {
    // Keep clear of ECHO's flight panel (top on phones, bottom on desktop).
    if (phone) cardStyle.bottom = 'calc(12px + var(--safe-bottom))';
    else {
      cardStyle.top = 'calc(12px + var(--safe-top))';
      cardStyle.left = 16;
    }
  } else if (!box && step.target) {
    // Target not on screen yet: stay out of the way.
    cardStyle.bottom = 'calc(84px + var(--safe-bottom))';
    if (!phone) cardStyle.left = 16;
  } else if (!box) {
    if (phone) cardStyle.bottom = 'calc(84px + var(--safe-bottom))';
    else {
      cardStyle.left = '50%';
      cardStyle.top = '50%';
      cardStyle.transform = 'translate(-50%, -50%)';
    }
  } else {
    if (targetLow) cardStyle.top = 'calc(var(--hud-h) + 8px + var(--safe-top))';
    else cardStyle.bottom = 'calc(84px + var(--safe-bottom))';
    if (!phone) cardStyle[targetRight ? 'left' : 'right'] = 16;
  }

  const missingTarget = step.target && !box && step.screen && s.screen !== step.screen && s.phase === 'play';
  const progress = (idx - first + 1) / (last - first + 1);
  const chapters = [...new Set(STEPS.map((x) => x.chapter))];
  const chapterNo = chapters.indexOf(step.chapter) + 1;

  return (
    <>
      {ring && <div className={`tut-ring ${dim ? '' : 'soft'}`} style={ring} />}
      {arrow && (
        <div className={`tut-arrow ${arrow.dir}`} style={{ left: arrow.left, top: arrow.top }}>
          {arrow.ch}
        </div>
      )}
      <div className={`tut-card panel ${mini ? 'mini' : ''} ${box ? '' : 'free'}`} style={cardStyle} role="dialog" aria-label="Flight School">
        <div className="row between">
          <span className="meter-label" style={{ color: 'var(--amber)' }}>
            🎓 Flight School · {session ? `${idx - first + 1}/${last - first + 1}` : `${chapterNo}/${chapters.length}`} {step.chapter}
          </span>
          <span className="row" style={{ gap: 2 }}>
            <button className="btn small ghost" onClick={() => setMini(!mini)} aria-label={mini ? 'Expand' : 'Minimise'} title={mini ? 'Expand' : 'Minimise'}>
              {mini ? '▢' : '–'}
            </button>
            <button className="btn small ghost" onClick={() => setConfirmExit(true)} aria-label="Exit tutorial" title="Exit tutorial">
              ✕
            </button>
          </span>
        </div>
        <div className="tut-progress">
          <i style={{ width: `${progress * 100}%` }} />
        </div>
        <h3>
          {step.title} {done && step.done && <span className="tut-done">✓</span>}
        </h3>
        <div className="body">
          {session && <p className="school-context">Unscored practice. Prerequisite observations may be supplied for this exercise; your expedition is preserved. Completing this guide records practice, not a skill certification.</p>}
          {session?.id === 'basic' && (step.id === 'pend-send' || step.id === 'year-send') && <p className="school-context">Optional: try the prediction practice in this instrument’s panel before continuing. It is skippable and has no points.</p>}
          {(session && step.id === 'debrief-grade' ? ['This practice run is unscored. Inspect the fuel and measurement feedback, then finish the exercise to restore your expedition.'] : step.body).map((p, i) => (
            <p key={i}>{rich(p)}</p>
          ))}
        </div>
        {s.tutorial.note && s.tutorial.note.length > 0 && !mini && (
          <div className="callout key">
            <b>ECHO’s report</b>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>
              {s.tutorial.note.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </div>
        )}
        {phone && !mini && (step.warn || step.tip) && (
          <div className="row" style={{ gap: 6 }}>
            {step.warn && (
              <button className={`chip ${extra === 'warn' ? 'red' : ''}`} onClick={() => setExtra(extra === 'warn' ? null : 'warn')}>
                ⚠ Watch out
              </button>
            )}
            {step.tip && (
              <button className={`chip ${extra === 'tip' ? 'green' : ''}`} onClick={() => setExtra(extra === 'tip' ? null : 'tip')}>
                💡 Tip
              </button>
            )}
          </div>
        )}
        {step.warn && !mini && (!phone || extra === 'warn') && (
          <div className="callout warn">
            <b>⚠ Watch out</b>
            {rich(step.warn)}
          </div>
        )}
        {step.tip && !mini && (!phone || extra === 'tip') && (
          <div className="callout tip">
            <b>💡 Tip</b>
            {rich(step.tip)}
          </div>
        )}
        <div className="row" style={{ marginTop: 8, gap: 6 }}>
          {(predictionKind || (session?.id === 'basic' && (step.id === 'pend-send' || step.id === 'year-send'))) && <button className="btn small" onClick={() => {
            const kind = predictionKind ?? (step.id === 'pend-send' ? 'pendulum' : 'star');
            document.querySelector(`[data-tut="training-prediction-${kind}"]`)?.scrollIntoView({ block: 'center' });
            setMini(true);
          }}>{predictionKind ? 'Prediction panel' : 'Optional prediction exercise'}</button>}
          {missingTarget && (
            <button className="btn small amber" onClick={() => s.go(step.screen!)}>
              Take me there
            </button>
          )}
          {step.lesson && (
            <button className="btn small" onClick={() => setLesson(step.lesson!)}>
              {LESSONS[step.lesson].icon} Open lesson
            </button>
          )}
          {step.action && !done && (
            <button className="btn small amber" onClick={() => (step.action!.run(), sfx('click'))}>
              ⏩ {step.action.label}
            </button>
          )}
          {step.doIt && !done && (
            <button className="btn small" onClick={() => { const current = useGame.getState(); if (current.schoolSession) useGame.setState({ schoolSession: { ...current.schoolSession, assisted: true } }); step.doIt!.run(); sfx('click'); }} title="ECHO does this step for you — you learn more doing it yourself">
              🤖 {step.doIt.label ?? 'Do it for me'}
            </button>
          )}
          <span className="spacer" />
          <button className="btn small ghost" disabled={idx === first} onClick={() => goStep(idx - 1)}>
            Back
          </button>
          {idx < last ? (
            <button className={`btn small ${!step.done || done ? 'primary' : ''}`} onClick={() => goStep(idx + 1)} title={step.done && !done ? 'Skip this step' : undefined}>
              {step.done && !done ? 'Skip' : 'Next'}
            </button>
          ) : (
            <button
              className="btn small primary"
              disabled={!!session && !schoolExerciseComplete(s)}
              title={session && !schoolExerciseComplete(s) ? 'Revisit skipped required steps, or use Exit tutorial to skip this exercise for now.' : undefined}
              onClick={() => {
                if (session) { finishSchoolExercise(); return; }
                exitTutorial();
                useGame.setState({ phase: 'title', outcome: null, debriefSeen: true });
              }}
            >
              {session ? 'Finish exercise' : 'Finish'}
            </button>
          )}
        </div>
      </div>
      {lesson && <LessonModal id={lesson} onClose={() => setLesson(null)} />}
      {confirmExit && (
        <div className="modal-back" style={{ zIndex: 96 }} onPointerDown={(e) => e.target === e.currentTarget && setConfirmExit(false)}>
          <div className="modal panel">
            <h2>Leave Flight School?</h2>
            <p className="muted">{session ? 'Your expedition will be restored. Return now to leave this exercise in progress, or explicitly skip it for now. You can repeat it from Flight School at any time.' : 'You can keep playing this system without the guide, or go back to the title screen. Lessons stay available in the Codex.'}</p>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => setConfirmExit(false)}>
                Stay
              </button>
              {session ? <>
                <button className="btn" onClick={leaveFlightPractice}>Return to library</button>
                <button className="btn primary" onClick={() => finishSchoolExercise(true)}>Skip exercise for now</button>
              </> : <><button className="btn" onClick={() => (exitTutorial(), setConfirmExit(false))}>
                Continue without guide
              </button>
              <button className="btn primary" onClick={() => (exitTutorial(), useGame.setState({ phase: 'title' }), setConfirmExit(false))}>
                Title screen
              </button>
              </>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export type { TutStep };
