// End-of-act card: a save point with what you learned and a hook into the
// next act. Continue goes straight on; nothing forces a stop.

import { useEffect, useState } from 'react';
import { actsFor, completedActs } from '../game/acts';
import { sfx } from '../game/audio';
import { clock } from '../game/clock';
import { useGame } from '../game/store';
import { unlockLog } from '../game/story';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

export function ActCard() {
  const s = useGame();
  const [showLearned, setShowLearned] = useState(false);
  const pending = completedActs(s).find((n) => !s.actsSeen.includes(n));
  const acts = actsFor(s.chapter);
  const act = pending ? acts.find((a) => a.n === pending)! : null;
  const next = act ? acts.find((a) => a.n === act.n + 1) : null;

  useEffect(() => {
    // No act cards (and so no pause) in Flight School or Free Roam.
    if (!act || s.tutorial.active || s.settings.freeRoam) return;
    const wasPaused = clock.paused;
    clock.paused = true;
    clock.emit();
    sfx('unlock');
    useGame.setState({ savedT: clock.t });
    return () => {
      clock.paused = wasPaused;
      clock.emit();
    };
  }, [act?.n]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!act || s.tutorial.active || s.settings.freeRoam) return null;
  const seen = () => {
    useGame.setState({ actsSeen: [...s.actsSeen, act.n] });
    // Midway through the chapter, ECHO risks a thaw to check the Commander.
    if (act.n === 3) unlockLog('vale1');
  };
  return (
    <div className="modal-back">
      <div className="modal panel act-card">
        <div className="meter-label">
          Act {ROMAN[act.n]} complete · progress saved
        </div>
        <h2>{act.name}</h2>
        <p className="act-hook">“{act.hook}”</p>
        <button className="btn small ghost" onClick={() => setShowLearned(!showLearned)}>
          {showLearned ? '▲ Hide' : '▼ What you learned'}
        </button>
        {showLearned && (
          <ul className="act-learned">
            {act.learned.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        )}
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 14 }}>
          <button
            className="btn ghost"
            onClick={() => {
              seen();
              useGame.setState({ phase: 'title', savedT: clock.t });
            }}
          >
            Save & quit
          </button>
          <button className="btn primary" onClick={seen}>
            {next ? `Continue · Act ${ROMAN[next.n]}: ${next.name}` : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
