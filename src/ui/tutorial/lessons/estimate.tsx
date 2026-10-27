import { useRef, useState } from 'react';
import { ArrowDefs, Demo, LessonShell, Note, P, Slider, fmtN } from './common';

type Move = 'line' | 'ratio' | 'bracket';

const MOVES: { id: Move; label: string }[] = [
  { id: 'line', label: '1 · Extend the line' },
  { id: 'ratio', label: '2 · Use a ratio' },
  { id: 'bracket', label: '3 · Bracket it' },
];

// Fixed "readings" with a little scatter, so the demo is the same every time.
const DATA = [2, 5, 9, 12, 16, 19, 23].map((x, i) => ({ x, y: 10 + 1.5 * x + [0.6, -0.8, 0.3, -0.5, 0.9, -0.4, 0.2][i] }));
const FUTURE = 40;
const TRUE_AT_FUTURE = 10 + 1.5 * FUTURE;

/** Three ways to turn your own data into an honest guess, instead of a random one. */
export function EstimateLesson() {
  const [move, setMove] = useState<Move>('line');
  return (
    <LessonShell
      kicker="Skill · Predictions"
      title="Making a good estimate"
      demo={
        <Demo h={330}>
          <div className="row" style={{ gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {MOVES.map((m) => (
              <button key={m.id} className={`btn small ${move === m.id ? 'primary' : ''}`} onClick={() => setMove(m.id)}>
                {m.label}
              </button>
            ))}
          </div>
          {move === 'line' && <LineDemo />}
          {move === 'ratio' && <RatioDemo />}
          {move === 'bracket' && <BracketDemo />}
        </Demo>
      }
      keyIdea="A prediction is a measurement of the future. Start from your own readings, use one of the three moves, and give a ± range that says how sure you really are."
      tip="Make the range about as wide as the scatter of your readings, then a bit wider the further ahead you predict. Small errors in a rate add up over time."
      warn="A random guess with a huge range earns almost nothing, and a confident guess that misses loses points. The only way to score well is to reason from your data."
    >
      <P>
        Astronomers have always predicted the sky: eclipses, oppositions, the return of a comet. They didn’t guess — they reasoned from what they had
        already measured. You can do the same with three simple moves.
      </P>
      <P>
        <b>Extend the line:</b> if something changes at a steady rate (like the star’s drift), draw the best straight line through your readings and
        read it off further along.
      </P>
      <P>
        <b>Use a ratio:</b> if you know how two things scale (a swing time grows with the square root of the length), you can scale a value you
        measured instead of starting again.
      </P>
      <P>
        <b>Bracket it:</b> find the earliest and latest it could possibly be, for reasons you can explain. The answer lies between — often near the
        middle, especially when the motion is symmetric (like a retrograde loop).
      </P>
    </LessonShell>
  );
}

/** Drag the two ends of a ruler through the points, then read it at the future day. */
function LineDemo() {
  const [a, setA] = useState(14); // ruler y at x=0
  const [b, setB] = useState(60); // ruler y at x=FUTURE
  const svg = useRef<SVGSVGElement>(null);
  const drag = useRef<0 | 1 | 2>(0);
  const W = 560;
  const H = 230;
  const X = (x: number) => 40 + (x / 44) * (W - 60);
  const Y = (y: number) => H - 30 - ((y - 0) / 90) * (H - 50);
  const fromY = (e: React.PointerEvent) => {
    const r = svg.current!.getBoundingClientRect();
    const py = ((e.clientY - r.top) / r.height) * H;
    return Math.max(0, Math.min(90, ((H - 30 - py) / (H - 50)) * 90));
  };
  const rulerAtFuture = b;
  const off = rulerAtFuture - TRUE_AT_FUTURE;
  return (
    <>
      <svg
        ref={svg}
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', touchAction: 'none' }}
        onPointerMove={(e) => {
          if (drag.current === 1) setA(fromY(e));
          if (drag.current === 2) setB(fromY(e));
        }}
        onPointerUp={() => (drag.current = 0)}
        onPointerLeave={() => (drag.current = 0)}
      >
        <ArrowDefs />
        <rect x={X(24)} y={20} width={X(44) - X(24)} height={H - 50} fill="rgba(108,196,255,0.06)" />
        <text x={X(25)} y={34} fill="#6cc4ff" fontSize={11}>
          future
        </text>
        <line x1={X(0)} x2={X(44)} y1={H - 30} y2={H - 30} stroke="rgba(255,255,255,0.2)" />
        <text x={X(44)} y={H - 12} fill="#93a2c3" fontSize={11} textAnchor="end">
          day
        </text>
        {DATA.map((p) => (
          <circle key={p.x} cx={X(p.x)} cy={Y(p.y)} r={4} fill="#ffc46b" />
        ))}
        <line x1={X(0)} y1={Y(a)} x2={X(FUTURE)} y2={Y(b)} stroke="#6cc4ff" strokeWidth={2} />
        <line x1={X(FUTURE)} x2={X(FUTURE)} y1={20} y2={H - 30} stroke="rgba(255,196,107,0.4)" strokeDasharray="3 3" />
        <text x={X(FUTURE)} y={H - 12} fill="#ffc46b" fontSize={11} textAnchor="middle">
          day {FUTURE}?
        </text>
        <circle cx={X(0)} cy={Y(a)} r={10} fill="rgba(108,196,255,0.35)" stroke="#6cc4ff" onPointerDown={() => (drag.current = 1)} style={{ cursor: 'ns-resize' }} />
        <circle cx={X(FUTURE)} cy={Y(b)} r={10} fill="rgba(108,196,255,0.35)" stroke="#6cc4ff" onPointerDown={() => (drag.current = 2)} style={{ cursor: 'ns-resize' }} />
      </svg>
      <div className="row between" style={{ fontSize: 13 }}>
        <span>
          Your line says: <b className="blue">{fmtN(rulerAtFuture, 1)}</b>
        </span>
        <span className={Math.abs(off) < 2 ? 'green' : Math.abs(off) < 5 ? 'amber' : 'red'}>
          {Math.abs(off) < 2 ? 'Spot on — the line follows the readings.' : `Off by ${fmtN(Math.abs(off), 1)}: line it up with the dots.`}
        </span>
      </div>
      <Note>Drag the two blue handles so the line runs through the middle of the dots, then read it at day {FUTURE}.</Note>
    </>
  );
}

/** Scale a measured swing time with the square-root rule. */
function RatioDemo() {
  const [k, setK] = useState(4);
  const [guess, setGuess] = useState(2.0);
  const T1 = 2.0;
  const truth = T1 * Math.sqrt(k);
  return (
    <>
      <svg viewBox="0 0 560 170" style={{ width: '100%' }}>
        <line x1={150} y1={10} x2={150} y2={10 + 30} stroke="#e8eefc" strokeWidth={2} />
        <circle cx={150} cy={44} r={8} fill="#ffc46b" />
        <text x={150} y={80} fill="#93a2c3" fontSize={12} textAnchor="middle">
          length L · swing {fmtN(T1, 1)} s (measured)
        </text>
        <line x1={380} y1={10} x2={380} y2={10 + Math.min(130, 30 * k)} stroke="#e8eefc" strokeWidth={2} />
        <circle cx={380} cy={14 + Math.min(130, 30 * k)} r={8} fill="#6cc4ff" />
        <text x={470} y={60} fill="#93a2c3" fontSize={12} textAnchor="middle">
          length {k}L
        </text>
        <text x={470} y={78} fill="#93a2c3" fontSize={12} textAnchor="middle">
          swing = ?
        </text>
      </svg>
      <Slider label="New length" value={k} min={1} max={9} step={1} onChange={setK} fmt={(v) => `${v} × L`} />
      <Slider label="Your guess for one swing" value={guess} min={1} max={8} step={0.1} onChange={setGuess} fmt={(v) => `${fmtN(v, 1)} s`} />
      <div style={{ fontSize: 13 }}>
        {Math.abs(guess - truth) < 0.15 ? (
          <span className="green">
            Right: {fmtN(T1, 1)} s × √{k} = {fmtN(truth, 2)} s. Twice the length is not twice the time.
          </span>
        ) : (
          <span className="muted">Hint: swing time grows with the square root of the length. √{k} = {fmtN(Math.sqrt(k), 2)}.</span>
        )}
      </div>
    </>
  );
}

/** A retrograde loop is symmetric: the turn-around before opposition mirrors the one after. */
function BracketDemo() {
  const [guess, setGuess] = useState(150);
  const start = 70; // day it turned backwards
  const opp = 105; // opposition (middle of the loop)
  const truth = opp + (opp - start);
  const W = 560;
  const X = (d: number) => 30 + (d / 200) * (W - 60);
  // Steady eastward drift minus the 'overtaking' wobble; stationary at day 70 and day 140.
  const w = (2 * Math.PI) / 200;
  const lon = (d: number) => 0.25 * d - 17.5 * Math.sin(w * (d - opp));
  const Y = (v: number) => 175 - (v + 5) * 3.8;
  const path = Array.from({ length: 121 }, (_, i) => i * (opp / 120) * 1.0).map((d) => `${X(d)},${Y(lon(d))}`).join(' ');
  return (
    <>
      <svg viewBox={`0 0 ${W} 200`} style={{ width: '100%' }}>
        <ArrowDefs />
        <polyline points={path} fill="none" stroke="#6cc4ff" strokeWidth={2} />
        <rect x={X(opp)} y={10} width={X(200) - X(opp)} height={170} fill="rgba(108,196,255,0.06)" />
        <line x1={X(start)} x2={X(start)} y1={20} y2={180} stroke="#ffc46b" strokeDasharray="3 3" />
        <text x={X(start)} y={195} fill="#ffc46b" fontSize={11} textAnchor="middle">
          turned back (day {start})
        </text>
        <line x1={X(opp)} x2={X(opp)} y1={20} y2={180} stroke="#5be3a4" strokeDasharray="3 3" />
        <text x={X(opp)} y={16} fill="#5be3a4" fontSize={11} textAnchor="middle">
          opposition (day {opp})
        </text>
        <line x1={X(guess)} x2={X(guess)} y1={20} y2={180} stroke="#e8eefc" strokeWidth={2} />
        <path d={`M ${X(start)} 60 Q ${X(opp)} 30 ${X(truth)} 60`} fill="none" stroke="rgba(255,255,255,0.25)" markerEnd="url(#arrow-white)" />
      </svg>
      <Slider label="When will it turn forwards again?" value={guess} min={opp} max={200} step={1} onChange={setGuess} fmt={(v) => `day ${v}`} />
      <div style={{ fontSize: 13 }}>
        {Math.abs(guess - truth) <= 3 ? (
          <span className="green">
            Yes — {opp - start} days before opposition, so about {opp - start} days after: day {truth}. The loop is a mirror image.
          </span>
        ) : (
          <span className="muted">It can’t be before opposition (day {opp}). How far before opposition did it turn back? Mirror that.</span>
        )}
      </div>
    </>
  );
}
