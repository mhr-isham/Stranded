// End-of-act card: a save point with what you learned and a hook into the
// next act. Continue goes straight on; nothing forces a stop.

import { useEffect, useState } from 'react';
import { ACTS, completedActs } from '../game/acts';
import { sfx } from '../game/audio';
import { clock } from '../game/clock';
import { useGame } from '../game/store';

const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V'];

export function ActCard() {
  const s = useGame();
  const [showLearned, setShowLearned] = useState(false);
  const pending = completedActs(s).find((n) => !s.actsSeen.includes(n));
  const act = pending ? ACTS.find((a) => a.n === pending)! : null;
  const next = act ? ACTS.find((a) => a.n === act.n + 1) : null;

  useEffect(() => {
    if (!act) return;
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

  if (!act || s.tutorial.active) return null;
  const seen = () => useGame.setState({ actsSeen: [...s.actsSeen, act.n] });
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
