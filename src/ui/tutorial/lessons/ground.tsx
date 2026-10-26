import { useState } from 'react';
import { DEG, G, M_EARTH } from '../../../engine/constants';
import { pendulumPeriod } from '../../../engine/measure';
import { ArrowDefs, Demo, LessonShell, Note, P, Slider, fmtN, useAnimTime } from './common';

export function PendulumLesson() {
  const [L, setL] = useState(1.5);
  const [g, setG] = useState(9.8);
  const [amp, setAmp] = useState(10);
  const [N, setN] = useState(1);
  const t = useAnimTime();
  const T = pendulumPeriod(g, L, amp * DEG);
  const T0 = 2 * Math.PI * Math.sqrt(L / g);
  const th = amp * DEG * Math.cos((2 * Math.PI * t) / T);
  const px = 200;
  const py = 30;
  const len = 60 + L * 70;
  const bx = px + Math.sin(th) * len;
  const by = py + Math.cos(th) * len;
  const reaction = 0.15; // s, scatter of a human start/stop press
  const relErr = (Math.SQRT2 * reaction) / (N * T);
  return (
    <LessonShell
      kicker="Lesson 3 · Gravity"
      title="A pendulum is a gravity meter"
      demo={
        <Demo>
          <svg viewBox="0 0 400 290">
            <ArrowDefs />
            <line x1={120} y1={py} x2={280} y2={py} stroke="#aab4c6" strokeWidth={5} />
            <path d={`M ${px} ${py + 40} A 40 40 0 0 ${amp > 0 ? 1 : 0} ${px + Math.sin(amp * DEG) * 40} ${py + Math.cos(amp * DEG) * 40}`} fill="none" stroke="#ffc46b" strokeWidth={1.5} />
            <text x={px + 46} y={py + 46} fill="#ffc46b" fontSize={12}>
              {amp}° release
            </text>
            <line x1={px} y1={py} x2={px} y2={py + len} stroke="#5d6a88" strokeDasharray="4 4" />
            <line x1={px} y1={py} x2={bx} y2={by} stroke="#e8eefc" strokeWidth={1.5} />
            <circle cx={bx} cy={by} r={12} fill="#d9a64e" />
            <line x1={px - 40} y1={py} x2={px - 40} y2={py + len} stroke="#6cc4ff" markerStart="url(#arrow-blue)" markerEnd="url(#arrow-blue)" />
            <text x={px - 48} y={py + len / 2} fill="#6cc4ff" fontSize={13} textAnchor="end">
              L = {L.toFixed(1)} m
            </text>
            <line x1={bx} y1={by + 14} x2={bx} y2={by + 50} stroke="#ff6b7d" strokeWidth={2} markerEnd="url(#arrow-red)" />
            <text x={bx + 8} y={by + 46} fill="#ff6b7d" fontSize={12}>
              gravity g
            </text>
          </svg>
          <Slider label="String length L" value={L} min={0.5} max={3} step={0.1} onChange={setL} fmt={(v) => `${v.toFixed(1)} m`} />
          <Slider label="Gravity g" value={g} min={2} max={25} step={0.1} onChange={setG} fmt={(v) => `${v.toFixed(1)} m/s²`} />
          <Slider label="Release angle" value={amp} min={2} max={60} step={1} onChange={setAmp} fmt={(v) => `${v}°`} />
          <dl className="kv">
            <dt>Period T (one full swing, there and back)</dt>
            <dd className="blue">{fmtN(T, 3)} s</dd>
            <dt>Simple formula 2π√(L/g)</dt>
            <dd>{fmtN(T0, 3)} s</dd>
            <dt>Difference from big swing</dt>
            <dd className={T / T0 - 1 > 0.002 ? 'red' : 'green'}>{fmtN((T / T0 - 1) * 100, 2)}%</dd>
          </dl>
          <hr className="sep" />
          <b>Your reaction time vs number of swings</b>
          <Slider label="Swings timed in one go (N)" value={N} min={1} max={30} step={1} onChange={setN} fmt={(v) => `${v}`} />
          <div className="row" style={{ gap: 8 }}>
            <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 7 }}>
              <div style={{ width: `${Math.min(100, relErr * 1000)}%`, height: '100%', background: relErr > 0.02 ? '#ff6b7d' : '#5be3a4', borderRadius: 7 }} />
            </div>
            <span className="mono">± {fmtN(relErr * 100, 2)}% in T</span>
          </div>
          <Note>Assumes ±0.15 s of human scatter on each button press.</Note>
        </Demo>
      }
      formula={
        <>
          T = 2π √(L / g)  →  g = 4π² L / T²<br />
          T = (time on the stopwatch) / (number of swings N)
        </>
      }
      keyIdea="Stronger gravity pulls the bob back faster, so the swing gets quicker. Time the swing and measure the string, and you know g."
      warn="Two traps: (1) timing a single swing — your reaction time swamps it; (2) a big release angle — the simple formula assumes small swings and gives too small a g. Keep the release under ~10°."
      tip="Your reaction error is the same whether you time 1 swing or 20, so time 20 and divide: the error in T drops twenty-fold. Because g ∝ 1/T², each 1% error in T becomes 2% in g."
    >
      <P>
        A pendulum swings back and forth with a very regular rhythm. That rhythm depends only on the <b>length</b> of the string and on{' '}
        <b>gravity</b> — not on how heavy the bob is.
      </P>
      <P>
        Move the sliders: a longer string swings slower; stronger gravity swings faster. Then push the release angle up and watch the real period
        drift away from the simple formula.
      </P>
    </LessonShell>
  );
}

export function HorizonLesson() {
  const [h, setH] = useState(800);
  const [R, setR] = useState(6400);
  const theta = Math.acos(R / (R + h / 1000)); // rad
  const thDeg = theta / DEG;
  const readErr = 0.005; // degrees
  const relR = (2 * readErr) / thDeg;
  // Exaggerated drawing: a small planet so the geometry is visible.
  const cx = 300;
  const cy = 330;
  const rpx = 200;
  const hpx = 12 + (h / 2000) * 90;
  const ex = cx;
  const ey = cy - rpx - hpx;
  const thPx = Math.acos(rpx / (rpx + hpx));
  const tx = cx + rpx * Math.sin(thPx);
  const ty = cy - rpx * Math.cos(thPx);
  return (
    <LessonShell
      kicker="Lesson 4 · The size of the world"
      title="The horizon dips — and the dip measures the planet"
      demo={
        <Demo>
          <svg viewBox="0 0 600 330">
            <ArrowDefs />
            <path d={`M ${cx - rpx} ${cy} A ${rpx} ${rpx} 0 0 1 ${cx + rpx} ${cy}`} fill="#3a2b24" stroke="#7a6550" />
            <line x1={ex} y1={cy - rpx} x2={ex} y2={ey} stroke="#aab4c6" strokeWidth={4} />
            <circle cx={ex} cy={ey} r={5} fill="#ffc46b" />
            <line x1={ex - 40} y1={ey} x2={ex + 230} y2={ey} stroke="#e8eefc" strokeDasharray="6 4" />
            <text x={ex + 232} y={ey + 4} fill="#e8eefc" fontSize={12}>
              level
            </text>
            <line x1={ex} y1={ey} x2={tx + (tx - ex) * 0.4} y2={ty + (ty - ey) * 0.4} stroke="#6cc4ff" strokeWidth={2} />
            <text x={tx + 10} y={ty - 6} fill="#6cc4ff" fontSize={12}>
              line of sight to the horizon
            </text>
            <path d={`M ${ex + 60} ${ey} A 60 60 0 0 1 ${ex + 60 * Math.cos(thPx)} ${ey + 60 * Math.sin(thPx)}`} fill="none" stroke="#ffc46b" strokeWidth={2} />
            <text x={ex + 66} y={ey + 20} fill="#ffc46b" fontSize={14} fontWeight={700}>
              θ
            </text>
            <line x1={cx} y1={cy} x2={tx} y2={ty} stroke="#5be3a4" strokeDasharray="4 4" />
            <line x1={cx} y1={cy} x2={ex} y2={cy - rpx} stroke="#5be3a4" strokeDasharray="4 4" />
            <text x={(cx + tx) / 2 + 8} y={(cy + ty) / 2 + 18} fill="#5be3a4" fontSize={13}>
              R
            </text>
            <text x={cx - 22} y={cy - rpx / 2} fill="#5be3a4" fontSize={13}>
              R
            </text>
            <text x={ex - 14} y={(ey + cy - rpx) / 2 + 4} fill="#aab4c6" fontSize={13} textAnchor="end">
              h
            </text>
            <circle cx={tx} cy={ty} r={4} fill="#6cc4ff" />
            <text x={cx} y={cy - 6} fill="#93a2c3" fontSize={11} textAnchor="middle">
              centre (drawing not to scale)
            </text>
          </svg>
          <Slider label="Your height above the plain h" value={h} min={2} max={2000} step={2} onChange={setH} fmt={(v) => `${v} m`} />
          <Slider label="Planet radius R" value={R} min={2000} max={12000} step={100} onChange={setR} fmt={(v) => `${v} km`} />
          <dl className="kv">
            <dt>Dip of the horizon θ</dt>
            <dd className="blue">{fmtN(thDeg, 4)}°</dd>
            <dt>If you misread θ by 0.005°, R is off by</dt>
            <dd className={relR > 0.03 ? 'red' : relR > 0.01 ? 'amber' : 'green'}>{fmtN(relR * 100, 1)}%</dd>
          </dl>
        </Demo>
      }
      formula={
        <>
          cos θ = R / (R + h)<br />
          R = h·cos θ / (1 − cos θ)  ≈  2h / θ²   (θ in radians)
        </>
      }
      keyIdea="On a curved world the horizon sits a little below level, and the higher you stand the more it dips. The triangle formed by the planet’s centre, your eye and the horizon point turns that dip into the radius."
      warn="Near the ground the dip is tiny, so a small reading error becomes a huge error in R (try h = 2 m). Always climb to the summit. Your hands shake, too — brace and wait for a steady moment before reading."
      tip="Because R ≈ 2h/θ², the relative error in R is twice the relative error in θ. Zoom the instrument in and repeat readings to shrink it."
    >
      <P>
        Stand on a hill and look at the far horizon. If the ground were flat it would sit exactly at eye level. On a ball it drops away — by an
        angle called the <b>dip</b>, θ.
      </P>
      <P>
        Your line of sight just grazes the planet at the horizon, so it meets the radius there at a right angle. That right triangle has sides
        R and R + h — trigonometry does the rest. Al-Bīrūnī used exactly this to measure the Earth a thousand years ago.
      </P>
    </LessonShell>
  );
}

export function MassLesson() {
  const [g, setG] = useState(9.8);
  const [R, setR] = useState(6400);
  const M = (g * (R * 1000) ** 2) / G;
  const vEsc = Math.sqrt(2 * g * R * 1000) / 1000;
  return (
    <LessonShell
      kicker="Lesson 5 · Weighing a planet"
      title="Gravity + radius = mass (and escape speed)"
      demo={
        <Demo h={240}>
          <svg viewBox="0 0 600 170">
            <ArrowDefs />
            <circle cx={140} cy={85} r={20 + R / 160} fill="#5a4632" stroke="#a08060" />
            <circle cx={140} cy={85} r={3} fill="#fff" />
            <line x1={140} y1={85} x2={140 + 20 + R / 160} y2={85} stroke="#5be3a4" markerEnd="url(#arrow-green)" />
            <text x={150} y={78} fill="#5be3a4" fontSize={12}>
              R
            </text>
            <line x1={340} y1={20} x2={340} y2={20 + g * 4.5} stroke="#ff6b7d" strokeWidth={3} markerEnd="url(#arrow-red)" />
            <text x={350} y={40} fill="#ff6b7d" fontSize={12}>
              g pulls down
            </text>
            <rect x={430} y={150 - Math.min(130, vEsc * 8)} width={60} height={Math.min(130, vEsc * 8)} fill="#6cc4ff" rx={6} />
            <text x={460} y={165} fill="#93a2c3" fontSize={11} textAnchor="middle">
              escape speed
            </text>
            <line x1={420} y1={150 - 11.2 * 8} x2={500} y2={150 - 11.2 * 8} stroke="#ffc46b" strokeDasharray="4 3" />
            <text x={505} y={150 - 11.2 * 8 + 4} fill="#ffc46b" fontSize={11}>
              Earth
            </text>
          </svg>
          <Slider label="Surface gravity g" value={g} min={3} max={25} step={0.1} onChange={setG} fmt={(v) => `${v.toFixed(1)} m/s²`} />
          <Slider label="Radius R" value={R} min={2000} max={12000} step={100} onChange={setR} fmt={(v) => `${v} km`} />
          <dl className="kv">
            <dt>Mass M = gR²/G</dt>
            <dd className="blue">
              {fmtN(M / 1e24, 2)} ×10²⁴ kg ({fmtN(M / M_EARTH, 2)} Earths)
            </dd>
            <dt>Escape speed √(2gR)</dt>
            <dd className="amber">{fmtN(vEsc, 2)} km/s</dd>
          </dl>
        </Demo>
      }
      formula={
        <>
          g = G·M / R²   →   M = g·R² / G<br />
          escape speed v = √(2GM/R) = √(2gR)<br />
          G = 6.674 × 10⁻¹¹ (Newton’s gravitational constant)
        </>
      }
      keyIdea="Newton’s law of gravity links the pull at the surface (g) to the planet’s mass and size. Measure g and R, and the whole planet is weighed."
      warn="R appears squared, so a 1% error in radius makes a 2% error in mass. Measure the hill carefully."
      tip="The escape speed is the biggest single item in your fuel bill. That is why ECHO starts with gravity and radius."
    >
      <P>
        Everything with mass pulls on everything else. The pull you feel standing on a planet — its surface gravity <b>g</b> — gets stronger with
        more mass and weaker the further you are from the centre.
      </P>
      <P>Turn that around and you can weigh a planet you are standing on, using only a pendulum and a hill.</P>
    </LessonShell>
  );
}
