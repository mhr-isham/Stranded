import { useMemo, useRef, useState } from 'react';
import { DAY, DEG } from '../engine/constants';
import { generateSystem } from '../engine/system';
import { starCatalog } from '../engine/sky';
import type { Difficulty } from '../engine/types';
import { paintSky } from '../render/paint';
import { makeLandscape } from '../render/terrain';
import { useGame, type Settings } from '../game/store';
import { dailySeed, randomSeed } from '../game/world';
import { startTutorial } from '../game/tutorial';
import { CanvasView } from './common/CanvasView';
import { Modal, Toggle } from './common/widgets';

const DIFFS: { id: Difficulty; name: string; text: string }[] = [
  { id: 'cadet', name: 'Cadet', text: 'Generous fuel and time. Formula sheet on. Great for a first flight.' },
  { id: 'navigator', name: 'Navigator', text: 'The intended experience. Tight but fair margins.' },
  { id: 'astronomer', name: 'Astronomer', text: 'Thin margins. Every error bar matters.' },
];

export function Title() {
  const s = useGame();
  const [setup, setSetup] = useState(false);
  const [how, setHow] = useState(false);
  const [settings, setSettings] = useState<Settings>({ ...s.settings });
  const [seedText, setSeedText] = useState('');
  const demo = useMemo(() => {
    const sys = generateSystem(20251, 'navigator');
    return { sys, cat: starCatalog(sys.seed), land: makeLandscape(sys.seed, sys.hillHeight) };
  }, []);
  const tRef = useRef(0);
  const canContinue = s.savedT > 0 && !s.outcome;
  const inTutorial = s.tutorial.active;

  const start = (seed: number) => {
    useGame.getState().newGame(seed, settings);
  };

  return (
    <div className="screen">
      <CanvasView
        draw={({ ctx, w, h, dpr, now, dt }) => {
          // A slow dusk time-lapse over the demo system.
          tRef.current += dt * 900;
          const sd = demo.sys.home.siderealDay;
          const t = 40 * DAY + 0.53 * sd + (tRef.current % (sd * 0.25));
          paintSky(ctx, { az: 250 * DEG, alt: 18 * DEG, fov: (w > h ? 95 : 70) * DEG, w, h }, demo.sys, demo.cat, demo.land, t, now, dpr);
        }}
      />
      <div className="title-wrap">
        <div className="logo">STRANDED</div>
        <p className="tagline">
          Your ship fell into an unknown star system. No catalogue. No radio. Fixed fuel. Measure the system with your own hands — then
          plot a course to the blue planet before the air runs out.
        </p>
        <div className="menu">
          {canContinue && (
            <button className="btn primary big" onClick={() => useGame.setState({ phase: 'play' })}>
              {inTutorial ? 'Continue Flight School' : 'Continue'}
            </button>
          )}
          <button className={`btn big ${canContinue ? '' : 'amber'}`} onClick={startTutorial}>
            🎓 Flight School <span style={{ fontWeight: 500, fontSize: 13, opacity: 0.8 }}>· start here</span>
          </button>
          <button className={`btn big ${canContinue ? '' : 'primary'}`} onClick={() => setSetup(true)}>
            New expedition
          </button>
          <button className="btn" onClick={() => setHow(true)}>
            How to play
          </button>
        </div>
      </div>

      {setup && (
        <Modal onClose={() => setSetup(false)}>
          <h2>New expedition</h2>
          <div className="diff-grid" style={{ margin: '10px 0' }}>
            {DIFFS.map((d) => (
              <button key={d.id} className={`diff ${settings.difficulty === d.id ? 'on' : ''}`} onClick={() => setSettings({ ...settings, difficulty: d.id })}>
                <b>{d.name}</b>
                <span>{d.text}</span>
              </button>
            ))}
          </div>
          <Toggle
            on={settings.survival}
            onChange={(v) => setSettings({ ...settings, survival: v })}
            label="Survival mode"
            sub="Manage oxygen, food and power. Weather can cloud the sky. Salvage the wreck to upgrade your tools."
          />
          <Toggle
            on={settings.formulas}
            onChange={(v) => setSettings({ ...settings, formulas: v })}
            label="Formula sheet"
            sub="Show the formula behind every step. Turning it off raises your score ceiling."
          />
          <Toggle on={settings.sound} onChange={(v) => setSettings({ ...settings, sound: v })} label="Sound" />
          <div className="field" style={{ marginTop: 12 }}>
            <label>System seed (optional — share it so friends play the same system)</label>
            <input className="input" inputMode="numeric" placeholder="random" value={seedText} onChange={(e) => setSeedText(e.target.value.replace(/\D/g, ''))} />
          </div>
          <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>
            <button className="btn" onClick={() => start(dailySeed())}>
              Daily system
            </button>
            <button className="btn primary" onClick={() => start(seedText ? Number(seedText) : randomSeed())}>
              Launch expedition
            </button>
          </div>
        </Modal>
      )}

      {how && (
        <Modal onClose={() => setHow(false)}>
          <h2>How to play</h2>
          <div className="stack muted" style={{ fontSize: 14 }}>
            <p style={{ margin: 0 }}>
              <b className="blue">Measure.</b> Use the pendulum, the hill, the observatory and the rover. Every tool is operated by you, so the
              errors are yours too — repeat readings and use long baselines to shrink them.
            </p>
            <p style={{ margin: 0 }}>
              <b className="blue">Record honestly.</b> Each value goes on the progress sheet with a ± error. The score rewards honest error bars:
              a tight range that misses the truth scores worse than a wide one that contains it.
            </p>
            <p style={{ margin: 0 }}>
              <b className="blue">Use time.</b> Warp time to watch the sky move — but life support runs down while you wait.
            </p>
            <p style={{ margin: 0 }}>
              <b className="blue">Launch.</b> Plan a transfer from your own numbers. ECHO flies it through the real system: bad numbers cost fuel on
              course corrections.
            </p>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 16 }}>
            <button className="btn primary" onClick={() => setHow(false)}>
              Got it
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
