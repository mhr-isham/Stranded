import { useEffect, useRef, useState } from 'react';
import { DEG, HOUR } from '../../engine/constants';
import { horizonDip } from '../../engine/measure';
import { starAltitude } from '../../engine/sky';
import { clock } from '../../game/clock';
import { fmt } from '../../game/format';
import { currentWorld, spendTime } from '../../game/sim';
import { useGame } from '../../game/store';
import { css, skyColors } from '../../render/color';
import { sfx } from '../../game/audio';
import { CanvasView } from '../common/CanvasView';
import { Formula, ReadingsTable, SendReadings, ToolHeader } from '../common/sheetBits';
import { toast } from '../common/widgets';

const EYE = 1.7;

export function Hill() {
  const { system: sys } = currentWorld();
  const s = useGame();
  const upgrades = s.settings.survival ? s.survival.upgrades : [];
  const tripod = upgrades.includes('tripod');
  const vernier = upgrades.includes('vernier');
  const res = vernier ? 0.001 : 0.005; // degrees per scale division
  const H = sys.hillHeight;
  const stations = [
    { name: 'Camp', h: 0 },
    { name: 'Boulder field', h: Math.round(H * 0.22) },
    { name: 'Saddle', h: Math.round(H * 0.55) },
    { name: 'Summit', h: H },
  ];
  const [at, setAt] = useState(0);
  const [moving, setMoving] = useState(false);
  const [zoom, setZoom] = useState(4);
  const [result, setResult] = useState<null | { theta: number; R: number; h: number }>(null);
  const view = useRef({ pitch: -0.3, drag: null as null | { y: number; p: number }, brace: 0, sway: 0 });
  const h = stations[at].h + EYE;
  const dip = horizonDip(sys.home.radius, h) / DEG;

  const climb = (i: number) => {
    if (i === at || moving) return;
    const dh = Math.abs(stations[i].h - stations[at].h);
    const dur = (dh / 350 + 0.25) * HOUR;
    setMoving(true);
    spendTime(dur, () => {
      setAt(i);
      setMoving(false);
      view.current.pitch = -0.3;
      toast(`${stations[i].name}: ${stations[i].h} m above camp`);
    });
  };

  const ppdFor = (hpx: number) => hpx / (4 / zoom);
  const read = () => {
    const reading = Math.round(view.current.pitch / res) * res;
    const theta = -reading * DEG;
    if (theta <= 0) {
      toast('The reading must be below level — the horizon dips downward.');
      return;
    }
    const R = (h * Math.cos(theta)) / (1 - Math.cos(theta));
    setResult({ theta, R, h });
    sfx('log');
  };

  return (
    <div className="tool">
      <div className="tool-stage">
        <CanvasView
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            view.current.drag = { y: e.clientY, p: view.current.pitch };
          }}
          onPointerMove={(e) => {
            const d = view.current.drag;
            if (!d) return;
            const c = e.currentTarget;
            const ppd = ppdFor(c.height) / (window.devicePixelRatio || 1);
            // Fine control: drag moves the instrument a quarter of the apparent motion.
            view.current.pitch = d.p + ((e.clientY - d.y) / ppd) * 0.25;
          }}
          onPointerUp={() => (view.current.drag = null)}
          onWheel={(e) => setZoom((z) => Math.max(1, Math.min(60, z * (e.deltaY < 0 ? 1.15 : 0.87))))}
          draw={({ ctx, w, h: hp, dpr, now, dt }) => {
            const V = view.current;
            const tt = now / 1000;
            // Hand sway: smooth, quasi-periodic. Bracing and a tripod steady it.
            V.brace = Math.max(0, V.brace - dt);
            const amp = 0.012 * (tripod ? 0.2 : 1) * (V.brace > 0 ? 0.3 : 1);
            V.sway = amp * (Math.sin(tt * 1.3) + 0.6 * Math.sin(tt * 2.9 + 1) + 0.3 * Math.sin(tt * 7.1 + 2)) / 1.9;
            const ppd = ppdFor(hp);
            const eff = V.pitch + V.sway;
            const yOf = (elev: number) => hp / 2 - (elev - eff) * ppd;
            const sun = starAltitude(sys, clock.t, sys.site) / DEG;
            const col = skyColors(sun);
            const yH = yOf(-dip);
            // Sky.
            const g = ctx.createLinearGradient(0, yH - hp, 0, yH);
            g.addColorStop(0, css(col.zenith));
            g.addColorStop(1, css(col.horizon));
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, w, Math.max(0, yH));
            // Distant plain with haze bands that compress towards the horizon.
            const gg = ctx.createLinearGradient(0, yH, 0, yH + hp * 0.6);
            gg.addColorStop(0, css(col.horizon, 1));
            gg.addColorStop(0.02, css(col.ground, 1));
            gg.addColorStop(1, css([col.ground[0] * 0.6, col.ground[1] * 0.6, col.ground[2] * 0.6]));
            ctx.fillStyle = gg;
            ctx.fillRect(0, Math.max(0, yH), w, hp);
            ctx.strokeStyle = 'rgba(255,255,255,0.05)';
            for (let k = 1; k < 30; k++) {
              const y = yH + (k * k * 0.0016 * ppd) / Math.max(0.2, zoom / 4);
              if (y > hp) break;
              ctx.beginPath();
              ctx.moveTo(0, y);
              ctx.lineTo(w, y);
              ctx.stroke();
            }
            // Instrument reticle (fixed to the instrument, so it does not sway).
            ctx.strokeStyle = 'rgba(255,90,90,0.9)';
            ctx.lineWidth = 1.2 * dpr;
            ctx.beginPath();
            ctx.moveTo(w * 0.15, hp / 2);
            ctx.lineTo(w * 0.45, hp / 2);
            ctx.moveTo(w * 0.55, hp / 2);
            ctx.lineTo(w * 0.85, hp / 2);
            ctx.moveTo(w / 2, hp / 2 - 30 * dpr);
            ctx.lineTo(w / 2, hp / 2 - 8 * dpr);
            ctx.moveTo(w / 2, hp / 2 + 8 * dpr);
            ctx.lineTo(w / 2, hp / 2 + 30 * dpr);
            ctx.stroke();
            // Elevation scale relative to the instrument's own level.
            const step = pickStep(4 / zoom);
            ctx.fillStyle = 'rgba(255,255,255,0.75)';
            ctx.font = `${11 * dpr}px JetBrains Mono`;
            ctx.textAlign = 'right';
            for (let e = Math.floor((V.pitch - 2 / zoom) / step) * step; e <= V.pitch + 2 / zoom; e += step) {
              const y = hp / 2 - (e - V.pitch) * ppd;
              ctx.fillRect(w - 46 * dpr, y, 14 * dpr, dpr);
              ctx.fillText(`${e.toFixed(step < 0.01 ? 3 : 2)}°`, w - 50 * dpr, y + 4 * dpr);
            }
            // Vignette.
            const v = ctx.createRadialGradient(w / 2, hp / 2, Math.min(w, hp) * 0.35, w / 2, hp / 2, Math.max(w, hp) * 0.75);
            v.addColorStop(0, 'rgba(0,0,0,0)');
            v.addColorStop(1, 'rgba(0,0,0,0.85)');
            ctx.fillStyle = v;
            ctx.fillRect(0, 0, w, hp);
          }}
        />
        <div className="panel panel-pad stage-bottom" style={{ padding: '8px 12px' }}>
          <div className="meter-label">Instrument pitch</div>
          <PitchReadout view={view} res={res} />
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn small" onClick={() => (view.current.pitch += res)}>
              ▲
            </button>
            <button className="btn small" onClick={() => (view.current.pitch -= res)}>
              ▼
            </button>
            <button className="btn small amber" onPointerDown={() => (view.current.brace = 4)}>
              Brace (hold breath)
            </button>
            <button className="btn small primary" onClick={read}>
              Read angle
            </button>
          </div>
        </div>
      </div>
      <div className="tool-side">
        <ToolHeader title="The hill" sub="Measure how far the horizon dips below level. The dip depends on your height and the planet’s radius." />
        <div className="panel panel-pad stack">
          <b>Where are you?</b>
          <div className="stack">
            {stations.map((st, i) => (
              <button key={st.name} className={`btn ${i === at ? 'primary' : ''}`} style={{ justifyContent: 'space-between' }} disabled={moving} onClick={() => climb(i)}>
                <span>{st.name}</span>
                <span className="mono">{st.h} m</span>
              </button>
            ))}
          </div>
          {moving && <div className="amber">Climbing…</div>}
          <div className="muted" style={{ fontSize: 13 }}>
            Heights come from the survey markers on the path. Your eye is {EYE} m above the ground. Climbing takes time.
          </div>
          <b>Aim</b>
          <div className="muted" style={{ fontSize: 13 }}>
            Drag the view up/down until the horizon sits exactly on the red crosshair. Zoom in for precision. Your hands shake — brace, wait for a
            still moment, then read.
          </div>
          <div className="row">
            <span className="muted" style={{ fontSize: 13 }}>Zoom {fmt(zoom, 0)}×</span>
            <input type="range" min={1} max={60} step={1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} style={{ flex: 1 }} />
          </div>
          <Formula>R = h·cos θ / (1 − cos θ)  ≈ 2h / θ²</Formula>
        </div>
        {result && (
          <div className="panel panel-pad stack">
            <b>Reading</b>
            <dl className="kv">
              <dt>Height h</dt>
              <dd>{fmt(result.h, 1)} m</dd>
              <dt>Dip θ</dt>
              <dd>{fmt(result.theta / DEG, 4)}°</dd>
              <dt>Radius R</dt>
              <dd className="blue">{fmt(result.R / 1000, 0)} km</dd>
            </dl>
            <div className="row">
              <button
                className="btn primary"
                onClick={() => {
                  s.addReading({ key: 'R1', value: result.R, at: clock.t, note: `${stations[at].name} · θ ${fmt(result.theta / DEG, 3)}°` });
                  setResult(null);
                  sfx('good');
                }}
              >
                Keep reading
              </button>
              <button className="btn" onClick={() => setResult(null)}>
                Discard
              </button>
            </div>
          </div>
        )}
        <div className="panel panel-pad">
          <b>Radius log</b>
          <ReadingsTable k="R1" />
          <SendReadings k="R1" />
        </div>
      </div>
    </div>
  );
}

function pickStep(spanDeg: number) {
  for (const s of [0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5]) if (spanDeg / s <= 12) return s;
  return 1;
}

function PitchReadout({ view, res }: { view: React.MutableRefObject<{ pitch: number }>; res: number }) {
  const [, force] = useState(0);
  useEffect(() => {
    const id = setInterval(() => force((x) => x + 1), 80);
    return () => clearInterval(id);
  }, []);
  const v = Math.round(view.current.pitch / res) * res;
  return <div className="readout">{v.toFixed(3)}°</div>;
}
