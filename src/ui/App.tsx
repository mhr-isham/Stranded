import { useEffect } from 'react';
import { clock } from '../game/clock';
import { advance, currentWorld, fastForward } from '../game/sim';
import { botMeasure, COMPETENT } from '../engine/solver';
import { makeRng } from '../engine/rng';
import { startAmbient } from '../game/audio';
import { useGame } from '../game/store';
import { ToastHost } from './common/widgets';
import { Game } from './Game';
import { Intro } from './Intro';
import { Prologue } from './Prologue';
import { Ascent } from './launch/Ascent';
import { StoryHost } from './StoryScene';
import { Results } from './launch/Results';
import { Flight } from './launch/Flight';
import { Title } from './Title';
import { Tutorial } from './tutorial/Tutorial';

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
  const tutorial = useGame((s) => s.tutorial.active);

  // One simulation loop for the whole game, independent of which canvas is shown.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let saveTimer = 0;
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      advance(dt);
      saveTimer += dt;
      if (saveTimer > 3) {
        saveTimer = 0;
        useGame.setState({ savedT: clock.t });
      }
    };
    raf = requestAnimationFrame(loop);
    const save = () => useGame.setState({ savedT: clock.t });
    window.addEventListener('pagehide', save);
    const firstGesture = () => {
      startAmbient();
      window.removeEventListener('pointerdown', firstGesture);
    };
    window.addEventListener('pointerdown', firstGesture);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('pagehide', save);
    };
  }, []);

  return (
    <>
      {phase === 'title' && <Title />}
      {phase === 'prologue' && <Prologue />}
      {phase === 'intro' && <Intro />}
      {phase === 'play' && <Game />}
      {phase === 'ascent' && <Ascent />}
      {phase === 'flight' && <Flight />}
      {phase === 'landing' && <Prologue arrival />}
      {phase === 'hop' && <Prologue hop />}
      {phase === 'results' && <Results />}
      {tutorial && <Tutorial />}
      {phase !== 'title' && phase !== 'prologue' && <StoryHost />}
      <ToastHost />
    </>
  );
}
