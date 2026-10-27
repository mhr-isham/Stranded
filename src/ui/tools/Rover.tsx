import { useEffect, useState } from 'react';
import { ARCSEC, DAY, DEG } from '../../engine/constants';
import { parallaxSite } from '../../engine/measure';
import { localFrame, observerPos, toHorizontal, topocentric } from '../../engine/sky';
import { norm, sub, unit, type Vec3 } from '../../engine/vec';
import { sfx } from '../../game/audio';
import { flag } from '../../game/tutorial';
import { clock } from '../../game/clock';
import { fmt } from '../../game/format';
import { currentWorld } from '../../game/sim';
import { useGame } from '../../game/store';
import { isCloudy } from '../../game/survival';
import { hasChallenge, seeingFactor } from '../../game/challenges';
import { hhmm, localSolarHours } from '../../game/time';
import { drawScope } from '../../render/telescope';
import { CanvasView, canvasPoint } from '../common/CanvasView';
import { Formula, ReadingsTable, SanityWarning, SendReadings, ToolHeader } from '../common/sheetBits';
import { toast, useGameTime } from '../common/widgets';

interface Capture {
  at: number;
  dirA: Vec3;
  dirB: Vec3;
  radius: number; // planet angular radius
  baseline: number; // m, laser-link straight-line distance
}

export function Rover() {
  const { system: sys } = currentWorld();
  const s = useGame();
  const t = useGameTime(5);
  const speed = (s.settings.survival && s.survival.upgrades.includes('rover') ? 700 : 400) * 1000 * (hasChallenge(s, 'rover') ? 0.5 : 1); // m per day
  const [target, setTarget] = useState(Math.max(1000, Math.round(s.rover.target / 1e5) * 100 || 3000));
  const [cap, setCap] = useState<Capture | null>(null);
  const [frame, setFrame] = useState<'A' | 'B'>('A');
  const [blink, setBlink] = useState(true);
  const [marks, setMarks] = useState<{ A: { x: number; y: number } | null; B: { x: number; y: number } | null }>({ A: null, B: null });
  const [fovAs, setFovAs] = useState(150);

  const driving = s.rover.arriveAt > t;
  const roverSite = parallaxSite(sys, sys.site, s.rover.dist);
  const midSite = parallaxSite(sys, sys.site, s.rover.dist / 2);

  const siteInfo = (site: typeof sys.site) => {
    const f = localFrame(sys, t, site);
    return {
      alt: toHorizontal(topocentric(sys, 'target', t, site), f).alt / DEG,
      sun: toHorizontal(topocentric(sys, 'star', t, site), f).alt / DEG,
    };
  };
  const A = siteInfo(sys.site);
  const B = siteInfo(roverSite);
  const M = siteInfo(midSite);
  const canImage = s.identified && !driving && s.rover.dist > 0 && A.alt > 15 && B.alt > 15 && A.sun < -12 && B.sun < -12 && !(s.settings.survival && isCloudy(s.seed, t));

  const drive = () => {
    if (s.northTrip.dist > 0 || s.northTrip.arriveAt > clock.t) return toast('The rover is out north at the shadow stick. Bring it back first.');
    const dist = Math.abs(target * 1000 - s.rover.dist);
    s.set({ rover: { dist: s.rover.dist, target: target * 1000, departAt: clock.t, arriveAt: clock.t + (dist / speed) * DAY } });
    toast(`Rover underway: ${fmt(dist / speed, 1)} days`);
  };

  const capture = () => {
    const tt = clock.t;
    const vA = topocentric(sys, 'target', tt, sys.site);
    const vB = topocentric(sys, 'target', tt, roverSite);
    setCap({
      at: tt,
      dirA: unit(vA),
      dirB: unit(vB),
      radius: Math.asin(sys.target.radius / norm(vA)),
      baseline: norm(sub(observerPos(sys, tt, sys.site), observerPos(sys, tt, roverSite))),
    });
    setMarks({ A: null, B: null });
    flag('rover-captured');
    sfx('log');
  };

  const p = cap && marks.A && marks.B ? Math.hypot(marks.A.x - marks.B.x, marks.A.y - marks.B.y) : null;
  useEffect(() => {
    if (p) flag('rover-marked');
  }, [p]);

  return (
    <div className="tool">
      <div className="tool-stage" data-tut="rover-stage">
        {cap ? (
          <CanvasView
            onPointerDown={(e) => {
              const pt = canvasPoint(e);
              const c = e.currentTarget;
              const k = c.width / (fovAs * ARCSEC);
              const pos = { x: (pt.x - c.width / 2) / k, y: (pt.y - c.height / 2) / k };
              (e.target as Element).setPointerCapture(e.pointerId);
              setMarks((m) => ({ ...m, [frame]: pos }));
            }}
            onPointerMove={(e) => {
              if (!e.buttons) return;
              const pt = canvasPoint(e);
              const c = e.currentTarget;
              const k = c.width / (fovAs * ARCSEC);
              setMarks((m) => ({ ...m, [frame]: { x: (pt.x - c.width / 2) / k, y: (pt.y - c.height / 2) / k } }));
            }}
            draw={({ ctx, w, h, dpr, now }) => {
              const showB = blink ? Math.floor(now / 700) % 2 === 1 : frame === 'B';
              const fov = fovAs * ARCSEC;
              const P = drawScope(
                ctx,
                { center: cap.dirA, fov, w, h },
                {
                  seed: sys.seed,
                  sunDir: [1, 0, 0],
                  sunRadius: 0,
                  starColor: [255, 255, 255],
                  targetDir: showB ? cap.dirB : cap.dirA,
                  targetRadius: cap.radius,
                  moonDir: null,
                  moonRadius: 0,
                  skyBrightness: 0,
                  seeing: 1.2 * ARCSEC * seeingFactor(useGame.getState(), cap.at),
                  realTime: 0,
                  filter: false,
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
      </div>

      <div className="tool-side">
        <ToolHeader title="Rover & parallax" sub="Two sites, one instant: the blue planet shifts against the distant stars. The shift gives the distance." />
        <div className="panel panel-pad stack" data-tut="rover-drive">
          <b>1 · Position the rover</b>
          <div className="row between">
            <span className="muted">Rover is</span>
            <span className="mono">{driving ? `driving… ${fmt((s.rover.arriveAt - t) / DAY, 1)} d left` : `${fmt(s.rover.dist / 1000, 0)} km east`}</span>
          </div>
          <input type="range" min={500} max={6000} step={100} value={target} onChange={(e) => setTarget(Number(e.target.value))} disabled={driving} />
          <div className="row between">
            <span className="muted" style={{ fontSize: 13 }}>Send to {target} km east · {fmt(Math.abs(target * 1000 - s.rover.dist) / speed, 1)} days</span>
            <button className="btn primary small" disabled={driving || target * 1000 === s.rover.dist} onClick={drive}>
              Drive
            </button>
          </div>
          <div className="hint">A longer baseline makes a bigger shift and a smaller relative error — but the drive takes days.</div>
        </div>

        <div className="panel panel-pad stack" data-tut="rover-image">
          <b>2 · Image both sites at once</b>
          <dl className="kv">
            <dt>Camp: blue planet altitude</dt>
            <dd>{fmt(A.alt, 1)}° · {hhmm(localSolarHours(sys, t))}</dd>
            <dt>Rover: blue planet altitude</dt>
            <dd>{fmt(B.alt, 1)}°</dd>
            <dt>Midpoint: altitude</dt>
            <dd>{fmt(M.alt, 1)}°</dd>
          </dl>
          <div className="hint">
            Best results: near opposition, when the planet is highest as seen from the point midway between the sites. Then the baseline is square-on
            to your line of sight.
          </div>
          <button className="btn primary" disabled={!canImage} onClick={capture}>
            Take simultaneous images
          </button>
          {!canImage && (
            <div className="amber" style={{ fontSize: 13 }}>
              {!s.identified ? 'Identify the blue planet first.' : driving ? 'Rover still driving.' : s.rover.dist <= 0 ? 'Send the rover out first.' : 'Both sites need a dark sky with the planet above 15°.'}
            </div>
          )}
        </div>

        {cap && (
          <div className="panel panel-pad stack" data-tut="rover-blink">
            <b>3 · Blink comparator</b>
            <div className="muted" style={{ fontSize: 13 }}>
              The two exposures alternate. Background stars stay put; the planet jumps. Mark the planet’s centre in each frame.
            </div>
            <div className="row">
              <label className="row" style={{ fontSize: 13 }}>
                <input type="checkbox" checked={blink} onChange={(e) => setBlink(e.target.checked)} /> Blink
              </label>
              <button className={`btn small ${frame === 'A' ? 'primary' : ''}`} onClick={() => (setFrame('A'), setBlink(false))}>
                Mark in A
              </button>
              <button className={`btn small ${frame === 'B' ? 'primary' : ''}`} onClick={() => (setFrame('B'), setBlink(false))}>
                Mark in B
              </button>
            </div>
            <div className="row">
              <span className="muted" style={{ fontSize: 13 }}>Field {fovAs}″</span>
              <input type="range" min={30} max={400} step={5} value={fovAs} onChange={(e) => setFovAs(Number(e.target.value))} style={{ flex: 1 }} />
            </div>
            <dl className="kv">
              <dt>Baseline B (laser link)</dt>
              <dd>{fmt(cap.baseline / 1000, 1)} km</dd>
              <dt>Shift p</dt>
              <dd>{p ? `${fmt(p / ARCSEC, 2)}″` : '—'}</dd>
              <dt>Distance d = B / p</dt>
              <dd className="blue">{p ? `${fmt(cap.baseline / p / 1e9, 3)} million km` : '—'}</dd>
            </dl>
            <Formula>d = B / p   (p in radians)</Formula>
            {p && (
              <SanityWarning
                msgs={[
                  p < 1 * ARCSEC && 'The two marks are almost on top of each other. Did you mark the planet in both frames (A and B)?',
                  p > 60 * ARCSEC && 'That shift is far too large — one mark is probably on a star or empty sky.',
                ]}
              />
            )}
            <div className="row" data-tut="rover-keep">
              <button
                className="btn primary"
                disabled={!p}
                onClick={() => {
                  s.addReading({ key: 'dPar', value: cap.baseline / p!, at: cap.at, note: `day ${fmt(cap.at / DAY, 1)} · B ${fmt(cap.baseline / 1000, 0)} km` });
                  sfx('good');
                  setMarks({ A: null, B: null });
                  toast('Distance reading logged');
                }}
              >
                Keep reading
              </button>
              <button className="btn" onClick={() => setCap(null)}>
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
