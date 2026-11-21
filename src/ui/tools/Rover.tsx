import { useEffect, useRef, useState } from 'react';
import { ARCSEC, DAY, DEG } from '../../engine/constants';
import { parallaxSite } from '../../engine/measure';
import { localFrame, observerPos, toHorizontal, topocentric } from '../../engine/sky';
import { norm, sub, unit } from '../../engine/vec';
import { sfx } from '../../game/audio';
import { flag } from '../../game/tutorial';
import { clock } from '../../game/clock';
import { fmt } from '../../game/format';
import { currentWorld } from '../../game/sim';
import { useGame } from '../../game/store';
import { acknowledgeObservation } from '../../game/measurementFeedback';
import { hasChallenge, seeingFactor } from '../../game/challenges';
import { hhmm, localSolarHours } from '../../game/time';
import { drawScope, scopeProjector } from '../../render/telescope';
import { CanvasView, canvasPoint } from '../common/CanvasView';
import { Formula, ReadingsTable, SanityWarning, SendReadings, ToolHeader } from '../common/sheetBits';
import { toast, useGameTime } from '../common/widgets';
import { SeeingConditions } from '../common/MeasurementNotes';
import { measuredParallax, projectedBaseline, type CameraMark } from '../../game/parallaxObservation';
import { ParallaxInvestigation } from '../tutorial/ParallaxInvestigation';
import { opticalStatus } from '../../game/observing';
import { ObservingStatus } from '../common/ObservingStatus';

export function Rover() {
  const { system: sys } = currentWorld();
  const s = useGame();
  const t = useGameTime(5);
  const speed = (s.settings.survival && s.survival.upgrades.includes('rover') ? 700 : 400) * 1000 * (hasChallenge(s, 'rover') ? 0.5 : 1); // m per day
  const [target, setTarget] = useState(Math.max(1000, Math.round(s.rover.target / 1e5) * 100 || 3000));
  const cap = s.parallaxPair ?? null;
  const [frame, setFrame] = useState<'A' | 'B'>('A');
  const [blink, setBlink] = useState(false), [blinkMs, setBlinkMs] = useState(700);
  const shownFrame = useRef<'A' | 'B'>('A'), dragging = useRef<'A' | 'B' | null>(null);
  const marks = cap?.marks ?? { A: null, B: null };
  const setMark = (key: 'A' | 'B', pos: CameraMark) => {
    const pair = useGame.getState().parallaxPair;
    if (pair && pair.id === cap?.id && [pos.x, pos.y].every(Number.isFinite)) useGame.setState({ parallaxPair: { ...pair, viewedB: pair.viewedB || key === 'B', marks: { ...pair.marks, [key]: pos } } });
  };
  const show = (key: 'A' | 'B') => {
    setBlink(false); setFrame(key);
    const pair = useGame.getState().parallaxPair;
    if (pair && key === 'B' && !pair.viewedB) useGame.setState({ parallaxPair: { ...pair, viewedB: true } });
  };
  useEffect(() => {
    if (!cap || !blink) return;
    const timer = setInterval(() => {
      setFrame((f) => f === 'A' ? 'B' : 'A');
      const pair = useGame.getState().parallaxPair;
      if (pair && !pair.viewedB) useGame.setState({ parallaxPair: { ...pair, viewedB: true } });
    }, blinkMs);
    const hide = () => { if (document.hidden) setBlink(false); };
    document.addEventListener('visibilitychange', hide);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', hide); };
  }, [cap?.id, blink, blinkMs]);
  const [fovAs, setFovAs] = useState(150);

  const driving = s.rover.arriveAt > t;
  // Chapter 7 triangulates the nearer, brighter giant instead of the far blue planet.
  const body = sys.giant ? 'giant' : 'target';
  const what = sys.giant ? 'giant' : 'blue planet';
  const roverSite = parallaxSite(sys, sys.site, s.rover.dist);
  const midSite = parallaxSite(sys, sys.site, s.rover.dist / 2);

  const siteInfo = (site: typeof sys.site) => {
    const f = localFrame(sys, t, site);
    return {
      alt: toHorizontal(topocentric(sys, body, t, site), f).alt / DEG,
      sun: toHorizontal(topocentric(sys, 'star', t, site), f).alt / DEG,
    };
  };
  const A = siteInfo(sys.site);
  const B = siteInfo(roverSite);
  const M = siteInfo(midSite);
  // On a locked planet the rover drives south for parallax (engine/measure.ts parallaxSite).
  const heading = sys.features.locked ? 'south' : 'east';
  const campView = opticalStatus(sys, s, t, 'parallax'), roverView = opticalStatus(sys, s, t, 'parallax', { site: roverSite });
  const view = campView.ok ? roverView : campView;
  const setupReason = !s.identified ? 'Identify the blue planet first.' : driving ? 'Rover still driving.' : s.rover.dist <= 0 ? 'Send the rover out first.' : '';
  const canImage = !setupReason && campView.ok && roverView.ok;

  const drive = () => {
    if (s.northTrip.dist > 0 || s.northTrip.arriveAt > clock.t) return toast('The rover is out north at the shadow stick. Bring it back first.');
    if (target > 0 && (s.surface.roverX !== null || (s.surface.task && s.surface.task.done > clock.t && s.surface.task.kind !== 'process')))
      return toast('The rover is out on the surface map. Bring it home first.');
    const dist = Math.abs(target * 1000 - s.rover.dist);
    s.set({ rover: { dist: s.rover.dist, target: target * 1000, departAt: clock.t, arriveAt: clock.t + (dist / speed) * DAY } });
    sfx('radio');
    toast(`Rover underway: ${fmt(dist / speed, 1)} days`);
  };

  const capture = () => {
    const tt = clock.t, current = useGame.getState(), { system } = currentWorld();
    if (!current.identified || current.rover.arriveAt > tt || current.rover.dist <= 0) return toast('Recheck the rover deployment and arrival.');
    const liveSite = parallaxSite(system, system.site, current.rover.dist), liveBody = system.giant ? 'giant' : 'target';
    for (const [label, site] of [['Camp', system.site], ['Rover', liveSite]] as const) {
      const status = opticalStatus(system, current, tt, 'parallax', { site });
      if (!status.ok) return toast(`${label}: ${status.reason}`);
    }
    const vA = topocentric(system, liveBody, tt, system.site), vB = topocentric(system, liveBody, tt, liveSite);
    const id = `${current.runId}:${tt}:${current.rover.dist}`;
    const same = current.parallaxPair?.id === id ? current.parallaxPair : null;
    current.set({ parallaxPair: {
      id, at: tt,
      dirA: unit(vA),
      dirB: unit(vB),
      radius: Math.asin((system.giant ?? system.target).radius / norm(vA)),
      baseline: norm(sub(observerPos(system, tt, system.site), observerPos(system, tt, liveSite))),
      projectedBaseline: projectedBaseline(observerPos(system, tt, system.site), observerPos(system, tt, liveSite), vA),
      roverDistance: current.rover.dist, seeing: seeingFactor(current, tt), marks: same?.marks ?? { A: null, B: null }, viewedB: same?.viewedB ?? false, prediction: same?.prediction,
    } });
    setFrame('A'); setBlink(false);
    flag('rover-captured');
    sfx('shutter');
  };

  const measured = cap ? measuredParallax(cap) : null;
  const p = measured?.shift ?? null;
  useEffect(() => {
    if (p) flag('rover-marked');
  }, [p]);

  return (
    <div className="tool">
      <div className="tool-stage" data-tut="rover-stage">
        {cap ? (
          <CanvasView
            tabIndex={0} role="img" aria-label="Parallax comparator. 1 selects A, 2 selects B. Arrows adjust the marker, Shift makes fine adjustments, Enter marks the centre, B toggles blinking."
            onKeyDown={(e) => {
              if (e.key === '1' || e.key === '2') { e.preventDefault(); show(e.key === '1' ? 'A' : 'B'); return; }
              if (e.key.toLowerCase() === 'b') { e.preventDefault(); if (!e.repeat) setBlink((value) => !value); return; }
              if (e.key !== 'Enter' && !e.key.startsWith('Arrow')) return;
              e.preventDefault(); const key = shownFrame.current; show(key);
              const prior = marks[key] ?? { x: 0, y: 0 }, step = (e.shiftKey ? .1 : 1) * ARCSEC;
              const x = e.key === 'Enter' ? 0 : prior.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0);
              const y = e.key === 'Enter' ? 0 : prior.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0);
              const limitX = Math.tan(fovAs * ARCSEC / 2), limitY = limitX * e.currentTarget.height / e.currentTarget.width;
              setMark(key, { x: Math.max(-limitX, Math.min(limitX, x)), y: Math.max(-limitY, Math.min(limitY, y)) });
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              const key = shownFrame.current; dragging.current = key; show(key);
              const pt = canvasPoint(e), c = e.currentTarget;
              const k = scopeProjector({ center: cap.dirA, fov: fovAs * ARCSEC, w: c.width, h: c.height }).k;
              c.setPointerCapture(e.pointerId); c.focus();
              setMark(key, { x: (pt.x - c.width / 2) / k, y: (pt.y - c.height / 2) / k });
            }}
            onPointerMove={(e) => {
              if (!e.buttons || !dragging.current) return;
              const pt = canvasPoint(e), c = e.currentTarget;
              const k = scopeProjector({ center: cap.dirA, fov: fovAs * ARCSEC, w: c.width, h: c.height }).k;
              setMark(dragging.current, { x: (pt.x - c.width / 2) / k, y: (pt.y - c.height / 2) / k });
            }}
            onPointerUp={() => { dragging.current = null; }} onPointerCancel={() => { dragging.current = null; }}
            draw={({ ctx, w, h, dpr }) => {
              const showB = frame === 'B'; shownFrame.current = frame;
              const fov = fovAs * ARCSEC;
              const P = drawScope(
                ctx,
                { center: cap.dirA, fov, w, h },
                {
                  seed: sys.seed,
                  sunDir: [-cap.dirA[0], -cap.dirA[1], -cap.dirA[2]],
                  sunRadius: 0,
                  starColor: [255, 255, 255],
                  targetDir: showB ? cap.dirB : cap.dirA,
                  targetRadius: cap.radius,
                  targetStyle: sys.giant ? 'giant' : 'blue',
                  moonDir: null,
                  moonRadius: 0,
                  skyBrightness: 0,
                  seeing: 1.2 * ARCSEC * cap.seeing,
                  realTime: 0,
                  filter: false, reduceFlicker: true,
                },
                dpr,
              );
              const k = P.k;
              for (const key of ['A', 'B'] as const) {
                const m = marks[key];
                if (!m) continue;
                const x = w / 2 + m.x * k;
                const y = h / 2 + m.y * k;
                ctx.strokeStyle = key === 'A' ? '#6cf0ff' : '#ffc46b';
                ctx.lineWidth = 1.5 * dpr;
                ctx.beginPath();
                ctx.arc(x, y, 6 * dpr, 0, Math.PI * 2);
                ctx.moveTo(x - 14 * dpr, y);
                ctx.lineTo(x - 7 * dpr, y);
                ctx.moveTo(x + 7 * dpr, y);
                ctx.lineTo(x + 14 * dpr, y);
                ctx.moveTo(x, y - 14 * dpr);
                ctx.lineTo(x, y - 7 * dpr);
                ctx.moveTo(x, y + 7 * dpr);
                ctx.lineTo(x, y + 14 * dpr);
                ctx.stroke();
              }
              ctx.fillStyle = showB ? '#ffc46b' : '#6cf0ff';
              ctx.font = `700 ${14 * dpr}px Inter`;
              ctx.textAlign = 'left';
              ctx.fillText(showB ? 'B · rover camera' : 'A · camp telescope', 14 * dpr, 24 * dpr);
            }}
          />
        ) : (
          <MapView dist={s.rover.dist} target={s.rover.target} departAt={s.rover.departAt} arriveAt={s.rover.arriveAt} R={sys.home.radius} t={t} />
        )}
        {cap && <div className="parallax-stage-controls panel" role="group" aria-label="Camera frame controls">
          <button className="btn small" aria-pressed={frame === 'A' && !blink} onClick={() => show('A')}>Mark in A</button>
          <button className="btn small" aria-pressed={frame === 'B' && !blink} onClick={() => show('B')}>Mark in B</button>
          <button className="btn small" onClick={() => setBlink((value) => !value)}>{blink ? 'Pause blink' : 'Play blink'}</button>
          <span className="faint" data-camera-frame={frame}>{frame} · {blink ? 'blinking' : 'frozen'} · day {fmt(cap.at / DAY, 3)}</span>
        </div>}
      </div>

      <div className="tool-side">
        <ToolHeader title="Rover & parallax" sub={`Two sites, one instant: the ${what} shifts against the distant stars. The shift gives the distance.`} />
        <div className="panel panel-pad stack" data-tut="rover-drive">
          <b>1 · Position the rover</b>
          <div className="row between">
            <span className="muted">Rover is</span>
            <span className="mono">{driving ? `driving… ${fmt((s.rover.arriveAt - t) / DAY, 1)} d left` : `${fmt(s.rover.dist / 1000, 0)} km ${heading}`}</span>
          </div>
          <input type="range" min={500} max={6000} step={100} value={target} onChange={(e) => setTarget(Number(e.target.value))} disabled={driving} />
          <div className="row between">
            <span className="muted" style={{ fontSize: 13 }}>Send to {target} km {heading} · {fmt(Math.abs(target * 1000 - s.rover.dist) / speed, 1)} days</span>
            <button className="btn primary small" disabled={driving || target * 1000 === s.rover.dist} onClick={drive}>
              Drive
            </button>
          </div>

        </div>

        <div className="panel panel-pad stack" data-tut="rover-image">
          <b>2 · Image both sites at once</b>
          <dl className="kv">
            <dt>Camp: {what} altitude</dt>
            <dd>{fmt(A.alt, 1)}° · {hhmm(localSolarHours(sys, t))}</dd>
            <dt>Rover: {what} altitude</dt>
            <dd>{fmt(B.alt, 1)}°</dd>
            <dt>Midpoint: altitude</dt>
            <dd>{fmt(M.alt, 1)}°</dd>
          </dl>
          <button className="btn primary" disabled={!canImage} onClick={capture}>
            Take simultaneous images
          </button>
          {setupReason ? <div className="amber" style={{ fontSize: 12 }}>{setupReason}</div> : <ObservingStatus status={view} site={view.ok || ['flare', 'clouds'].includes(view.code) ? undefined : campView.ok ? 'Rover' : 'Camp'} />}
        </div>

        <SeeingConditions frozenAt={cap?.at} frozenFactor={cap?.seeing} />

        {cap && (
          <div className="panel panel-pad stack" data-tut="rover-blink">
            <b>3 · Blink comparator</b>
            <div className="parallax-pair-labels"><span>A · camp · day {fmt(cap.at / DAY, 3)}</span><span>B · rover · day {fmt(cap.at / DAY, 3)}</span></div>
            <div className="faint">Synchronized frozen exposures. The expedition clock remains separate.</div>
            <div className="muted" style={{ fontSize: 13 }}>
              Switch A/B or play the blink. A click freezes and marks the visible frame. Drag to refine; keyboard 1/2 selects a frame, arrows move its marker (Shift: 0.1″), Enter marks the centre.
            </div>
            <label className="field">Blink speed<select className="input" aria-label="Blink speed" value={blinkMs} onChange={(e) => setBlinkMs(Number(e.target.value))}><option value={1200}>Slow · 1.2 s per frame</option><option value={700}>Normal · 0.7 s per frame</option><option value={350}>Fast · 0.35 s per frame</option></select></label>
            <div className="row">
              <span className="muted" style={{ fontSize: 13 }}>Field {fovAs}″</span>
              <input aria-label="Comparator field in arcseconds" type="range" min={30} max={1200} step={5} value={fovAs} onChange={(e) => setFovAs(Number(e.target.value))} style={{ flex: 1 }} />
            </div>
            <dl className="kv">
              <dt>Baseline B (laser link)</dt>
              <dd>{fmt(cap.baseline / 1000, 1)} km</dd>
              <dt>Across-sightline baseline B⊥</dt><dd>{fmt(cap.projectedBaseline / 1000, 1)} km</dd>
              <dt>Shift p</dt>
              <dd>{p ? `${fmt(p / ARCSEC, 2)}″` : '—'}</dd>
              <dt>Distance from marked shift</dt>
              <dd className="blue">{measured ? `${fmt(measured.distance / 1e9, 3)} million km` : '—'}</dd>
            </dl>
            <Formula>d ≈ B⊥ / p (p in radians)</Formula>
            <details className="measurement-help"><summary>Optional: why use the across-sightline baseline?</summary><p>The laser measures the straight line between sites. Only its sideways component produces this angular jump. The readout projects the laser baseline using the camp camera pointing. The distance uses a distant-target, small-angle approximation. Flight School has an optional geometry experiment; no lesson is required here.</p><p>Keep both images at one instant so orbital motion does not masquerade as parallax. Re-marking this pair revises one exposure measurement rather than adding independent data.</p></details>
            {marks.A && marks.B && <div className="faint">B relative to A: horizontal {fmt((marks.B.x - marks.A.x) / ARCSEC, 3)}″ · vertical {fmt((marks.B.y - marks.A.y) / ARCSEC, 3)}″ (+right, +down).</div>}
            <ParallaxInvestigation />
            {p && (
              <SanityWarning
                msgs={[
                  p < 1 * ARCSEC && 'The two marks are almost on top of each other. Did you mark the planet in both frames (A and B)?',
                  p > 60 * ARCSEC && 'Large marked separation. Check that both markers are on the planet; widen the field if needed. Large shifts alone do not prove a mistake.',
                ]}
              />
            )}
            <div className="row" data-tut="rover-keep">
              <button
                className="btn primary"
                disabled={!measured}
                onClick={() => {
                  if (!measured || !marks.A || !marks.B) return;
                  const reading = { key: 'dPar' as const, value: measured.distance, at: cap.at,
                    note: `day ${fmt(cap.at / DAY, 3)} · B⊥ ${fmt(cap.projectedBaseline / 1000, 1)} km · frozen pair`,
                    parallax: { captureId: cap.id, baseline: cap.baseline, projectedBaseline: cap.projectedBaseline, shift: measured.shift, markA: { ...marks.A }, markB: { ...marks.B } },
                    environment: { instrument: 'telescope' as const, at: cap.at, rawValue: measured.distance, seeing: { factor: cap.seeing, frozen: true } } };
                  const prior = s.readings.find((r) => r.parallax?.captureId === cap.id);
                  if (prior) {
                    s.set({ readings: s.readings.map((r) => r.id === prior.id ? { ...r, ...reading, kept: true } : r) });
                    acknowledgeObservation(s.readings, useGame.getState().readings, s.runId);
                  }
                  else s.addReading(reading);
                  sfx('good');
                  toast('Pair measurement saved; re-marking updates this same reading.');
                }}
              >
                {s.readings.some((r) => r.parallax?.captureId === cap.id) ? 'Update pair reading' : 'Keep reading'}
              </button>
              <button className="btn" onClick={() => { setBlink(false); s.set({ parallaxPair: null }); }}>
                Back to map
              </button>
            </div>
          </div>
        )}

        <div className="panel panel-pad">
          <b>Distance log</b>
          <ReadingsTable k="dPar" />
          <SendReadings k="dPar" tut="rover-send" />
        </div>
      </div>
    </div>
  );
}

/** Stylised orbital view of the planet's surface track: camp, rover and the arc between them. */
function MapView({ dist, target, departAt, arriveAt, R, t }: { dist: number; target: number; departAt: number; arriveAt: number; R: number; t: number }) {
  const cur = arriveAt > t ? dist + (target - dist) * Math.min(1, (t - departAt) / Math.max(1, arriveAt - departAt)) : dist;
  return (
    <CanvasView
      draw={({ ctx, w, h, dpr, now }) => {
        ctx.fillStyle = '#04060c';
        ctx.fillRect(0, 0, w, h);
        const cx = w / 2;
        const cy = h * 0.56;
        const r = Math.min(w, h) * 0.34;
        const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
        g.addColorStop(0, '#a08060');
        g.addColorStop(0.7, '#5a4632');
        g.addColorStop(1, '#22180f');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(160,200,255,0.25)';
        ctx.lineWidth = 6 * dpr;
        ctx.beginPath();
        ctx.arc(cx, cy, r + 4 * dpr, 0, Math.PI * 2);
        ctx.stroke();
        const ang = (d: number) => -Math.PI / 2 + d / R;
        const pt = (d: number) => ({ x: cx + Math.cos(ang(d)) * r, y: cy + Math.sin(ang(d)) * r });
        ctx.strokeStyle = 'rgba(255,196,107,0.8)';
        ctx.lineWidth = 2 * dpr;
        ctx.setLineDash([6 * dpr, 6 * dpr]);
        ctx.beginPath();
        ctx.arc(cx, cy, r, ang(0), ang(Math.max(target, cur)));
        ctx.stroke();
        ctx.setLineDash([]);
        const a = pt(0);
        const b = pt(cur);
        ctx.strokeStyle = 'rgba(108,196,255,0.9)';
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        for (const [p, c, label] of [
          [a, '#6cf0ff', 'Camp'],
          [b, '#ffc46b', 'Rover'],
        ] as const) {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(p.x, p.y, (5 + Math.sin(now / 300)) * dpr, 0, Math.PI * 2);
          ctx.fill();
          ctx.font = `600 ${12 * dpr}px Inter`;
          ctx.fillText(label, p.x + 10 * dpr, p.y - 8 * dpr);
        }
        ctx.fillStyle = 'rgba(200,215,240,0.8)';
        ctx.font = `${12 * dpr}px Inter`;
        ctx.textAlign = 'center';
        ctx.fillText('baseline B = straight line between the two sites', cx, h * 0.1);
      }}
    />
  );
}
