import { useState } from 'react';
import { MISSIONS, activeMission } from '../game/missions';
import { useGame } from '../game/store';

export function MissionPanel() {
  const s = useGame();
  const [collapsed, setCollapsed] = useState(() => window.innerWidth < 860);
  const cur = activeMission(s);
  return (
    <div className={`missions panel panel-pad ${collapsed ? 'collapsed' : ''}`}>
      <div className="row between" onClick={() => setCollapsed(!collapsed)} style={{ cursor: 'pointer' }}>
        <span className="meter-label">
          Mission {Math.min(MISSIONS.length, s.missionsDone.length + 1)} / {MISSIONS.length}
        </span>
        <span className="muted" style={{ fontSize: 12 }}>
          {collapsed ? '▼ show' : '▲ hide'}
        </span>
      </div>
      {cur ? (
        <div className="mission-active" onClick={() => cur.screen && s.go(cur.screen)} style={{ cursor: 'pointer' }}>
          <h3>{cur.title}</h3>
          <div style={{ fontSize: 14 }}>{cur.goal}</div>
          <div className="mission-why hint" style={{ marginTop: 8 }}>
            {cur.why}
          </div>
        </div>
      ) : (
        <div className="mission-active">
          <h3>Ready to launch</h3>
          <div style={{ fontSize: 14 }}>Open the launch planner and choose your moment.</div>
        </div>
      )}
      <ul className="mission-list">
        {MISSIONS.map((m) => {
          const done = s.missionsDone.includes(m.id) || m.done(s);
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
