// Optional Flight School modules, one per campaign chapter.

import { useState } from 'react';
import { ArrowDefs, Demo, LessonShell, Note, P, Slider, fmtN } from './common';


/** Chapter 2: a probe falling past a planet speeds up; the speed-up weighs the planet. */
export function FlybyLesson() {
  const [mass, setMass] = useState(1); // Earth masses
  const [rp, setRp] = useState(2); // planet radii
  const G = 6.674e-11;
  const M = mass * 5.97e24;
  const R = 6.37e6 * Math.cbrt(mass);
  const mu = G * M;
  const vInf = 4000;
  const rP = rp * R;
  const e = 1 + (rP * vInf * vInf) / mu;
  const vPeak = Math.sqrt(vInf * vInf + (2 * mu) / rP);
  const thInf = Math.acos(-1 / e);
  const p = rP * (1 + e);
  // Draw the hyperbola in planet radii.
  const S = 26; // px per planet radius
  const cx = 230;
  const cy = 140;
  const pts: string[] = [];
  for (let i = 0; i <= 120; i++) {
    const th = -thInf * 0.985 + (2 * thInf * 0.985 * i) / 120;
    const r = p / (1 + e * Math.cos(th)) / R;
    if (r > 12) continue;
    pts.push(`${cx + r * Math.cos(th + Math.PI) * S},${cy + r * Math.sin(th + Math.PI) * S}`);
  }
  const curve = Array.from({ length: 80 }, (_, i) => {
    const th = -thInf * 0.98 + (2 * thInf * 0.98 * i) / 79;
    const r = p / (1 + e * Math.cos(th));
    return Math.sqrt(vInf * vInf + (2 * mu) / r);
  });
  const vmax = Math.max(...curve);
  return (
    <LessonShell
      kicker="Chapter 2 · The Silent Planet"
      title="Weighing a planet with a flyby"
      demo={
        <Demo h={340}>
          <svg viewBox="0 0 600 280" style={{ width: '100%' }}>
            <ArrowDefs />
            <circle cx={cx} cy={cy} r={S} fill="#5aa7ff" opacity={0.85} />
            <polyline points={pts.join(' ')} fill="none" stroke="#ffc46b" strokeWidth={2} />
            <text x={cx} y={cy + 4} fill="#05070f" fontSize={10} textAnchor="middle">
              planet
            </text>
            <text x={20} y={20} fill="#93a2c3" fontSize={12}>
              the probe’s path (bends more for a heavier planet or a closer pass)
            </text>
            {/* Speed over the flyby */}
            <text x={430} y={30} fill="#93a2c3" fontSize={11}>
              speed during the flyby
            </text>
            <polyline
              points={curve.map((v, i) => `${420 + i * 2.1},${230 - ((v - vInf) / Math.max(1, vmax - vInf)) * 160}`).join(' ')}
              fill="none"
              stroke="#6cc4ff"
              strokeWidth={2}
            />
            <line x1={420} x2={590} y1={230} y2={230} stroke="rgba(255,255,255,0.2)" />
            <text x={592} y={228} fill="#93a2c3" fontSize={10} textAnchor="end">
              v∞ = {fmtN(vInf / 1000, 1)} km/s
            </text>
            <text x={505} y={60} fill="#6cc4ff" fontSize={11} textAnchor="middle">
              vₚ = {fmtN(vPeak / 1000, 2)} km/s
            </text>
          </svg>
          <Slider label="Planet mass" value={mass} min={0.2} max={3} step={0.05} onChange={setMass} fmt={(v) => `${fmtN(v, 2)} × Earth`} />
          <Slider label="Closest approach" value={rp} min={1.1} max={6} step={0.1} onChange={setRp} fmt={(v) => `${fmtN(v, 1)} planet radii`} />
          <Note>
            Path bends by {fmtN((2 * Math.asin(1 / e) * 180) / Math.PI, 1)}°. Speed-up vₚ² − v∞² = {fmtN((vPeak ** 2 - vInf ** 2) / 1e6, 2)} km²/s².
          </Note>
        </Demo>
      }
      formula={
        <>
          Energy is conserved along the flyby: ½vₚ² − GM/rₚ = ½v∞²
          <br />
          so M = rₚ (vₚ² − v∞²) / (2G)
        </>
      }
      keyIdea="A probe speeds up as it falls toward a planet and slows again as it climbs away. How much it speeds up — measured by its radio signal’s Doppler shift — weighs the planet, no moon needed. Mariner 10 weighed Mercury this way."
      tip="A closer pass gives a bigger speed-up and a more precise mass — but aim too close and the probe hits the planet. Your aim is only as good as your measured radius R₂."
      warn="vₚ² − v∞² is a small difference of two big numbers when the pass is far away. Small errors in the speeds become big errors in the mass."
    >
      <P>
        This blue planet has no moon to act as a scale. So we make our own experiment: launch our last probe on a path that passes close to it, and
        listen to its radio.
      </P>
      <P>
        Far from the planet the probe drifts at a steady speed v∞. As it falls in, it speeds up to vₚ at closest approach rₚ, then slows again. Raise
        the mass: the speed-up grows and the path bends more.
      </P>
    </LessonShell>
  );
}

/** Chapter 3: air bends light near the horizon; noon shadows at two sites don't care. */
export function RefractionLesson() {
  const [k, setK] = useState(0.55);
  const [arc, setArc] = useState(7.2); // degrees between sites
  const dipTrue = 1.0; // degrees, for a hill on a mid-sized planet
  const dipSeen = dipTrue * Math.sqrt(1 - k);
  const Rerr = 1 / (1 - k);
  const cx = 150;
  const cy = 260;
  const R = 150;
  const a1 = -90;
  const a2 = -90 + arc * 3; // exaggerated for the drawing
  const P1 = [cx + R * Math.cos((a1 * Math.PI) / 180), cy + R * Math.sin((a1 * Math.PI) / 180)];
  const P2 = [cx + R * Math.cos((a2 * Math.PI) / 180), cy + R * Math.sin((a2 * Math.PI) / 180)];
  return (
    <LessonShell
      kicker="Chapter 3 · Thick Air"
      title="Light bends in air — measure the planet another way"
      demo={
        <Demo h={360}>
          <svg viewBox="0 0 600 280" style={{ width: '100%' }}>
            <ArrowDefs />
            {/* Left: refraction near the horizon */}
            <path d="M 20 200 Q 150 180 280 200" fill="#6b5a41" />
            <line x1={40} y1={110} x2={270} y2={200} stroke="rgba(255,255,255,0.35)" strokeDasharray="4 4" />
            <path d={`M 40 110 Q 150 ${110 + 50 * (1 - k)} 270 ${200 - 40 * k}`} fill="none" stroke="#ffc46b" strokeWidth={2} markerEnd="url(#arrow-amber)" />
            <text x={40} y={100} fill="#93a2c3" fontSize={11}>
              eye on the hill
            </text>
            <text x={150} y={240} fill="#93a2c3" fontSize={11} textAnchor="middle">
              dip you see: {fmtN(dipSeen, 2)}° (true {fmtN(dipTrue, 2)}°)
            </text>
            <text x={150} y={258} fill={Rerr > 1.3 ? '#ff6b7d' : '#93a2c3'} fontSize={11} textAnchor="middle">
              horizon method overestimates R by ×{fmtN(Rerr, 2)}
            </text>
            {/* Right: Eratosthenes */}
            <g transform="translate(300,0)">
              <circle cx={cx} cy={cy} r={R} fill="#3d3528" />
              <line x1={P1[0]} y1={P1[1]} x2={P1[0]} y2={P1[1] - 26} stroke="#e8eefc" strokeWidth={3} />
              <line x1={P2[0]} y1={P2[1]} x2={P2[0] + ((P2[0] - cx) / R) * 26} y2={P2[1] + ((P2[1] - cy) / R) * 26} stroke="#e8eefc" strokeWidth={3} />
              {[0, 1, 2, 3].map((i) => (
                <line key={i} x1={20 + i * 70} y1={0} x2={20 + i * 70} y2={60} stroke="#ffd36b" strokeWidth={1.5} markerEnd="url(#arrow-amber)" opacity={0.7} />
              ))}
              <line x1={cx} y1={cy} x2={P1[0]} y2={P1[1]} stroke="rgba(255,255,255,0.3)" />
              <line x1={cx} y1={cy} x2={P2[0]} y2={P2[1]} stroke="rgba(255,255,255,0.3)" />
              <text x={cx + 18} y={cy - 40} fill="#5be3a4" fontSize={11}>
                Δ = {fmtN(arc, 1)}°
              </text>
              <text x={cx} y={20} fill="#93a2c3" fontSize={11} textAnchor="middle">
                parallel sunlight at noon
              </text>
            </g>
          </svg>
          <Slider label="How thick the air is (refraction)" value={k} min={0} max={0.8} step={0.01} onChange={setK} fmt={(v) => `${Math.round(v * 100)}%`} />
          <Slider label="Difference in noon sun angle" value={arc} min={2} max={15} step={0.1} onChange={setArc} fmt={(v) => `${fmtN(v, 1)}°`} />
          <Note>
            Two sites {fmtN(800, 0)} km apart with Δ = {fmtN(arc, 1)}° → R = 800 km / {fmtN((arc * Math.PI) / 180, 4)} rad = {fmtN(800 / ((arc * Math.PI) / 180), 0)} km.
          </Note>
        </Demo>
      }
      formula={<>R = d / Δ, with Δ in radians (d = distance between the sites, due north–south)</>}
      keyIdea="Near the horizon, light skims through the thickest air and bends, so the horizon looks higher than it is — the dip shrinks and the planet seems bigger. At noon the sun is high, its light crosses little air, and two stick shadows a known distance apart give the planet’s size directly."
      tip="Drive the rover due north so both sticks see noon at the same moment. Measure the shortest shadow of the day at each site — that is noon."
      warn="If two methods disagree badly, one of them has a systematic error. Repeating the bad one doesn’t fix it."
    >
      <P>
        Around 240 BC Eratosthenes noticed that at noon on the solstice the sun shone straight down a well in Syene, while in Alexandria, 800 km
        north, a stick still cast a short shadow. The sun’s rays are parallel, so the difference in angle is the slice of the Earth between the two
        cities.
      </P>
      <P>Raise the air thickness on the left: the horizon method goes badly wrong. The shadow method on the right doesn’t care.</P>
    </LessonShell>
  );
}

/** Chapter 5: an inner planet never stands opposite the star; greatest elongation and transits. */
export function InnerLesson() {
  const [ratio, setRatio] = useState(0.68);
  const [ang, setAng] = useState(40);
  const cx = 170;
  const cy = 150;
  const a1 = 120;
  const a2 = a1 * ratio;
  const us = [cx + a1, cy];
  const th = (ang * Math.PI) / 180;
  const pl = [cx + a2 * Math.cos(th), cy - a2 * Math.sin(th)];
  // Elongation: angle at us between the star and the planet.
  const v1 = [cx - us[0], cy - us[1]];
  const v2 = [pl[0] - us[0], pl[1] - us[1]];
  const elong = (Math.acos((v1[0] * v2[0] + v1[1] * v2[1]) / (Math.hypot(...v1) * Math.hypot(...v2))) * 180) / Math.PI;
  const maxE = (Math.asin(ratio) * 180) / Math.PI;
  const transit = Math.abs(((ang % 360) + 360) % 360) < 2.5 || Math.abs((((ang % 360) + 360) % 360) - 360) < 2.5;
  return (
    <LessonShell
      kicker="Chapter 5 · Inward"
      title="Inner planets: elongation and transits"
      demo={
        <Demo h={340}>
          <svg viewBox="0 0 600 300" style={{ width: '100%' }}>
            <ArrowDefs />
            <circle cx={cx} cy={cy} r={a1} fill="none" stroke="rgba(255,196,107,0.3)" />
            <circle cx={cx} cy={cy} r={a2} fill="none" stroke="rgba(108,196,255,0.35)" />
            <circle cx={cx} cy={cy} r={10} fill="#ffd36b" />
            <circle cx={us[0]} cy={us[1]} r={6} fill="#ffc46b" />
            <text x={us[0] + 8} y={us[1] + 16} fill="#ffc46b" fontSize={11}>
              us
            </text>
            <circle cx={pl[0]} cy={pl[1]} r={5} fill="#6cc4ff" />
            <line x1={us[0]} y1={us[1]} x2={cx} y2={cy} stroke="rgba(255,255,255,0.35)" />
            <line x1={us[0]} y1={us[1]} x2={pl[0]} y2={pl[1]} stroke="#6cc4ff" />
            <text x={us[0] - 60} y={us[1] - 10} fill={Math.abs(elong - maxE) < 1 ? '#5be3a4' : '#93a2c3'} fontSize={12}>
              elongation {fmtN(elong, 1)}°
            </text>
            {/* Star disk with a transit dot */}
            <circle cx={480} cy={110} r={60} fill="#ffd36b" />
            {transit && <circle cx={480 - ang * 12} cy={110} r={5} fill="#05070f" />}
            <text x={480} y={190} fill="#93a2c3" fontSize={11} textAnchor="middle">
              the star through a solar filter
            </text>
            <text x={480} y={208} fill={transit ? '#5be3a4' : '#5d6a88'} fontSize={12} textAnchor="middle">
              {transit ? 'Transit! The planet crosses the star.' : 'no transit now'}
            </text>
            <text x={480} y={250} fill="#93a2c3" fontSize={11} textAnchor="middle">
              greatest elongation: sin ε = a₂/a₁
            </text>
            <text x={480} y={268} fill="#6cc4ff" fontSize={12} textAnchor="middle">
              ε = {fmtN(maxE, 1)}° for a₂/a₁ = {fmtN(ratio, 2)}
            </text>
          </svg>
          <Slider label="Where the planet is on its orbit" value={ang} min={-180} max={180} step={1} onChange={setAng} fmt={(v) => `${v}°`} />
          <Slider label="Orbit size a₂/a₁" value={ratio} min={0.3} max={0.9} step={0.01} onChange={setRatio} fmt={(v) => fmtN(v, 2)} />
          <Note>Move the planet until the elongation is largest: the line from us just grazes its orbit, at a right angle to the planet–star line.</Note>
        </Demo>
      }
      formula={
        <>
          sin ε(max) = a₂ / a₁,   1/P₂ = 1/P₁ + 1/S
          <br />
          S = time from one transit to the next
        </>
      }
      keyIdea="An inner planet never strays far from the star: it swings out to its greatest elongation and back, so you only see it in twilight. When it passes exactly between us and the star you can watch it cross the star’s face — a transit — and time it to the minute."
      tip="Transits come once per synodic period. Two of them give S; the moment of either one fixes where the planets are. Measure its distance by parallax when it is high in a dark twilight sky, near greatest elongation."
      warn="Never look for an inner planet near the star without the solar filter. And it laps us, so its year comes from 1/P₂ = 1/P₁ + 1/S — a plus, not a minus."
    >
      <P>
        Copernicus measured the orbits of Venus and Mercury with nothing more than their greatest elongation: when the planet looks farthest from the
        sun, our line of sight just touches its orbit, so sin ε = a₂/a₁.
      </P>
      <P>
        In 1761 and 1769 observers spread across the world to time the transits of Venus. The tiny differences between their timings gave the first
        good distance to the Sun.
      </P>
    </LessonShell>
  );
}


/** Chapter 4: Kepler's first and second laws on an ellipse. */
export function EllipseLesson() {
  const [e, setE] = useState(0.4);
  const [phase, setPhase] = useState(0.15);
  const a = 120;
  const b = a * Math.sqrt(1 - e * e);
  const cx = 200;
  const cy = 150;
  // Star at the right-hand focus; perihelion on the right.
  const fx = cx + a * e;
  const pos = (f: number) => {
    const M = 2 * Math.PI * f;
    let E = M;
    for (let i = 0; i < 30; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    return [cx + a * Math.cos(E), cy - b * Math.sin(E)];
  };
  // Two wedges swept in the same time: one where the planet is now, one half an orbit later.
  const wedge = (f0: number) => {
    const pts = Array.from({ length: 13 }, (_, i) => pos(f0 + (0.08 * i) / 12));
    return `M${fx},${cy} ` + pts.map((p) => `L${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ') + ' Z';
  };
  const p = pos(phase);
  const r = Math.hypot(p[0] - fx, p[1] - cy) / a;
  const speed = Math.sqrt(2 / r - 1); // vis-viva, in units of the circular speed at a
  return (
    <LessonShell
      kicker="Chapter 4 · The Long Ellipse"
      title="Kepler’s laws: ellipses and equal areas"
      demo={
        <Demo h={360}>
          <svg viewBox="0 0 600 300" style={{ width: '100%' }}>
            <ellipse cx={cx} cy={cy} rx={a} ry={b} fill="none" stroke="rgba(108,196,255,0.45)" />
            <path d={wedge(phase)} fill="rgba(108,196,255,0.25)" stroke="rgba(108,196,255,0.6)" />
            <path d={wedge(phase + 0.5)} fill="rgba(255,196,107,0.22)" stroke="rgba(255,196,107,0.6)" />
            <circle cx={fx} cy={cy} r={9} fill="#ffd36b" />
            <circle cx={cx - a * e} cy={cy} r={2.5} fill="#5d6a88" />
            <text x={cx - a * e} y={cy + 16} fill="#5d6a88" fontSize={10} textAnchor="middle">
              empty focus
            </text>
            <circle cx={p[0]} cy={p[1]} r={6} fill="#6cc4ff" />
            <text x={cx + a + 6} y={cy - 6} fill="#93a2c3" fontSize={10}>
              perihelion
            </text>
            <text x={cx - a - 6} y={cy - 6} fill="#93a2c3" fontSize={10} textAnchor="end">
              aphelion
            </text>
            <text x={430} y={70} fill="#93a2c3" fontSize={12}>
              Same time, same area:
            </text>
            <text x={430} y={90} fill="#6cc4ff" fontSize={12}>
              blue wedge = gold wedge
            </text>
            <text x={430} y={130} fill="#93a2c3" fontSize={12}>
              distance r = {fmtN(r, 2)} a
            </text>
            <text x={430} y={150} fill={speed > 1 ? '#5be3a4' : '#ffc46b'} fontSize={12}>
              speed = {fmtN(speed, 2)} × average
            </text>
            <text x={430} y={190} fill="#93a2c3" fontSize={11}>
              closest {fmtN(1 - e, 2)} a · farthest {fmtN(1 + e, 2)} a
            </text>
          </svg>
          <Slider label="Eccentricity e" value={e} min={0} max={0.8} step={0.01} onChange={setE} fmt={(v) => fmtN(v, 2)} />
          <Slider label="Where the planet is (fraction of its year)" value={phase} min={0} max={1} step={0.005} onChange={setPhase} fmt={(v) => fmtN(v, 3)} />
          <Note>Both wedges are swept in the same time. Near the star the wedge is short and wide; far away it is long and thin — the areas match.</Note>
        </Demo>
      }
      formula={
        <>
          r = a(1 − e²) / (1 + e cos θ),   v² = GM(2/r − 1/a)
          <br />
          P² = 4π²a³/(GM) — the period depends only on a, not on e
        </>
      }
      keyIdea="Planets move on ellipses with the star at one focus (first law), sweeping equal areas in equal times (second law): fast near the star, slow far away. So oppositions come unevenly, the planet’s distance at opposition changes, and a transfer aimed at the circle you assumed will miss."
      tip="Log the blue planet every clear night for most of its orbit. In the Orbit tab, the fit finds the one ellipse that matches every sight line — Kepler’s own method — and gives P₂, e and the direction of perihelion ϖ."
      warn="The period still follows Kepler’s third law with a = the semi-major axis (half the long axis), so P₂ still gives a₂. What changes is where on the ellipse the planet is, and how fast it moves there."
    >
      <P>
        Kepler spent six years on Tycho Brahe’s observations of Mars. A circle missed them by 8 arcminutes — small, but Tycho never erred that much. So
        Kepler threw out the circle, and found the ellipse.
      </P>
      <P>
        His trick: Mars returns to the same point of its orbit every 687 days, while Earth is somewhere else each time. Two sight lines to the same
        point from two known places fix where that point is. Do that again and again, and the orbit draws itself.
      </P>
    </LessonShell>
  );
}

/** Chapter 6: tidal locking, and flares as a random process with a steady rate. */
export function LockedLesson() {
  const [spin, setSpin] = useState(1); // turns per orbit
  const [orbit, setOrbit] = useState(0.15); // fraction of an orbit
  const [seed, setSeed] = useState(1);
  const cx = 150;
  const cy = 150;
  const R = 95;
  const th = 2 * Math.PI * orbit;
  const px = cx + R * Math.cos(th);
  const py = cy - R * Math.sin(th);
  // The marked face points along this angle (it turns `spin` times per orbit, relative to the stars).
  const face = 2 * Math.PI * orbit * spin + Math.PI;
  const facesStar = Math.cos(face - (th + Math.PI)) > 0.95;
  // Flares: exponential gaps with a mean of 2.5 days, over 60 days.
  let r = seed * 9301 + 49297;
  const rnd = () => ((r = (r * 9301 + 49297) % 233280) + 0.5) / 233280;
  const gaps: number[] = [];
  for (let t = 0; t < 60; ) {
    const g = -Math.log(rnd()) * 2.5;
    t += g;
    if (t < 60) gaps.push(g);
  }
  const bins = Array.from({ length: 8 }, (_, i) => gaps.filter((g) => g >= i && g < i + 1).length);
  const maxBin = Math.max(1, ...bins);
  let tt = 0;
  return (
    <LessonShell
      kicker="Chapter 6 · Red Dwarf"
      title="Tidal locking and flares"
      demo={
        <Demo h={380}>
          <svg viewBox="0 0 600 300" style={{ width: '100%' }}>
            <circle cx={cx} cy={cy} r={R} fill="none" stroke="rgba(255,120,90,0.3)" />
            <circle cx={cx} cy={cy} r={12} fill="#ff7a52" />
            <circle cx={px} cy={py} r={14} fill="#33405f" />
            <path d={`M${px},${py} L${px + 14 * Math.cos(face)},${py - 14 * Math.sin(face)}`} stroke="#ffd36b" strokeWidth={3} />
            <text x={cx} y={285} fill={spin === 1 ? '#5be3a4' : '#93a2c3'} fontSize={12} textAnchor="middle">
              {spin === 1 ? 'Locked: the same face always points at the star' : facesStar ? 'Day at the marked spot' : 'The marked spot turns into night'}
            </text>
            <text x={320} y={24} fill="#93a2c3" fontSize={12}>
              Gaps between flares (days), 60 days of watching
            </text>
            {bins.map((b, i) => (
              <g key={i}>
                <rect x={320 + i * 32} y={210 - (b / maxBin) * 160} width={26} height={(b / maxBin) * 160} fill="rgba(255,122,82,0.7)" />
                <text x={333 + i * 32} y={226} fill="#5d6a88" fontSize={10} textAnchor="middle">
                  {i}
                </text>
              </g>
            ))}
            {gaps.slice(0, 40).map((g, i) => {
              tt += g;
              return <line key={i} x1={320 + (tt / 60) * 256} x2={320 + (tt / 60) * 256} y1={245} y2={262} stroke="#ffc46b" />;
            })}
            <text x={320} y={280} fill="#93a2c3" fontSize={11}>
              {gaps.length} flares · mean gap {fmtN(gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length), 1)} d
            </text>
          </svg>
          <Slider label="Spin: turns per orbit" value={spin} min={0.5} max={4} step={0.5} onChange={setSpin} fmt={(v) => fmtN(v, 1)} />
          <Slider label="Where the planet is on its orbit" value={orbit} min={0} max={1} step={0.01} onChange={setOrbit} fmt={(v) => fmtN(v, 2)} />
          <button className="btn small" onClick={() => setSeed(seed + 1)}>
            Watch another 60 days
          </button>
          <Note>Short gaps are the most common, and long quiet spells still happen. Each run differs; the average barely moves.</Note>
        </Demo>
      }
      formula={
        <>
          locked: rotation period = orbital period,   P₁ = 360° / (sky turn rate)
          <br />
          chance of no flare for t days = e^(−t / mean gap)
        </>
      }
      keyIdea="Tides slow a planet close to its star until it turns once per orbit — tidally locked, like our Moon facing Earth. The star then stands still in the sky, so there is no day to measure the year with; but the planet still turns once per orbit relative to the stars, so the starry sky wheels round once a year."
      tip="Log the sky’s turn every few days and fit the rate, just like the star’s drift elsewhere. Flares come at random: plan with the rate (about one every 2–3 days, lasting hours), not with a schedule."
      warn="A flare tells you nothing about when the next one comes — the gaps are random. Long gaps are rarer than short ones, but they never become ‘due’."
    >
      <P>
        Most stars in the galaxy are red dwarfs, and many of their planets are probably tidally locked. Their temperate zone is so close in that a year
        lasts weeks.
      </P>
      <P>
        Flares are counted the way radioactive decays are: a steady average rate, random timing. The gaps between them follow an exponential curve.
      </P>
    </LessonShell>
  );
}

/** Chapter 7: a gravity assist, seen from the giant and from the star. */
export function SlingshotLesson() {
  const [rp, setRp] = useState(3); // giant radii
  const [mass, setMass] = useState(1); // relative to what you measured
  const vInf = 6; // km/s relative to the giant
  const vG = 13; // giant's orbital speed, km/s
  const mu = 1.27e8 * 3; // km³/s², a heavy giant
  const R = 70000; // km
  const turn = (m: number) => 2 * Math.asin(1 / (1 + (rp * R * vInf * vInf) / (mu * m)));
  const dPlan = turn(1);
  const dReal = turn(mass);
  // Incoming relative velocity points backwards-and-inwards; outgoing is turned by δ.
  const inAng = Math.PI + 0.5;
  const rel = (a: number) => [vInf * Math.cos(a), vInf * Math.sin(a)];
  const vin = rel(inAng);
  const vout = rel(inAng - dReal);
  const voutPlan = rel(inAng - dPlan);
  const helioIn = Math.hypot(vin[0] + vG, vin[1]);
  const helioOut = Math.hypot(vout[0] + vG, vout[1]);
  const S = 9;
  const ox = 140;
  const oy = 150;
  const arrow = (x0: number, y0: number, v: number[], c: string, dash = false) => (
    <line x1={x0} y1={y0} x2={x0 + v[0] * S} y2={y0 - v[1] * S} stroke={c} strokeWidth={2.2} strokeDasharray={dash ? '5 4' : undefined} markerEnd="url(#arrow)" />
  );
  const missDeg = ((dReal - dPlan) * 180) / Math.PI;
  return (
    <LessonShell
      kicker="Chapter 7 · Slingshot"
      title="Gravity assists"
      demo={
        <Demo h={360}>
          <svg viewBox="0 0 600 300" style={{ width: '100%' }}>
            <ArrowDefs />
            <circle cx={ox} cy={oy} r={22} fill="#e9d6a8" />
            <text x={ox} y={oy + 40} fill="#93a2c3" fontSize={11} textAnchor="middle">
              the giant (its own view)
            </text>
            {arrow(ox, oy, vin.map((x) => -x), '#93a2c3')}
            {arrow(ox, oy, vout, '#6cc4ff')}
            {mass !== 1 && arrow(ox, oy, voutPlan, 'rgba(255,196,107,0.8)', true)}
            <text x={ox - 120} y={30} fill="#93a2c3" fontSize={12}>
              In: {fmtN(vInf, 1)} km/s · Out: {fmtN(vInf, 1)} km/s
            </text>
            <text x={ox - 120} y={48} fill="#93a2c3" fontSize={12}>
              Same speed, new direction: turned {fmtN((dReal * 180) / Math.PI, 0)}°
            </text>
            <text x={360} y={60} fill="#93a2c3" fontSize={12}>
              Seen from the star (add the giant’s {vG} km/s):
            </text>
            <text x={360} y={84} fill="#ffc46b" fontSize={13}>
              before {fmtN(helioIn, 1)} km/s → after {fmtN(helioOut, 1)} km/s
            </text>
            <text x={360} y={108} fill={helioOut > helioIn ? '#5be3a4' : '#ff8a7a'} fontSize={12}>
              {helioOut > helioIn ? `+${fmtN(helioOut - helioIn, 1)} km/s for free` : 'slowed down'}
            </text>
            <text x={360} y={160} fill="#93a2c3" fontSize={12}>
              Real mass ÷ your measured mass: {fmtN(mass, 2)}
            </text>
            <text x={360} y={180} fill={Math.abs(missDeg) < 1 ? '#5be3a4' : '#ff8a7a'} fontSize={12}>
              {Math.abs(missDeg) < 0.05 ? 'Bends exactly as planned.' : `Bends ${fmtN(Math.abs(missDeg), 1)}° ${missDeg > 0 ? 'more' : 'less'} than planned.`}
            </text>
            <text x={360} y={200} fill="#93a2c3" fontSize={11}>
              dashed: the direction you planned
            </text>
          </svg>
          <Slider label="Closest approach (giant radii)" value={rp} min={1.5} max={20} step={0.5} onChange={setRp} fmt={(v) => fmtN(v, 1)} />
          <Slider label="Real mass ÷ your measurement" value={mass} min={0.8} max={1.2} step={0.01} onChange={setMass} fmt={(v) => fmtN(v, 2)} />
          <Note>Pass closer and the giant turns you more. A heavier giant than you measured turns you more than you planned.</Note>
        </Demo>
      }
      formula={
        <>
          turn δ = 2 asin(1 / (1 + r_p v∞² / GM_G))
          <br />
          relative to the giant: |v∞,out| = |v∞,in|; relative to the star: v = v_giant + v∞
        </>
      }
      keyIdea="Relative to the giant, a flyby only changes your direction — you leave as fast as you came. But the giant itself is moving around the star, so turning your velocity towards its direction of motion adds its speed to yours. You leave faster, relative to the star, than you arrived: speed borrowed from the giant’s orbit."
      tip="The bend depends on the giant’s mass and on how close you pass. ECHO aims the flyby with YOUR mass. Weigh the giant carefully (its moon), and pin down where it will be (its oppositions, sharpened with the orbit fit)."
      warn="The giant pays for your speed by slowing down a tiny, tiny bit. It never notices — but your error bars will."
    >
      <P>
        Voyager 2 used Jupiter, Saturn and Uranus to reach Neptune in 12 years instead of 30. Cassini swung past Venus twice, Earth and Jupiter to reach
        Saturn.
      </P>
      <P>The idea came from asking what a planet’s gravity looks like from the planet’s own point of view: just a turn. Everything else is adding velocities.</P>
    </LessonShell>
  );
}
