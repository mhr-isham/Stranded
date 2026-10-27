import { useMemo, useRef, useState } from 'react';
import { DAY, DEG } from '../engine/constants';
import { generateSystem } from '../engine/system';
import { starCatalog } from '../engine/sky';
import { MODES, MODE_ORDER } from '../game/modes';
import { paintSky } from '../render/paint';
import { makeLandscape } from '../render/terrain';
import { useGame, type Settings } from '../game/store';
import { dailySeed, randomSeed } from '../game/world';
import { startTutorial } from '../game/tutorial';
import { CanvasView } from './common/CanvasView';
import { Modal, Toggle } from './common/widgets';
import { AtlasGrid, CalibrationPanel } from './Atlas';
import { CHAPTERS, chapterOf, chapterUnlocked } from '../game/campaign';
import { LESSONS, type LessonId } from './tutorial/lessons';
import { LessonModal } from './tutorial/Tutorial';

export function Title() {
  const s = useGame();
  const [setup, setSetup] = useState(false);
  const [how, setHow] = useState(false);
  const [atlas, setAtlas] = useState(false);
  const [campaign, setCampaign] = useState(false);
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
          <button className={`btn big ${canContinue ? '' : 'primary'}`} onClick={() => setCampaign(true)}>
            📖 Campaign
          </button>
          <button className="btn big" onClick={() => setSetup(true)}>
            Single expedition
          </button>
          <div className="row" style={{ gap: 8, justifyContent: 'center' }}>
            <button className="btn" onClick={() => setHow(true)}>
              How to play
            </button>
            {s.atlas.length > 0 && (
              <button className="btn" onClick={() => setAtlas(true)}>
                🗺 Atlas
              </button>
            )}
          </div>
        </div>
      </div>

      {setup && (
        <Modal onClose={() => setSetup(false)}>
          <h2>Single expedition</h2>
          <p className="muted" style={{ margin: '2px 0 8px', fontSize: 13 }}>One star system like the first chapter — random, daily or from a seed.</p>
          <ModeSettings settings={settings} setSettings={setSettings} />
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

      {campaign && <CampaignModal settings={settings} setSettings={setSettings} onClose={() => setCampaign(false)} />}

      {atlas && (
        <Modal onClose={() => setAtlas(false)}>
          <div className="stack">
            <CalibrationPanel />
            <AtlasGrid />
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

/** Mode picker plus the survival, formula and sound toggles (shared by New expedition and Campaign). */
function ModeSettings({ settings, setSettings }: { settings: Settings; setSettings: (s: Settings) => void }) {
  return (
    <>
          <p className="muted" style={{ margin: '4px 0 0', fontSize: 13 }}>
            Pick a mode. The physics is the same in all of them — only the spare fuel, spare air and help change.
          </p>
          <div className="mode-pick" role="radiogroup" aria-label="Mode">
            {MODE_ORDER.map((id, i) => (
              <button
                key={id}
                role="radio"
                aria-checked={settings.difficulty === id}
                className={`mode-chip ${settings.difficulty === id ? 'on' : ''}`}
                onClick={() =>
                  setSettings({
                    ...settings,
                    difficulty: id,
                    formulas: MODES[id].formulas,
                    survival: MODES[id].survivalForced ? true : MODES[settings.difficulty].survivalForced ? false : settings.survival,
                  })
                }
              >
                <span className="mode-pips" aria-hidden>
                  {MODE_ORDER.map((_, k) => (
                    <i key={k} className={k <= i ? 'on' : ''} />
                  ))}
                </span>
                {MODES[id].name}
              </button>
            ))}
          </div>
          {(() => {
            const m = MODES[settings.difficulty];
            return (
              <div className="mode-detail">
                <b>
                  {m.name} <em>{m.tag}</em>
                </b>
                <span className="diff-for">{m.forWho}</span>
                <ul>
                  {m.expect.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            );
          })()}
          <Toggle
            on={settings.survival}
            onChange={(v) => !MODES[settings.difficulty].survivalForced && setSettings({ ...settings, survival: v })}
            label="Survival mode"
            sub={
              MODES[settings.difficulty].survivalForced
                ? 'Always on in Legend.'
                : 'Manage oxygen, food and power. Weather can cloud the sky. Salvage the wreck to upgrade your tools.'
            }
          />
          <Toggle
            on={settings.formulas}
            onChange={(v) => !MODES[settings.difficulty].formulasLocked && setSettings({ ...settings, formulas: v })}
            label="Formula sheet"
            sub={
              MODES[settings.difficulty].formulasLocked
                ? 'Not available in Legend.'
                : 'Show the formula behind every step. Each mode picks a default; you can change it here or during play.'
            }
          />
          <Toggle on={settings.sound} onChange={(v) => setSettings({ ...settings, sound: v })} label="Sound" />
    </>
  );
}

/** Chapters in order; each opens when the previous one is completed. Lessons are optional. */
function CampaignModal({ settings, setSettings, onClose }: { settings: Settings; setSettings: (s: Settings) => void; onClose: () => void }) {
  const s = useGame();
  const [pick, setPick] = useState<number | null>(null);
  const [lesson, setLesson] = useState<LessonId | null>(null);
  const ch = pick !== null ? chapterOf(pick) : null;
  return (
    <Modal onClose={onClose}>
      {!ch ? (
        <>
          <h2>Campaign</h2>
          <p className="muted" style={{ margin: '2px 0 10px', fontSize: 13 }}>
            Follow the Halcyon’s trail home. Each chapter is a new star system that needs one new idea.
          </p>
          <div className="stack" style={{ gap: 8 }}>
            {CHAPTERS.map((c) => {
              const open = c.ready && chapterUnlocked(s, c.n);
              const prog = s.campaign[c.n];
              const best = prog ? Object.entries(prog.best).map(([m, b]) => `${MODES[m as keyof typeof MODES]?.name ?? m} ${b!.grade}`).join(' · ') : '';
              return (
                <button key={c.n} className={`panel panel-pad chapter-row ${open ? '' : 'locked'}`} disabled={!open} onClick={() => setPick(c.n)}>
                  <span className="chapter-n">{c.n}</span>
                  <span style={{ flex: 1, textAlign: 'left' }}>
                    <b>{c.title}</b>
                    <span className="muted" style={{ display: 'block', fontSize: 12 }}>
                      {c.ready ? c.idea : 'In development'}
                    </span>
                    {best && <span className="faint" style={{ display: 'block', fontSize: 11 }}>Best: {best}</span>}
                  </span>
                  <span style={{ fontSize: 18 }}>{prog?.done ? '✓' : open ? '▶' : '🔒'}</span>
                </button>
              );
            })}
          </div>
        </>
      ) : (
        <>
          <button className="btn small ghost" onClick={() => setPick(null)}>
            ← Chapters
          </button>
          <div className="meter-label" style={{ marginTop: 8 }}>
            Chapter {ch.n}
          </div>
          <h2>{ch.title}</h2>
          <div className="stack" style={{ gap: 6, margin: '6px 0 10px' }}>
            <div style={{ fontSize: 14 }}>
              <b>New idea:</b> {ch.idea}
            </div>
            <div className="muted" style={{ fontSize: 13 }}>
              <b>The catch:</b> {ch.twist}
            </div>
          </div>
          {ch.lessons.length > 0 && (
            <div className="callout tip" style={{ margin: '0 0 10px' }}>
              <b>Optional training</b>
              <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {ch.lessons.map((l) => (
                  <button key={l} className="btn small" onClick={() => setLesson(l)}>
                    {LESSONS[l].icon} {LESSONS[l].title}
                    {s.tutorial.lessons.includes(l) ? ' ✓' : ''}
                  </button>
                ))}
              </div>
              <div className="faint" style={{ fontSize: 12, marginTop: 6 }}>A few minutes. Skip it if you like — it stays in the Codex.</div>
            </div>
          )}
          <ModeSettings settings={settings} setSettings={setSettings} />
          <div className="row" style={{ justifyContent: 'flex-end', marginTop: 14 }}>
            <button className="btn primary big" onClick={() => useGame.getState().newGame(randomSeed(), settings, ch.n)}>
              Start chapter {ch.n}
            </button>
          </div>
          {lesson && <LessonModal id={lesson} onClose={() => setLesson(null)} />}
        </>
      )}
    </Modal>
  );
}
