import { Equation } from '../../common/Equation';
import { useMemo, useState } from 'react';
import { makeRng } from '../../../engine/rng';
import { scoreQuantity } from '../../../engine/scoring';
import { ArrowDefs, Demo, LessonShell, Note, P, Slider, fmtN } from './common';

const TRUE_ROD = 1.0;

/** Repeated readings, resolution and scatter-only error versus shared bias. */
export function MeasureLesson() {
  const [readings, setReadings] = useState<number[]>([]);
  const [bent, setBent] = useState(false);
  const [coarse, setCoarse] = useState(false);
  const [showTruth, setShowTruth] = useState(false);
  const rng = useMemo(() => makeRng(5), []);
  const take = (n: number) => {
    // Generate on the observation action, outside a replayable React updater.
    const fresh = Array.from({ length: n }, () => {
      const v = TRUE_ROD + (bent ? 0.006 : 0) + rng.normal(0, 0.004);
      return coarse ? Math.round(v / .002) * .002 : v;
    });
    setReadings((r) => [...r, ...fresh]);
  };
  const n = readings.length;
  const mean = n ? readings.reduce((a, b) => a + b, 0) / n : NaN;
  const sd = n > 1 ? Math.sqrt(readings.reduce((a, b) => a + (b - mean) ** 2, 0) / (n - 1)) : NaN;
  const se = sd / Math.sqrt(n);
  const lo = Math.floor(Math.min(.985, ...readings) / .005) * .005;
  const hi = Math.ceil(Math.max(1.015, ...readings) / .005) * .005;
  const X = (v: number) => 30 + ((v - lo) / (hi - lo)) * 540;
  return (
    <LessonShell
      kicker="Lesson 1 · Measuring"
      title="Every measurement has an error"
      demo={
        <Demo>
          <div className="faint" style={{ marginBottom: 8 }}>Practice model · Gaussian scatter σ = 4 mm{bent ? ' · shared +6 mm bias' : ' · no added bias'}{coarse ? ' · rounded to 2 mm' : ' · unrounded samples'}</div>
          <svg viewBox="0 0 600 190" role="img" aria-label="Practice readings of a hypothetical one-metre rod">
            <ArrowDefs />
            <line x1={30} y1={120} x2={570} y2={120} stroke="#5d6a88" />
            {Array.from({ length: 7 }, (_, i) => (
              <g key={i}>
                <line x1={X(lo + i * (hi - lo) / 6)} y1={120} x2={X(lo + i * (hi - lo) / 6)} y2={132} stroke="#5d6a88" />
                <text x={X(lo + i * (hi - lo) / 6)} y={148} fill="#93a2c3" fontSize={11} textAnchor="middle" fontFamily="JetBrains Mono">
                  {(lo + i * (hi - lo) / 6).toFixed(3)}
                </text>
              </g>
            ))}
            {readings.map((r, i) => (
              <circle key={i} cx={X(r)} cy={110 - (i % 12) * 7} r={4} fill="#6cc4ff" opacity={0.75}><title>Reading {i + 1}: {r.toFixed(6)} m</title></circle>
            ))}
            {n > 0 && (
              <>
                <line x1={X(mean)} y1={20} x2={X(mean)} y2={120} stroke="#ffc46b" strokeWidth={2} />
                <text x={X(mean)} y={14} fill="#ffc46b" fontSize={12} textAnchor="middle">
                  average · scatter-only bar
                </text>
              </>
            )}
            {n > 1 && <g stroke="#ffc46b" strokeWidth={2}>
              <line x1={X(mean - se)} y1={30} x2={X(mean + se)} y2={30} />
              <line x1={X(mean - se)} y1={25} x2={X(mean - se)} y2={35} />
              <line x1={X(mean + se)} y1={25} x2={X(mean + se)} y2={35} />
            </g>}
            {showTruth && (
              <>
                <line x1={X(TRUE_ROD)} y1={40} x2={X(TRUE_ROD)} y2={120} stroke="#5be3a4" strokeWidth={2} strokeDasharray="5 4" />
                <text x={X(TRUE_ROD)} y={176} fill="#5be3a4" fontSize={12} textAnchor="middle">
                  true length
                </text>
              </>
            )}
          </svg>
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn primary small" onClick={() => take(1)}>
              Take a reading
            </button>
            <button className="btn small" onClick={() => take(10)}>
              Take 10
            </button>
            <button className="btn small ghost" onClick={() => setReadings([])}>
              Reset
            </button>
          </div>
          <div className="stack" style={{ gap: 8 }}>
            <label className="row" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={bent} onChange={(e) => (setBent(e.target.checked), setReadings([]))} /> Biased ruler (+6 mm)
            </label>
            <label className="row" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={coarse} onChange={(e) => (setCoarse(e.target.checked), setReadings([]))} /> Coarse ruler (2 mm steps)
            </label>
            <label className="row" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={showTruth} onChange={(e) => setShowTruth(e.target.checked)} /> Reveal the truth
            </label>
          </div>
          <div className="faint" style={{ marginTop: 8 }}>Changing the ruler starts a new set of practice readings. Revealing the truth changes only the display. The real expedition is separate.</div>
          <dl className="kv">
            <dt>Readings</dt>
            <dd>{n}</dd>
            <dt>Average</dt>
            <dd>{n ? `${fmtN(mean, 4)} m` : '—'}</dd>
            <dt>Observed spread (s)</dt>
            <dd>{n > 1 ? `${fmtN(sd * 1000, 1)} mm` : '—'}</dd>
            <dt>Scatter-only standard error</dt>
            <dd className="amber">{n > 1 ? `± ${fmtN(se * 1000, 2)} mm` : '—'}</dd>
          </dl>
        </Demo>
      }
      formula={<Equation tex={"\\bar{x}=\\frac{x_1+x_2+\\cdots+x_N}{N} \\\\ s_{\\bar{x}}=\\frac{s}{\\sqrt{N}}\\quad\\text{(independent repeats, scatter only)}"} />}
      keyIdea="For independent repeats of a stable quantity, the scatter of single readings stays the same, but the random error of the average shrinks like 1/√N: 4 readings halve it, 100 readings cut it to a tenth. New timestamps alone do not establish independence."
      warn="A shared error can shift all readings together. Try the biased ruler: more independent readings can narrow the scatter-only bar while the mean stays displaced. Check calibration or compare another method. The bar omits shared bias and is not a guaranteed bound."
      tip="Your timing and aiming matter. Instrument resolution, changing conditions and simplified simulated receiver or tracker scatter matter too. Inspect an instrument’s recorded conditions and distinguish a new observation from another view of the same data."
    >
      <P>
        This hypothetical rod is one metre long. Each click generates a new practice sample with illustrative random scatter; it does not measure your real reaction time or aiming. The examples are simplified models, not calibrated specifications for every tool in the game.
      </P>
      <P>
        Press <b>Take a reading</b> a few times. Each blue dot is one reading. The amber line is their <b>average</b>, and the amber bar shows
        a scatter-only estimate of uncertainty in that average. Turn on the coarse scale to see finite reading steps; turn on the biased ruler to see a shared shift. Zero observed scatter would not prove perfect accuracy.
      </P>
      <details className="measurement-help" aria-label="Connect error sources to instruments"><summary>Connect this to your instruments</summary>
        <p><b>Technique:</b> stopwatch start/stop timing and telescope wire placement depend on your actions. Compare careful independent measurements.</p>
        <p><b>Resolution:</b> scale divisions and reported angle steps limit what one reading can distinguish. More displayed digits do not establish greater accuracy.</p>
        <p><b>Changing conditions and receiver scatter:</b> turbulent images can change between observations; probe and tracker readings also use simplified simulated scatter. A frozen image or received sample stays the same when viewed again.</p>
        <p><b>Shared systematic effects:</b> an incorrect length calibration or refraction model can affect a whole set. Use a justified correction, calibration or independent method, and retain its uncertainty.</p>
      </details>
    </LessonShell>
  );
}

/** Honest error bars: the log score rewards a range that contains the truth. */
export function HonestyLesson() {
  const truth = 9.81;
  const [value, setValue] = useState(9.86);
  const [sigma, setSigma] = useState(0.05);
  const [reveal, setReveal] = useState(false);
  const sc = scoreQuantity(value, sigma, truth);
  const X = (v: number) => 30 + ((v - 9.4) / 0.9) * 540;
  const curve = Array.from({ length: 200 }, (_, i) => {
    const v = 9.4 + (i / 199) * 0.9;
    const y = Math.exp(-0.5 * ((v - value) / sigma) ** 2);
    return `${X(v)},${150 - y * 110}`;
  }).join(' ');
  return (
    <LessonShell
      kicker="Lesson 2 · Honesty"
      title="Error bars: say how sure you are"
      demo={
        <Demo>
          <svg viewBox="0 0 600 190">
            <line x1={30} y1={150} x2={570} y2={150} stroke="#5d6a88" />
            {[9.4, 9.6, 9.8, 10.0, 10.2].map((v) => (
              <text key={v} x={X(v)} y={168} fill="#93a2c3" fontSize={11} textAnchor="middle" fontFamily="JetBrains Mono">
                {v.toFixed(1)}
              </text>
            ))}
            <polyline points={curve} fill="none" stroke="#6cc4ff" strokeWidth={2} />
            <rect x={X(value - sigma)} y={150} width={X(value + sigma) - X(value - sigma)} height={6} fill="#6cc4ff" opacity={0.6} />
            <text x={X(value)} y={30} fill="#6cc4ff" fontSize={12} textAnchor="middle">
              your value ± error
            </text>
            {reveal && (
              <>
                <line x1={X(truth)} y1={35} x2={X(truth)} y2={150} stroke="#5be3a4" strokeWidth={2} strokeDasharray="5 4" />
                <text x={X(truth)} y={184} fill="#5be3a4" fontSize={12} textAnchor="middle">
                  truth
                </text>
              </>
            )}
          </svg>
          <Slider label="Your value of g (m/s²)" value={value} min={9.5} max={10.1} step={0.01} onChange={setValue} fmt={(v) => v.toFixed(2)} />
          <Slider label="Your ± error" value={sigma} min={0.005} max={0.4} step={0.005} onChange={setSigma} fmt={(v) => `± ${v.toFixed(3)}`} />
          <div className="row">
            <button className="btn small" onClick={() => (setValue(9.86), setSigma(0.06))}>
              Honest
            </button>
            <button className="btn small" onClick={() => (setValue(9.86), setSigma(0.008))}>
              Over-confident
            </button>
            <button className="btn small" onClick={() => (setValue(9.86), setSigma(0.35))}>
              Too cautious
            </button>
            <label className="row" style={{ fontSize: 13 }}>
              <input type="checkbox" checked={reveal} onChange={(e) => setReveal(e.target.checked)} /> Reveal truth
            </label>
          </div>
          {reveal ? (
            <div className="row between">
              <span>{sc.inside ? '✓ The truth is inside your range' : `✗ The truth is ${fmtN(sc.z, 1)}σ outside your range`}</span>
              <span className={`readout small ${sc.points > 50 ? 'green' : sc.points > 0 ? 'amber' : 'red'}`}>{sc.points} pts</span>
            </div>
          ) : (
            <Note>Tick “Reveal truth” to see how this entry would score.</Note>
          )}
        </Demo>
      }
      keyIdea="Write every result as value ± error, where the error is your honest estimate of how far off you might be. The score is highest for a small error bar that still contains the truth."
      warn="Claiming more precision than you have is punished hard. Over-confident: a tiny range that misses the truth scores below zero. Too cautious: a huge range is safe but earns almost nothing."
      tip="A good starting point for ± is the standard error of your readings (the tools show it). Add a little extra if you suspect a systematic error."
    >
      <P>
        Suppose you measured gravity and got <b>9.86 m/s²</b>. Is that exactly right? Almost certainly not. The question is: <i>how wrong</i>{' '}
        might it be?
      </P>
      <P>
        The blue bell curve shows what you are claiming: the true value is probably near the peak, and very likely within the shaded bar. Try the
        three presets, then reveal the truth.
      </P>
      <P>The game never tells you your real error during play — you have to judge it, just like a real scientist.</P>
    </LessonShell>
  );
}

/** How errors grow through powers and combine through sums. */
export function PropagationLesson() {
  const [rel, setRel] = useState(2);
  const [power, setPower] = useState(3);
  const [e1, setE1] = useState(1);
  const [e2, setE2] = useState(1);
  const out = rel * Math.abs(power);
  const comb = Math.sqrt((2 * e1) ** 2 + e2 ** 2);
  const bar = (v: number, color: string, label: string) => (
    <div className="row" style={{ gap: 8 }}>
      <span style={{ width: 120, fontSize: 13 }}>{label}</span>
      <div style={{ flex: 1, height: 14, background: 'rgba(255,255,255,0.06)', borderRadius: 7 }}>
        <div style={{ width: `${Math.min(100, v * 3.3)}%`, height: '100%', background: color, borderRadius: 7, transition: 'width 0.2s' }} />
      </div>
      <span className="mono" style={{ width: 60, textAlign: 'right' }}>
        {fmtN(v, 1)}%
      </span>
    </div>
  );
  return (
    <LessonShell
      kicker="Lesson · Errors travel"
      title="How errors grow along the chain"
      demo={
        <Demo h={260}>
          <b>1 · Powers multiply the error</b>
          <Slider label="Error in the input x" value={rel} min={0.5} max={10} step={0.5} onChange={setRel} fmt={(v) => `${v}%`} />
          <div className="row">
            {[
              [0.5, '√x'],
              [1, 'x'],
              [2, 'x²'],
              [3, 'x³'],
            ].map(([p, l]) => (
              <button key={l} className={`btn small ${power === p ? 'primary' : ''}`} onClick={() => setPower(p as number)}>
                result ∝ {l}
              </button>
            ))}
          </div>
          {bar(rel, '#6cc4ff', 'input x')}
          {bar(out, '#ffc46b', 'result')}
          <hr className="sep" />
          <b>2 · Independent errors add “in quadrature”</b>
          <div className="muted" style={{ fontSize: 13 }}>Planet mass M₁ = gR²/G uses g once and R twice.</div>
          <Slider label="Error in R₁" value={e1} min={0} max={5} step={0.1} onChange={setE1} fmt={(v) => `${v}%`} />
          <Slider label="Error in g" value={e2} min={0} max={5} step={0.1} onChange={setE2} fmt={(v) => `${v}%`} />
          {bar(2 * e1, '#b59cff', 'from R² (2×)')}
          {bar(e2, '#6cc4ff', 'from g')}
          {bar(comb, '#ffc46b', 'mass M₁')}
        </Demo>
      }
      formula={<Equation tex={"y\\propto x^n\\ \\Rightarrow\\ \\frac{\\sigma_y}{|y|}\\approx |n|\\frac{\\sigma_x}{|x|} \\\\ e_{\\mathrm{total}}=\\sqrt{e_1^2+e_2^2+\\cdots}\\quad\\text{(independent errors)}"} />}
      keyIdea="A small error early in the chain can become a big one later. The star’s mass depends on the cube of the orbit size, so a 2% error in distance becomes a 6% error in mass."
      warn="Quantities that appear with a big power deserve your most careful measurements: R₁ (squared in M₁) and the parallax distance (cubed in M★)."
      tip="Open ‘Where does this uncertainty come from?’ on a derived star in the progress sheet to see its contributions and try hypothetical error bars. ECHO propagates the errors you enter using an independent-input, first-order approximation; missing systematic errors still need your attention."
    >
      <P>
        Most numbers you need are not measured directly: they are <b>calculated</b> from other measurements. Each step carries the error along —
        and sometimes multiplies it.
      </P>
      <P>
        Two independent errors don’t simply add up, because they are unlikely to both be at their worst at the same time. They combine like the
        sides of a right triangle.
      </P>
    </LessonShell>
  );
}

/** Fuel as delta-v and where it goes. */
export function DeltaVLesson() {
  const [err, setErr] = useState(1);
  const escape = 11.6;
  const capture = 3.3;
  const correction = 0.05 + err * 0.35;
  const budget = 16.4;
  const left = budget - escape - capture - correction;
  const W = (v: number) => `${(v / Math.max(budget, escape + capture + correction)) * 100}%`;
  return (
    <LessonShell
      kicker="Lesson · Fuel"
      title="Fuel is measured as Δv — a change of speed"
      demo={
        <Demo h={220}>
          <Slider label="How wrong are your numbers (typical error)" value={err} min={0} max={6} step={0.25} onChange={setErr} fmt={(v) => `${v}%`} />
          <div style={{ display: 'flex', height: 26, borderRadius: 8, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
            <div style={{ width: W(escape), background: '#6cc4ff' }} title="escape" />
            <div style={{ width: W(correction), background: '#ffc46b', transition: 'width 0.2s' }} title="corrections" />
            <div style={{ width: W(capture), background: '#b59cff' }} title="capture" />
            <div style={{ flex: 1, background: left >= 0 ? 'rgba(91,227,164,0.5)' : 'var(--red)' }} />
          </div>
          <dl className="kv">
            <dt>
              <span style={{ color: '#6cc4ff' }}>■</span> Escape from the surface
            </dt>
            <dd>{fmtN(escape)} km/s</dd>
            <dt>
              <span style={{ color: '#ffc46b' }}>■</span> Course corrections
            </dt>
            <dd>{fmtN(correction)} km/s</dd>
            <dt>
              <span style={{ color: '#b59cff' }}>■</span> Braking into orbit
            </dt>
            <dd>{fmtN(capture)} km/s</dd>
            <dt>Ship carries</dt>
            <dd>{fmtN(budget)} km/s</dd>
            <dt>Left over</dt>
            <dd className={left >= 0 ? 'green' : 'red'}>{fmtN(left)} km/s</dd>
          </dl>
          {left < 0 && <div className="red">Out of fuel before reaching orbit — the ship flies past the blue planet.</div>}
        </Demo>
      }
      keyIdea="A rocket’s fuel is best counted as how much it can change its speed: Δv (“delta-v”). Every manoeuvre costs some Δv; when the total runs out, the ship can no longer steer."
      warn="Escaping the home planet takes most of the fuel and cannot be avoided. Mistakes in your measurements show up as course corrections — the only part you control."
      tip="Measure carefully and launch in a window: then corrections stay small and you arrive with fuel to spare (that also raises your grade)."
    >
      <P>
        In space there is no road to push against. To change speed or direction, the ship throws exhaust backwards. How much it can change its
        velocity in total is its <b>Δv budget</b> — shown in the top bar as <b>Fuel Δv</b>.
      </P>
      <P>
        Slide the error up: the course corrections grow, and eventually eat the whole margin. That is what bad numbers do to a real mission.
      </P>
    </LessonShell>
  );
}
