import { CODEX } from '../game/codex';
import { ACHIEVEMENTS } from '../game/achievements';
import { useGame } from '../game/store';

export function Codex() {
  const s = useGame();
  return (
    <div className="screen scroll" style={{ background: 'radial-gradient(ellipse at 30% 20%, #142040 0%, #05070f 65%)', zIndex: 5 }}>
      <div style={{ maxWidth: 980, margin: '0 auto', padding: 'calc(76px + var(--safe-top)) 14px 100px' }} className="stack">
        <h1 style={{ fontSize: 28 }}>Codex</h1>
        <div className="muted">Every method you use was discovered by someone first. Complete missions to unlock their stories.</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
          {CODEX.map((c) => {
            const open = s.codex.includes(c.id);
            return (
              <div key={c.id} className="panel panel-pad" style={{ opacity: open ? 1 : 0.5 }}>
                <div className="meter-label">{open ? c.year : 'locked'}</div>
                <h3 style={{ fontSize: 17, margin: '4px 0 6px' }}>{open ? c.title : '???'}</h3>
                <div className="muted" style={{ fontSize: 13 }}>{open ? c.text : 'Keep exploring to unlock this story.'}</div>
              </div>
            );
          })}
        </div>
        <h2 style={{ fontSize: 22, marginTop: 16 }}>Achievements</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
          {Object.entries(ACHIEVEMENTS).map(([id, a]) => {
            const got = s.achievements.includes(id);
            return (
              <div key={id} className="panel panel-pad row" style={{ opacity: got ? 1 : 0.45, gap: 12 }}>
                <span style={{ fontSize: 26 }}>{got ? a.icon : '🔒'}</span>
                <div>
                  <b>{a.name}</b>
                  <div className="muted" style={{ fontSize: 12 }}>{a.text}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
