import { useState } from 'react';
import { DAY } from '../engine/constants';
import { WARPS, clock, setWarp, togglePause } from '../game/clock';
import { currentWorld } from '../game/sim';
import { useGame } from '../game/store';
import { lifeSupportEnd } from '../game/survival';
import { dayNumber, hhmm, localSolarHours } from '../game/time';
import { fmt } from '../game/format';
import { flag } from '../game/tutorial';
import { Modal, Toggle, toast, useClockState, useGameTime } from './common/widgets';
import { useMode } from '../game/modes';
import { SLOTS, listSlots, loadSlot, saveSlot } from '../game/checkpoints';

export function Hud() {
  const t = useGameTime(6);
  useClockState();
  const s = useGame();
  const mode = useMode();
  const { system: sys } = currentWorld();
  const [menu, setMenu] = useState(false);
  const end = lifeSupportEnd(s, sys);
  const lifeFrac = Math.max(0, Math.min(1, (end - t) / sys.lifeSupport));
  const daysLeft = Math.max(0, (end - t) / DAY);
  const fuel = sys.fuelDv - s.penaltyDv;
  const sol = localSolarHours(sys, t);
  const night = sol < 5 || sol > 19;

  return (
    <>
      <div className="hud">
        <div className="panel hud-block hud-time" data-tut="hud-time">
          <span style={{ fontSize: 20 }}>{night ? '🌙' : '☀️'}</span>
          <div>
            <div className="day">Day {dayNumber(t)}</div>
            <div className="clock">
              {hhmm(sol)}
              <span className="hide-phone"> local</span>
            </div>
          </div>
        </div>
        <div className="panel hud-block warp" data-tut="hud-warp">
          <button className="btn icon small" aria-label="Slower" onClick={() => (setWarp(clock.warpIndex - 1), flag('warp-changed'))} disabled={clock.realtime}>
            ◀
          </button>
          <button className="btn small hide-phone" onClick={() => (togglePause(), flag('warp-changed'))} style={{ minWidth: 40 }} aria-label="Pause">
            {clock.paused ? '▶' : '❚❚'}
          </button>
          <button className="rate btn ghost small" onClick={() => (togglePause(), flag('warp-changed'))} title="Tap to pause / resume">
            {clock.realtime ? 'real time' : clock.paused ? 'paused' : WARPS[clock.warpIndex].label}
          </button>
          <button className="btn icon small" aria-label="Faster" onClick={() => (setWarp(clock.warpIndex + 1), flag('warp-changed'))} disabled={clock.realtime}>
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
              <i style={{ width: `${lifeFrac * 100}%`, background: lifeFrac < 0.15 ? 'var(--red)' : lifeFrac < 0.35 ? 'var(--amber)' : 'var(--green)' }} />
            </div>
          </div>
          <span className="mono" style={{ fontSize: 13 }}>{fmt(daysLeft, 0)} d</span>
        </div>
        {s.settings.survival && (
          <button className="panel hud-block btn hide-phone" style={{ gap: 10 }} onClick={() => s.go('workshop')} title="Camp supplies">
            <span className="mono" style={{ fontSize: 12 }}>O₂ {fmt(s.survival.o2, 0)}</span>
            <span className="mono" style={{ fontSize: 12 }}>🍲 {fmt(s.survival.food, 0)}</span>
            <span className={`mono ${s.survival.power < 15 ? 'red' : ''}`} style={{ fontSize: 12 }}>⚡{fmt(s.survival.power, 0)}%</span>
            {s.survival.leak && <span className="red">⚠</span>}
          </button>
        )}
        <div className="panel hud-block hide-phone" data-tut="hud-fuel">
          <div>
            <div className="meter-label">Fuel Δv</div>
            <div className="mono" style={{ fontSize: 14 }}>{fmt(fuel / 1000, 2)} km/s</div>
          </div>
        </div>
        <button className="panel hud-block btn" onClick={() => setMenu(true)} aria-label="Menu">
          ☰
        </button>
      </div>
      {menu && (
        <Modal onClose={() => setMenu(false)}>
          <h2>Expedition</h2>
          <dl className="kv" style={{ margin: '8px 0 12px' }}>
            <dt>System seed</dt>
            <dd>{s.seed}</dd>
            <dt>Mode</dt>
            <dd>{mode.name}</dd>
            <dt>Survival mode</dt>
            <dd>{s.settings.survival ? 'on' : 'off'}</dd>
            <dt>Fuel budget</dt>
            <dd>{fmt(fuel / 1000, 2)} km/s</dd>
          </dl>
          <Toggle
            on={s.settings.formulas}
            onChange={(v) => !mode.formulasLocked && s.set({ settings: { ...s.settings, formulas: v } })}
            label="Formula sheet"
            sub={mode.formulasLocked ? `Not available in ${mode.name}.` : 'Shown in tools and on the progress sheet.'}
          />
          {!s.tutorial.active && <CheckpointPanel onDone={() => setMenu(false)} />}
          <Toggle on={s.settings.sound} onChange={(v) => s.set({ settings: { ...s.settings, sound: v } })} label="Sound" />
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
        <span className="faint" style={{ fontSize: 12 }}>{finite ? `${left} save${left === 1 ? '' : 's'} left this run` : 'save any time'}</span>
      </div>
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
