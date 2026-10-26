import { useState } from 'react';
import { DAY, G, M_EARTH } from '../../../engine/constants';
import { ArrowDefs, Demo, LessonShell, Note, P, Slider, fmtN, useAnimTime } from './common';

const AS = Math.PI / 648000; // one arcsecond in radians

export function ParallaxLesson() {
  const [Bkm, setB] = useState(3000);
  const [dM, setD] = useState(80);
  const [frame, setFrame] = useState<'A' | 'B'>('A');
  const p = (Bkm * 1e3) / (dM * 1e9); // rad
  const pAs = p / AS;
  const relErr = 0.2 / pAs;
  // Exaggerated drawing.
  const ax = 40;
  const ay = 70;
  const by = 230;
  const ox = 120 + dM * 1.6;
  const oy = 150;
  const bgx = 560;
  const hit = (sy: number) => sy + ((oy - sy) * (bgx - ax)) / (ox - ax);
  return (
    <LessonShell
      kicker="Lesson 11 · Parallax"
      title="Two viewpoints reveal the distance"
      demo={
        <Demo>
          <svg viewBox="0 0 600 300">
            <ArrowDefs />
            <rect x={bgx} y={0} width={40} height={300} fill="rgba(255,255,255,0.04)" />
            {[30, 80, 140, 190, 250, 280].map((y) => (
              <circle key={y} cx={bgx + 20} cy={y} r={2} fill="#c8d2ea" />
            ))}
            <text x={bgx + 20} y={14} fill="#93a2c3" fontSize={10} textAnchor="middle">
              far stars
            </text>
            <line x1={ax} y1={ay} x2={ax} y2={by} stroke="#5be3a4" strokeWidth={3} markerStart="url(#arrow-green)" markerEnd="url(#arrow-green)" />
            <text x={ax - 8} y={(ay + by) / 2} fill="#5be3a4" fontSize={13} textAnchor="end">
              B
            </text>
            <circle cx={ax} cy={ay} r={6} fill="#6cf0ff" />
            <text x={ax + 8} y={ay - 8} fill="#6cf0ff" fontSize={12}>
              camp (A)
            </text>
            <circle cx={ax} cy={by} r={6} fill="#ffc46b" />
            <text x={ax + 8} y={by + 18} fill="#ffc46b" fontSize={12}>
              rover (B)
            </text>
            <line x1={ax} y1={ay} x2={bgx} y2={hit(ay)} stroke="#6cf0ff" strokeDasharray="5 4" />
            <line x1={ax} y1={by} x2={bgx} y2={hit(by)} stroke="#ffc46b" strokeDasharray="5 4" />
            <circle cx={ox} cy={oy} r={9} fill="#6cc4ff" />
            <text x={ox} y={oy - 14} fill="#6cc4ff" fontSize={12} textAnchor="middle">
              blue planet
            </text>
            <line x1={ax} y1={oy} x2={ox} y2={oy} stroke="#e8eefc" strokeDasharray="2 4" />
            <text x={(ax + ox) / 2} y={oy + 16} fill="#e8eefc" fontSize={12} textAnchor="middle">
              d
            </text>
            <circle cx={bgx + 6} cy={hit(ay)} r={5} fill="#6cf0ff" />
            <circle cx={bgx + 6} cy={hit(by)} r={5} fill="#ffc46b" />
            <line x1={bgx - 8} y1={hit(ay)} x2={bgx - 8} y2={hit(by)} stroke="#ff6b7d" strokeWidth={2} markerStart="url(#arrow-red)" markerEnd="url(#arrow-red)" />
            <text x={bgx - 14} y={(hit(ay) + hit(by)) / 2} fill="#ff6b7d" fontSize={13} textAnchor="end">
              shift p
            </text>
          </svg>
          <div className="row" style={{ gap: 12, alignItems: 'stretch' }}>
            <div style={{ flex: 1 }}>
              <Slider label="Baseline B (rover distance)" value={Bkm} min={500} max={6000} step={100} onChange={setB} fmt={(v) => `${v} km`} />
              <Slider label="Distance d to the planet" value={dM} min={30} max={200} step={1} onChange={setD} fmt={(v) => `${v} million km`} />
            </div>
            <div style={{ width: 150 }}>
              <svg viewBox="0 0 150 110" style={{ background: '#04060c', borderRadius: 8 }}>
                {[
                  [20, 20],
                  [110, 30],
                  [40, 90],
                  [130, 85],
                  [80, 15],
                ].map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={1.6} fill="#fff" />
                ))}
                <circle cx={75 + (frame === 'B' ? Math.min(40, pAs * 2.2) : 0)} cy={55} r={6} fill="#6cc4ff" />
                <text x={6} y={104} fill={frame === 'A' ? '#6cf0ff' : '#ffc46b'} fontSize={10}>
                  frame {frame}
                </text>
              </svg>
              <button className="btn small" style={{ width: '100%', marginTop: 4 }} onClick={() => setFrame(frame === 'A' ? 'B' : 'A')}>
                Blink A ⇄ B
              </button>
            </div>
          </div>
          <dl className="kv">
            <dt>Shift p = B / d</dt>
            <dd className="blue">
              {fmtN(pAs, 2)}″ ({p.toExponential(2)} rad)
            </dd>
            <dt>If you misplace a marker by 0.2″, d is off by</dt>
            <dd className={relErr > 0.05 ? 'red' : relErr > 0.02 ? 'amber' : 'green'}>{fmtN(relErr * 100, 1)}%</dd>
          </dl>
          <Note>Drawing exaggerated; ″ = arcsecond = 1/3600 of a degree.</Note>
        </Demo>
      }
      formula={
        <>
          p = B / d   →   d = B / p   (p in radians)<br />
          1″ = 1/3600° = 4.85 × 10⁻⁶ rad
        </>
      }
      keyIdea="Hold up a finger and blink one eye, then the other: the finger jumps against the background. Nearer things jump more. Measure the jump and the distance between your eyes, and you know how far away the finger is."
      warn="The shift is tiny — a few arcseconds. A longer baseline (send the rover further) and imaging near opposition (planet closest) both make the shift bigger and your error smaller. Image both sites at the same instant, when the planet is high."
      tip="In the blink comparator, background stars stay put while the planet jumps. Zoom in and click the centre of the planet’s disk in each frame."
    >
      <P>
        This is the most important measurement in the game: it’s the only one that gives a real distance in kilometres. Everything else in the sky
        — orbit sizes, the star’s mass — is scaled from it.
      </P>
      <P>
        Cassini and Richer did exactly this with Mars in 1672, from Paris and French Guiana, and found the size of the solar system.
      </P>
    </LessonShell>
  );
}

export function AngularLesson() {
  const [Rkm, setR] = useState(6000);
  const [dM, setD] = useState(80);
  const alpha = 2 * Math.atan((Rkm * 1e3) / (dM * 1e9));
  const aAs = alpha / AS;
  const dpx = 80 + dM * 2.2;
  const rpx = 12 + Rkm / 400;
  return (
    <LessonShell
      kicker="Lesson 12 · Angular size"
      title="Angle × distance = size"
      demo={
        <Demo h={240}>
          <svg viewBox="0 0 600 220">
            <ArrowDefs />
            <circle cx={40} cy={110} r={5} fill="#ffc46b" />
            <text x={40} y={135} fill="#ffc46b" fontSize={12} textAnchor="middle">
              telescope
            </text>
            <circle cx={40 + dpx} cy={110} r={rpx} fill="#2f7fd0" />
            <line x1={40} y1={110} x2={40 + dpx} y2={110 - rpx} stroke="#6cc4ff" />
            <line x1={40} y1={110} x2={40 + dpx} y2={110 + rpx} stroke="#6cc4ff" />
            <text x={70} y={106} fill="#6cc4ff" fontSize={14} fontWeight={700}>
              α
            </text>
            <line x1={52 + dpx} y1={110 - rpx} x2={52 + dpx} y2={110} stroke="#5be3a4" markerStart="url(#arrow-green)" markerEnd="url(#arrow-green)" />
            <text x={58 + dpx} y={110 - rpx / 2} fill="#5be3a4" fontSize={12}>
              R₂
            </text>
            <text x={40 + dpx / 2} y={200} fill="#e8eefc" fontSize={12} textAnchor="middle">
              distance d
            </text>
          </svg>
          <Slider label="Planet radius R₂" value={Rkm} min={2000} max={12000} step={100} onChange={setR} fmt={(v) => `${v} km`} />
          <Slider label="Distance d" value={dM} min={30} max={200} step={1} onChange={setD} fmt={(v) => `${v} million km`} />
          <dl className="kv">
            <dt>Angular diameter α</dt>
            <dd className="blue">{fmtN(aAs, 1)}″</dd>
          </dl>
        </Demo>
      }
      formula={<>R₂ = d · tan(α / 2)   ≈   d · α / 2</>}
      keyIdea="A coin held at arm’s length can cover the Moon: something small and near can look as big as something huge and far. If you know the distance, the angle tells you the true size."
      warn="The disk is only tens of arcseconds across and its edge is blurred by the air (“seeing”). Measure it several times and average."
      tip="Measure the disk on the same night as your parallax images — then the distance you use is right for that moment."
    >
      <P>
        Your telescope’s <b>micrometer</b> has two fine wires you can move. Put one on each edge of the planet’s disk and it reads the angle
        between them, α.
      </P>
    </LessonShell>
  );
}

export function MoonLesson() {
  const [m, setM] = useState(1);
  const [aK, setA] = useState(250);
  const t = useAnimTime();
  const a = aK * 1e6;
  const Pm = 2 * Math.PI * Math.sqrt(a ** 3 / (G * m * M_EARTH)) / DAY;
  const speed = 1.4 / Math.max(1, Pm / 5);
  const ph = t * speed;
  const r = 30 + aK / 6;
  const pts = Array.from({ length: 160 }, (_, i) => {
    const x = 300 + i * 1.8;
    const y = 200 - Math.sin(ph - (160 - i) * 0.05) * (r * 0.6);
    return `${x},${y}`;
  }).join(' ');
  return (
    <LessonShell
      kicker="Lesson 13 · Weighing the blue planet"
      title="A moon is a scale for its planet"
      demo={
        <Demo>
          <svg viewBox="0 0 600 270">
            <ArrowDefs />
            <text x={130} y={18} fill="#93a2c3" fontSize={12} textAnchor="middle">
              top view
            </text>
            <circle cx={130} cy={110} r={r} fill="none" stroke="rgba(255,255,255,0.2)" strokeDasharray="4 4" />
            <circle cx={130} cy={110} r={12} fill="#2f7fd0" />
            <circle cx={130 + r * Math.sin(ph)} cy={110 + r * Math.cos(ph)} r={5} fill="#d9d2c3" />
            <line x1={130} y1={250} x2={130} y2={110 + r + 10} stroke="#ffc46b" markerEnd="url(#arrow-amber)" />
            <text x={140} y={245} fill="#ffc46b" fontSize={11}>
              we look from here
            </text>
            <text x={420} y={18} fill="#93a2c3" fontSize={12} textAnchor="middle">
              what the tracker logs: offset east/west
            </text>
            <line x1={300} y1={200} x2={590} y2={200} stroke="#5d6a88" />
            <polyline points={pts} fill="none" stroke="#d9d2c3" strokeWidth={1.6} />
            <line x1={295} y1={200 - r * 0.6} x2={295} y2={200} stroke="#6cc4ff" markerStart="url(#arrow-blue)" markerEnd="url(#arrow-blue)" />
            <text x={290} y={200 - r * 0.3} fill="#6cc4ff" fontSize={13} textAnchor="end">
              θₘ
            </text>
          </svg>
          <Slider label="Blue planet mass" value={m} min={0.3} max={2} step={0.05} onChange={setM} fmt={(v) => `${v.toFixed(2)} Earths`} />
          <Slider label="Moon orbit radius aₘ" value={aK} min={80} max={500} step={5} onChange={setA} fmt={(v) => `${v} thousand km`} />
          <dl className="kv">
            <dt>Moon period Pₘ</dt>
            <dd className="blue">{fmtN(Pm, 2)} days</dd>
          </dl>
          <Note>Heavier planet → faster moon at the same distance.</Note>
        </Demo>
      }
      formula={
        <>
          aₘ = d · tan θₘ<br />
          M₂ = 4π² aₘ³ / (G · Pₘ²)
        </>
      }
      keyIdea="We see the moon’s orbit edge-on, so the moon just swings back and forth beside the planet. The size of the swing (θₘ) times the distance gives the orbit radius; the time for one swing gives the period. Kepler’s law then weighs the planet."
      warn="The swing looks bigger when the planet is closer, so fit only a few weeks of data around opposition. aₘ is cubed: a 1% error in the swing gives 3% in mass."
      tip="Fit several full swings — a longer run pins down the period much better."
    >
      <P>
        You need the blue planet’s mass to brake into orbit around it. Nobody can put a planet on a scale — but its moon is held in orbit by the
        planet’s gravity, and how fast it goes around depends on that mass.
      </P>
    </LessonShell>
  );
}
