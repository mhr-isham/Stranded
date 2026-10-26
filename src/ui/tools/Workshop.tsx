import { useState } from 'react';
import { DAY } from '../../engine/constants';
import { sfx } from '../../game/audio';
import { clock } from '../../game/clock';
import { fmt } from '../../game/format';
import { spendTime } from '../../game/sim';
import { useGame } from '../../game/store';
import { UPGRADES, inStorm, o2Rate, salvage } from '../../game/survival';
import { ToolHeader } from '../common/sheetBits';
import { toast, useGameTime } from '../common/widgets';

export function Workshop() {
  const s = useGame();
  const t = useGameTime(3);
  const sv = s.survival;
  const [busy, setBusy] = useState(false);
  if (!s.settings.survival) return null;
  const storm = inStorm(s.seed, Math.floor(t / DAY));

  const doSalvage = () => {
    setBusy(true);
    spendTime(0.5 * DAY, () => {
      const r = salvage(useGame.getState());
      useGame.setState({ survival: r.survival });
      toast(r.found);
      sfx('good');
      setBusy(false);
    });
  };
  const repair = () => {
    if (sv.parts < 1) return toast('Need 1 part to patch the tank.');
    setBusy(true);
    spendTime(0.5 * DAY, () => {
      const cur = useGame.getState().survival;
      useGame.setState({ survival: { ...cur, leak: false, parts: cur.parts - 1, log: [`Day ${Math.floor(clock.t / DAY) + 1}: oxygen tank patched.`, ...cur.log] } });
      toast('Leak repaired');
      setBusy(false);
    });
  };
  const build = (id: string, cost: number) => {
    if (sv.parts < cost) return toast(`Needs ${cost} parts.`);
    setBusy(true);
    spendTime(1 * DAY, () => {
      const cur = useGame.getState().survival;
      useGame.setState({
        survival: { ...cur, parts: cur.parts - cost, upgrades: [...cur.upgrades, id], greenhouseSince: id === 'greenhouse' ? clock.t : cur.greenhouseSince },
      });
      sfx('unlock');
      toast('Built!');
      setBusy(false);
    });
  };

  const Bar = ({ label, v, max, unit, color }: { label: string; v: number; max: number; unit: string; color: string }) => (
    <div>
      <div className="row between" style={{ fontSize: 13 }}>
        <span>{label}</span>
        <span className="mono">
          {fmt(v, 0)} {unit}
        </span>
      </div>
      <div className="meter" style={{ width: '100%', height: 8 }}>
        <i style={{ width: `${Math.max(0, Math.min(100, (100 * v) / max))}%`, background: color }} />
      </div>
    </div>
  );

  return (
    <div className="tool">
      <div className="tool-stage" style={{ background: 'radial-gradient(ellipse at 50% 60%, #2a1d12 0%, #05070f 70%)' }}>
        <div style={{ position: 'absolute', inset: 'calc(80px + var(--safe-top)) 16px 90px', display: 'grid', placeItems: 'center' }}>
          <div className="panel panel-pad" style={{ width: 'min(520px, 100%)' }}>
            <h2 style={{ fontSize: 18, marginBottom: 8 }}>Camp status</h2>
            <div className="stack">
              <Bar label="Oxygen" v={sv.o2} max={Math.max(sv.o2, 400)} unit="days" color="var(--blue)" />
              <Bar label="Food" v={sv.food} max={Math.max(sv.food, 400)} unit="days" color="var(--green)" />
              <Bar label="Battery" v={sv.power} max={100} unit="%" color="var(--amber)" />
            </div>
            <dl className="kv" style={{ marginTop: 10 }}>
              <dt>Oxygen use</dt>
              <dd>{fmt(o2Rate(sv), 2)} days/day</dd>
              <dt>Weather</dt>
              <dd>{storm ? 'dust storm' : 'clear-ish'}</dd>
              <dt>Spare parts</dt>
              <dd>{sv.parts}</dd>
              <dt>Wreck salvage left</dt>
              <dd>{sv.salvageLeft} loads</dd>
            </dl>
            {sv.leak && (
              <div className="row between" style={{ marginTop: 10 }}>
                <span className="red">⚠ Oxygen tank leaking</span>
                <button className="btn small danger" disabled={busy} onClick={repair}>
                  Patch (1 part, ½ day)
                </button>
              </div>
            )}
            <hr className="sep" />
            <b>Log</b>
            <div className="stack" style={{ maxHeight: 180, overflow: 'auto', fontSize: 13, marginTop: 6 }}>
              {sv.log.length ? sv.log.map((l, i) => <div key={i} className="muted">{l}</div>) : <div className="faint">Quiet so far.</div>}
            </div>
          </div>
        </div>
      </div>
      <div className="tool-side">
        <ToolHeader title="Workshop" sub="Keep the camp alive. Every job costs time — and time costs air." />
        <div className="panel panel-pad stack">
          <b>Salvage the wreck</b>
          <div className="muted" style={{ fontSize: 13 }}>Half a day of work. Finds parts — and occasionally supplies.</div>
          <button className="btn primary" disabled={busy || sv.salvageLeft <= 0} onClick={doSalvage}>
            {busy ? 'Working…' : 'Salvage (½ day)'}
          </button>
        </div>
        <div className="panel panel-pad stack">
          <b>Build upgrades (1 day each)</b>
          {UPGRADES.map((u) => {
            const owned = sv.upgrades.includes(u.id);
            return (
              <div key={u.id} className="row between" style={{ alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{u.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>{u.text}</div>
                </div>
                <button className={`btn small ${owned ? '' : 'primary'}`} disabled={owned || busy || sv.parts < u.cost} onClick={() => build(u.id, u.cost)}>
                  {owned ? 'Built' : `${u.cost} parts`}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
