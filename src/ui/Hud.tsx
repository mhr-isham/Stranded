import { useState } from 'react';
import { DAY } from '../engine/constants';
import { WARPS, clock, setWarp, togglePause } from '../game/clock';
import { currentWorld } from '../game/sim';
import { useGame } from '../game/store';
import { lifeSupportEnd } from '../game/survival';
import { dayNumber, hhmm, localSolarHours } from '../game/time';
import { fmt } from '../game/format';
import { Modal, Toggle, useClockState, useGameTime } from './common/widgets';

export function Hud() {
  const t = useGameTime(6);
  useClockState();
  const s = useGame();
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
        <div className="panel hud-block hud-time">
          <span style={{ fontSize: 20 }}>{night ? '🌙' : '☀️'}</span>
          <div>
            <div className="day">Day {dayNumber(t)}</div>
            <div className="clock">
              {hhmm(sol)}
              <span className="hide-phone"> local</span>
            </div>
          </div>
        </div>
        <div className="panel hud-block warp">
          <button className="btn icon small" aria-label="Slower" onClick={() => setWarp(clock.warpIndex - 1)} disabled={clock.realtime}>
            ◀
          </button>
          <button className="btn small hide-phone" onClick={togglePause} style={{ minWidth: 40 }} aria-label="Pause">
            {clock.paused ? '▶' : '❚❚'}
          </button>
          <button className="rate btn ghost small" onClick={togglePause} title="Tap to pause / resume">
            {clock.realtime ? 'real time' : clock.paused ? 'paused' : WARPS[clock.warpIndex].label}
          </button>
          <button className="btn icon small" aria-label="Faster" onClick={() => setWarp(clock.warpIndex + 1)} disabled={clock.realtime}>
            ▶
          </button>
        </div>
        <div className="spacer hide-phone" />
        <div className="panel hud-block hud-life">
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
        <div className="panel hud-block hide-phone">
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
            <dt>Difficulty</dt>
            <dd style={{ textTransform: 'capitalize' }}>{s.settings.difficulty}</dd>
            <dt>Survival mode</dt>
            <dd>{s.settings.survival ? 'on' : 'off'}</dd>
            <dt>Fuel budget</dt>
            <dd>{fmt(fuel / 1000, 2)} km/s</dd>
          </dl>
          <Toggle on={s.settings.formulas} onChange={(v) => s.set({ settings: { ...s.settings, formulas: v } })} label="Formula sheet" sub="Shown in tools and on the progress sheet." />
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
