import { useState } from 'react';
import { activeMission, missionsFor } from '../game/missions';
import { useMode } from '../game/modes';
import { currentAct } from '../game/acts';
import { useGame } from '../game/store';

export function MissionPanel() {
  const s = useGame();
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 860);
  const mode = useMode();
  const MISSIONS = missionsFor(s);
  const cur = activeMission(s);
  if (mode.missions === 'off') return null;
  const coach = mode.missions === 'coach';
  const curIdx = cur ? MISSIONS.indexOf(cur) : -1;
  return (
    <div className={`missions panel panel-pad ${collapsed ? 'collapsed' : ''}`}>
      <div className="row between" onClick={() => setCollapsed(!collapsed)} style={{ cursor: 'pointer' }}>
        <span className="meter-label">
          Act {currentAct(s).n} · {currentAct(s).name} — mission {Math.min(MISSIONS.length, s.missionsDone.length + 1)}/{MISSIONS.length}
        </span>
        <span className="muted" style={{ fontSize: 12 }}>
          {collapsed ? '▼ show' : '▲ hide'}
        </span>
      </div>
      {cur ? (
        <div className="mission-active" onClick={() => cur.screen && s.go(cur.screen)} style={{ cursor: 'pointer' }}>
          <h3>{cur.title}</h3>
          <div style={{ fontSize: 14 }}>{coach ? cur.goal : cur.short}</div>
          {coach && (
            <div className="mission-why hint" style={{ marginTop: 8 }}>
              {cur.why}
            </div>
          )}
        </div>
      ) : (
        <div className="mission-active">
          <h3>Ready to launch</h3>
          <div style={{ fontSize: 14 }}>Open the launch planner and choose your moment.</div>
        </div>
      )}
      <ul className="mission-list">
        {MISSIONS.map((m, i) => {
          const done = s.missionsDone.includes(m.id) || m.done(s);
          // Coach mode keeps the list short: what's done, now, and next.
          if (coach && !done && curIdx >= 0 && i > curIdx + 1) return null;
          return (
            <li key={m.id} className={done ? 'done' : m === cur ? 'current' : ''} onClick={() => m.screen && s.go(m.screen)}>
              <span className="dot" />
              {m.title}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
