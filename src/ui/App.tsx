import { SchoolRewardFeedback } from './SchoolRewards';
import { useEffect } from 'react';
import { flushPacing, pacingInput, tickPacing } from '../game/pacingRecorder';
import { clock } from '../game/clock';
import { advance, currentWorld, fastForward } from '../game/sim';
import { botMeasure, COMPETENT } from '../engine/solver';
import { makeRng } from '../engine/rng';
import { disposeAudio, startAmbient } from '../game/audio';
import { useGame } from '../game/store';
import { ToastHost } from './common/widgets';
import { SharpEyeFeedback } from './common/SharpEye';
import { Game } from './Game';
import { Intro } from './Intro';
import { Prologue } from './Prologue';
import { Ascent } from './launch/Ascent';
import { StoryHost } from './StoryScene';
import { Results } from './launch/Results';
import { FoldTransit } from './launch/FoldNavigation';
import { Flight } from './launch/Flight';
import { Title } from './Title';
import { Tutorial } from './tutorial/Tutorial';
import { FlightSchool } from './FlightSchool';

if (import.meta.env.DEV) {
  // Test hooks for automated browser checks (dev server only).
  Object.assign(window, {
    __game: useGame,
    __clock: clock,
    __tut: { tutorial: () => import('../game/tutorial'), steps: () => import('./tutorial/steps') },
    __ff: (t: number) => fastForward(t),
    __botFill: () => {
      const { system } = currentWorld();
      const { primaries } = botMeasure(system, COMPETENT, makeRng(7));
      useGame.setState({ sheet: primaries, identified: true });
    },
  });
}

export default function App() {
  const phase = useGame((s) => s.phase);
  const runId = useGame((s) => s.runId);
  const tutorial = useGame((s) => s.tutorial.active);
  const school = useGame((s) => s.schoolOpen);

  // One simulation loop for the whole game, independent of which canvas is shown.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let saveTimer = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      tickPacing(now, dt, document.visibilityState === 'visible' && document.hasFocus());
      advance(dt);
      saveTimer += dt;
      if (saveTimer > 3) {
        saveTimer = 0;
        if (!flushPacing()) useGame.setState({ savedT: clock.t });
      }
    };
    raf = requestAnimationFrame(loop);
    const save = () => { if (!flushPacing()) useGame.setState({ savedT: clock.t }); };
    const rebase = () => { flushPacing(); last = performance.now(); };
    const pacingGesture = () => pacingInput(performance.now());
    window.addEventListener('focus', rebase);
    window.addEventListener('blur', rebase);
    document.addEventListener('visibilitychange', rebase);
    window.addEventListener('pointermove', pacingGesture, { passive: true });
    window.addEventListener('wheel', pacingGesture, { passive: true });
    window.addEventListener('pagehide', save);
    const firstGesture = () => {
      pacingGesture();
      startAmbient();
    };
    window.addEventListener('pointerdown', firstGesture);
    window.addEventListener('keydown', firstGesture);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pagehide', save);
      window.removeEventListener('focus', rebase);
      window.removeEventListener('blur', rebase);
      document.removeEventListener('visibilitychange', rebase);
      window.removeEventListener('pointermove', pacingGesture);
      window.removeEventListener('wheel', pacingGesture);
      window.removeEventListener('pointerdown', firstGesture);
      window.removeEventListener('keydown', firstGesture);
      disposeAudio();
    };
  }, []);

  return (
    <>
      {phase === 'title' && <Title />}
      {phase === 'prologue' && <Prologue key={`${runId}-opening`} />}
      {phase === 'intro' && <Intro />}
      {phase === 'play' && <Game key={runId} />}
      {phase === 'ascent' && <Ascent key={`${runId}-ascent`} />}
      {phase === 'flight' && <Flight />}
      {phase === 'fold' && <FoldTransit key={runId} />}
      {phase === 'landing' && <Prologue key={`${runId}-landing`} arrival />}
      {phase === 'hop' && <Prologue key={`${runId}-hop`} hop />}
      {phase === 'results' && <Results />}
      {tutorial && <Tutorial />}
      {school && <FlightSchool recommendedChapter={school.chapter} onClose={() => useGame.setState({ schoolOpen: null })} />}
      {phase !== 'title' && phase !== 'prologue' && <StoryHost />}
      <ToastHost />
      <SharpEyeFeedback />
      <SchoolRewardFeedback />
    </>
  );
}
