import { useRef, useState } from 'react';
import { ArrowDefs, Demo, LessonShell, Note, P, Slider, fmtN, useAnimTime } from './common';

const TAU = Math.PI * 2;

/** Turbulent air makes a point flicker; a disk averages the flicker out. */
export function TwinkleLesson() {
  const [turb, setTurb] = useState(0.6);
  const t = useAnimTime();
  const hist = useRef<{ s: number[]; p: number[] }>({ s: [], p: [] });
  const air = (x: number, tt: number) => Math.sin(x * 7 + tt * 9) * 0.5 + Math.sin(x * 13 - tt * 14) * 0.3 + Math.sin(x * 23 + tt * 21) * 0.2;
  const star = 1 + turb * air(0.3, t);
  let planet = 0;
  for (let i = 0; i < 40; i++) planet += 1 + turb * air(0.3 + (i / 40) * 1.2, t);
  planet /= 40;
  const H = hist.current;
  H.s.push(star);
  H.p.push(planet);
  if (H.s.length > 140) (H.s.shift(), H.p.shift());
  const spark = (arr: number[], y0: number) => arr.map((v, i) => `${300 + i * 2},${y0 - (v - 1) * 40}`).join(' ');
  return (
    <LessonShell
      kicker="Lesson 6 · Star or planet?"
      title="Stars twinkle. Planets don’t."
      demo={
        <Demo>
          <svg viewBox="0 0 600 260">
            {/* Turbulent air cells */}
            {Array.from({ length: 10 }, (_, i) => (
              <ellipse key={i} cx={((i * 70 + t * 40 * (1 + (i % 3))) % 320) - 20} cy={120 + Math.sin(i + t) * 10} rx={34} ry={14} fill="rgba(108,196,255,0.06)" />
            ))}
            <text x={150} y={20} fill="#93a2c3" fontSize={12} textAnchor="middle">
              light passing through moving air
            </text>
            <circle cx={80} cy={210} r={Math.max(1, 3 * star)} fill="#fff" opacity={Math.min(1, Math.max(0.2, star * 0.8))} />
            <text x={80} y={245} fill="#e8eefc" fontSize={12} textAnchor="middle">
              star (a point)
            </text>
            <circle cx={220} cy={210} r={9} fill="#9fd0ff" opacity={Math.min(1, planet * 0.85)} />
            <text x={220} y={245} fill="#9fd0ff" fontSize={12} textAnchor="middle">
              planet (a tiny disk)
            </text>
            <text x={300} y={20} fill="#93a2c3" fontSize={12}>
              brightness over time
            </text>
            <polyline points={spark(H.s, 90)} fill="none" stroke="#fff" strokeWidth={1.5} />
            <text x={580} y={60} fill="#fff" fontSize={11} textAnchor="end">
              star
            </text>
            <polyline points={spark(H.p, 190)} fill="none" stroke="#9fd0ff" strokeWidth={1.5} />
            <text x={580} y={170} fill="#9fd0ff" fontSize={11} textAnchor="end">
              planet
            </text>
          </svg>
          <Slider label="Air turbulence" value={turb} min={0} max={1} step={0.05} onChange={setTurb} fmt={(v) => `${Math.round(v * 100)}%`} />
        </Demo>
      }
      keyIdea="Stars are so far away that each is effectively a single point of light, so every gust of air makes it flicker. A planet shows a small disk: the flickers from different parts of the disk average out, and it shines steadily."
      tip="In the sky view, watch the bright lights for a few seconds — the steady one is your planet. In the telescope at high zoom, a planet shows a round disk; a star stays a dot."
      warn="Twinkling is strongest near the horizon, where the light passes through more air. Compare lights that are fairly high in the sky."
    >
      <P>
        Before you can measure the blue planet you have to <b>find</b> it. Without a star chart it looks like just another bright light.
      </P>
      <P>Raise the turbulence: the star’s brightness jumps around, while the planet’s line stays nearly flat.</P>
    </LessonShell>
  );
}

/** The star's drift against the background stars measures the year. */
export function YearLesson() {
  const [P1, setP1] = useState(220);
  const [day, setDay] = useState(30);
  const cx = 200;
  const cy = 150;
  const r = 70;
  const ring = 130;
  const ang = (d: number) => -TAU * (d / P1) + Math.PI / 2;
  const pos = (d: number) => [cx + r * Math.cos(ang(d)), cy - r * Math.sin(ang(d))];
  const bg = (d: number) => [cx - ring * Math.cos(ang(d)), cy + ring * Math.sin(ang(d))];
  const [px, py] = pos(day);
  const [bx, by] = bg(day);
  const [b0x, b0y] = bg(0);
  const drift = (360 / P1) * day;
  return (
    <LessonShell
      kicker="Lesson 7 · The year"
      title="Watch the star creep past the background stars"
      demo={
        <Demo>
          <svg viewBox="0 0 400 300">
            <ArrowDefs />
            <circle cx={cx} cy={cy} r={ring} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={14} />
            {Array.from({ length: 36 }, (_, i) => {
              const a = (i / 36) * TAU;
              return <circle key={i} cx={cx + ring * Math.cos(a)} cy={cy + ring * Math.sin(a)} r={1.6} fill="#c8d2ea" />;
            })}
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,190,120,0.35)" />
            <circle cx={cx} cy={cy} r={12} fill="#ffd28a" />
            <line x1={px} y1={py} x2={bx} y2={by} stroke="#ffc46b" strokeDasharray="5 4" />
            <circle cx={px} cy={py} r={7} fill="#ffb26b" />
            <text x={px + 10} y={py - 8} fill="#ffb26b" fontSize={12}>
              us, day {day}
            </text>
            <circle cx={b0x} cy={b0y} r={6} fill="none" stroke="#6cc4ff" strokeWidth={2} />
            <circle cx={bx} cy={by} r={6} fill="#ffc46b" />
            <text x={bx} y={by + (by > cy ? 22 : -12)} fill="#ffc46b" fontSize={12} textAnchor="middle">
              star appears here
            </text>
            <text x={b0x} y={b0y + (b0y > cy ? 22 : -12)} fill="#6cc4ff" fontSize={12} textAnchor="middle">
              day 0
            </text>
          </svg>
          <Slider label="Days since first log" value={day} min={0} max={Math.round(P1)} step={1} onChange={setDay} />
          <Slider label="True year length P₁" value={P1} min={120} max={400} step={1} onChange={(v) => (setP1(v), setDay(Math.min(day, v)))} fmt={(v) => `${v} days`} />
          <dl className="kv">
            <dt>Drift since day 0</dt>
            <dd>{fmtN(drift, 1)}°</dd>
            <dt>Drift per day</dt>
            <dd>{fmtN(360 / P1, 3)}°/day</dd>
            <dt>Year = 360° / drift per day</dt>
            <dd className="blue">{fmtN(P1, 1)} days</dd>
          </dl>
        </Demo>
      }
      formula={<>P₁ = 360° × (days between logs) / (drift in degrees)</>}
      keyIdea="As we circle the star, we see it against different background stars. It drifts all the way round the sky in exactly one year."
      warn="You can only see background stars near the star at sunrise or sunset, so logs are made at twilight. Two logs a day apart give a tiny drift that your aiming error swamps."
      tip="Spread your logs over weeks. A 60-day baseline gives a drift of ~100°, so a 0.03° aiming error hardly matters."
    >
      <P>
        Draw a line from us, through the star, out to the distant stars. As our planet moves along its orbit, that line sweeps around — so the
        star seems to slide slowly eastward through the constellations.
      </P>
      <P>Drag the day slider and watch the yellow marker move away from the blue day-0 marker.</P>
    </LessonShell>
  );
}

/** Retrograde motion: overtaking an outer planet makes it loop backwards. */
export function RetrogradeLesson() {
  const [playing, setPlaying] = useState(true);
  const t = useAnimTime(playing);
  const P1 = 1;
  const P2 = 1.9;
  const S = 1 / (1 / P1 - 1 / P2);
  // Radii follow Kepler's third law so the loop is physically right.
  const time = ((t * 0.12) % (S * 1.2)) - S * 0.1; // years; opposition at 0.5 S
  const r1 = 70;
  const r2 = r1 * Math.pow(P2 / P1, 2 / 3);
  const cx = 160;
  const cy = 150;
  const a1 = (tt: number) => TAU * (tt / P1);
  const a2 = (tt: number) => TAU * (tt / P2) + TAU * (0.5 * S) * (1 / P1 - 1 / P2);
  const p1 = (tt: number) => [cx + r1 * Math.cos(a1(tt)), cy - r1 * Math.sin(a1(tt))];
  const p2 = (tt: number) => [cx + r2 * Math.cos(a2(tt)), cy - r2 * Math.sin(a2(tt))];
  const lon = (tt: number) => {
    const [x1, y1] = p1(tt);
    const [x2, y2] = p2(tt);
    return Math.atan2(-(y2 - y1), x2 - x1);
  };
  // Apparent longitude curve over the window (unwrapped, degrees).
  const N = 240;
  const curve: { t: number; v: number }[] = [];
  let prev = 0;
  let off = 0;
  for (let i = 0; i <= N; i++) {
    const tt = -S * 0.1 + (S * 1.2 * i) / N;
    let v = (lon(tt) * 180) / Math.PI;
    if (i > 0) {
      if (v + off - prev > 180) off -= 360;
      if (v + off - prev < -180) off += 360;
    }
    v += off;
    prev = v;
    curve.push({ t: tt, v });
  }
  const vmin = Math.min(...curve.map((c) => c.v));
  const vmax = Math.max(...curve.map((c) => c.v));
  const CX = (tt: number) => 330 + ((tt + S * 0.1) / (S * 1.2)) * 250;
  const CY = (v: number) => 270 - ((v - vmin) / (vmax - vmin)) * 200;
  const [x1, y1] = p1(time);
  const [x2, y2] = p2(time);
  const k = 2.2;
  const cur = curve.reduce((a, c) => (Math.abs(c.t - time) < Math.abs(a.t - time) ? c : a), curve[0]);
  const retro = cur && curve.indexOf(cur) > 0 && cur.v < curve[curve.indexOf(cur) - 1].v;
  return (
    <LessonShell
      kicker="Lesson 8 · Opposition"
      title="Why the blue planet loops backwards"
      demo={
        <Demo>
          <svg viewBox="0 0 600 300">
            <ArrowDefs />
            <circle cx={cx} cy={cy} r={r1} fill="none" stroke="rgba(255,190,120,0.35)" />
            <circle cx={cx} cy={cy} r={r2} fill="none" stroke="rgba(108,196,255,0.35)" />
            <circle cx={cx} cy={cy} r={9} fill="#ffd28a" />
            <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * k} y2={y1 + (y2 - y1) * k} stroke={retro ? '#ff6b7d' : '#5be3a4'} strokeDasharray="4 4" />
            <circle cx={x1} cy={y1} r={6} fill="#ffb26b" />
            <circle cx={x2} cy={y2} r={7} fill="#6cc4ff" />
            <text x={10} y={20} fill="#93a2c3" fontSize={12}>
              top view: we (orange) are on the faster inside track
            </text>
            <text x={330} y={20} fill="#93a2c3" fontSize={12}>
              where it appears against the stars
            </text>
            <polyline points={curve.map((c) => `${CX(c.t)},${CY(c.v)}`).join(' ')} fill="none" stroke="#6cc4ff" strokeWidth={2} />
            <line x1={CX(0.5 * S)} y1={60} x2={CX(0.5 * S)} y2={280} stroke="#5be3a4" strokeDasharray="5 4" />
            <text x={CX(0.5 * S)} y={56} fill="#5be3a4" fontSize={12} textAnchor="middle">
              opposition
            </text>
            <circle cx={CX(cur.t)} cy={CY(cur.v)} r={6} fill="#ffc46b" />
            <text x={590} y={290} fill="#93a2c3" fontSize={11} textAnchor="end">
              time →
            </text>
            <text x={10} y={290} fill={retro ? '#ff6b7d' : '#5be3a4'} fontSize={13} fontWeight={700}>
              {retro ? '◀ moving backwards (retrograde)' : 'moving forwards ▶'}
            </text>
          </svg>
          <div className="row">
            <button className="btn small" onClick={() => setPlaying(!playing)}>
              {playing ? 'Pause' : 'Play'}
            </button>
          </div>
        </Demo>
      }
      keyIdea="We orbit faster than the outer blue planet. When we overtake it, it appears to drift backwards against the stars for a while — a retrograde loop. The middle of the loop is opposition: the planet is opposite the star in our sky and as close to us as it gets."
      warn="The planet doesn’t really reverse. It’s like overtaking a slower car on a motorway: against the distant hills, the car seems to slide backwards."
      tip="In the tracker chart, find the loop and mark its middle — where the backward motion is fastest, halfway between the two turning points. Zoom in to place the cursor precisely."
    >
      <P>
        Planets wander against the stars: that’s what “planet” means (Greek <i>planētēs</i>, “wanderer”). Usually they creep eastward. But
        every so often an outer planet stops, goes backwards, then turns forward again.
      </P>
      <P>Watch the dashed line of sight: when it swings backwards, the planet’s path on the right loops back.</P>
    </LessonShell>
  );
}

/** Synodic period: lapping on a race track. */
export function SynodicLesson() {
  const [P1, setP1] = useState(220);
  const [P2, setP2] = useState(420);
  const t = useAnimTime();
  const S = 1 / (1 / P1 - 1 / P2);
  const day = (t * 60) % (S * 2);
  const a1 = (TAU * day) / P1;
  const a2 = (TAU * day) / P2;
  const laps = Math.floor(day / S);
  return (
    <LessonShell
      kicker="Lesson 9 · The synodic period"
      title="How often do we lap the blue planet?"
      demo={
        <Demo>
          <svg viewBox="0 0 400 260">
            <circle cx={200} cy={130} r={60} fill="none" stroke="rgba(255,190,120,0.4)" strokeWidth={10} />
            <circle cx={200} cy={130} r={105} fill="none" stroke="rgba(108,196,255,0.3)" strokeWidth={10} />
            <circle cx={200} cy={130} r={10} fill="#ffd28a" />
            <line x1={200} y1={130} x2={200 + 120 * Math.cos(a1)} y2={130 - 120 * Math.sin(a1)} stroke="rgba(255,255,255,0.08)" />
            <circle cx={200 + 60 * Math.cos(a1)} cy={130 - 60 * Math.sin(a1)} r={8} fill="#ffb26b" />
            <circle cx={200 + 105 * Math.cos(a2)} cy={130 - 105 * Math.sin(a2)} r={8} fill="#6cc4ff" />
            <text x={10} y={20} fill="#93a2c3" fontSize={12}>
              day {Math.round(day)} · overtakes so far: {laps}
            </text>
          </svg>
          <Slider label="Our year P₁ (inner track)" value={P1} min={100} max={400} step={5} onChange={(v) => setP1(Math.min(v, P2 - 20))} fmt={(v) => `${v} d`} />
          <Slider label="Blue planet year P₂ (outer track)" value={P2} min={150} max={1200} step={5} onChange={(v) => setP2(Math.max(v, P1 + 20))} fmt={(v) => `${v} d`} />
          <dl className="kv">
            <dt>Time between overtakes S</dt>
            <dd className="blue">{fmtN(S, 1)} days</dd>
          </dl>
          <Note>Each overtake is an opposition.</Note>
        </Demo>
      }
      formula={
        <>
          1/S = 1/P₁ − 1/P₂   →   1/P₂ = 1/P₁ − 1/S
        </>
      }
      keyIdea="We can’t time the blue planet’s year directly — we are moving too. But we can time how often we overtake it (opposition to opposition) and combine that with our own year."
      warn="One synodic period is long — often more than a year. You’ll need to warp time and wait for the second opposition. Waiting costs life support."
      tip="1/P is “laps per day”. The difference between the two runners’ laps per day is how fast the faster one gains: one full lap gained every S days."
    >
      <P>
        Think of two runners on a track: the inner runner is faster. Every so often the inner runner catches up and passes the outer one. The time
        between passes is the <b>synodic period</b>, S.
      </P>
    </LessonShell>
  );
}

/** Kepler's third law: periods give orbit sizes (as ratios). */
export function KeplerLesson() {
  const [ratio, setRatio] = useState(1.5);
  const t = useAnimTime();
  const Pr = Math.pow(ratio, 1.5);
  const r1 = 50;
  const r2 = r1 * ratio;
  const s = 120 / Math.max(r2, 60);
  return (
    <LessonShell
      kicker="Lesson 10 · Kepler’s third law"
      title="Slower planets live further out"
      demo={
        <Demo>
          <svg viewBox="0 0 400 270">
            <circle cx={200} cy={135} r={r1 * s} fill="none" stroke="rgba(255,190,120,0.4)" />
            <circle cx={200} cy={135} r={r2 * s} fill="none" stroke="rgba(108,196,255,0.4)" />
            <circle cx={200} cy={135} r={9} fill="#ffd28a" />
            <circle cx={200 + r1 * s * Math.cos(t)} cy={135 - r1 * s * Math.sin(t)} r={7} fill="#ffb26b" />
            <circle cx={200 + r2 * s * Math.cos(t / Pr)} cy={135 - r2 * s * Math.sin(t / Pr)} r={7} fill="#6cc4ff" />
          </svg>
          <Slider label="Orbit size ratio a₂ / a₁" value={ratio} min={1.1} max={3} step={0.01} onChange={setRatio} fmt={(v) => v.toFixed(2)} />
          <dl className="kv">
            <dt>Year ratio P₂ / P₁ = (a₂/a₁)^1.5</dt>
            <dd className="blue">{fmtN(Pr, 3)}</dd>
          </dl>
        </Demo>
      }
      formula={
        <>
          P² ∝ a³   →   a₂/a₁ = (P₂/P₁)^(2/3)<br />
          with masses:  M★ = 4π² a³ / (G P²)
        </>
      }
      keyIdea="Kepler found that the square of a planet’s year is proportional to the cube of its orbit size. Knowing both years gives you the shape of the system — how much bigger one orbit is than the other."
      warn="Periods alone give only ratios. To know the actual size (in km) you need one real distance — that is what the rover parallax is for."
      tip="Once a₁ is known in metres, the same law with Newton’s G weighs the star: M★ = 4π²a₁³/(GP₁²). The cube makes your distance error count three times."
    >
      <P>Further planets move more slowly and have further to go, so their years are much longer. Slide the ratio and watch the outer planet fall behind.</P>
    </LessonShell>
  );
}
