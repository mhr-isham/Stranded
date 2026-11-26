import { useMemo, useState } from 'react';
import { DAY } from '../engine/constants';
import { variantOf } from '../engine/chapters';
import { predictedWindows } from '../engine/planner';
import { WARPS, clock, setWarp, togglePause } from '../game/clock';
import { checkMissions, currentWorld } from '../game/sim';
import { useGame } from '../game/store';
import { lifeSupportEnd } from '../game/survival';
import { dayNumber, hhmm, localSolarHours } from '../game/time';
import { fmt } from '../game/format';
import { flag } from '../game/tutorial';
import { Modal, Toggle, toast, useClockState, useGameTime } from './common/widgets';
import { useMode } from '../game/modes';
import { SLOTS, listSlots, loadSlot, saveSlot } from '../game/checkpoints';
import { flightReadiness, navigationModel, navigationProgress, quantityName, weakestValue } from '../game/readiness';
import { flareAt } from '../engine/flares';
import { AudioSettings } from './common/AudioSettings';
import { EventMenu } from './common/EventMenu';
import { isCadetExpedition } from '../game/cadetGuidance';

export function Hud({ onLaunchWindow }: { onLaunchWindow: (at: number) => void }) {
  const t = useGameTime(6);
  useClockState();
  const s = useGame();
  const mode = useMode();
  const { system: sys } = currentWorld();
  const [menu, setMenu] = useState(false);
  const [eventsOpen, setEventsOpen] = useState(false);
  const ClockPanel = s.tutorial.active ? 'div' : 'button';
  const end = lifeSupportEnd(s, sys);
  const lifeFrac = s.tutorial.active ? 1 : Math.max(0, Math.min(1, (end - t) / sys.lifeSupport));
  const daysLeft = Math.max(0, (end - t) / DAY);
  const fuel = sys.fuelDv - s.penaltyDv;
  const sol = localSolarHours(sys, t);
  const night = sol < 5 || sol > 19;
  const flare = flareAt(sys, t);
  const variant = variantOf(sys.features);
  const model = useMemo(() => navigationModel(s.sheet, variant), [s.sheet, variant]);
  const launchWindow = !s.tutorial.active && model ? predictedWindows(model, t, end, 1)[0] : undefined;
  const windowDays = launchWindow === undefined ? 0 : Math.ceil((launchWindow - t) / DAY);
  const windowCountdown = windowDays <= 1 ? 'Under 1 day' : `${fmt(windowDays, 0)} days`;

  return (
    <>
      <div className="hud">
        <ClockPanel className={`panel hud-block hud-time${s.tutorial.active ? '' : ' hud-time-button'}`} data-tut="hud-time"
          type={s.tutorial.active ? undefined : 'button'} aria-label={s.tutorial.active ? undefined : 'Next event'}
          title={s.tutorial.active ? undefined : 'Open scheduled events'} onClick={s.tutorial.active ? undefined : () => setEventsOpen(true)}>
          <span className="hud-clock-icon" style={{ fontSize: 20 }}>{flare ? '🔥' : sys.features.locked ? '🌒' : night ? '🌙' : '☀️'}</span>
          <span className="hud-clock-readout">
            <span className="day">Day {dayNumber(t)}</span>
            <span className={`clock ${flare ? 'amber' : ''}`}>
              {flare ? (
                'FLARE'
              ) : sys.features.locked ? (
                <><span className="hide-phone">eternal dusk</span><span className="show-phone">dusk</span></>
              ) : (
                <>
                  {hhmm(sol)}
                  <span className="hide-phone"> local</span>
                </>
              )}
              {!s.tutorial.active && <span className="hud-time-caret hide-phone" aria-hidden="true"> ▾</span>}
            </span>
          </span>
        </ClockPanel>
        <div className="panel hud-block warp" data-tut="hud-warp">
          <button
            className="btn icon small"
            aria-label="Slower"
            onClick={() => (setWarp(clock.warpIndex - 1), flag('warp-changed'))}
            disabled={clock.realtime}
          >
            ◀
          </button>
          <button
            className="btn small hide-phone"
            onClick={() => (togglePause(), flag('warp-changed'))}
            style={{ minWidth: 40 }}
            aria-label="Pause"
          >
            {clock.paused ? '▶' : '❚❚'}
          </button>
          <button className="rate btn ghost small" onClick={() => (togglePause(), flag('warp-changed'))} title="Tap to pause / resume">
            {clock.paused ? 'paused' : clock.realtime ? 'real time' : WARPS[clock.warpIndex].label}
          </button>
          <button
            className="btn icon small"
            aria-label="Faster"
            onClick={() => (setWarp(clock.warpIndex + 1), flag('warp-changed'))}
            disabled={clock.realtime}
          >
            ▶
          </button>
        </div>
        <div className="spacer hide-phone" />
        <div className="panel hud-block hud-life" data-tut="hud-life">
          <div>
            <div className="meter-label">
              Life<span className="hide-phone"> support</span>
            </div>
            <div className="meter">
              <i
                style={{
                  width: `${lifeFrac * 100}%`,
                  background: lifeFrac < 0.15 ? 'var(--red)' : lifeFrac < 0.35 ? 'var(--amber)' : 'var(--green)',
                }}
              />
            </div>
          </div>
          <span className="mono" style={{ fontSize: 13 }}>
            {s.settings.freeRoam || s.tutorial.active ? '∞' : `${fmt(daysLeft, 0)} d`}
          </span>
        </div>
        {s.settings.survival && (
          <button className="panel hud-block btn hide-phone" style={{ gap: 10 }} onClick={() => s.go('workshop')} title="Camp supplies">
            <span className="mono" style={{ fontSize: 12 }}>
              O₂ {fmt(Math.max(0, s.survival.o2), 0)}
            </span>
            <span className="mono" style={{ fontSize: 12 }}>
              🍲 {fmt(s.survival.food, 0)}
            </span>
            <span className={`mono ${s.survival.power < 15 ? 'red' : ''}`} style={{ fontSize: 12 }}>
              ⚡{fmt(s.survival.power, 0)}%
            </span>
            {s.survival.leak && <span className="red">⚠</span>}
          </button>
        )}
        {s.settings.survival && (
          // Phones: a compact supplies button, red when something needs attention.
          <button
            className={`panel hud-block btn show-phone ${s.survival.leak || s.survival.power < 15 || s.survival.o2 < 30 ? 'red' : ''}`}
            onClick={() => s.go('workshop')}
            aria-label="Camp supplies"
            title={`Camp supplies · oxygen ${fmt(Math.max(0, s.survival.o2), 0)}`}
          >
            <span className="mono" style={{ fontSize: 12 }}>
              O₂ <span className="mobile-supply-value">{fmt(Math.max(0, s.survival.o2), 0)}</span>
              {s.survival.leak || s.survival.power < 15 ? ' ⚠' : ''}
            </span>
          </button>
        )}
        {!s.tutorial.active && <div className={`hud-navigation${launchWindow === undefined ? '' : ' has-window'}`}>
          <ReadinessBlock t={t} end={end} budget={fuel} />
          {launchWindow !== undefined && <button type="button" className="panel hud-block btn hud-window"
            title="Estimated from your navigation sheet. Measurement errors can shift the window."
            aria-label={`Estimated launch window: ${windowCountdown.toLowerCase()}. Open launch planner.`}
            onClick={() => {
              const current = useGame.getState();
              const currentModel = navigationModel(current.sheet, variant);
              if (!currentModel) return;
              const at = predictedWindows(currentModel, clock.t, lifeSupportEnd(current, sys), 1)[0];
              if (at !== undefined) onLaunchWindow(at);
            }}>
            <span className="meter-label"><span className="hide-phone">Est. launch window</span><span className="show-phone">Est. window</span></span>
            <span className="mono">{windowDays <= 1 ? '< 1 d' : `${fmt(windowDays, 0)} d`}</span>
          </button>}
        </div>}
        <div className="panel hud-block hide-phone" data-tut="hud-fuel">
          <div>
            <div className="meter-label">Fuel Δv</div>
            <div className="mono" style={{ fontSize: 14 }}>
              {fmt(fuel / 1000, 2)} km/s
            </div>
          </div>
        </div>
        <button className="panel hud-block btn" onClick={() => setMenu(true)} aria-label="Menu">
          ☰
        </button>
      </div>
      {!s.tutorial.active && <EventMenu open={eventsOpen} onClose={() => setEventsOpen(false)} now={t} supplyEnd={end} />}
      {menu && (
        <Modal top onClose={() => setMenu(false)}>
          <h2>Expedition</h2>
          <button className="btn small" onClick={() => { s.set({ schoolOpen: { chapter: s.chapter } }); setMenu(false); }}>Open Flight School</button>
          <dl className="kv" style={{ margin: '8px 0 12px' }}>
            <dt>System seed</dt>
            <dd>{s.seed}</dd>
            <dt>Mode</dt>
            <dd>{s.settings.freeRoam ? 'Free Roam' : mode.name}</dd>
            <dt>Survival mode</dt>
            <dd>{s.settings.survival ? 'on' : 'off'}</dd>
            <dt>Fuel budget</dt>
            <dd>{fmt(fuel / 1000, 2)} km/s</dd>
          </dl>
          <Toggle
            on={s.settings.formulas}
            onChange={(v) =>
              !mode.formulasLocked && !s.settings.challenges?.includes('noFormula') && s.set({ settings: { ...s.settings, formulas: v } })
            }
            label="Formula sheet"
            sub={mode.formulasLocked ? `Not available in ${mode.name}.` : 'Shown in tools and on the progress sheet.'}
          />
          {isCadetExpedition(s) && <Toggle
            on={s.settings.cadetGuidance !== false}
            onChange={(v) => s.set({ settings: { ...s.settings, cadetGuidance: v }, echo: s.echo.filter((l) => !l.coach) })}
            label="Cadet guidance"
            sub="Optional next goal and coaching. Instrument warnings and requested hints remain available."
          />}
          {s.settings.freeRoam && (
            <div className="stack">
              <Toggle
                on={!!s.settings.freeRoamGuidance}
                onChange={(v) => {
                  s.set({ settings: { ...s.settings, freeRoamGuidance: v }, echo: [] });
                  if (v) checkMissions();
                }}
                label="ECHO guidance"
                sub="Optional suggestions and measurement goals."
              />
              <Toggle
                on={!!s.settings.showTruth}
                onChange={(v) => s.set({ settings: { ...s.settings, showTruth: v } })}
                label="Sandbox: show the true values"
                sub="Free Roam only. The sheet shows the real value next to yours — a way to explore, never scored."
              />
              <button
                className="btn"
                onClick={() => {
                  s.set({ phase: 'prologue', storyQueue: [], echo: [] });
                  setMenu(false);
                }}
              >
                Practice landing
              </button>
            </div>
          )}
          {!s.tutorial.active && <CheckpointPanel onDone={() => setMenu(false)} />}
          <AudioSettings settings={s.settings} onChange={(settings) => s.set({ settings })} />
          <div className="row" style={{ justifyContent: 'space-between', marginTop: 16 }}>
            <button
              className="btn"
              onClick={() => {
                useGame.setState({ phase: 'title', savedT: clock.t });
                setMenu(false);
              }}
            >
              Save & quit to title
            </button>
            <button className="btn primary" onClick={() => setMenu(false)}>
              Resume
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/** Manual checkpoints: three slots, limited per run in some modes, none in the one-shot modes. */
function CheckpointPanel({ onDone }: { onDone: () => void }) {
  const mode = useMode();
  const used = useGame((s) => s.checkpointsUsed);
  const [slots, setSlots] = useState(listSlots);
  if (mode.checkpoints <= 0) {
    return (
      <div className="faint" style={{ fontSize: 12, padding: '10px 0' }}>
        {mode.name} is one shot: no checkpoints or rewinds. The game still autosaves so you can quit and continue.
      </div>
    );
  }
  const left = mode.checkpoints - used;
  const finite = Number.isFinite(mode.checkpoints);
  return (
    <div className="stack" style={{ padding: '10px 0', gap: 8 }}>
      <div className="row between">
        <b style={{ fontSize: 14 }}>Checkpoints</b>
        <span className="faint" style={{ fontSize: 12 }}>
          {finite ? `${left} save${left === 1 ? '' : 's'} left this run` : 'save any time'}
        </span>
      </div>
      <div className="faint" style={{ fontSize: 12 }}>Loading keeps unlocked hints and spent hint/verification costs.</div>
      {Array.from({ length: SLOTS }, (_, i) => {
        const snap = slots[i];
        return (
          <div key={i} className="row between" style={{ gap: 8 }}>
            <span className="muted" style={{ fontSize: 13, flex: 1 }}>
              Slot {i + 1}: {snap ? `day ${fmt(snap.t / DAY, 1)}` : 'empty'}
            </span>
            <button
              className="btn small"
              disabled={finite && left <= 0}
              onClick={() => {
                if (saveSlot(i)) {
                  setSlots(listSlots());
                  toast(`Checkpoint saved in slot ${i + 1}`);
                } else toast('Could not save — browser storage is full or blocked.');
              }}
            >
              Save
            </button>
            <button
              className="btn small"
              disabled={!snap}
              onClick={() => {
                if (loadSlot(i)) {
                  toast(`Back to day ${fmt(snap!.t / DAY, 1)}`);
                  onDone();
                }
              }}
            >
              Load
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** The HUD meter tracks sheet entries. Transfer trials are available on request. */
function ReadinessBlock({ t, end, budget }: { t: number; end: number; budget: number }) {
  const s = useGame();
  const mode = useMode();
  const { system } = currentWorld();
  const [open, setOpen] = useState(false);
  const variant = variantOf(system.features);
  const progress = navigationProgress(s.sheet, variant);
  const flight = open ? flightReadiness(s.sheet, system, budget, t, end) : null;
  const weakest = open && mode.missions !== 'off' && !progress.invalid.length ? weakestValue(s.sheet, variant) : null;
  const count = `${progress.logged} of ${progress.total} navigation values logged`;
  return (
    <>
      <button className="panel hud-block btn hud-ready" onClick={() => setOpen(true)} title={count} aria-label={`Mission readiness: ${count}`}>
        <div className="hide-phone">
          <div className="meter-label">Nav log</div>
          <div className="meter" style={{ width: 70 }}>
            <i style={{ width: `${100 * progress.logged / progress.total}%`, background: 'var(--blue)' }} />
          </div>
        </div>
        <span className="mono" style={{ fontSize: 13 }}>
          <span className="show-phone" aria-hidden="true">🎯 </span>
          {progress.logged}/{progress.total}
        </span>
      </button>
      {open && flight && (
        <Modal onClose={() => setOpen(false)}>
          <h2>Mission readiness</h2>
          <div className="stack" style={{ marginBlock: 12 }}>
            <section className="panel panel-pad stack" aria-label="Navigation log">
              <b>Navigation log</b>
              <span>{count}</span>
              {progress.missing.length > 0 && <span className="muted">{progress.missing.length} still needed on the progress sheet.</span>}
              {weakest && <details className="measurement-help"><summary>Review measurement uncertainty</summary>
                <p>{quantityName(weakest.k)} makes the largest contribution in the current comparison of derived errors. This estimate uses the values and ranges on your sheet.</p>
              </details>}
            </section>
            <section className="panel panel-pad stack" aria-label="Transfer estimate">
              <b>Transfer estimate</b>
              {flight.status === 'missing' && <span className="muted">Log the remaining navigation values to estimate fuel and capture.</span>}
              {flight.status === 'invalid-model' && <span className="muted">The current values or ranges do not form a usable flight model. Review the progress sheet.</span>}
              {flight.status === 'no-window' && <span className="muted">Your model shows no upcoming departure window before the current supplies deadline.</span>}
              {flight.status === 'no-transfer' && <span className="muted">The planner could not evaluate a transfer at the next modeled window.</span>}
              {flight.status === 'sampled' && <>
                <span className="muted">Next modeled window · Day {dayNumber(flight.window)}</span>
                {flight.summary.unassessable === flight.summary.attempted
                  ? <span>None of the {flight.summary.attempted} simulations could be evaluated. Review your inputs and ranges.</span>
                  : <span><b>{flight.summary.succeeded} of {flight.summary.attempted}</b> simulations reached capture within the fuel budget.</span>}
                <span className="muted">{flight.summary.unsuccessful} unsuccessful · {flight.summary.unassessable} unassessable</span>
                <details className="measurement-help"><summary>What this covers</summary>
                  <p>These trials use the ranges on your sheet, assuming independent errors between inputs. They cover automatic transfer and capture. Check the arrival deadline and any manual flight separately.</p>
                </details>
              </>}
            </section>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end' }}>
            <button className="btn primary" onClick={() => setOpen(false)}>OK</button>
          </div>
        </Modal>
      )}
    </>
  );
}
