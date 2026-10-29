import { useEffect, useRef, useState } from 'react';
import { DAY } from '../../engine/constants';
import { planetPos, planetVel } from '../../engine/ephemeris';
import { G } from '../../engine/constants';
import { variantOf } from '../../engine/chapters';
import { modelFromPrimaries, systemFromModel } from '../../engine/planner';
import { propagate } from '../../engine/orbits';
import { add, scale, unit } from '../../engine/vec';
import type { StarSystem } from '../../engine/types';
import { mulberry32 } from '../../engine/rng';
import type { Vec3 } from '../../engine/vec';
import { fmt } from '../../game/format';
import { currentWorld } from '../../game/sim';
import { useGame } from '../../game/store';
import { CanvasView } from '../common/CanvasView';
import { setRumble, sfx, stopRumble } from '../../game/audio';

const DURATION = 14; // seconds of animation

export function Flight() {
  const outcome = useGame((s) => s.outcome);
  const { system: sys } = currentWorld();
  const prog = useRef(0);
  const modelPath = useRef<Vec3[] | null>(null);
  const tutorial = useGame((s) => s.tutorial.active);
  const arrivalDone = useGame((s) => !!s.arrival);
  const [stage, setStage] = useState(0);
  useEffect(() => {
    if (!outcome) return;
    const burning = stage === 0 || (outcome.result.outcome !== 'no-escape' && (stage === 2 || stage === 3));
    setRumble(burning ? (stage === 0 ? 0.75 : 0.45) : 0, 0.35);
    if (stage === 2 && outcome.result.outcome !== 'no-escape') sfx('radio');
    return stopRumble;
  }, [stage, outcome]);
  if (!outcome) return null;
  const { plan, result } = outcome;
  const path = (result.path ?? []).filter((v) => v && Number.isFinite(v[0]) && Number.isFinite(v[1]));
  // Where the player's own numbers said the ship would go (no correction burn).
  const predicted = modelPath.current ?? (modelPath.current = predictedPath(outcome, sys));
  const noEscape = result.outcome === 'no-escape';

  const stages = noEscape
    ? ['Ignition…', 'The engines strain — we cannot reach escape speed.', 'Abort. We fall back to the surface.']
    : [
        `Ignition. Burning ${fmt(result.departCost / 1000, 2)} km/s to escape.`,
        'Coasting. Cryo-pods engaged.',
        outcome.plan.flyby
          ? `Slingshot: we swing past the giant ${fmt(outcome.plan.flyby.rp / 1e6, 0)} thousand km from its centre. ECHO’s corrections before and after: ${fmt(result.correctionCost, 0)} m/s.`
          : `Mid-course: ECHO sights the blue planet and corrects course — ${fmt(result.correctionCost, 0)} m/s.`,
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
          const S = (Math.min(w, h) * 0.42) / (Math.max(sys.home.a, sys.target.a * (1 + (sys.target.e ?? 0))) * 1.15);
          const X = (v: Vec3) => cx + v[0] * S;
          const Y = (v: Vec3) => cy - v[1] * S;
          for (const [pl, c] of [
            [sys.home, 'rgba(255,190,120,0.3)'],
            [sys.target, 'rgba(108,196,255,0.3)'],
            ...(sys.giant ? ([[sys.giant, 'rgba(255,230,184,0.3)']] as const) : []),
          ] as const) {
            ctx.strokeStyle = c;
            ctx.lineWidth = dpr;
            ctx.beginPath();
            for (let i = 0; i <= 120; i++) {
              const v = planetPos(pl, (pl.period * i) / 120);
              if (i) ctx.lineTo(X(v), Y(v));
              else ctx.moveTo(X(v), Y(v));
            }
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
          if (sys.giant) dot(planetPos(sys.giant, tNow), '#ffe6b8', 9);
          if (predicted.length > 1) {
            ctx.strokeStyle = 'rgba(181,156,255,0.55)';
            ctx.setLineDash([5 * dpr, 5 * dpr]);
            ctx.lineWidth = 1.5 * dpr;
            ctx.beginPath();
            predicted.forEach((v, i) => (i ? ctx.lineTo(X(v), Y(v)) : ctx.moveTo(X(v), Y(v))));
            ctx.stroke();
            ctx.setLineDash([]);
          }
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
          ctx.fillStyle = 'rgba(181,156,255,0.85)';
          if (predicted.length) ctx.fillText('- - your numbers’ path (no correction)', 16 * dpr, 28 * dpr);
          ctx.fillStyle = '#ffc46b';
          ctx.fillText('—— the real path, with ECHO’s mid-course correction', 16 * dpr, 46 * dpr);
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
            {result.outcome === 'success' && !tutorial && !arrivalDone ? (
              <button className="btn small primary" disabled={stage < stages.length - 1 && prog.current < 1} onClick={() => useGame.setState({ phase: 'landing' })}>
                Land at the beacon →
              </button>
            ) : (
              <button className="btn small primary" disabled={stage < stages.length - 1 && prog.current < 1} onClick={() => useGame.setState({ phase: 'results' })}>
                Debrief →
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** The coast your own model predicts for this plan, drawn in the real system's frame. */
function predictedPath(outcome: NonNullable<ReturnType<typeof useGame.getState>['outcome']>, sys: StarSystem): Vec3[] {
  // A slingshot's path depends on the flyby: the single-coast comparison would mislead.
  if (outcome.plan.flyby) return [];
  const variant = variantOf(sys.features);
  const m = modelFromPrimaries(outcome.sheet, variant);
  if (!m) return [];
  const msys = systemFromModel(m, sys);
  const t0 = outcome.plan.departTime;
  const r1 = planetPos(sys.home, t0);
  const v1 = planetVel(sys.home, t0);
  const vInf = add(scale(unit(r1), outcome.plan.vInfRadial), scale(unit(v1), outcome.plan.vInfPrograde));
  const mu = G * msys.star.mass;
  const out: Vec3[] = [];
  for (let i = 0; i <= 60; i++) out.push(propagate(r1, add(v1, vInf), (outcome.plan.tof * i) / 60, mu)[0]);
  return out;
}
