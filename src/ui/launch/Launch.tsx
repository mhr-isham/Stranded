import { PlanningModelNotes } from '../common/PlanningModelNotes';
import { DistanceContext } from '../common/DistanceContext';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { StarSystem } from '../../engine/types';
import { QUANTITY_INFO, labelFor } from '../../engine/chain';
import { variantOf } from '../../engine/chapters';
import { DAY, DEG, G } from '../../engine/constants';
import { simulateLaunch } from '../../engine/launch';
import { lambert, propagate } from '../../engine/orbits';
import {
  bestDirectTransfer,
  bestSlingshot,
  hohmannFor,
  modelFromPrimaries,
  planTransfer,
  posAt,
  targetState,
  giantState,
  routeWindows,
  sampleModel,
  systemFromModel,
  velAt,
  type PlannedTransfer,
  type PlayerModel,
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
import { cruiseLimit, cruiseReserve, cruiseSupplies, flyTransfer, type CruiseSupplies } from '../../game/travelSupplies';
import { savePrelaunch } from '../../game/checkpoints';
import { CanvasView, canvasPoint } from '../common/CanvasView';
import { Formula, ToolHeader } from '../common/sheetBits';
import { toast, useGameTime } from '../common/widgets';
import { flag, jumpTo } from '../../game/tutorial';
import { manualFlightRequired } from '../../game/piloting';
import { assessableModel, summarizeForecast, type ForecastSummary } from '../../game/forecast';

import { navigationModel, navigationProgress } from '../../game/readiness';

interface McResult extends ForecastSummary {
  paths: Vec3[][];
}

interface TransferForecasts {
  byRoute: Map<PlannedTransfer, McResult>;
  budget: number;
  system: StarSystem;
}

type RouteMode = 'fuel-saver' | 'fast' | 'custom';
type GiantRoute = 'flyby' | 'direct';

function replanDeparture(model: PlayerModel, route: PlannedTransfer, mode: RouteMode, at: number) {
  if (route.plan.departTime === at) return route;
  if (route.plan.flyby) return bestSlingshot(model, at);
  if (model.giant || mode === 'fuel-saver') return bestDirectTransfer(model, at);
  return planTransfer(model, at, route.plan.tof);
}

function canReachArrival(route: PlannedTransfer | null, supplies: CruiseSupplies | null, budget: number) {
  return !!route && route.total <= budget && (!supplies || supplies.canDepart && cruiseLimit(supplies) > supplies.needs);
}

export function Launch({ launchWindow, clearLaunchWindow }: { launchWindow: number | null; clearLaunchWindow: (value: null) => void }) {
  const s = useGame();
  const manualRequired = manualFlightRequired(s);
  const { system: sys } = currentWorld();
  const t = useGameTime(2);
  const variant = variantOf(sys.features);
  const progress = useMemo(() => navigationProgress(s.sheet, variant), [s.sheet, variant]);
  const model = useMemo(() => navigationModel(s.sheet, variant), [s.sheet, variant]);
  const end = lifeSupportEnd(s, sys);
  const budget = sys.fuelDv - s.penaltyDv;
  const [dep, setDep] = useState<number | 'now' | null>(null); // days
  const [routeMode, setRouteMode] = useState<RouteMode>('fuel-saver');
  const [giantChoice, setGiantChoice] = useState<GiantRoute | null>(null);
  const [customDays, setCustomDays] = useState<number | null>(null);
  const [forecast, setForecast] = useState<TransferForecasts | null>(null);
  const [showPaths, setShowPaths] = useState(false);
  const [compact, setCompact] = useState(() => window.matchMedia('(max-width: 860px)').matches);
  const [confirm, setConfirm] = useState(false);

  useEffect(() => {
    if (launchWindow === null) return;
    setDep(launchWindow / DAY);
    setConfirm(false);
    clearLaunchWindow(null);
  }, [launchWindow, clearLaunchWindow]);

  useEffect(() => {
    if (model && !s.missionsDone.includes('plan')) {
      s.set({ missionsDone: [...s.missionsDone, 'plan'] });
      s.say(ECHO.plan);
    }
  }, [model]); // eslint-disable-line react-hooks/exhaustive-deps

  const hoh = useMemo(() => (model ? hohmannFor(model) : null), [model]);
  // A window stays listed for a day after it opens, so warping onto it doesn't make it vanish.
  const windows = useMemo(() => (model ? routeWindows(model, Math.max(0, t - DAY), end) : []), [model, end, Math.floor(t / DAY)]); // eslint-disable-line react-hooks/exhaustive-deps
  // Which windows can our fuel pay for (by the player's own model)? Default to the first of those.
  const affordable = useMemo(
    () => (model ? windows.filter((w) => (bestDirectTransfer(model, w)?.total ?? Infinity) <= budget
      || (model.giant && (bestSlingshot(model, w)?.total ?? Infinity) <= budget)) : []),
    [model, windows, budget],
  );
  const firstWindow = affordable[0] ?? windows[0];
  const nowDeparture = model?.giant ? t : Math.ceil(t / DAY * 4) / 4 * DAY;
  const departure = launchWindow ?? (dep === 'now' ? nowDeparture : dep === null ? firstWindow ?? t : dep * DAY);
  const depDay = departure / DAY;
  const departureDate = fmt(depDay + 1, 1);
  const fuelSaver = useMemo(() => model && !model.giant ? bestDirectTransfer(model, departure) : null, [model, departure]);
  const direct = useMemo(() => model?.giant ? bestDirectTransfer(model, departure) : null, [model, departure]);
  const flyby = useMemo(() => model?.giant ? bestSlingshot(model, departure) : null, [model, departure]);
  const directSupplies = direct ? cruiseSupplies(s, sys, t, direct.plan) : null;
  const flybySupplies = flyby ? cruiseSupplies(s, sys, t, flyby.plan) : null;
  const directFits = canReachArrival(direct, directSupplies, budget);
  const flybyFits = canReachArrival(flyby, flybySupplies, budget);
  const preferDirect = directFits !== flybyFits ? directFits : (direct?.total ?? Infinity) < (flyby?.total ?? Infinity);
  const giantRoute = giantChoice ?? (preferDirect ? 'direct' : 'flyby');
  const fast = useMemo(() => model && !model.giant && fuelSaver
    ? planTransfer(model, departure, .75 * fuelSaver.plan.tof) : null, [model, departure, fuelSaver]);
  const minDays = Math.max(1, Math.round((hoh?.tof ?? DAY) / DAY * .5));
  const maxDays = Math.max(minDays, Math.round((hoh?.tof ?? DAY) / DAY * 1.6));
  const tofDays = Math.min(maxDays, Math.max(minDays, customDays ?? Math.round((fuelSaver?.plan.tof ?? DAY) / DAY)));
  const custom = useMemo(() => model && !model.giant && routeMode === 'custom'
    ? planTransfer(model, departure, tofDays * DAY) : null, [model, departure, tofDays, routeMode]);
  const plan = model?.giant ? (giantRoute === 'flyby' ? flyby : direct)
    : routeMode === 'fuel-saver' ? fuelSaver : routeMode === 'fast' ? fast : custom;
  const launchNowPlan = useMemo(() => confirm && plan && model
    ? replanDeparture(model, plan, routeMode, t)
    : null, [confirm, plan, model, routeMode, t]);
  const selectedSupplies = plan ? cruiseSupplies(s, sys, t, plan.plan) : null;
  const forecastRoutes = useMemo(() => [fuelSaver, fast, custom, direct, flyby].filter((route): route is PlannedTransfer => !!route), [fuelSaver, fast, custom, direct, flyby]);

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

  useEffect(() => {
    const query = window.matchMedia('(max-width: 860px)');
    const sync = () => setCompact(query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  // Only show results matching the current route, budget and system.
  const routeForecasts = forecast && forecast.budget === budget && forecast.system === sys ? forecast.byRoute : null;
  const mc = (plan && routeForecasts?.get(plan)) ?? null;
  const pathLimit = compact ? 12 : 24;
  const paths = useMemo(() => {
    if (!showPaths || !mc) return [];
    if (mc.paths.length <= pathLimit) return mc.paths;
    // Spread the displayed sample across all drawable paths in trial order.
    return Array.from({ length: pathLimit }, (_, i) => mc.paths[Math.round(i * (mc.paths.length - 1) / (pathLimit - 1))]);
  }, [mc, pathLimit, showPaths]);

  // Use the same sampled systems for each route so the comparison varies the
  // flight plan, rather than drawing different inputs for each option.
  useEffect(() => {
    if (!forecastRoutes.length) return;
    const id = setTimeout(() => {
      const rng = makeRng(42);
      const systems = Array.from({ length: 36 }, () => {
        const sampled = sampleModel(s.sheet, rng, variant);
        return assessableModel(sampled) ? { ...systemFromModel(sampled, sys), fuelDv: budget, lifeSupport: Infinity } : null;
      });
      const byRoute = new Map<PlannedTransfer, McResult>();
      for (const route of forecastRoutes) {
        const trials = systems.map(system => system ? simulateLaunch(system, route.plan) : null);
        const paths = trials.flatMap(trial => trial && trial.path.length > 1 &&
          trial.path.every(point => point.every(Number.isFinite)) ? [trial.path] : []);
        byRoute.set(route, { ...summarizeForecast(trials), paths });
      }
      setForecast({ byRoute, budget, system: sys });
    }, 250);
    return () => clearTimeout(id);
  }, [forecastRoutes, s.sheet, sys, budget, variant]);

  if (!model || !hoh) {
    const entriesToReview = [...progress.missing, ...progress.invalid];
    return (
      <div className="tool">
        <div className="tool-stage" />
        <div className="tool-side">
          <ToolHeader title="Launch planner" sub="Plot a course to the blue planet using your own measurements." />
          <div className="panel panel-pad stack">
            <b>{progress.missing.length ? 'More navigation values needed' : 'Review the flight model'}</b>
            <div>{progress.logged} of {progress.total} navigation values logged</div>
            <div className="muted">{progress.missing.length
              ? 'Log the remaining values on the progress sheet before estimating a transfer.'
              : 'The current values or ranges do not form a usable flight model. Review the progress sheet.'}</div>
            {entriesToReview.map((k) => (
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
    if (!plan) return;
    const p = replanDeparture(model, plan, routeMode, clock.t);
    if (!p) return toast('No transfer found for this date.');
    const current = useGame.getState();
    if (cruiseSupplies(current, sys, clock.t, p.plan)?.canDepart === false) return toast('The camp is out of supplies for takeoff.');
    sfx('launch');
    if (!current.tutorial.active) savePrelaunch();
    if (manual || manualRequired) {
      // Fly the ascent to parking orbit first; the flight is simulated after it.
      useGame.setState({ pendingLaunch: { plan: p.plan }, phase: 'ascent' });
      return;
    }
    const outcome = flyTransfer(useGame.getState(), sys, budget, p.plan);
    useGame.setState({ outcome, phase: 'flight' });
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
    <div className="tool launch-tool">
      <div className="tool-stage" data-tut="launch-stage">
        <Orrery model={model} plan={plan} paths={paths} t={t} depDay={depDay} />
        {plan && <div className="panel stage-bottom orrery-overlay-controls" role="group" aria-label="Trajectory display">
          <span className={`orrery-route-key${plan.plan.flyby ? ' flyby-route-key' : ''}`}><i aria-hidden="true" />{model.giant ? (giantRoute === 'flyby' ? 'Giant flyby' : 'Direct') : 'Planned route'}</span>
          <button type="button" className="btn small" aria-pressed={showPaths} onClick={() => setShowPaths(!showPaths)}>
            {showPaths ? 'Hide possible paths' : 'Show possible paths'}
          </button>
          {showPaths && <span className="orrery-path-count" role="status">
            {mc ? `${paths.length} paths shown from ${mc.attempted} trials` : 'Updating paths…'}
          </span>}
        </div>}
      </div>
      <div className="tool-side">
        <ToolHeader title="Launch planner" sub="Everything here is computed from your measurements — ECHO flies it through the real system." />
        {!model.giant && <><PlanningModelNotes model={model} /><DistanceContext sheet={s.sheet} variant={variant} /></>}
        <div className="panel panel-pad stack" data-tut="launch-departure">
          <div className="row between">
            <b>Departure</b>
            <span className="mono">Day {departureDate}</span>
          </div>
          <input aria-label="Departure day" aria-valuetext={`Expedition day ${departureDate}`} type="range" min={Math.floor(nowDay)} max={Math.floor(end / DAY)} step={0.5} value={depDay} onChange={(e) => setDep(Number(e.target.value))} />
          <div className="row" data-tut="launch-windows">
            {windows.slice(0, 3).map((w, i) => (
              <button
                key={w}
                className={`btn small ${affordable.includes(w) ? '' : 'ghost'}`}
                title={affordable.includes(w) ? undefined : 'By your numbers this window costs more fuel than we carry.'}
                onClick={() => setDep(w / DAY)}
              >
                Window {i + 1}: Day {fmt(w / DAY + 1, 1)}
                {affordable.includes(w) ? '' : ' · over budget'}
              </button>
            ))}
            <button className={`btn small ${dep === 'now' ? 'primary' : 'ghost'}`} onClick={() => setDep('now')}>
              Now
            </button>
          </div>
          {model.giant && <section className="stack" aria-label="Compare routes">
            <b>Choose your route</b>
            <span className="muted route-comparison-note">Same departure · Day {departureDate} · From your measurements</span>
            <div className="route-comparison slingshot-comparison">
              <RouteOption label="Giant flyby" route={flyby} budget={budget} supplies={flybySupplies} showForecast={false}
                selected={giantRoute === 'flyby'} onSelect={() => { setGiantChoice('flyby'); setConfirm(false); }} />
              <RouteOption label="Direct" route={direct} budget={budget} supplies={directSupplies} showForecast={false}
                selected={giantRoute === 'direct'} onSelect={() => { setGiantChoice('direct'); setConfirm(false); }} />
            </div>
            <p className="route-comparison-note" aria-live="polite">{directFits && flybyFits
              ? 'Both routes fit your fuel and supplies estimates. Compare time in flight and fuel left for corrections.'
              : directFits || flybyFits
                ? `Only ${flybyFits ? 'the giant flyby' : 'the direct route'} fits your fuel and supplies estimates at this departure.`
                : 'Neither route fits your fuel and supplies estimates here. Try another departure.'}</p>
            {flyby?.plan.flyby && model.giant && <EncounterDetails flyby={flyby.plan.flyby} departure={departure} flightTime={flyby.plan.tof} />}
          </section>}
          {!model.giant && <section className="stack" aria-label="Compare routes">
            <b>Compare routes</b>
            <span className="muted route-comparison-note">Same departure · Day {departureDate}</span>
            <div className="route-comparison">
              <RouteOption label="Fuel-saver" route={fuelSaver} budget={budget} supplies={fuelSaver ? cruiseSupplies(s, sys, t, fuelSaver.plan) : null}
                forecast={fuelSaver ? routeForecasts?.get(fuelSaver) : undefined}
                selected={routeMode === 'fuel-saver'} onSelect={() => setRouteMode('fuel-saver')} />
              <RouteOption label="Fast" route={fast} budget={budget} supplies={fast ? cruiseSupplies(s, sys, t, fast.plan) : null}
                forecast={fast ? routeForecasts?.get(fast) : undefined}
                selected={routeMode === 'fast'} onSelect={() => setRouteMode('fast')} />
            </div>
            <p className="muted route-comparison-note">Fast targets 25% less flight time. Both routes use the same 36 fuel trials. Compare the supplies left at arrival before choosing.</p>
            <button type="button" className={`btn small ${routeMode === 'custom' ? 'primary' : ''}`} aria-pressed={routeMode === 'custom'} onClick={() => {
              if (customDays === null && plan) setCustomDays(Math.round(plan.plan.tof / DAY));
              setRouteMode('custom');
            }}>Custom</button>
            {routeMode === 'custom' && <>
              <div className="row between">
                <span className="muted">Flight time</span>
                <span className="mono">{fmt(tofDays, 1)} days</span>
              </div>
              <input aria-label="Custom flight time" type="range" min={minDays} max={maxDays} value={tofDays} onChange={e => setCustomDays(Number(e.target.value))} />
            </>}
            {routeMode !== 'fuel-saver' && !plan && <span className="amber">No usable transfer for this route and departure.</span>}
          </section>}
          {pork && <div data-tut="launch-porkchop"><Porkchop pork={pork} budget={budget} depDay={depDay} tof={plan?.plan.tof ?? hoh.tof} onPick={(d, tf) => {
            setDep(d); setCustomDays(tf); setRouteMode('custom');
          }} /></div>}
          {model.giant ? (
            <div className="muted" style={{ fontSize: 13 }}>
              A flyby needs the giant and the blue planet in position. Try a different window to see how the encounter and fuel costs change.
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
              <dd>{fmt((plan.departCost - encounterFuel(plan.plan.flyby)) / 1000, 3)} km/s</dd>
              {plan.plan.flyby && <><dt>Flyby maneuvers</dt><dd>{fmt(encounterFuel(plan.plan.flyby) / 1000, 3)} km/s</dd></>}
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
            {selectedSupplies && <section className="panel-inset stack" aria-label="Selected route supplies">
              <b>Ship supplies · {fmt(selectedSupplies.needs, 1)} days in flight</b>
              <ArrivalSupplies supplies={selectedSupplies} />
              <details><summary>Where ship supplies come from</summary>
                <p>The ship adds a sealed {cruiseReserve(s.chapter)}-day cruise reserve to what remains at camp on departure. The reserve opens after escape. The ship uses one day of supplies per day in flight.</p>
                <p>Estimates for later departures use your current camp consumption. Weather, repairs and resupply can change what you bring.</p>
              </details>
            </section>}
            <div className="stack" style={{ gap: 6 }} aria-label="Simulated transfer outcomes">
              <div className="row between">
                <span className="muted" style={{ fontSize: 13 }}>Simulated transfer outcomes</span>
                <span className="mono">{mc ? `${mc.succeeded} of ${mc.attempted} succeeded` : 'Simulating…'}</span>
              </div>
              <div className="faint" style={{ fontSize: 12 }}>
                {mc ? `${mc.unsuccessful} unsuccessful · ${mc.unassessable} unassessable. ` : ''}These are conditional simulation results, not a measured chance of completing your expedition.
              </div>
              <details style={{ fontSize: 12 }}><summary>What does this forecast include?</summary><div className="faint" style={{ marginTop: 8, lineHeight: 1.6 }}>
                This plan is tested against 36 independently drawn models using Gaussian error bars on your primary inputs. Each sampled input is reused throughout the derived chain. Nonphysical models or numerically invalid outcomes remain unassessable attempts, rather than disappearing from the count. Success means the transfer simulator reports successful capture within the fuel budget; fuel remaining alone does not mean success.
                <br />The draws assume different primary inputs are independent. Shared calibration errors, correlations, missing biases and an unsuitable orbit model are not captured. A small sample and smaller entered errors do not establish a calibrated probability.
                <br />These trials cover the automatic transfer and capture model with the current fuel budget. They exclude the survival deadline, manual flight performance and later surface survival. See the ship supplies estimate for the selected route.
              </div></details>
            </div>
            <div data-tut="launch-go">
            {ready ? (
              confirm ? (
                <div className="stack" style={{ gap: 6 }}>
                  {launchNowPlan && <div className="panel-inset" aria-label="Supplies if you launch now">
                    <b>{model.giant ? `${giantRoute === 'flyby' ? 'Giant flyby' : 'Direct'} · ` : 'Launching now · '}{fmt(launchNowPlan.plan.tof / DAY, 1)} days in flight</b>
                    {model.giant && <div className="route-comparison-note">
                      {fmt(Math.abs(budget - launchNowPlan.total) / 1000, 2)} km/s {launchNowPlan.total > budget ? 'over budget if launched now' : 'for corrections if launched now'}
                    </div>}
                    <ArrivalSupplies supplies={cruiseSupplies(s, sys, t, launchNowPlan.plan)} />
                  </div>}
                  {!launchNowPlan && <div className="amber">There is no usable transfer at the current time.</div>}
                  <div className="row">
                    <button className="btn danger big" disabled={!launchNowPlan} onClick={() => launch(manualRequired)} style={{ flex: 1 }}>
                      {manualRequired ? '🕹 Begin manual ascent' : '🚀 Confirm launch'}
                    </button>
                    <button className="btn" onClick={() => setConfirm(false)}>
                      Wait
                    </button>
                  </div>
                  {!s.tutorial.active && !manualRequired && (
                    <button className="btn" disabled={!launchNowPlan} onClick={() => launch(true)}>
                      🕹 Fly the ascent yourself
                    </button>
                  )}
                  {!s.tutorial.active && <div className="faint" style={{ fontSize: 12 }}>{manualRequired ? 'Manual ascent and destination entry/landing are required. A rescue preserves your expedition as assisted, without a hard-mode score. Flight begins paused so you can check the controls.' : 'ECHO flies the ascent unless you take it. Fuel you waste beyond ECHO’s profile comes out of the margin.'}</div>}
                </div>
              ) : (
                <button className="btn amber big" onClick={() => {
                  if (model.giant) setGiantChoice(giantRoute);
                  setConfirm(true);
                }}>
                  Launch now
                </button>
              )
            ) : depDay > nowDay ? (
              <button className="btn primary" onClick={warpTo}>
                Warp to Day {departureDate} ({fmt(depDay - nowDay, 1)} expedition days of life support)
              </button>
            ) : (
              <div className="amber">That date has passed.</div>
            )}
            </div>
          </div>
        )}
        {model.giant && <><PlanningModelNotes model={model} /><DistanceContext sheet={s.sheet} variant={variant} /></>}
      </div>
    </div>
  );
}

const TAU_DEG = 360;

type Flyby = NonNullable<PlannedTransfer['plan']['flyby']>;

function encounterFuel(flyby?: Flyby) {
  return flyby ? Math.abs(flyby.dv) + flyby.extraDv : 0;
}

function EncounterDetails({ flyby, departure, flightTime }: { flyby: Flyby; departure: number; flightTime: number }) {
  return <details className="flyby-details">
    <summary>Inside the giant encounter</summary>
    <dl className="kv">
      <dt>Reach the giant</dt><dd>Day {fmt((departure + flyby.tof1) / DAY + 1, 1)}</dd>
      <dt>Closest to the giant's centre</dt><dd>{fmt(flyby.rp / 1e6, 0)} thousand km</dd>
      <dt>Burn at closest approach</dt><dd>{fmt(Math.abs(flyby.dv), 0)} m/s</dd>
      {flyby.extraDv > 0 && <><dt>Extra turn burn</dt><dd>{fmt(flyby.extraDv, 0)} m/s</dd></>}
      <dt>Coast from giant to blue planet</dt><dd>{fmt((flightTime - flyby.tof1) / DAY, 1)} days</dd>
    </dl>
    <p>The giant's gravity turns the ship. Because the giant is itself orbiting the star, that turn can give the ship a boost or slow it down. A poor approach can need more fuel. Your estimate of the giant's mass helps ECHO aim the pass.</p>
  </details>;
}

function RouteOption({ label, route, budget, supplies, forecast, selected, onSelect, showForecast = true }: {
  label: string;
  route: PlannedTransfer | null;
  budget: number;
  supplies: CruiseSupplies | null;
  forecast?: ForecastSummary;
  showForecast?: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  const margin = route ? budget - route.total : 0;
  return <section className="panel-inset route-option" aria-label={`${label} route`} data-selected={selected}>
    <button type="button" className={`btn small ${selected ? 'primary' : ''}`} aria-pressed={selected} disabled={!route} onClick={onSelect}>{label}</button>
    {route ? <>
      <dl>
        <dt>Flight time</dt><dd>{fmt(route.plan.tof / DAY, 1)} days</dd>
        <dt>{margin < 0 ? 'Over budget by' : 'Fuel for corrections'}</dt>
        <dd className={margin < 0 ? 'red' : 'blue'}>{fmt(Math.abs(margin) / 1000, 2)} km/s</dd>
        {showForecast && <><dt>Captures within budget</dt>
          <dd>{forecast ? `${forecast.succeeded} of ${forecast.attempted}` : 'Simulating…'}</dd></>}
      </dl>
      {forecast && forecast.unassessable > 0 && <div className="muted route-comparison-note">{forecast.unassessable} unassessable</div>}
      <ArrivalSupplies supplies={supplies} />
    </> : <div className="muted route-comparison-note">No usable transfer</div>}
  </section>;
}

function ArrivalSupplies({ supplies }: { supplies: CruiseSupplies | null }) {
  if (!supplies) return null;
  if (!supplies.canDepart) return <div className="amber route-comparison-note">Camp supplies run out before departure.</div>;
  const margin = cruiseLimit(supplies) - supplies.needs;
  return <div className={`route-comparison-note ${margin <= 0 ? 'amber' : 'muted'}`}>
    {margin <= 0
      ? `Supplies run out ${margin === 0 ? 'at arrival' : `${fmt(-margin, 1)} days before arrival`}.`
      : `At arrival · ${fmt(supplies.air - supplies.needs, 1)} days of air${supplies.food === undefined ? '' : ` · ${fmt(supplies.food - supplies.needs, 1)} days of food`}`}
  </div>;
}

function FuelBar({ plan, budget }: { plan: PlannedTransfer; budget: number }) {
  const parts = [
    { v: plan.departCost - encounterFuel(plan.plan.flyby), c: '#6cc4ff', l: 'escape' },
    ...(plan.plan.flyby ? [{ v: encounterFuel(plan.plan.flyby), c: '#ffc46b', l: 'flyby' }] : []),
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
        <span className="muted">Cost map: departure day → (flight time ↑)</span>
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

function Orrery({ model, plan, paths, t, depDay }: { model: NonNullable<ReturnType<typeof modelFromPrimaries>>; plan: PlannedTransfer | null; paths: Vec3[][]; t: number; depDay: number }) {
  const anim = useRef(0);
  // The planned transfer arc in the player's model, computed once per plan.
  const arc = useMemo(() => {
    if (!plan) return { points: [], encounterIndex: -1 };
    const td = plan.plan.departTime;
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
      return { points: [...leg1, ...leg2.slice(1)], encounterIndex: leg1.length - 1 };
    }
    return { points: Array.from({ length: 121 }, (_, i) => propagate(r1, v0, (plan.plan.tof * i) / 120, mu)[0]), encounterIndex: -1 };
  }, [plan, model]);
  const reducedMotion = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), []);
  const orbitDescription = model.giant
    ? plan?.plan.flyby ? 'Giant flyby route, showing the leg to the giant and the leg to the blue planet'
      : plan ? 'Direct route from home to the blue planet' : 'Planetary orbits'
    : 'Planned route and planetary orbits';
  return (
    <CanvasView
      role="img" aria-label={paths.length ? `${orbitDescription} with sampled trajectories` : orbitDescription}
      draw={({ ctx, w, h, dpr, dt }) => {
        if (!reducedMotion.matches) anim.current = (anim.current + dt * 0.15) % 1;
        ctx.fillStyle = '#04060c';
        ctx.fillRect(0, 0, w, h);
        const cx = w / 2;
        const cy = h * (model.giant && w < 600 * dpr && h >= w ? 0.52 : 0.47);
        const S = (Math.min(w, h) * 0.42) / (model.a2 * (1 + (model.ecc ?? 0)) * 1.12);
        const X = (v: Vec3) => cx + v[0] * S;
        const Y = (v: Vec3) => cy - v[1] * S;
        const labelAt = (text: string, x: number, y: number, offset: number) => {
          const width = ctx.measureText(text).width;
          const pad = 6 * dpr;
          const left = x + offset + width <= w - pad ? x + offset : x - offset - width;
          ctx.fillText(text, Math.max(pad, left), y);
        };
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
        // Sampled trajectories sit behind the selected route.
        ctx.lineWidth = dpr;
        ctx.strokeStyle = 'rgba(124,166,224,0.24)';
        for (const path of paths) {
          ctx.beginPath();
          path.forEach((v, i) => (i ? ctx.lineTo(X(v), Y(v)) : ctx.moveTo(X(v), Y(v))));
          ctx.stroke();
        }
        const td = depDay * DAY;
        if (plan) {
          // Planned transfer in the player's model.
          const drawLeg = (start: number, end: number, color: string) => {
            ctx.strokeStyle = color;
            ctx.lineWidth = 2 * dpr;
            ctx.beginPath();
            for (let i = start; i < end; i++) {
              const r = arc.points[i];
              if (i === start) ctx.moveTo(X(r), Y(r));
              else ctx.lineTo(X(r), Y(r));
            }
            ctx.stroke();
          };
          ctx.setLineDash([6 * dpr, 5 * dpr]);
          if (arc.encounterIndex < 0) drawLeg(0, arc.points.length, '#ffc46b');
          else {
            drawLeg(0, arc.encounterIndex + 1, '#ffc46b');
            drawLeg(arc.encounterIndex, arc.points.length, '#76dccc');
          }
          ctx.setLineDash([]);
          // Ship marker animating along the plan.
          const rs = arc.points[Math.floor(anim.current * arc.points.length)];
          if (rs && !reducedMotion.matches) {
            ctx.fillStyle = '#fff';
            ctx.beginPath();
            ctx.arc(X(rs), Y(rs), 3 * dpr, 0, Math.PI * 2);
            ctx.fill();
          }
          // The giant at the flyby (ghost).
          if (plan.plan.flyby && model.giant) {
            const rg = giantState(model, td + plan.plan.flyby.tof1)[0];
            const x = X(rg), y = Y(rg);
            const glow = ctx.createRadialGradient(x, y, 2 * dpr, x, y, 23 * dpr);
            glow.addColorStop(0, '#ffe6b8');
            glow.addColorStop(.35, 'rgba(255,196,107,0.25)');
            glow.addColorStop(1, 'rgba(255,196,107,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(x - 23 * dpr, y - 23 * dpr, 46 * dpr, 46 * dpr);
            ctx.strokeStyle = 'rgba(255,230,184,0.8)';
            ctx.lineWidth = dpr;
            ctx.beginPath();
            ctx.arc(x, y, 9 * dpr, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = '#ffe6b8';
            ctx.font = `600 ${11 * dpr}px Inter, sans-serif`;
            labelAt('Giant encounter', x, y - 9 * dpr, 12 * dpr);
          }
          // Planet 2 at arrival (ghost).
          const r2a = targetState(model, td + plan.plan.tof)[0];
          ctx.strokeStyle = 'rgba(108,196,255,0.8)';
          ctx.beginPath();
          ctx.arc(X(r2a), Y(r2a), 8 * dpr, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = 'rgba(108,196,255,0.8)';
          ctx.font = `${11 * dpr}px Inter, sans-serif`;
          labelAt('Arrival', X(r2a), Y(r2a), 10 * dpr);
        }
        // Planets at departure and now.
        const planet = (v: Vec3, c: string, r: number, label: string, labelY = -6) => {
          ctx.fillStyle = c;
          ctx.beginPath();
          ctx.arc(X(v), Y(v), r * dpr, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = 'rgba(230,238,252,0.85)';
          ctx.font = `600 ${11 * dpr}px Inter, sans-serif`;
          if (label) labelAt(label, X(v), Y(v) + labelY * dpr, 9 * dpr);
        };
        planet(posAt(model.a1, model.P1, model, td), '#ffb26b', 6, model.giant ? 'Home' : 'home @ departure');
        planet(targetState(model, td)[0], '#6cc4ff', 6, model.giant ? 'Blue planet' : 'blue @ departure', model.giant ? 15 : -6);
        ctx.globalAlpha = 0.45;
        planet(posAt(model.a1, model.P1, model, t), '#ffb26b', 4, 'now');
        planet(targetState(model, t)[0], '#6cc4ff', 4, '');
        ctx.globalAlpha = 1;
      }}
    />
  );
}
