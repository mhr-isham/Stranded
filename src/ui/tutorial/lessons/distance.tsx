import { ParallaxGeometryLab } from '../ParallaxGeometryLab';
import { Equation } from '../../common/Equation';
import { useState } from 'react';
import { DAY, G, M_EARTH } from '../../../engine/constants';
import { ArrowDefs, Demo, LessonShell, Note, P, Slider, fmtN, useAnimTime } from './common';

const AS = Math.PI / 648000; // one arcsecond in radians

export function ParallaxLesson() {
  return <LessonShell kicker="Lesson 11 · Parallax" title="Two viewpoints reveal the distance"
    demo={<Demo><ParallaxGeometryLab /></Demo>}
    keyIdea="Hold up a finger and look with one eye, then the other: it shifts against distant objects. The rover and camp telescope provide two viewpoints in the same way."
    warn="Use synchronized images. The useful baseline is the part across the sightline, not the ground distance driven. Marks closer than the blurred image scale do not establish a reliable direction."
    tip="Compare 0°, 30° and 90° drives in the teaching model, then try predicting the jump in the real practice comparator.">
    <P>Your measured parallax anchors the distance scale used in later calculations. The laser link gives the straight line between the cameras; its sideways component is used with your measured angular shift.</P>
    <P>Background stars provide a shared reference. Both exposures retain their time and pointing, so switching frames changes viewpoint rather than observation date.</P>
    <P>Cassini and Richer used observations of Mars from Paris and French Guiana in 1672 to help establish the solar system’s scale.</P>
  </LessonShell>;
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
      formula={<Equation tex={"R_2=d\\tan\\left(\\frac{\\alpha}{2}\\right)\\approx\\frac{d\\alpha}{2}"} />}
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
      formula={<Equation tex={"a_{\\mathrm m}=d\\tan\\theta_{\\mathrm m} \\\\ M_2=\\frac{4\\pi^2a_{\\mathrm m}^3}{GP_{\\mathrm m}^2}"} />}
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
