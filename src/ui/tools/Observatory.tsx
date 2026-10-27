import { useEffect, useMemo, useRef, useState } from 'react';
import { ARCSEC, DAY, DEG } from '../../engine/constants';
import { linearFit } from '../../engine/solver';
import { eclLon, localFrame, toHorizontal, topocentric } from '../../engine/sky';
import { starLongitude } from '../../engine/measure';
import { unit, type Vec3 } from '../../engine/vec';
import { sfx } from '../../game/audio';
import { clock } from '../../game/clock';
import { ECHO } from '../../game/echo';
import { sineFit } from '../../game/fits';
import { fmt } from '../../game/format';
import { checkMissions, currentWorld, targetObservable } from '../../game/sim';
import { useGame } from '../../game/store';
import { paintSky, starRGB } from '../../render/paint';
import { makeProjector } from '../../render/projection';
import { drawScope, SEEING } from '../../render/telescope';
import { makeLandscape } from '../../render/terrain';
import { CanvasView, canvasPoint } from '../common/CanvasView';
import { Chart, unwrapDeg } from '../common/Chart';
import { Formula, ReadingsTable, SendReadings, SendToSheet, ToolHeader, outlierNote } from '../common/sheetBits';
import { toast, useGameTime } from '../common/widgets';
import { flag, onTutEvent, setAnchor } from '../../game/tutorial';
import { lastOf, makePrediction, nextMoonEast, nextStationary, pendingOf } from '../../game/predictions';
import { PredictCard } from '../common/Predict';
import { hasChallenge, seeingFactor } from '../../game/challenges';
import { currentMode, useMode } from '../../game/modes';
import { relaySunlit, relayTopocentric } from '../../engine/relay';
import { toLocal as toLocalDir } from '../../render/scene';
import { unlockLog } from '../../game/story';
import { OrbitPanel } from './OrbitPanel';

type Sel = { kind: 'star' } | { kind: 'target' } | { kind: 'relay' } | { kind: 'catalog'; i: number };
type Tab = 'sky' | 'year' | 'track' | 'transit' | 'orbit' | 'micro' | 'moon';

const TABS: { id: Tab; label: string }[] = [
  { id: 'sky', label: 'Sky' },
  { id: 'year', label: 'Year' },
  { id: 'track', label: 'Tracker' },
  { id: 'transit', label: 'Transit' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'micro', label: 'Micrometer' },
  { id: 'moon', label: 'Moon' },
];

export function Observatory() {
  const { system: sys, catalog } = currentWorld();
  const land = useMemo(() => makeLandscape(sys.seed, sys.hillHeight), [sys]);
  const s = useGame();
  const t = useGameTime(5);
  const [mode, setMode] = useState<'sky' | 'scope'>('sky');
  const [tab, setTab] = useState<Tab>('sky');
  const [sel, setSel] = useState<Sel | null>(null);
  const [fovLog, setFovLog] = useState(Math.log10(2)); // degrees, log scale
  const [showEcl, setShowEcl] = useState(false);
  const cam = useRef({ az: 180 * DEG, alt: 35 * DEG, fov: 90 * DEG, scale: 1 });
  const ptr = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<null | { az: number; alt: number; fov: number; x: number; y: number; dist: number }>(null);
  const aim = useRef({ a: 0, b: 0 }); // player's pointing offset from the object (rad)
  const calip = useRef({ x1: -15 * ARCSEC, x2: 15 * ARCSEC, dragging: 0 as 0 | 1 | 2 | 3, start: { x: 0, a: 0, b: 0 } });
  const scopeK = useRef(1);
  const fov = Math.pow(10, fovLog) * DEG;

  /** Point the telescope at an object (used by the "point at" buttons and Flight School). */
  const pointAt = (kind: 'star' | 'target', fovDeg: number, tabId?: Tab) => {
    setSel({ kind });
    const off = Math.min(0.12, fovDeg / 12) * DEG;
    aim.current = { a: (Math.random() - 0.5) * off, b: (Math.random() - 0.5) * off };
    setMode('scope');
    setFovLog(Math.log10(fovDeg));
    if (tabId) setTab(tabId);
    if (kind === 'target' && fovDeg < 0.1) calip.current = { ...calip.current, x1: -fovDeg * DEG * 0.22, x2: fovDeg * DEG * 0.22 };
  };

  useEffect(
    () =>
      onTutEvent((e) => {
        if (e === 'select-target') {
          setSel({ kind: 'target' });
          aim.current = { a: 0, b: 0 };
          flag('obs-sel-target');
        } else if (e === 'scope-star') {
          pointAt('star', 2, 'year');
          flag('scope-star');
        } else if (e === 'micro-ready') {
          pointAt('target', 1 / 60, 'micro');
          flag('micro-ready');
        }
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );

  // Tutorial signals.
  useEffect(() => {
    if (mode === 'scope' && sel) flag('scope-open');
    if (mode === 'scope' && sel?.kind === 'target' && fov < 0.1 * DEG) flag('scope-zoomed');
  }, [mode, sel, fov]);

  const objDir = (sl: Sel, tt: number): Vec3 => {
    if (sl.kind === 'star') return unit(topocentric(sys, 'star', tt, sys.site));
    if (sl.kind === 'target') return unit(topocentric(sys, 'target', tt, sys.site));
    if (sl.kind === 'relay') return unit(relayTopocentric(sys, tt, sys.site));
    return catalog[sl.i].dir;
  };
  const pointing = (tt: number): Vec3 | null => {
    if (!sel) return null;
    const d = objDir(sel, tt);
    let e1: Vec3 = [-d[1], d[0], 0];
    const n = Math.hypot(e1[0], e1[1]) || 1;
    e1 = [e1[0] / n, e1[1] / n, 0];
    const e2: Vec3 = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]];
    // Offsets are applied with the telescope convention (east to the left).
    const { a, b } = aim.current;
    return unit([d[0] - a * e1[0] + b * e2[0], d[1] - a * e1[1] + b * e2[1], d[2] - a * e1[2] + b * e2[2]]);
  };

  const selLabel = (sl: Sel | null) => {
    if (!sl) return 'Nothing selected';
    if (sl.kind === 'star') return 'The star (our sun)';
    if (sl.kind === 'target') return s.identified ? 'The blue planet' : 'Unknown light';
    if (sl.kind === 'relay') return s.logs.includes('relay') ? 'The Halcyon relay' : 'A moving light';
    return 'Unknown light';
  };

  const frameNow = localFrame(sys, t, sys.site);
  const altOf = (sl: Sel) => toHorizontal(objDir(sl, t), frameNow).alt;
  const starAlt = toHorizontal(topocentric(sys, 'star', t, sys.site), frameNow).alt / DEG;
  const twilight = starAlt > -1 && starAlt < 8;
  const filter = sel?.kind === 'star';

  // Pick the light nearest a tap in the wide view.
  const pick = (px: number, py: number, w: number, h: number) => {
    const camera = { ...cam.current, w, h };
    const P = makeProjector(camera);
    const f = localFrame(sys, clock.t, sys.site);
    const toLoc = (v: Vec3): [number, number, number] => {
      const u = unit(v);
      return [u[0] * f.east[0] + u[1] * f.east[1] + u[2] * f.east[2], u[0] * f.north[0] + u[1] * f.north[1] + u[2] * f.north[2], u[0] * f.up[0] + u[1] * f.up[1] + u[2] * f.up[2]];
    };
    let best: Sel | null = null;
    let bd = 30 * (window.devicePixelRatio || 1);
    const test = (sl: Sel, v: Vec3) => {
      const p = P.project(toLoc(v));
      if (!p || toLoc(v)[2] < 0) return;
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < bd) [bd, best] = [d, sl];
    };
    test({ kind: 'star' }, topocentric(sys, 'star', clock.t, sys.site));
    test({ kind: 'target' }, topocentric(sys, 'target', clock.t, sys.site));
    if (relayVisible(clock.t)) test({ kind: 'relay' }, relayTopocentric(sys, clock.t, sys.site));
    catalog.forEach((c, i) => c.mag < 2.6 && test({ kind: 'catalog', i }, c.dir));
    if (best) {
      setSel(best);
      if ((best as Sel).kind === 'target') flag('obs-sel-target');
      aim.current = { a: (Math.random() - 0.5) * 0.4 * DEG, b: (Math.random() - 0.5) * 0.4 * DEG };
      sfx('click');
    }
  };

  /** The relay shows only in a dark sky while it is still in sunlight, above the horizon. */
  function relayVisible(tt: number) {
    const f = localFrame(sys, tt, sys.site);
    if (toHorizontal(topocentric(sys, 'star', tt, sys.site), f).alt > -6 * DEG) return false;
    if (toHorizontal(relayTopocentric(sys, tt, sys.site), f).alt < 3 * DEG) return false;
    return relaySunlit(sys, tt);
  }

  const identify = () => {
    if (sel?.kind === 'target') {
      useGame.setState({ identified: true });
      useGame.getState().unlock('codex', 'twinkle');
      toast('Identified: the blue planet!');
      sfx('unlock');
      checkMissions();
      useGame.getState().say(ECHO.track);
    } else {
      toast('It flickers and stays a point however far you zoom — a star.');
      sfx('bad');
    }
  };

  return (
    <div className="tool">
      <div className="tool-stage" data-tut="obs-stage">
        {mode === 'sky' ? (
          <CanvasView
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture(e.pointerId);
              ptr.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              const pts = [...ptr.current.values()];
              gesture.current = { ...cam.current, x: e.clientX, y: e.clientY, dist: pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0 };
            }}
            onPointerMove={(e) => {
              if (!ptr.current.has(e.pointerId)) return;
              ptr.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              const g = gesture.current;
              if (!g) return;
              const pts = [...ptr.current.values()];
              const dpr = window.devicePixelRatio || 1;
              if (pts.length > 1 && g.dist > 0) {
                const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
                cam.current.fov = Math.max(15 * DEG, Math.min(120 * DEG, (g.fov * g.dist) / d));
              } else {
                cam.current.az = g.az - ((e.clientX - g.x) * dpr) / cam.current.scale;
                cam.current.alt = Math.max(-5 * DEG, Math.min(85 * DEG, g.alt + ((e.clientY - g.y) * dpr) / cam.current.scale));
              }
            }}
            onPointerUp={(e) => {
              const g = gesture.current;
              ptr.current.delete(e.pointerId);
              if (g && Math.hypot(e.clientX - g.x, e.clientY - g.y) < 6 && ptr.current.size === 0) {
                const p = canvasPoint(e);
                const c = e.currentTarget;
                pick(p.x, p.y, c.width, c.height);
              }
              gesture.current = null;
            }}
            onWheel={(e) => (cam.current.fov = Math.max(15 * DEG, Math.min(120 * DEG, cam.current.fov * (e.deltaY > 0 ? 1.1 : 0.9))))}
            draw={({ ctx, w, h, dpr, now, canvas }) => {
              const camera = { az: cam.current.az, alt: cam.current.alt, fov: cam.current.fov, w, h };
              const { scene, P } = paintSky(ctx, camera, sys, catalog, land, clock.t, now, dpr, { showEcliptic: showEcl });
              // Let Flight School point at the blue planet.
              const tp = P.project(scene.target);
              if (tp && scene.target[2] > 0 && tp.x > 0 && tp.y > 0 && tp.x < w && tp.y < h) {
                const r = canvas.getBoundingClientRect();
                setAnchor('planet', r.left + tp.x / dpr, r.top + tp.y / dpr);
              }
              cam.current.scale = P.scale;
              // Selection ring and labels.
              const label = (d: [number, number, number], text: string, color: string) => {
                const p = P.project(d);
                if (!p || d[2] < 0) return;
                ctx.strokeStyle = color;
                ctx.lineWidth = 1.5 * dpr;
                ctx.beginPath();
                ctx.arc(p.x, p.y, 12 * dpr, 0, Math.PI * 2);
                ctx.stroke();
                ctx.fillStyle = color;
                ctx.font = `600 ${12 * dpr}px Inter`;
                ctx.textAlign = 'left';
                ctx.fillText(text, p.x + 16 * dpr, p.y + 4 * dpr);
              };
              if (s.identified) label(scene.target, 'Blue planet', 'rgba(108,196,255,0.9)');
              // The Halcyon relay: a faint light that moves across the sky in minutes.
              if (relayVisible(clock.t)) {
                const rd = toLocalDir(relayTopocentric(sys, clock.t, sys.site), scene.frame);
                const rp = P.project(rd);
                if (rp && rd[2] > 0) {
                  ctx.fillStyle = 'rgba(235,240,255,0.85)';
                  ctx.beginPath();
                  ctx.arc(rp.x, rp.y, 1.4 * dpr, 0, Math.PI * 2);
                  ctx.fill();
                  if (s.logs.includes('relay')) label(rd, 'Halcyon relay', 'rgba(181,156,255,0.9)');
                }
              }
              if (sel) {
                const d =
                  sel.kind === 'star'
                    ? scene.sun
                    : sel.kind === 'target'
                      ? scene.target
                      : sel.kind === 'relay'
                        ? toLocalDir(relayTopocentric(sys, clock.t, sys.site), scene.frame)
                        : ([scene.stars[sel.i * 3], scene.stars[sel.i * 3 + 1], scene.stars[sel.i * 3 + 2]] as [number, number, number]);
                label(d, '', 'rgba(255,196,107,0.95)');
              }
              // Compass.
              ctx.fillStyle = 'rgba(255,255,255,0.55)';
              ctx.font = `600 ${11 * dpr}px Inter`;
              ctx.textAlign = 'center';
              for (const [name, az] of [['N', 0], ['E', 90], ['S', 180], ['W', 270]] as const) {
                const p = P.project([Math.sin(az * DEG), Math.cos(az * DEG), 0]);
                if (p && p.z > 0) ctx.fillText(name, p.x, p.y + 16 * dpr);
              }
            }}
          />
        ) : (
          <CanvasView
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture(e.pointerId);
              const p = canvasPoint(e);
              const c = e.currentTarget;
              const C = calip.current;
              C.start = { x: p.x, a: aim.current.a, b: aim.current.b };
              C.dragging = 3;
              if (tab === 'micro') {
                const x1 = c.width / 2 + C.x1 * scopeK.current;
                const x2 = c.width / 2 + C.x2 * scopeK.current;
                if (Math.abs(p.x - x1) < 24) C.dragging = 1;
                else if (Math.abs(p.x - x2) < 24) C.dragging = 2;
              }
              (C.start as { y?: number }).y = p.y;
            }}
            onPointerMove={(e) => {
              const C = calip.current;
              if (!C.dragging) return;
              const p = canvasPoint(e);
              const c = e.currentTarget;
              const k = scopeK.current;
              if (C.dragging === 1) C.x1 = (p.x - c.width / 2) / k;
              else if (C.dragging === 2) C.x2 = (p.x - c.width / 2) / k;
              else {
                // Fine pointing: drag moves the telescope by a quarter of the screen motion.
                const sy = (C.start as { y?: number }).y ?? p.y;
                aim.current = { a: C.start.a - ((p.x - C.start.x) / k) * 0.25, b: C.start.b + ((p.y - sy) / k) * 0.25 };
              }
            }}
            onPointerUp={() => (calip.current.dragging = 0)}
            onWheel={(e) => setFovLog((v) => Math.max(Math.log10(0.015), Math.min(Math.log10(4), v + (e.deltaY > 0 ? 0.05 : -0.05))))}
            draw={({ ctx, w, h, dpr, now }) => {
              const tt = clock.t;
              const center = pointing(tt) ?? [1, 0, 0];
              const tgtV = topocentric(sys, 'target', tt, sys.site);
              const sunV = topocentric(sys, 'star', tt, sys.site);
              const moonV = topocentric(sys, 'moon', tt, sys.site);
              const f = localFrame(sys, tt, sys.site);
              const sunAlt = toHorizontal(sunV, f).alt / DEG;
              const ts = now / 1000;
              const P = drawScope(
                ctx,
                { center, fov, w, h },
                {
                  seed: sys.seed,
                  sunDir: unit(sunV),
                  sunRadius: Math.asin(sys.star.radius / Math.hypot(...sunV)),
                  starColor: starRGB(sys),
                  targetDir: unit(tgtV),
                  targetRadius: Math.asin(sys.target.radius / Math.hypot(...tgtV)),
                  moonDir: sys.features.moon ? unit(moonV) : null,
                  moonRadius: Math.asin(sys.moon.radius / Math.hypot(...moonV)),
                  skyBrightness: Math.max(0, Math.min(1, (sunAlt + 10) / 14)),
                  seeing: SEEING * seeingFactor(useGame.getState(), tt),
                  realTime: now,
                  filter,
                  targetInFront: sys.features.inner && Math.hypot(...tgtV) < Math.hypot(...sunV),
                  shimmer: { x: 0.35 * ARCSEC * Math.sin(ts * 2.1) * Math.sin(ts * 0.7), y: 0.35 * ARCSEC * Math.sin(ts * 1.7 + 1) },
                },
                dpr,
              );
              scopeK.current = P.k;
              // Below the horizon?
              const alt = toHorizontal(center, f).alt;
              if (alt < 0) {
                ctx.fillStyle = 'rgba(10,8,6,0.94)';
                ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = '#c9a';
                ctx.font = `600 ${15 * dpr}px Inter`;
                ctx.textAlign = 'center';
                ctx.fillText('Below the horizon — wait for it to rise', w / 2, h / 2);
              }
              // Reticle.
              ctx.strokeStyle = 'rgba(255,90,90,0.85)';
              ctx.lineWidth = dpr;
              const g = 10 * dpr;
              ctx.beginPath();
              ctx.moveTo(w / 2 - 60 * dpr, h / 2);
              ctx.lineTo(w / 2 - g, h / 2);
              ctx.moveTo(w / 2 + g, h / 2);
              ctx.lineTo(w / 2 + 60 * dpr, h / 2);
              ctx.moveTo(w / 2, h / 2 - 60 * dpr);
              ctx.lineTo(w / 2, h / 2 - g);
              ctx.moveTo(w / 2, h / 2 + g);
              ctx.lineTo(w / 2, h / 2 + 60 * dpr);
              ctx.stroke();
              // Calipers (filar micrometer).
              if (tab === 'micro') {
                ctx.strokeStyle = 'rgba(120,255,170,0.95)';
                for (const x of [calip.current.x1, calip.current.x2]) {
                  const X = w / 2 + x * P.k;
                  ctx.beginPath();
                  ctx.moveTo(X, h * 0.15);
                  ctx.lineTo(X, h * 0.85);
                  ctx.stroke();
                }
              }
              // Scale bar.
              const bar = pickBar(w / P.k / 4);
              ctx.fillStyle = 'rgba(255,255,255,0.8)';
              ctx.fillRect(16 * dpr, h - 24 * dpr, bar.rad * P.k, 2 * dpr);
              ctx.font = `${11 * dpr}px JetBrains Mono`;
              ctx.textAlign = 'left';
              ctx.fillText(bar.label, 16 * dpr, h - 30 * dpr);
            }}
          />
        )}
        <div style={{ position: 'absolute', right: 10, top: 'calc(var(--hud-h) + var(--safe-top))', zIndex: 6 }} className="row">
          <button className={`btn ${mode === 'sky' ? 'primary' : ''}`} onClick={() => setMode('sky')}>
            Wide sky
          </button>
          <button
            data-tut="obs-scope-btn"
            className={`btn ${mode === 'scope' ? 'primary' : ''}`}
            onClick={() => (sel ? setMode('scope') : toast('Tap a light in the sky first'))}
          >
            Telescope
          </button>
        </div>
        {mode === 'scope' && (
          <div className="panel panel-pad stage-bottom" data-tut="obs-fov" style={{ width: 'min(440px, calc(100% - 16px))', padding: '8px 12px' }}>
            <div className="row between">
              <span className="muted" style={{ fontSize: 13 }}>Field of view</span>
              <span className="mono">{fov > 0.1 * DEG ? `${fmt(fov / DEG, 2)}°` : `${fmt(fov / ARCSEC, 0)}″`}</span>
            </div>
            <input type="range" min={Math.log10(0.015)} max={Math.log10(4)} step={0.01} value={fovLog} onChange={(e) => setFovLog(Number(e.target.value))} />
            <div className="faint hide-phone" style={{ fontSize: 12 }}>Drag to fine-tune the pointing. The drive keeps tracking your target.</div>
          </div>
        )}
      </div>

      <div className="tool-side">
        <ToolHeader title="Observatory" sub="Tracker + telescope. Positions are measured against the background stars." />
        <div className="panel panel-pad" style={{ padding: 6 }}>
          <div className="row" style={{ gap: 4 }}>
            {TABS.filter((tb) => (tb.id !== 'transit' || sys.features.inner) && (tb.id !== 'orbit' || !!sys.target.e)).map((tb) => (
              <button
                key={tb.id}
                data-tut={`obs-tab-${tb.id}`}
                className={`btn small ${tab === tb.id ? 'primary' : 'ghost'}`}
                onClick={() => {
                  setTab(tb.id);
                  if (tb.id === 'micro') calip.current = { ...calip.current, x1: -fov / 10, x2: fov / 10 };
                }}
                style={{ flex: 1 }}
              >
                {tb.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'sky' && (
          <div className="panel panel-pad stack">
            <b>{selLabel(sel)}</b>
            {sel && <div className="muted" style={{ fontSize: 13 }}>Altitude {fmt(altOf(sel) / DEG, 1)}°</div>}
            <div className="muted" style={{ fontSize: 13 }}>
              Drag to look around, pinch or scroll to zoom, tap a light to select it. Then open the telescope.
            </div>
            {!s.identified && (
              <div className="hint">
                Find the blue planet: at night, watch the bright lights. Stars twinkle — planets shine steadily. In the telescope at high zoom a planet
                shows a disk.
              </div>
            )}
            {sel?.kind === 'relay' && <RelayInfo />}
            {mode === 'scope' && sel && sel.kind !== 'star' && sel.kind !== 'relay' && !s.identified && (
              <button className="btn primary" onClick={identify} data-tut="obs-identify">
                This is the blue planet
              </button>
            )}
            {s.identified && sel?.kind !== 'target' && (
              <button
                className="btn"
                onClick={() => {
                  setSel({ kind: 'target' });
                  aim.current = { a: 0, b: 0 };
                }}
              >
                Select the blue planet
              </button>
            )}
            <label className="row" style={{ fontSize: 13, cursor: 'pointer' }}>
              <input type="checkbox" checked={showEcl} onChange={(e) => setShowEcl(e.target.checked)} /> Show the ecliptic (the path of the star)
            </label>
          </div>
        )}

        {tab === 'year' && (
          <YearPanel
            onPoint={() => (pointAt('star', 2), flag('scope-star'))}
            canLog={mode === 'scope' && sel?.kind === 'star' && twilight}
            reason={sel?.kind !== 'star' ? 'Select the star and open the telescope (the solar filter fits automatically).' : mode !== 'scope' ? 'Open the telescope.' : !twilight ? 'Wait for sunrise or sunset: the tracker needs the star low in a twilight sky to see reference stars.' : ''}
            onLog={() => {
              const c = pointing(clock.t);
              if (!c) return;
              useGame.setState((st) => ({ starObs: [...st.starObs, { at: clock.t, v: eclLon(c) }] }));
              toast('Star position logged');
              sfx('log');
            }}
          />
        )}

        {tab === 'track' && <TrackerPanel />}
        {tab === 'transit' && <TransitPanel onPoint={() => pointAt('star', 1.2)} />}

        {tab === 'micro' && (
          <div className="panel panel-pad stack">
            <b>Filar micrometer</b>
            <div className="muted" style={{ fontSize: 13 }}>
              Point the telescope at the blue planet, zoom right in (under 2′), then drag the two green wires onto opposite edges of its disk.
            </div>
            <button className="btn" data-tut="micro-point" onClick={() => (pointAt('target', 1 / 60), flag('micro-ready'))} disabled={!s.identified}>
              Point at the blue planet (1′ field)
            </button>
            <MicroReadout calip={calip} />
            <button
              data-tut="micro-log"
              className="btn primary"
              disabled={!(mode === 'scope' && sel?.kind === 'target' && s.identified)}
              onClick={() => {
                const a = Math.abs(calip.current.x2 - calip.current.x1);
                s.addReading({ key: 'alpha2', value: a, at: clock.t, note: `day ${fmt(clock.t / DAY, 1)}` });
                const warn = outlierNote(a, s.readings.filter((r) => r.key === 'alpha2' && r.kept).map((r) => r.value), 0.15);
                toast(warn ? `Logged ${fmt(a / ARCSEC, 2)}″ — but it is far from your other readings. Check the wires.` : `Diameter ${fmt(a / ARCSEC, 2)}″ logged`);
                sfx('log');
              }}
            >
              Log diameter
            </button>
            <div className="hint">The disk looks biggest — and is easiest to measure — near opposition, when the blue planet is closest.</div>
            {currentMode().coaching && seeingFactor(s, clock.t) > 1.5 && (
              <div className="amber" style={{ fontSize: 13 }}>The air is rough tonight — the image swims. Readings will scatter more; another night may be better.</div>
            )}
            <Formula>R₂ = d · tan(α₂ / 2)</Formula>
            <ReadingsTable k="alpha2" render={(v) => `${fmt(v / ARCSEC, 2)}″`} />
            <SendReadings k="alpha2" tut="micro-send" />
          </div>
        )}

        {tab === 'orbit' && <OrbitPanel />}
        {tab === 'moon' && <MoonPanel />}
      </div>
    </div>
  );
}

function pickBar(maxRad: number) {
  const opts = [0.5, 1, 2, 5, 10, 30, 60, 120, 300, 600, 1800, 3600].map((a) => a * ARCSEC);
  let r = opts[0];
  for (const o of opts) if (o <= maxRad) r = o;
  const label = r >= 3600 * ARCSEC ? `${r / DEG}°` : r >= 60 * ARCSEC ? `${r / ARCSEC / 60}′` : `${r / ARCSEC}″`;
  return { rad: r, label };
}

function MicroReadout({ calip }: { calip: React.MutableRefObject<{ x1: number; x2: number }> }) {
  useGameTime(10);
  return <div className="readout">{fmt(Math.abs(calip.current.x2 - calip.current.x1) / ARCSEC, 2)}″</div>;
}

function YearPanel({ canLog, reason, onLog, onPoint }: { canLog: boolean; reason: string; onLog: () => void; onPoint: () => void }) {
  const obs = useGame((s) => s.starObs);
  const [band, setBand] = useState<[number, number] | null>(null);
  const days = obs.map((o) => o.at / DAY);
  const lon = unwrapDeg(obs.map((o) => o.v / DEG));
  const pts = days.map((x, i) => ({ x, y: lon[i] }));
  const used = pts.filter((p) => !band || (p.x >= band[0] && p.x <= band[1]));
  const fit = used.length >= 2 ? linearFit(used.map((p) => p.x), used.map((p) => p.y)) : null;
  const P1 = fit && fit.slope > 0 ? 360 / fit.slope : null;
  const sigma = fit && P1 && used.length > 2 ? (P1 * fit.slopeSigma) / fit.slope : undefined;
  return (
    <div className="panel panel-pad stack">
      <b>Length of the year</b>
      <div className="muted" style={{ fontSize: 13 }}>
        At sunrise or sunset, centre the star in the telescope and log its position against the background stars. Come back days or weeks later.
        The star drifts east by 360° per year.
      </div>
      <button className="btn" data-tut="year-point" onClick={onPoint}>
        Point at the star (solar filter)
      </button>
      <button className="btn primary" disabled={!canLog} onClick={onLog} data-tut="year-log">
        Log star position
      </button>
      {!canLog && <div className="amber" style={{ fontSize: 13 }}>{reason}</div>}
      <div data-tut="year-fit" className="stack">
      {pts.length > 0 && (
        <Chart
          series={[
            { pts, color: '#ffc46b', kind: 'dots', faded: (p) => !!band && (p.x < band[0] || p.x > band[1]) },
            ...(fit ? [{ pts: [pts[0], pts[pts.length - 1]].map((p) => ({ x: p.x, y: fit.intercept + fit.slope * p.x })), color: 'rgba(108,196,255,0.8)', kind: 'line' as const }] : []),
          ]}
          xLabel="day"
          yLabel="star longitude (°)"
          band={band}
          onBand={setBand}
          brushMode="band"
        />
      )}
      {pts.length > 0 && <div className="faint" style={{ fontSize: 12 }}>Drag across the chart to choose which logs to fit. Double-tap to use all.</div>}
      {fit && hasChallenge(useGame.getState(), 'handFit') && (
        <div className="hint">Fit by hand: read the drift per day off your chart (rise over run), work out P₁ = 360° / drift, and type it on the progress sheet.</div>
      )}
      {fit && !hasChallenge(useGame.getState(), 'handFit') && (
        <dl className="kv">
          <dt>Drift</dt>
          <dd>{fmt(fit.slope, 4)} °/day</dd>
          <dt>Baseline</dt>
          <dd>{fmt(used[used.length - 1].x - used[0].x, 1)} days</dd>
          <dt>Year P₁ = 360° / drift</dt>
          <dd className="blue">{P1 ? `${fmt(P1, 2)} days` : '—'}</dd>
        </dl>
      )}
      <Formula>P₁ = 360° / (daily drift)</Formula>
      {P1 && !hasChallenge(useGame.getState(), 'handFit') && <SendToSheet k="P1" value={P1 * DAY} spread={sigma ? sigma * DAY : undefined} />}
      </div>
      {pts.length >= 2 && <StarPrediction pts={pts} fit={fit} />}
    </div>
  );
}

/** "Extend the line": where will the star be against the stars on a future day? */
function StarPrediction({ pts, fit }: { pts: { x: number; y: number }[]; fit: { slope: number; intercept: number } | null }) {
  const s = useGame();
  const t = useGameTime(1);
  const [ahead, setAhead] = useState(14);
  const pending = pendingOf(s, 'star');
  useEffect(() => {
    if (!s.tutorial.active) useGame.getState().say(ECHO.predict);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  if (s.tutorial.active) return null;
  const nowDay = Math.floor(t / DAY);
  const xT = nowDay + ahead;
  const own = fit ? { value: fit.intercept + fit.slope * xT, line: [pts[0].x, xT].map((x) => ({ x, y: fit.intercept + fit.slope * x })) } : null;
  return (
    <PredictCard
      kind="star"
      question={
        <>
          Where will the star stand against the background stars on <b>day {xT}</b>?
        </>
      }
      helper="Extend the line: the star drifts at a steady rate. Follow the trend of your logs out to the dashed line — and widen your range a little, because any error in the rate grows with time."
      extra={
        <div className="row" style={{ gap: 6 }}>
          {[7, 14, 30].map((d) => (
            <button key={d} className={`btn small ${ahead === d ? 'primary' : ''}`} onClick={() => setAhead(d)}>
              in {d} days
            </button>
          ))}
        </div>
      }
      pts={pts}
      axis="y"
      xT={xT}
      xMax={xT + 2}
      xLabel="day"
      yLabel="star longitude (°)"
      ownFit={own}
      sigma0={1}
      sigmaMax={20}
      pending={pending}
      last={lastOf(s, 'star')}
      onCommit={(value, sigma) => makePrediction({ kind: 'star', made: clock.t, due: xT * DAY, value, sigma, at: xT })}
    />
  );
}

function TrackerPanel() {
  const s = useGame();
  const t = useGameTime(4);
  const [cursor, setCursor] = useState<number | null>(null);
  const obs = targetObservable(t);
  const { system: sysT } = currentWorld();
  const inner = sysT.features.inner;
  const days = s.track.map((o) => o.at / DAY);
  // An inner planet is shown by its elongation (angle from the star), which swings back and forth.
  const lon = inner
    ? s.track.map((o) => {
        let e = (o.v - starLongitude(sysT, o.at, sysT.site)) / DEG;
        e = ((e + 540) % 360) - 180;
        return e;
      })
    : unwrapDeg(s.track.map((o) => o.v / DEG));
  const pts = days.map((x, i) => ({ x, y: lon[i] }));
  const picks = inner ? [] : [...s.oppPicks].sort((a, b) => a - b);
  const S = picks.length >= 2 ? (picks[picks.length - 1] - picks[0]) / (picks.length - 1) : null;
  return (
    <div className="panel panel-pad stack">
      <b>Blue planet tracker</b>
      {inner && (
        <div className="muted" style={{ fontSize: 13 }}>
          This planet orbits inside ours, so it never strays far from the star. The tracker logs its elongation — its angle east (+) or west (−)
          of the star — in twilight. Its largest value is the greatest elongation, sin ε = a₂/a₁. Time its transits in the Transit tab.
        </div>
      )}
      {!s.identified ? (
        <div className="amber" style={{ fontSize: 13 }}>Identify the blue planet first (Sky tab).</div>
      ) : (
        <>
          <button data-tut="track-toggle" className={`btn ${s.trackOn ? '' : 'primary'}`} onClick={() => (s.set({ trackOn: !s.trackOn }), checkMissions())}>
            {s.trackOn ? 'Auto-log: ON (nightly)' : 'Turn on nightly auto-log'}
          </button>
          <div className="muted" style={{ fontSize: 13 }}>
            {obs.ok ? 'Tracking now: target visible.' : obs.cloudy ? 'Clouded out tonight.' : obs.sunAlt > -12 * DEG ? 'Waiting for a dark sky.' : 'Target below 12° altitude.'} Warp time to
            collect weeks of data.
          </div>
        </>
      )}
      <div data-tut="track-chart" className="stack">
      {pts.length > 1 && (
        <Chart
          series={[{ pts, color: '#6cc4ff', kind: 'dots' }]}
          markers={picks.map((p, i) => ({ x: p / DAY, color: '#5be3a4', label: `opp ${i + 1}` }))}
          cursor={cursor}
          onCursor={setCursor}
          xLabel="day"
          yLabel={inner ? 'elongation from the star (°)' : 'longitude vs stars (°)'}
          xFmt={(x) => x.toFixed(0)}
          yFmt={(y) => y.toFixed(1)}
        />
      )}
      {pts.length > 1 && (
        <div className="faint" style={{ fontSize: 12 }}>
          Drag across a region to zoom in, tap to place the cursor. Opposition is the middle of the backward (retrograde) loop, where the planet
          moves backwards fastest.
        </div>
      )}
      {inner && pts.length > 1 && (
        <div className="faint" style={{ fontSize: 12 }}>
          When the planet passes in front of the star it vanishes from the twilight for a while. The middle of that gap is the moment it passed the
          star (a rougher alternative to timing a transit).
        </div>
      )}
      {cursor !== null && (
        <div className="row between">
          <span className="mono">day {fmt(cursor, 2)}</span>
          <button
            className="btn primary small"
            onClick={() => {
              s.set({ oppPicks: [...s.oppPicks, cursor * DAY] });
              setCursor(null);
              sfx('good');
              setTimeout(checkMissions, 0);
            }}
          >
            {inner ? 'Mark: passed the star here' : 'Mark opposition here'}
          </button>
        </div>
      )}
      </div>
      {picks.length > 0 && (
        <div className="stack">
          {picks.map((p, i) => (
            <div key={p} className="row between">
              <span>
                Opposition {i + 1}: <span className="mono">day {fmt(p / DAY, 2)}</span>
              </span>
              <button className="btn small ghost" onClick={() => s.set({ oppPicks: s.oppPicks.filter((x) => x !== p) })}>
                ✕
              </button>
            </div>
          ))}
          <b style={{ marginTop: 6 }}>Date of opposition t₀ (latest)</b>
          <SendToSheet k="tOpp" value={picks[picks.length - 1]} tut="track-send-t0" />
          {S && (
            <>
              <b style={{ marginTop: 6 }}>Synodic period S = {fmt(S / DAY, 2)} days</b>
              <Formula>1/P₂ = 1/P₁ − 1/S</Formula>
              <SendToSheet k="S2" value={S} tut="track-send-S" />
            </>
          )}
        </div>
      )}
      {!inner && <RetroPrediction pts={pts} />}
    </div>
  );
}

/** "Bracket it": the loop is symmetric about opposition, so the end mirrors the start. */
function RetroPrediction({ pts }: { pts: { x: number; y: number }[] }) {
  const s = useGame();
  const t = useGameTime(1);
  const pending = pendingOf(s, 'retro');
  const last = lastOf(s, 'retro');
  if (s.tutorial.active || pts.length < 5) return null;
  const n = pts.length;
  // Going backwards now: the last few nightly logs decrease.
  const backwards = pts[n - 1].y < pts[Math.max(0, n - 4)].y;
  const recent = last && t - last.made < 150 * DAY;
  if (!pending && (!backwards || recent)) return null;
  // When did it turn back? The last maximum of the track.
  let iMax = n - 1;
  while (iMax > 0 && pts[iMax - 1].y >= pts[iMax].y) iMax--;
  const start = pts[iMax].x;
  const opp = [...s.oppPicks].map((p) => p / DAY).filter((p) => p > start).pop();
  const own = opp !== undefined ? { value: opp + (opp - start) } : null;
  return (
    <PredictCard
      kind="retro"
      question={
        <>
          The blue planet is moving <b>backwards</b> (retrograde). On which day will it stop and move forwards again?
        </>
      }
      helper={`Bracket it: it can't be before opposition. The loop is a mirror image around opposition — it turned back around day ${start.toFixed(0)}; ${opp !== undefined ? `you marked opposition on day ${opp.toFixed(0)}, so mirror the gap.` : 'find the middle of the loop (opposition) and mirror the gap.'}`}
      pts={pts.slice(Math.max(0, iMax - 30))}
      axis="x"
      xMax={t / DAY + 120}
      xLabel="day"
      yLabel="longitude (°)"
      ownFit={own}
      sigma0={5}
      sigmaMax={40}
      pending={pending}
      last={last}
      onCommit={(value, sigma) => {
        const st = nextStationary(currentWorld().system, clock.t);
        if (st === null) return;
        makePrediction({ kind: 'retro', made: clock.t, due: st + DAY, value, sigma });
      }}
    />
  );
}


function MoonPanel() {
  const s = useGame();
  const [band, setBand] = useState<[number, number] | null>(null);
  const [pickB, setPickB] = useState(false);
  const t = useGameTime(2);
  if (!currentWorld().system.features.moon)
    return (
      <div className="panel panel-pad stack">
        <b>No moon</b>
        <div className="muted" style={{ fontSize: 13 }}>
          However long you look, nothing orbits this blue planet. Without a moon to act as a scale, its mass has to come from something else —
          the probe bay at camp.
        </div>
      </div>
    );
  const pts = s.moonTrack.map((o) => ({ x: o.at / DAY, y: o.v / ARCSEC }));
  const used = pts.filter((p) => !band || (p.x >= band[0] && p.x <= band[1]));
  const span = used.length ? used[used.length - 1].x - used[0].x : 0;
  // The swing looks bigger when the planet is closer, so a fit over months is meaningless.
  const tooLong = span > 50;
  const fit = used.length >= 8 && !tooLong ? sineFit(used.map((p) => p.x), used.map((p) => p.y), 0.4, 60) : null;
  const mid = used.length ? (used[0].x + used[used.length - 1].x) / 2 : 0;
  // Two hypotheses (period aliasing): draw both, extended a few days ahead, so a new night can decide.
  const alt = fit?.alternative && !hasChallenge(s, 'handFit') ? fit.alternative : null;
  const nowDay = t / DAY;
  const x1 = alt ? Math.max(used[used.length - 1]?.x ?? 0, nowDay) + Math.max(2, 1.2 * Math.max(fit!.period, alt.period)) : used[used.length - 1]?.x ?? 0;
  const curve = fit && used.length ? Array.from({ length: 300 }, (_, i) => {
    const x = used[0].x + ((x1 - used[0].x) * i) / 299;
    return { x, y: fit.model(x) };
  }) : [];
  const curveB = alt && used.length ? Array.from({ length: 300 }, (_, i) => {
    const x = used[0].x + ((x1 - used[0].x) * i) / 299;
    return { x, y: alt.model(x) };
  }) : [];
  // Where the two models disagree most in the coming days.
  let decide: number | null = null;
  if (alt && fit) {
    let best = 0;
    for (let x = nowDay; x < nowDay + 5; x += 0.05) {
      const d = Math.abs(fit.model(x) - alt.model(x));
      if (d > best) [best, decide] = [d, x];
    }
  }
  const mode = currentMode();
  const useB = !!alt && pickB;
  const chosen = useB && alt ? { amplitude: alt.amplitude, period: alt.period } : fit;
  return (
    <div className="panel panel-pad stack">
      <b>The moon of the blue planet</b>
      {!s.identified ? (
        <div className="amber" style={{ fontSize: 13 }}>Identify the blue planet first.</div>
      ) : (
        <button data-tut="moon-toggle" className={`btn ${s.moonTrackOn ? '' : 'primary'}`} onClick={() => (s.set({ moonTrackOn: !s.moonTrackOn }), s.say(ECHO.moon))}>
          {s.moonTrackOn ? 'Moon auto-log: ON' : 'Log the moon’s offset every few hours'}
        </button>
      )}
      <div className="muted" style={{ fontSize: 13 }}>
        The tracker measures how far the moon sits east (+) or west (−) of the planet. Its swing is the moon’s orbit seen edge-on.
      </div>
      <div data-tut="moon-chart" className="stack">
      {pts.length > 1 && (
        <Chart
          series={[
            { pts, color: '#d9d2c3', kind: 'dots', faded: (p) => !!band && (p.x < band[0] || p.x > band[1]) },
            ...(curve.length && !hasChallenge(useGame.getState(), 'handFit') ? [{ pts: curve, color: '#6cc4ff', kind: 'line' as const }] : []),
            ...(curveB.length ? [{ pts: curveB, color: '#b59cff', kind: 'line' as const }] : []),
          ]}
          markers={decide !== null && mode.missions !== 'off' ? [{ x: decide, color: '#ffc46b', label: 'decides' }] : []}
          xLabel="day"
          yLabel="moon offset (″)"
          band={band}
          onBand={setBand}
          brushMode="band"
          yFmt={(y) => y.toFixed(0)}
        />
      )}
      {alt && fit && (
        <div className="callout key" style={{ margin: 0 }}>
          <b>Two models fit your data</b>
          <div style={{ fontSize: 13 }}>
            <span className="blue">A: Pₘ = {fmt(fit.period, 3)} d</span> · <span className="violet">B: Pₘ = {fmt(alt.period, 3)} d</span> (B fits {fmt((alt.rssRatio - 1) * 100, 0)}% worse).
            Gaps in the data let both swing through the same points. A new observation where they differ will rule one out.
          </div>
          {decide !== null && mode.missions !== 'off' && (
            <div style={{ fontSize: 13, marginTop: 4 }}>
              They disagree most around <b>day {fmt(decide, 1)}</b> — keep logging through then.
            </div>
          )}
          {mode.coaching && mode.missions === 'coach' && <div className="hint" style={{ marginTop: 4 }}>ECHO: A fits a little better, so I’d lean that way — but one more night will settle it.</div>}
          <div className="row" style={{ gap: 6, marginTop: 6 }}>
            <button className={`btn small ${!pickB ? 'primary' : ''}`} onClick={() => setPickB(false)}>
              Use model A
            </button>
            <button className={`btn small ${pickB ? 'primary' : ''}`} onClick={() => setPickB(true)}>
              Use model B
            </button>
          </div>
        </div>
      )}
      {pts.length > 1 && <div className="faint" style={{ fontSize: 12 }}>Drag to choose the stretch of data to fit — near opposition is best, when the planet is closest.</div>}
      {tooLong && <div className="amber" style={{ fontSize: 13 }}>Choose a stretch of at most ~50 days (drag across the chart): the swing looks smaller when the planet is further away.</div>}
      {fit && hasChallenge(useGame.getState(), 'handFit') && (
        <div className="hint">Fit by hand: read the swing’s half-height (θₘ) and the time from peak to peak (Pₘ) off your chart and type them on the progress sheet.</div>
      )}
      {fit && !hasChallenge(useGame.getState(), 'handFit') && (
        <>
          <dl className="kv">
            <dt>Greatest elongation θₘ</dt>
            <dd className="blue">{fmt(chosen!.amplitude, 2)}″</dd>
            <dt>Period Pₘ</dt>
            <dd className="blue">{fmt(chosen!.period, 3)} days</dd>
            <dt>Centre of data</dt>
            <dd>day {fmt(mid, 1)}</dd>
          </dl>
          <Formula>aₘ = d · tan θₘ,   M₂ = 4π² aₘ³ / (G Pₘ²)</Formula>
          <b>θₘ</b>
          <SendToSheet k="thetaM" value={chosen!.amplitude * ARCSEC} at={mid * DAY} spread={fit.sigmaAmplitude * ARCSEC} />
          <b>Pₘ</b>
          <SendToSheet k="Pm" value={chosen!.period * DAY} spread={fit.sigmaPeriod * DAY} />
        </>
      )}
      </div>
      <MoonPrediction pts={pts} fit={fit} />
    </div>
  );
}

/** "Use a ratio": peak to peak is one moon period. */
function MoonPrediction({ pts, fit }: { pts: { x: number; y: number }[]; fit: { model: (x: number) => number; period: number } | null }) {
  const s = useGame();
  const t = useGameTime(1);
  const pending = pendingOf(s, 'moon');
  if (s.tutorial.active || pts.length < 8) return null;
  const nowDay = t / DAY;
  const recent = pts.filter((p) => p.x > nowDay - 20);
  if (recent.length < 8 && !pending) return null;
  // The player's own fit gives the next peak after now.
  let own: { value: number } | null = null;
  if (fit) {
    let best = -Infinity;
    for (let x = nowDay; x < nowDay + fit.period * 1.05; x += fit.period / 400) {
      const y = fit.model(x);
      if (y > best) {
        best = y;
        own = { value: x };
      }
    }
  }
  const span = fit ? Math.max(4, fit.period * 1.6) : 12;
  return (
    <PredictCard
      kind="moon"
      question="When will the moon next be at its farthest point east of the planet (the top of the swing)?"
      helper="Use a ratio: from one top of the swing to the next is one full moon period. Measure it peak to peak on your chart, then add it to the latest peak."
      pts={recent}
      axis="x"
      xMax={nowDay + span}
      xLabel="day"
      yLabel="moon offset (″)"
      ownFit={own}
      sigma0={0.5}
      sigmaMax={5}
      pending={pending}
      last={null}
      onCommit={(value, sigma) => {
        const e = nextMoonEast(currentWorld().system, clock.t);
        if (e === null) return;
        makePrediction({ kind: 'moon', made: clock.t, due: e + 0.05 * DAY, value, sigma });
      }}
    />
  );
}

/** A light that moves against the stars in minutes can only be something in orbit around us. */
function RelayInfo() {
  const { system: sys } = currentWorld();
  const s = useGame();
  const t = useGameTime(2);
  const f = localFrame(sys, t, sys.site);
  const a = unit(relayTopocentric(sys, t, sys.site));
  const b = unit(relayTopocentric(sys, t + 60, sys.site));
  // Angle moved against the background stars in one minute.
  const deg = (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) / Math.PI;
  const alt = toHorizontal(relayTopocentric(sys, t, sys.site), f).alt / DEG;
  const known = s.logs.includes('relay');
  return (
    <div className="stack" style={{ gap: 6 }}>
      <div className="muted" style={{ fontSize: 13 }}>
        It moves about <b>{fmt(deg, 2)}°</b> against the stars every minute (altitude {fmt(alt, 0)}°). The star and the planets take hours to move that far.
      </div>
      {!known ? (
        <button className="btn primary" onClick={() => unlockLog('relay')}>
          Track the moving light
        </button>
      ) : (
        <div className="hint">The Halcyon’s dead relay satellite, in orbit around this planet.</div>
      )}
    </div>
  );
}

/**
 * Chapter 5: time transits of the inner planet. The solar camera logs the
 * planet's offset from the star's centre every hour while the star is up; the
 * offset changes steadily, so a straight-line fit gives the moment it crossed
 * the centre — even if that happened at night.
 */
function TransitPanel({ onPoint }: { onPoint: () => void }) {
  const s = useGame();
  const t = useGameTime(2);
  const { system: sys } = currentWorld();
  const [band, setBand] = useState<[number, number] | null>(null);
  const pts = s.sunLog.map((o) => ({ x: o.at / DAY, y: o.v / ARCSEC }));
  const used = band ? pts.filter((p) => p.x >= band[0] && p.x <= band[1]) : [];
  const fit = used.length >= 3 ? linearFit(used.map((p) => p.x), used.map((p) => p.y)) : null;
  const mid = fit && fit.slope !== 0 ? -fit.intercept / fit.slope : null;
  // Uncertainty of the zero crossing from the line's scatter (simple propagation).
  const midSigma = fit && mid !== null && used.length > 2
    ? (() => {
        const n = used.length;
        const mx = used.reduce((a, p) => a + p.x, 0) / n;
        const sxx = used.reduce((a, p) => a + (p.x - mx) ** 2, 0);
        const resid = Math.sqrt(used.reduce((a, p) => a + (p.y - fit.intercept - fit.slope * p.x) ** 2, 0) / Math.max(1, n - 2));
        return (resid / Math.abs(fit.slope)) * Math.sqrt(1 / n + (mid - mx) ** 2 / sxx);
      })()
    : null;
  const picks = [...s.oppPicks].sort((a, b) => a - b);
  const S = picks.length >= 2 ? (picks[picks.length - 1] - picks[0]) / (picks.length - 1) : null;
  const sv = topocentric(sys, 'star', t, sys.site);
  const tv = topocentric(sys, 'target', t, sys.site);
  const now = Math.abs(eclLon(tv) - eclLon(sv)) < Math.asin(sys.star.radius / Math.hypot(...sv)) && Math.hypot(...tv) < Math.hypot(...sv);
  const mode = useMode();
  return (
    <div className="panel panel-pad stack">
      <b>Transit timer</b>
      <div className="muted" style={{ fontSize: 13 }}>
        When the inner planet passes exactly between us and the star, it crosses the star’s face as a small black dot. The solar camera logs where the
        dot is every hour while the star is up.
      </div>
      <button className="btn" onClick={onPoint}>
        Look at the star (solar filter)
      </button>
      <button className={`btn ${s.sunCamOn ? '' : 'primary'}`} onClick={() => s.set({ sunCamOn: !s.sunCamOn })}>
        {s.sunCamOn ? 'Solar camera: ON (hourly)' : 'Turn on the solar camera'}
      </button>
      {mode.coaching && now && <div className="green" style={{ fontSize: 13 }}>A transit is happening now.</div>}
      {pts.length > 1 && (
        <>
          <Chart
            series={[
              { pts, color: '#ffc46b', kind: 'dots', faded: (p) => !!band && (p.x < band[0] || p.x > band[1]) },
              ...(fit && used.length ? [{ pts: [used[0].x, used[used.length - 1].x, mid ?? used[0].x].sort((a, b) => a - b).map((x) => ({ x, y: fit.intercept + fit.slope * x })), color: 'rgba(108,196,255,0.8)', kind: 'line' as const }] : []),
            ]}
            band={band}
            onBand={setBand}
            brushMode="band"
            xLabel="day"
            yLabel="offset from the star’s centre (″)"
            yFmt={(y) => y.toFixed(0)}
          />
          <div className="faint" style={{ fontSize: 12 }}>Drag across one transit’s logs. The line’s zero crossing is mid-transit.</div>
        </>
      )}
      {mid !== null && (
        <>
          <dl className="kv">
            <dt>Mid-transit (line crosses zero)</dt>
            <dd className="blue">day {fmt(mid, 3)}</dd>
            <dt>Uncertainty</dt>
            <dd>{midSigma !== null ? `± ${fmt(midSigma * 24 * 60, 0)} min` : '—'}</dd>
          </dl>
          <button
            className="btn primary small"
            onClick={() => {
              s.set({ oppPicks: [...s.oppPicks, mid * DAY] });
              setBand(null);
              sfx('good');
              setTimeout(checkMissions, 0);
            }}
          >
            Log this transit
          </button>
        </>
      )}
      {picks.length > 0 && (
        <div className="stack">
          {picks.map((p, i) => (
            <div key={p} className="row between">
              <span>
                Passage {i + 1}: <span className="mono">day {fmt(p / DAY, 3)}</span>
              </span>
              <button className="btn small ghost" onClick={() => s.set({ oppPicks: s.oppPicks.filter((x) => x !== p) })}>
                ✕
              </button>
            </div>
          ))}
          <b style={{ marginTop: 6 }}>Date of transit t₀ (latest)</b>
          <SendToSheet k="tOpp" value={picks[picks.length - 1]} spread={midSigma !== null ? midSigma * DAY : undefined} />
          {S && (
            <>
              <b style={{ marginTop: 6 }}>Synodic period S = {fmt(S / DAY, 2)} days</b>
              <Formula>1/P₂ = 1/P₁ + 1/S</Formula>
              <SendToSheet k="S2" value={S} />
            </>
          )}
        </div>
      )}
    </div>
  );
}
