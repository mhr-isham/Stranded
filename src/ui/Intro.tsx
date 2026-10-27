import { useEffect, useMemo, useRef, useState } from 'react';
import { DAY, DEG } from '../engine/constants';
import { INTRO } from '../game/echo';
import { freshSurvival, useGame } from '../game/store';
import { currentWorld } from '../game/sim';
import { paintSky } from '../render/paint';
import { makeLandscape } from '../render/terrain';
import { CanvasView } from './common/CanvasView';
import { clock } from '../game/clock';
import { starAltitude } from '../engine/sky';

export function useTypewriter(text: string, cps = 55) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const id = setInterval(() => setN((k) => (k >= text.length ? k : k + 2)), 1000 / cps);
    return () => clearInterval(id);
  }, [text, cps]);
  return { shown: text.slice(0, n), done: n >= text.length, finish: () => setN(text.length) };
}

export function Intro() {
  // After a flown prologue the first log card ("fold exit") has already happened on screen.
  const flown = useGame((s) => s.camp && s.camp.landing !== 'skipped');
  const [i, setI] = useState(flown ? 1 : 0);
  const { system: sys, catalog } = currentWorld();
  const land = useMemo(() => makeLandscape(sys.seed, sys.hillHeight), [sys]);
  const tw = useTypewriter(INTRO[i].text);
  const tRef = useRef(0);

  const begin = beginPlay;
  const next = () => {
    if (!tw.done) return tw.finish();
    if (i < INTRO.length - 1) setI(i + 1);
    else begin();
  };

  return (
    <div className="screen" onClick={next}>
      <CanvasView
        draw={({ ctx, w, h, dpr, now, dt }) => {
          tRef.current += dt;
          const t = 0.5 * DAY + tRef.current * 400;
          paintSky(ctx, { az: (160 + tRef.current * 0.6) * DEG, alt: 22 * DEG, fov: (w > h ? 90 : 65) * DEG, w, h }, sys, catalog, land, t, now, dpr);
          ctx.fillStyle = 'rgba(2,4,10,0.45)';
          ctx.fillRect(0, 0, w, h);
        }}
      />
      <div className="title-wrap">
        <div className="intro-card panel">
          <div className="row between" style={{ marginBottom: 12 }}>
            <span className="echo-name mono blue" style={{ fontSize: 12, letterSpacing: '0.14em' }}>
              ECHO · SHIP LOG
            </span>
            <div className="progress-dots">
              {INTRO.map((_, k) => (
                <i key={k} className={k <= i ? 'on' : ''} />
              ))}
            </div>
          </div>
          <h2>{INTRO[i].title}</h2>
          <p>{tw.shown}</p>
          <div className="row between">
            <button className="btn ghost small" onClick={(e) => (e.stopPropagation(), begin())}>
              Skip
            </button>
            <button className="btn primary" onClick={(e) => (e.stopPropagation(), next())}>
              {i < INTRO.length - 1 ? 'Next' : 'Step outside'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Leave the opening and start the game at dusk on day 1. */
export function beginPlay() {
  const { system: sys } = currentWorld();
  clock.t = findDusk();
  const g = useGame.getState();
  const survival = freshSurvival(sys.lifeSupport / DAY);
  // A hard landing costs a spare part (the landing legs needed fixing). In Legend,
  // ECHO's rescue is rougher still: two parts and a slow oxygen leak to patch.
  if (g.camp && (g.camp.landing === 'rough' || g.camp.landing === 'rescued')) survival.parts = Math.max(0, survival.parts - 1);
  if (g.camp?.landing === 'rescued' && g.settings.difficulty === 'legend') {
    survival.parts = Math.max(0, survival.parts - 1);
    survival.leak = true;
    survival.log = ['Day 1: the rescue landing cracked an oxygen line. Repair it in the workshop.', ...survival.log];
  }
  useGame.setState({ phase: 'play', screen: 'hub', survival });
}

/** First evening after landing, when the star is ~4 degrees below the horizon. */
function findDusk() {
  const { system: sys } = currentWorld();
  let prev = starAltitude(sys, 0, sys.site);
  for (let t = 600; t < 3 * DAY; t += 600) {
    const a = starAltitude(sys, t, sys.site);
    if (prev > -2 * DEG && a <= -2 * DEG) return t;
    prev = a;
  }
  return 0;
}
