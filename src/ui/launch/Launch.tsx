import { useEffect, useMemo, useRef, useState } from 'react';
import { QUANTITY_INFO, keysFor, labelFor } from '../../engine/chain';
import { variantOf } from '../../engine/chapters';
import { DAY, DEG, G } from '../../engine/constants';
import { simulateLaunch } from '../../engine/launch';
import { lambert, propagate } from '../../engine/orbits';
import {
  bestTransfer,
  hohmannFor,
  modelFromPrimaries,
  planTransfer,
  posAt,
  targetState,
  giantState,
  predictedWindows,
  sampleModel,
  systemFromModel,
  velAt,
  type PlannedTransfer,
} from '../../engine/planner';
import { makeRng } from '../../engine/rng';
import { add, scale, unit, type Vec3 } from '../../engine/vec';
import { sfx } from '../../game/audio';
import { WARPS, clock } from '../../game/clock';
import { ECHO } from '../../game/echo';
import { fmt } from '../../game/format';
import { currentWorld } from '../../game/sim';
import { useGame } from '../../game/store';
import { lifeSupportEnd } from '../../game/survival';
import { savePrelaunch } from '../../game/checkpoints';
import { CanvasView, canvasPoint } from '../common/CanvasView';
import { Formula, ToolHeader } from '../common/sheetBits';
import { toast, useGameTime } from '../common/widgets';
import { flag, jumpTo } from '../../game/tutorial';

interface McResult {
  fuelLeft: number[];
  paths: Vec3[][];
  success: number;
}

export function Launch() {
  const s = useGame();
  const { system: sys } = currentWorld();
  const t = useGameTime(2);
  const variant = variantOf(sys.features);
  const model = useMemo(() => modelFromPrimaries(s.sheet, variant), [s.sheet, variant]);
  const end = lifeSupportEnd(s, sys);
  const budget = sys.fuelDv - s.penaltyDv;
  const [dep, setDep] = useState<number | 'now' | null>(null); // days
  const [autoTof, setAutoTof] = useState(true);
  const [tofDays, setTofDays] = useState(200);
  const [mc, setMc] = useState<McResult | null>(null);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (model && !s.missionsDone.includes('plan')) {
      s.set({ missionsDone: [...s.missionsDone, 'plan'] });
      s.say(ECHO.plan);
    }
  }, [model]); // eslint-disable-line react-hooks/exhaustive-deps

  const hoh = useMemo(() => (model ? hohmannFor(model) : null), [model]);
  // A window stays listed for a day after it opens, so warping onto it doesn't make it vanish.
  const windows = useMemo(() => (model ? predictedWindows(model, Math.max(0, t - DAY), end) : []), [model, end, Math.floor(t / DAY)]); // eslint-disable-line react-hooks/exhaustive-deps
  // Which windows can our fuel pay for (by the player's own model)? Default to the first of those.
  const affordable = useMemo(
    () => (model ? windows.filter((w) => (bestTransfer(model, w)?.total ?? Infinity) <= budget) : []),
    [model, windows, budget],
  );
  const firstWindow = affordable[0] ?? windows[0];
  const depDay = dep === 'now' ? Math.ceil((t / DAY) * 4) / 4 : (dep ?? (firstWindow ?? t) / DAY);
  const plan: PlannedTransfer | null = useMemo(() => {
    if (!model) return null;
    return autoTof || model.giant ? bestTransfer(model, depDay * DAY) : planTransfer(model, depDay * DAY, tofDays * DAY);
  }, [model, depDay, autoTof, tofDays]);

  // Porkchop: estimated total delta-v over departure date x flight time.
  const pork = useMemo(() => {
    // A slingshot has two flight times; the windows list and the route summary replace the map.
    if (!model || !hoh || model.giant) return null;
    const nx = 56;
    const ny = 30;
    const d0 = Math.floor(t / DAY);
    const d1 = Math.max(d0 + 5, Math.floor(end / DAY));
    const tof0 = hoh.tof * 0.5;
    const tof1 = hoh.tof * 1.6;
    const v = new Float32Array(nx * ny);
    for (let i = 0; i < nx; i++)
      for (let j = 0; j < ny; j++) {
        const p = planTransfer(model, (d0 + ((d1 - d0) * i) / (nx - 1)) * DAY, tof0 + ((tof1 - tof0) * j) / (ny - 1));
        v[j * nx + i] = p ? p.total : Infinity;
      }
    return { nx, ny, d0, d1, tof0, tof1, v };
    // Recompute when the model changes or every ~10 days of game time.
  }, [model, hoh, end, Math.floor(t / (10 * DAY))]); // eslint-disable-line react-hooks/exhaustive-deps

  // Monte Carlo over the player's own error bars (never the truth).
  useEffect(() => {
    setMc(null);
    if (!plan || !model) return;
    const id = setTimeout(() => {
      const rng = makeRng(42);
      const fuelLeft: number[] = [];
      const paths: Vec3[][] = [];
      for (let i = 0; i < 36; i++) {
        const m = sampleModel(s.sheet, rng, variant);
        if (!m) continue;
        const u = { ...systemFromModel(m, sys), fuelDv: budget, lifeSupport: Infinity };
        const r = simulateLaunch(u, plan.plan);
        fuelLeft.push(r.fuelLeft);
        if (i < 24) paths.push(r.path);
      }
      setMc({ fuelLeft, paths, success: fuelLeft.filter((f) => f >= 0).length / Math.max(1, fuelLeft.length) });
    }, 250);
    return () => clearTimeout(id);
  }, [plan, model, s.sheet, sys, budget]);

  if (!model || !hoh) {
    const missing = keysFor(variant).filter((k) => !s.sheet[k] || !Number.isFinite(s.sheet[k]!.value));
    return (
      <div className="tool">
        <div className="tool-stage" />
        <div className="tool-side">
          <ToolHeader title="Launch planner" sub="Plot a course to the blue planet using your own measurements." />
          <div className="panel panel-pad stack">
            <b>Not enough data yet</b>
            <div className="muted">The planner needs every measured quantity on the progress sheet. Still missing:</div>
            {missing.map((k) => (
              <div key={k} className="row between" style={{ fontSize: 13 }}>
                <span>{labelFor(k, variant)}</span>
                <span className="faint">{QUANTITY_INFO[k].symbol}</span>
              </div>
            ))}
            <button className="btn" onClick={() => s.go('sheet')}>
              Open progress sheet
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nowDay = t / DAY;
  const ready = Math.abs(depDay - nowDay) < 1.5;
  if (ready && dep !== 'now') setTimeout(() => flag('launch-ready'), 0);
  const leadNow = (((TAU_DEG * (t - model.tOpp)) / model.P2 - (TAU_DEG * (t - model.tOpp)) / model.P1) % 360 + 360) % 360;
  const margin = plan ? budget - plan.total : NaN;

  const launch = (manual = false) => {
    const p = autoTof || model.giant ? bestTransfer(model, clock.t) : planTransfer(model, clock.t, tofDays * DAY);
    if (!p) return toast('No transfer found for this date.');
    sfx('launch');
    if (!s.tutorial.active) savePrelaunch();
    if (manual) {
      // Fly the ascent to parking orbit first; the flight is simulated after it.
      useGame.setState({ pendingLaunch: { plan: p.plan }, phase: 'ascent' });
      return;
    }
    const result = simulateLaunch({ ...sys, fuelDv: budget }, p.plan);
    useGame.setState({ outcome: { plan: p.plan, result, sheet: s.sheet }, phase: 'flight' });
  };

  const warpTo = () => {
    if (s.tutorial.active) {
      // Flight School: skip straight there.
      jumpTo(depDay * DAY);
      toast('ECHO skipped ahead to the launch window');
      return;
    }
    setDep(depDay);
    clock.stopAt = depDay * DAY;
    clock.pauseAtStop = true;
    clock.warpIndex = WARPS.length - 1;
    clock.paused = false;
    clock.emit();
    toast('Warping to departure…');
  };

  return (
    <div className="tool">
      <div className="tool-stage" data-tut="launch-stage">
        <Orrery model={model} plan={plan} mc={mc} t={t} depDay={depDay} />
      </div>
      <div className="tool-side">
        <ToolHeader title="Launch planner" sub="Everything here is computed from your measurements — ECHO flies it through the real system." />
        <div className="panel panel-pad stack" data-tut="launch-departure">
          <div className="row between">
            <b>Departure</b>
            <span className="mono">day {fmt(depDay, 1)}</span>
          </div>
          <input type="range" min={Math.floor(nowDay)} max={Math.floor(end / DAY)} step={0.5} value={depDay} onChange={(e) => setDep(Number(e.target.value))} />
          <div className="row" data-tut="launch-windows">
            {windows.slice(0, 3).map((w, i) => (
              <button
                key={w}
                className={`btn small ${affordable.includes(w) ? '' : 'ghost'}`}
                title={affordable.includes(w) ? undefined : 'By your numbers this window costs more fuel than we carry.'}
                onClick={() => setDep(w / DAY)}
              >
                Window {i + 1}: day {fmt(w / DAY, 1)}
                {affordable.includes(w) ? '' : ' · over budget'}
              </button>
            ))}
            <button className={`btn small ${dep === 'now' ? 'primary' : 'ghost'}`} onClick={() => setDep('now')}>
              Now
            </button>
          </div>
          {model.giant && plan?.plan.flyby && (
            <div className="callout key" style={{ margin: 0 }}>
              <b>Slingshot route</b>
              <dl className="kv" style={{ marginTop: 4 }}>
                <dt>To the giant</dt>
                <dd>{fmt(plan.plan.flyby.tof1 / DAY, 0)} days</dd>
                <dt>Closest approach</dt>
                <dd>{fmt(plan.plan.flyby.rp / 1e6, 0)} thousand km</dd>
                <dt>Burn at closest approach</dt>
                <dd>{fmt(Math.abs(plan.plan.flyby.dv) + plan.plan.flyby.extraDv, 0)} m/s</dd>
                <dt>Giant to the blue planet</dt>
                <dd>{fmt((plan.plan.tof - plan.plan.flyby.tof1) / DAY, 0)} days</dd>
              </dl>
              <div className="faint" style={{ fontSize: 12 }}>
                ECHO aims the flyby with YOUR giant mass. If it is heavier than you think, it bends us further — and the correction after it costs fuel.
              </div>
            </div>
          )}
          {!model.giant && (
          <>
          <div className="row" style={{ gap: 6 }}>
            <button className={`btn small ${autoTof ? 'primary' : ''}`} onClick={() => setAutoTof(true)} title="The cheapest flight time for this date">
              ⛽ Fuel-saver
            </button>
            <button
              className={`btn small ${!autoTof && Math.abs(tofDays - Math.round((hoh.tof / DAY) * 0.75)) <= 1 ? 'primary' : ''}`}
              onClick={() => (setAutoTof(false), setTofDays(Math.round((hoh.tof / DAY) * 0.75)))}
              title="A quarter less time in space: saves life support, costs fuel"
            >
              ⚡ Fast
            </button>
            <button className={`btn small ${!autoTof && Math.abs(tofDays - Math.round((hoh.tof / DAY) * 0.75)) > 1 ? 'primary' : ''}`} onClick={() => setAutoTof(false)}>
              Custom
            </button>
          </div>
          <div className="faint" style={{ fontSize: 12 }}>
            Fuel-saver keeps the most fuel for corrections. Fast spends some of that margin to save days of air — worth it only if you trust your error bars.
          </div>
          {!autoTof && (
            <>
              <div className="row between">
                <span className="muted">Flight time</span>
                <span className="mono">{fmt(tofDays, 0)} days</span>
              </div>
              <input type="range" min={Math.round((hoh.tof / DAY) * 0.5)} max={Math.round((hoh.tof / DAY) * 1.6)} value={tofDays} onChange={(e) => setTofDays(Number(e.target.value))} />
            </>
          )}
          </>
          )}
          {pork && <div data-tut="launch-porkchop"><Porkchop pork={pork} budget={budget} depDay={depDay} tof={plan?.plan.tof ?? hoh.tof} onPick={(d, tf) => (setDep(d), setAutoTof(false), setTofDays(tf))} /></div>}
          {model.giant ? (
            <div className="muted" style={{ fontSize: 13 }}>
              No single lead angle here: the route needs the giant AND the blue planet in the right places, so windows are rare. ECHO searches your own
              numbers date by date for routes past the giant.
            </div>
          ) : model.ecc ? (
            <div className="muted" style={{ fontSize: 13 }}>
              On an ellipse there is no single lead angle: the planet speeds up near perihelion, so windows come unevenly. The cost map above searches your own
              ellipse date by date — the cheap bands are the windows. Rough flight time ≈ {fmt(hoh.tof / DAY, 0)} days.
            </div>
          ) : (
            <>
              <Formula>t = π√((a₁+a₂)³ / 8GM★),  φ = 180° − 360°·t/P₂</Formula>
              <dl className="kv">
                <dt>Hohmann flight time</dt>
                <dd>{fmt(hoh.tof / DAY, 1)} days</dd>
                <dt>Required lead angle φ</dt>
                <dd>{fmt(hoh.lead / DEG, 1)}°</dd>
                <dt>Lead angle now</dt>
                <dd>{fmt(leadNow, 1)}°</dd>
              </dl>
            </>
          )}
        </div>

        {plan && (
          <div className="panel panel-pad stack" data-tut="launch-fuel">
            <b>Fuel (your estimate)</b>
            <dl className="kv">
              <dt>Escape from surface</dt>
              <dd>{fmt(plan.departCost / 1000, 3)} km/s</dd>
              <dt>Capture into orbit</dt>
              <dd>{fmt(plan.captureCost / 1000, 3)} km/s</dd>
              <dt>Total planned</dt>
              <dd>{fmt(plan.total / 1000, 3)} km/s</dd>
              <dt>Ship carries</dt>
              <dd>{fmt(budget / 1000, 3)} km/s</dd>
              <dt>Margin for corrections</dt>
              <dd className={margin > 0 ? 'green' : 'red'}>{fmt(margin / 1000, 3)} km/s</dd>
            </dl>
            <FuelBar plan={plan} budget={budget} />
            <div className="stack" style={{ gap: 4 }}>
              <div className="row between">
                <span className="muted" style={{ fontSize: 13 }}>Chance of success, given your error bars</span>
                <span className={`mono ${mc && mc.success > 0.8 ? 'green' : mc && mc.success > 0.4 ? 'amber' : 'red'}`}>{mc ? `${Math.round(mc.success * 100)}%` : '…'}</span>
              </div>
              <div className="faint" style={{ fontSize: 12 }}>
                ECHO flew this plan through {mc?.fuelLeft.length ?? '…'} versions of the system that are consistent with your measurements. Honest error
                bars make this forecast honest too.
              </div>
            </div>
            <div data-tut="launch-go">
            {ready ? (
              confirm ? (
                <div className="stack" style={{ gap: 6 }}>
                  <div className="row">
                    <button className="btn danger big" onClick={() => launch(false)} style={{ flex: 1 }}>
                      🚀 Confirm launch
                    </button>
                    <button className="btn" onClick={() => setConfirm(false)}>
                      Wait
                    </button>
                  </div>
                  {!s.tutorial.active && (
                    <button className="btn" onClick={() => launch(true)}>
                      🕹 Fly the ascent yourself
                    </button>
                  )}
                  {!s.tutorial.active && <div className="faint" style={{ fontSize: 12 }}>ECHO flies the ascent unless you take it. Fuel you waste beyond ECHO’s profile comes out of the margin.</div>}
                </div>
              ) : (
                <button className="btn amber big" onClick={() => setConfirm(true)}>
                  Launch now
                </button>
              )
            ) : depDay > nowDay ? (
              <button className="btn primary" onClick={warpTo}>
                Warp to day {fmt(depDay, 1)} ({fmt(depDay - nowDay, 0)} days of life support)
              </button>
            ) : (
              <div className="amber">That date has passed.</div>
            )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const TAU_DEG = 360;

function FuelBar({ plan, budget }: { plan: PlannedTransfer; budget: number }) {
  const parts = [
    { v: plan.departCost, c: '#6cc4ff', l: 'escape' },
    { v: plan.captureCost, c: '#b59cff', l: 'capture' },
  ];
  const total = Math.max(budget, plan.total);
  return (
    <div style={{ display: 'flex', height: 12, borderRadius: 6, overflow: 'hidden', background: 'rgba(255,255,255,0.08)' }} title="fuel use">
      {parts.map((p) => (
        <div key={p.l} style={{ width: `${(100 * p.v) / total}%`, background: p.c }} />
      ))}
      <div style={{ flex: 1, background: plan.total > budget ? 'var(--red)' : 'rgba(91,227,164,0.55)' }} />
    </div>
  );
}

function Porkchop({ pork, budget, depDay, tof, onPick }: { pork: { nx: number; ny: number; d0: number; d1: number; tof0: number; tof1: number; v: Float32Array }; budget: number; depDay: number; tof: number; onPick: (d: number, tofDays: number) => void }) {
  // Render the cost map once per data change into a small offscreen image.
  const img = useMemo(() => {
    const min = Math.min(...pork.v);
    const c = document.createElement('canvas');
    c.width = pork.nx;
    c.height = pork.ny;
    const g = c.getContext('2d')!;
    for (let i = 0; i < pork.nx; i++)
      for (let j = 0; j < pork.ny; j++) {
        const v = pork.v[j * pork.nx + i];
        const x = (v - min) / Math.max(1, budget - min); // 0 = cheapest, 1 = whole budget
        if (!Number.isFinite(v) || x > 1) g.fillStyle = 'rgb(40,20,30)';
        else {
          const q = Math.pow(x, 0.5);
          g.fillStyle = `rgb(${Math.round(40 + 200 * q)},${Math.round(200 - 140 * q)},${Math.round(160 - 110 * q)})`;
        }
        g.fillRect(i, pork.ny - 1 - j, 1, 1);
      }
    return c;
  }, [pork, budget]);
  return (
    <div>
      <div className="row between" style={{ fontSize: 12 }}>
        <span className="muted">Cost map: departure date → (flight time ↑)</span>
        <span className="faint">tap to choose</span>
      </div>
      <div style={{ height: 130, position: 'relative' }}>
        <CanvasView
          style={{ borderRadius: 8 }}
          onPointerDown={(e) => {
            const p = canvasPoint(e);
            const c = e.currentTarget;
            const d = pork.d0 + (p.x / c.width) * (pork.d1 - pork.d0);
            const tf = pork.tof1 - (p.y / c.height) * (pork.tof1 - pork.tof0);
            onPick(d, tf / DAY);
          }}
          draw={({ ctx, w, h, dpr }) => {
            ctx.imageSmoothingEnabled = true;
            ctx.drawImage(img, 0, 0, w, h);
            const x = ((depDay - pork.d0) / (pork.d1 - pork.d0)) * w;
            const y = h - ((tof - pork.tof0) / (pork.tof1 - pork.tof0)) * h;
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2 * dpr;
            ctx.beginPath();
            ctx.arc(x, y, 6 * dpr, 0, Math.PI * 2);
            ctx.stroke();
          }}
        />
      </div>
    </div>
  );
}

function Orrery({ model, plan, mc, t, depDay }: { model: NonNullable<ReturnType<typeof modelFromPrimaries>>; plan: PlannedTransfer | null; mc: McResult | null; t: number; depDay: number }) {
  const anim = useRef(0);
  // The planned transfer arc in the player's model, computed once per plan.
  const arc = useMemo(() => {
    if (!plan) return [];
    const td = depDay * DAY;
    const r1 = posAt(model.a1, model.P1, model, td);
    const v1 = velAt(model.a1, model.P1, model, td);
    const vInf = add(scale(unit(r1), plan.plan.vInfRadial), scale(unit(v1), plan.plan.vInfPrograde));
    const v0 = add(v1, vInf);
    const mu = G * model.Mstar;
    const fb = plan.plan.flyby;
    if (fb && model.giant) {
      // Two legs: out to the giant, then on from it to the blue planet.
      const leg1 = Array.from({ length: 61 }, (_, i) => propagate(r1, v0, (fb.tof1 * i) / 60, mu)[0]);
      const tof2 = plan.plan.tof - fb.tof1;
      const rg = giantState(model, td + fb.tof1)[0];
      const sol = lambert(rg, targetState(model, td + plan.plan.tof)[0], tof2, mu);
      const leg2 = sol ? Array.from({ length: 61 }, (_, i) => propagate(rg, sol[0], (tof2 * i) / 60, mu)[0]) : [];
      return [...leg1, ...leg2];
    }
    return Array.from({ length: 121 }, (_, i) => propagate(r1, v0, (plan.plan.tof * i) / 120, mu)[0]);
  }, [plan, model, depDay]);
  return (
    <CanvasView
      draw={({ ctx, w, h, dpr, dt }) => {
        anim.current = (anim.current + dt * 0.15) % 1;
        ctx.fillStyle = '#04060c';
        ctx.fillRect(0, 0, w, h);
        const cx = w / 2;
        const cy = h * 0.47;
        const S = (Math.min(w, h) * 0.42) / (model.a2 * (1 + (model.ecc ?? 0)) * 1.12);
        const X = (v: Vec3) => cx + v[0] * S;
        const Y = (v: Vec3) => cy - v[1] * S;
        // Orbits.
        for (const [a, c] of [
          [model.a1, 'rgba(255,190,120,0.35)'],
          [model.a2, 'rgba(108,196,255,0.35)'],
          ...(model.giant ? ([[model.giant.a, 'rgba(255,230,184,0.35)']] as const) : []),
        ] as const) {
          ctx.strokeStyle = c;
          ctx.lineWidth = dpr;
          ctx.beginPath();
          if (a === model.a2 && model.ecc) {
            // The blue planet's ellipse, sampled over one orbit.
            for (let i = 0; i <= 120; i++) {
              const v = targetState(model, model.tOpp + (model.P2 * i) / 120)[0];
              if (i) ctx.lineTo(X(v), Y(v));
              else ctx.moveTo(X(v), Y(v));
            }
          } else ctx.arc(cx, cy, a * S, 0, Math.PI * 2);
          ctx.stroke();
        }
        // Star.
        const sg = ctx.createRadialGradient(cx, cy, 0, cx, cy, 26 * dpr);
        sg.addColorStop(0, '#fff6dc');
        sg.addColorStop(0.3, 'rgba(255,200,110,0.7)');
        sg.addColorStop(1, 'rgba(255,200,110,0)');
        ctx.fillStyle = sg;
        ctx.beginPath();
        ctx.arc(cx, cy, 26 * dpr, 0, Math.PI * 2);
        ctx.fill();
        // Uncertainty spaghetti from the Monte Carlo.
        if (mc) {
          ctx.lineWidth = dpr;
          for (const p of mc.paths) {
            ctx.strokeStyle = 'rgba(255,196,107,0.13)';
            ctx.beginPath();
            p.forEach((v, i) => (i ? ctx.lineTo(X(v), Y(v)) : ctx.moveTo(X(v), Y(v))));
            ctx.stroke();
          }
        }
        const td = depDay * DAY;
        if (plan) {
          // Planned transfer in the player's model.
          ctx.strokeStyle = '#ffc46b';
          ctx.lineWidth = 2 * dpr;
          ctx.setLineDash([6 * dpr, 5 * dpr]);
          ctx.beginPath();
          arc.forEach((r, i) => (i ? ctx.lineTo(X(r), Y(r)) : ctx.moveTo(X(r), Y(r))));
          ctx.stroke();
          ctx.setLineDash([]);
          // Ship marker animating along the plan.
          const rs = arc[Math.min(arc.length - 1, Math.floor(anim.current * arc.length))];
          if (rs) {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(X(rs), Y(rs), 3 * dpr, 0, Math.PI * 2);
            ctx.fill();
          }
          // The giant at the flyby (ghost).
          if (plan.plan.flyby && model.giant) {
            const rg = giantState(model, td + plan.plan.flyby.tof1)[0];
            ctx.strokeStyle = 'rgba(255,230,184,0.85)';
            ctx.beginPath();
            ctx.arc(X(rg), Y(rg), 9 * dpr, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = 'rgba(255,230,184,0.85)';
            ctx.font = `${11 * dpr}px Inter`;
            ctx.fillText('flyby', X(rg) + 11 * dpr, Y(rg));
          }
          // Planet 2 at arrival (ghost).
          const r2a = targetState(model, td + plan.plan.tof)[0];
          ctx.strokeStyle = 'rgba(108,196,255,0.8)';
          ctx.beginPath();
          ctx.arc(X(r2a), Y(r2a), 8 * dpr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(108,196,255,0.8)';
          ctx.font = `${11 * dpr}px Inter`;
          ctx.fillText('arrival', X(r2a) + 10 * dpr, Y(r2a));
        }
        // Planets at departure and now.
        const planet = (v: Vec3, c: string, r: number, label: string) => {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(X(v), Y(v), r * dpr, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(230,238,252,0.85)';
          ctx.font = `600 ${11 * dpr}px Inter`;
          ctx.fillText(label, X(v) + 9 * dpr, Y(v) - 6 * dpr);
        };
        planet(posAt(model.a1, model.P1, model, td), '#ffb26b', 6, 'home @ departure');
        planet(targetState(model, td)[0], '#6cc4ff', 6, 'blue @ departure');
        ctx.globalAlpha = 0.45;
        planet(posAt(model.a1, model.P1, model, t), '#ffb26b', 4, 'now');
        planet(targetState(model, t)[0], '#6cc4ff', 4, '');
        ctx.globalAlpha = 1;
      }}
    />
  );
}
