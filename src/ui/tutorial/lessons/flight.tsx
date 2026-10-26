import { useState } from 'react';
import { ArrowDefs, Demo, LessonShell, P, Slider, fmtN, useAnimTime } from './common';

const TAU = Math.PI * 2;

/** The Hohmann transfer and the launch window. */
export function HohmannLesson() {
  const [lead, setLead] = useState(30);
  const [launched, setLaunched] = useState(0);
  const t = useAnimTime();
  const r1 = 1;
  const r2 = 1.75;
  const P2 = Math.pow(r2, 1.5);
  const tof = 0.5 * Math.pow((r1 + r2) / 2, 1.5);
  const phi = 180 - (360 * tof) / P2;
  const S = 78;
  const cx = 200;
  const cy = 150;
  const k = (frac: number) => Math.min(1, Math.max(0, frac));
  const prog = launched ? k((t - launched) / 4) : 0;
  const tt = prog * tof;
  // Ship on the half ellipse: perihelion at angle 0 (r1), aphelion at pi (r2).
  const a = (r1 + r2) / 2;
  const e = (r2 - r1) / (r2 + r1);
  const meanAnom = Math.PI * prog;
  let E = meanAnom;
  for (let i = 0; i < 20; i++) E = E - (E - e * Math.sin(E) - meanAnom) / (1 - e * Math.cos(E));
  const nu = 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
  const rr = (a * (1 - e * e)) / (1 + e * Math.cos(nu));
  const ship = [cx + rr * S * Math.cos(nu), cy - rr * S * Math.sin(nu)];
  const p2ang = (lead * Math.PI) / 180 + (TAU * tt) / P2;
  const p2 = [cx + r2 * S * Math.cos(p2ang), cy - r2 * S * Math.sin(p2ang)];
  const p1ang = TAU * tt;
  const p1 = [cx + r1 * S * Math.cos(p1ang), cy - r1 * S * Math.sin(p1ang)];
  const missDeg = ((p2ang * 180) / Math.PI - 180 + 540) % 360 - 180;
  const ellipse = Array.from({ length: 61 }, (_, i) => {
    const n = (Math.PI * i) / 60;
    const r = (a * (1 - e * e)) / (1 + e * Math.cos(n));
    return `${cx + r * S * Math.cos(n)},${cy - r * S * Math.sin(n)}`;
  }).join(' ');
  return (
    <LessonShell
      kicker="Lesson 14 · Launch"
      title="The Hohmann transfer and the launch window"
      demo={
        <Demo>
          <svg viewBox="0 0 400 300">
            <ArrowDefs />
            <circle cx={cx} cy={cy} r={r1 * S} fill="none" stroke="rgba(255,190,120,0.4)" />
            <circle cx={cx} cy={cy} r={r2 * S} fill="none" stroke="rgba(108,196,255,0.4)" />
            <polyline points={ellipse} fill="none" stroke="#ffc46b" strokeDasharray="6 5" />
            <circle cx={cx} cy={cy} r={10} fill="#ffd28a" />
            {!launched && (
              <>
                <path d={`M ${cx + 50} ${cy} A 50 50 0 0 0 ${cx + 50 * Math.cos((lead * Math.PI) / 180)} ${cy - 50 * Math.sin((lead * Math.PI) / 180)}`} fill="none" stroke="#6cc4ff" strokeWidth={2} />
                <text x={cx + 56} y={cy - 12} fill="#6cc4ff" fontSize={12}>
                  lead {lead}°
                </text>
                <line x1={cx} y1={cy} x2={cx + r2 * S * Math.cos((phi * Math.PI) / 180)} y2={cy - r2 * S * Math.sin((phi * Math.PI) / 180)} stroke="#5be3a4" strokeDasharray="3 4" />
                <text x={cx + (r2 * S + 6) * Math.cos((phi * Math.PI) / 180)} y={cy - (r2 * S + 6) * Math.sin((phi * Math.PI) / 180)} fill="#5be3a4" fontSize={11}>
                  ideal φ
                </text>
              </>
            )}
            <circle cx={p1[0]} cy={p1[1]} r={7} fill="#ffb26b" />
            <circle cx={p2[0]} cy={p2[1]} r={8} fill="#6cc4ff" />
            {launched > 0 && <circle cx={ship[0]} cy={ship[1]} r={4} fill="#fff" />}
            <line x1={cx + r1 * S} y1={cy + 6} x2={cx + r1 * S} y2={cy - 34} stroke="#ff6b7d" strokeWidth={2} markerEnd="url(#arrow-red)" />
            <text x={cx + r1 * S + 6} y={cy - 30} fill="#ff6b7d" fontSize={11}>
              burn 1
            </text>
            <text x={10} y={290} fill={prog >= 1 ? (Math.abs(missDeg) < 3 ? '#5be3a4' : '#ff6b7d') : '#93a2c3'} fontSize={13} fontWeight={700}>
              {prog >= 1 ? (Math.abs(missDeg) < 3 ? '✓ Rendezvous! The planet arrived with you.' : `✗ Missed: the planet is ${fmtN(Math.abs(missDeg), 0)}° ${missDeg > 0 ? 'ahead' : 'behind'}`) : launched ? 'Coasting…' : 'Set the lead angle, then launch'}
            </text>
          </svg>
          <Slider label="Blue planet’s lead angle at launch" value={lead} min={0} max={120} step={1} onChange={(v) => (setLead(v), setLaunched(0))} fmt={(v) => `${v}°`} />
          <div className="row">
            <button className="btn primary small" onClick={() => setLaunched(t)}>
              🚀 Launch
            </button>
            <button className="btn small" onClick={() => (setLead(Math.round(phi)), setLaunched(0))}>
              Set the ideal angle ({fmtN(phi, 0)}°)
            </button>
          </div>
        </Demo>
      }
      formula={
        <>
          transfer time t = π √((a₁ + a₂)³ / (8 G M★))<br />
          lead angle φ = 180° − 360° · t / P₂
        </>
      }
      keyIdea="The cheapest route between two circular orbits is half an ellipse that just touches both: a Hohmann transfer. Burn once to stretch your orbit out to the blue planet’s, coast for half an orbit, then brake."
      warn="It only works if the blue planet arrives at the meeting point when you do — so at launch it must lead you by the angle φ. That geometry repeats only once per synodic period: that is the launch window. Leaving at another time needs a faster, more expensive orbit."
      tip="In the launch planner the cost map shows the window as a cool green patch. The planner computes φ and the window date from your own numbers — if they’re wrong, the window is wrong too."
    >
      <P>
        You can’t just point at the blue planet and fire: it is moving, and so are you. You aim at where it <b>will be</b> when you arrive.
      </P>
      <P>Try launching with a random lead angle, then with the ideal one.</P>
    </LessonShell>
  );
}
