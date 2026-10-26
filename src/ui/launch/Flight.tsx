import { useRef, useState } from 'react';
import { DAY } from '../../engine/constants';
import { planetPos } from '../../engine/ephemeris';
import { mulberry32 } from '../../engine/rng';
import type { Vec3 } from '../../engine/vec';
import { fmt } from '../../game/format';
import { currentWorld } from '../../game/sim';
import { useGame } from '../../game/store';
import { CanvasView } from '../common/CanvasView';

const DURATION = 14; // seconds of animation

export function Flight() {
  const outcome = useGame((s) => s.outcome);
  const { system: sys } = currentWorld();
  const prog = useRef(0);
  const [stage, setStage] = useState(0);
  if (!outcome) return null;
  const { plan, result } = outcome;
  const path = (result.path ?? []).filter((v) => v && Number.isFinite(v[0]) && Number.isFinite(v[1]));
  const noEscape = result.outcome === 'no-escape';

  const stages = noEscape
    ? ['Ignition…', 'The engines strain — we cannot reach escape speed.', 'Abort. We fall back to the surface.']
    : [
        `Ignition. Burning ${fmt(result.departCost / 1000, 2)} km/s to escape.`,
        'Coasting. Cryo-pods engaged.',
        `Mid-course: ECHO sights the blue planet and corrects course — ${fmt(result.correctionCost, 0)} m/s.`,
        result.outcome === 'lost' ? 'Not enough fuel to correct. We drift past the blue planet’s orbit…' : `Arrival. Braking ${fmt(result.captureCost / 1000, 2)} km/s into orbit…`,
        result.outcome === 'success' ? 'Orbit achieved. Heat shield armed for landing.' : result.outcome === 'flyby' ? 'The tanks run dry mid-burn. We fly past.' : 'Lost in space.',
      ];

  return (
    <div className="screen">
      <CanvasView
        draw={({ ctx, w, h, dpr, dt }) => {
          prog.current = Math.max(0, Math.min(1, prog.current + dt / DURATION));
          const p = prog.current;
          const st = Math.min(stages.length - 1, Math.floor(p * stages.length * 1.02));
          if (st !== stage) setStage(st);
          ctx.fillStyle = '#03050b';
          ctx.fillRect(0, 0, w, h);
          // Background stars.
          const rnd = mulberry32(7);
          for (let i = 0; i < 260; i++) {
            const x = rnd();
            const y = rnd();
            ctx.fillStyle = `rgba(255,255,255,${0.15 + rnd() * 0.6})`;
            ctx.fillRect(x * w, y * h, dpr, dpr);
          }
          const cx = w / 2;
          const cy = h / 2;
          const S = (Math.min(w, h) * 0.42) / (sys.target.a * 1.15);
          const X = (v: Vec3) => cx + v[0] * S;
          const Y = (v: Vec3) => cy - v[1] * S;
          for (const [a, c] of [
            [sys.home.a, 'rgba(255,190,120,0.3)'],
            [sys.target.a, 'rgba(108,196,255,0.3)'],
          ] as const) {
            ctx.strokeStyle = c;
            ctx.lineWidth = dpr;
            ctx.beginPath();
            ctx.arc(cx, cy, a * S, 0, Math.PI * 2);
            ctx.stroke();
          }
          const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 30 * dpr);
          sg.addColorStop(0, '#fff6dc');
          sg.addColorStop(1, 'rgba(255,200,110,0)');
          ctx.fillStyle = sg;
          ctx.fillRect(cx - 30 * dpr, cy - 30 * dpr, 60 * dpr, 60 * dpr);
          const tNow = plan.departTime + plan.tof * (noEscape ? 0 : p);
          const dot = (v: Vec3, c: string, r: number) => {
            ctx.fillStyle = c;
            ctx.beginPath();
            ctx.arc(X(v), Y(v), r * dpr, 0, Math.PI * 2);
            ctx.fill();
          };
          dot(planetPos(sys.home, tNow), '#ffb26b', 6);
          dot(planetPos(sys.target, tNow), '#6cc4ff', 7);
          if (path.length) {
            const n = Math.min(path.length - 1, Math.floor(p * (path.length - 1)));
            ctx.strokeStyle = '#ffc46b';
            ctx.lineWidth = 2 * dpr;
            ctx.beginPath();
            for (let i = 0; i <= n; i++) (i ? ctx.lineTo(X(path[i]), Y(path[i])) : ctx.moveTo(X(path[i]), Y(path[i])));
            ctx.stroke();
            const ship = path[n];
            const glow = ctx.createRadialGradient(X(ship), Y(ship), 0, X(ship), Y(ship), 12 * dpr);
            glow.addColorStop(0, 'rgba(255,255,255,1)');
            glow.addColorStop(1, 'rgba(255,200,120,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(X(ship) - 12 * dpr, Y(ship) - 12 * dpr, 24 * dpr, 24 * dpr);
          }
          ctx.fillStyle = 'rgba(200,215,240,0.8)';
          ctx.font = `${12 * dpr}px JetBrains Mono`;
          ctx.textAlign = 'left';
          ctx.fillText(`mission day ${fmt(tNow / DAY, 0)}`, 16 * dpr, h - 20 * dpr);
        }}
      />
      <div className="echo panel panel-pad" style={{ bottom: 'calc(30px + var(--safe-bottom))' }}>
        <div className="avatar" />
        <div style={{ flex: 1 }}>
          <div className="name">ECHO</div>
          <div className="text">{stages[stage]}</div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn small" onClick={() => (prog.current = 1)}>
              Skip
            </button>
            <button className="btn small primary" disabled={stage < stages.length - 1 && prog.current < 1} onClick={() => useGame.setState({ phase: 'results' })}>
              Debrief →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
