import { nudgeWire, pickWire, wireDiameter, type WireChoice } from '../../game/micrometer';
import { AngularSizeInvestigation } from '../tutorial/AngularSizeInvestigation';
import { observedMotion, savedSkyDirection } from '../../game/observedMotion';
import { ObservationReplay } from './ObservationReplay';
import { RetroInvestigation } from '../tutorial/RetroInvestigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ARCSEC, DAY, DEG } from '../../engine/constants';
import { linearFit } from '../../engine/solver';
import { eclLon, localFrame, toHorizontal, topocentric } from '../../engine/sky';
import { starLongitude } from '../../engine/measure';
import { unit, type Vec3 } from '../../engine/vec';
import { sfx, setInstrument, stopInstrument } from '../../game/audio';
import { clock } from '../../game/clock';
import { ECHO } from '../../game/echo';
import { MoonAnalysisPanel } from './MoonAnalysis';
import { fmt } from '../../game/format';
import { MeasurementSources } from '../common/MeasurementSources';
import { checkMissions, currentWorld, targetObservable } from '../../game/sim';
import { useGame } from '../../game/store';
import { paintSky, starRGB } from '../../render/paint';
import { drawScope, scopeProjector, SEEING } from '../../render/telescope';
import { makeLandscape } from '../../render/terrain';
import { CanvasView, canvasPoint } from '../common/CanvasView';
import { Chart } from '../common/Chart';
import { Formula, ReadingsTable, SendReadings, SendToSheet, ToolHeader, outlierNote } from '../common/sheetBits';
import { toast, useGameTime } from '../common/widgets';
import { flag, onTutEvent, setAnchor } from '../../game/tutorial';
import { lastOf, makePrediction, nextMoonEast, nextStationary, pendingOf } from '../../game/predictions';
import { PredictCard } from '../common/Predict';
import { ReadingPredictionPractice } from '../tutorial/ReadingPredictionPractice';
import { hasChallenge, seeingFactor } from '../../game/challenges';
import { SeeingConditions } from '../common/MeasurementNotes';
import { useMode } from '../../game/modes';
import { relaySunlit, relayTopocentric } from '../../engine/relay';
import { toLocal as toLocalDir } from '../../render/scene';
import { unlockLog } from '../../game/story';
import { OrbitPanel } from './OrbitPanel';
import { GiantPanel } from './GiantPanel';
import { StarsPanel } from './StarsPanel';
import { flareAt } from '../../engine/flares';
import { meridianAngle } from '../../engine/sky';
import { isCloudy } from '../../game/survival';
import { makeSkySighting, skyCode, skyDirection, skyKey, skyline, visibleSkyLights, type SkyRef } from '../../game/skyObservation';
import { SkyExplorer, SkyNotebook } from './SkyExplorer';
import { analyzeYear } from '../../game/yearObservations';
import { YearPlot, YearFitDetails } from './YearAnalysis';
import { YearInvestigation } from '../tutorial/YearInvestigation';

type Sel = SkyRef;
type Tab = 'sky' | 'year' | 'track' | 'transit' | 'orbit' | 'giant' | 'stars' | 'micro' | 'moon';

const TABS: { id: Tab; label: string }[] = [
  { id: 'sky', label: 'Sky' },
  { id: 'year', label: 'Year' },
  { id: 'track', label: 'Tracker' },
  { id: 'transit', label: 'Transit' },
  { id: 'orbit', label: 'Orbit' },
  { id: 'giant', label: 'Giant' },
  { id: 'stars', label: 'Stars' },
  { id: 'micro', label: 'Micrometer' },
  { id: 'moon', label: 'Moon' },
];

export function Observatory() {
  useEffect(() => stopInstrument, []);
  const lastMotion = useRef(-Infinity);
  const { system: sys, catalog } = currentWorld();
  const land = useMemo(() => makeLandscape(sys.seed, sys.hillHeight), [sys]);
  const s = useGame();
  const t = useGameTime(5);
  const [mode, setMode] = useState<'sky' | 'scope'>('sky');
  const [tab, setTab] = useState<Tab>('sky');
  const [moonChartFocus, setMoonChartFocus] = useState(true);
  const [sel, setSel] = useState<Sel | null>(null);
  const [fovLog, setFovLog] = useState(Math.log10(2)); // degrees, log scale
  const [showEcl, setShowEcl] = useState(false);
  const cam = useRef({ az: 180 * DEG, alt: 35 * DEG, fov: 90 * DEG, scale: 1 });
  const ptr = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<null | { az: number; alt: number; fov: number; x: number; y: number; dist: number }>(null);
  const aim = useRef({ a: 0, b: 0 }); // player's pointing offset from the object (rad)
  const calip = useRef({ x1: -15 * ARCSEC, x2: 15 * ARCSEC, dragging: 0 as 0 | 1 | 2 | 3, start: { x: 0, a: 0, b: 0 } });
  const [wire, setWire] = useState<WireChoice>('A'), [wireStep, setWireStep] = useState(.1);
  const wireRef = useRef<WireChoice>('A'), scopePointer = useRef<number | null>(null), wireGrab = useRef(0);
  const scopeSample = useRef<{ at: number; realTime: number; seeing: number; field: number; target: boolean; observable: boolean } | null>(null);
  const chooseWire = (value: WireChoice) => { wireRef.current = value; setWire(value); };
  const scopeK = useRef(1);
  const fov = Math.pow(10, fovLog) * DEG;
  const [labels, setLabels] = useState(false);
  const [, refreshCamera] = useState(0);
  const viewSize = useRef({ w: 1000, h: 600, dpr: 1 });
  const rules = useMode();
  const obscured = (at: number) => !!flareAt(sys, at) || (s.settings.survival && isCloudy(s.seed, at));
  const skyLights = visibleSkyLights(sys, catalog, t, { ...cam.current, w: viewSize.current.w, h: viewSize.current.h }, land, obscured(t));
  const panSky = (az: number, alt: number) => { cam.current.az += az * DEG; cam.current.alt = Math.max(-5 * DEG, Math.min(85 * DEG, cam.current.alt + alt * DEG)); lastMotion.current = performance.now(); refreshCamera((n) => n + 1); };
  const zoomSky = (factor: number) => { cam.current.fov = Math.max(15 * DEG, Math.min(120 * DEG, cam.current.fov * factor)); refreshCamera((n) => n + 1); };
  const selectLight = (ref: SkyRef) => {
    if (!visibleSkyLights(sys, catalog, clock.t, { ...cam.current, w: viewSize.current.w, h: viewSize.current.h }, land, obscured(clock.t)).some((light) => light.key === skyKey(ref))) return;
    setSel(ref); aim.current = { a: (Math.random() - .5) * .4 * DEG, b: (Math.random() - .5) * .4 * DEG };
    if (ref.kind === 'target') flag('obs-sel-target');
    sfx('click');
  };
  // A rough night seen through the eyepiece earns the Codex card on seeing.
  useEffect(() => {
    if (mode === 'scope' && seeingFactor(useGame.getState(), clock.t) > 1.5) useGame.getState().unlock('codex', 'seeingAnom');
  }, [mode, Math.floor(t / DAY)]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Point the telescope at an object (used by the "point at" buttons and Flight School). */
  const pointAt = (kind: 'star' | 'target', fovDeg: number, tabId?: Tab) => {
    sfx('detent');
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
    return skyDirection(sys, catalog, sl, tt);
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
    if (sl.kind === 'target' && s.identified) return `The blue planet · ${skyCode(sys.seed, sl)}`;
    if (sl.kind === 'relay' && s.logs.includes('relay')) return `The Halcyon relay · ${skyCode(sys.seed, sl)}`;
    return skyCode(sys.seed, sl);
  };

  const frameNow = localFrame(sys, t, sys.site);
  const altOf = (sl: Sel) => toHorizontal(objDir(sl, t), frameNow).alt;
  const starAlt = toHorizontal(topocentric(sys, 'star', t, sys.site), frameNow).alt / DEG;
  const twilight = starAlt > -1 && starAlt < 8;
  const filter = sel?.kind === 'star';
  const inspectable = (sl: Sel | null, at: number) => {
    if (!sl || obscured(at)) return false;
    const frame = localFrame(sys, at, sys.site), dir = objDir(sl, at), position = toHorizontal(dir, frame);
    if (position.alt <= skyline(land, position.az)) return false;
    if (sl.kind === 'relay' && !relayVisible(at)) return false;
    if (mode === 'sky') return visibleSkyLights(sys, catalog, at, { ...cam.current, w: viewSize.current.w, h: viewSize.current.h }, land).some((light) => light.key === skyKey(sl));
    const sun = toHorizontal(topocentric(sys, 'star', at, sys.site), frame).alt / DEG;
    if (sl.kind === 'catalog' && sun >= -1.6) return false;
    const center = pointing(at);
    if (!center) return false;
    const p = scopeProjector({ center, fov, w: viewSize.current.w, h: viewSize.current.h }).project(dir);
    return !!p && p.x >= 0 && p.y >= 0 && p.x <= viewSize.current.w && p.y <= viewSize.current.h;
  };
  const available = inspectable(sel, t);
  const notebookAllowed = available && sel?.kind !== 'star' && starAlt < -1.6;
  const logSighting = (note: string) => {
    if (!sel || sel.kind === 'star' || !inspectable(sel, clock.t) || toHorizontal(topocentric(sys, 'star', clock.t, sys.site), localFrame(sys, clock.t, sys.site)).alt >= -1.6 * DEG) return false;
    const ray = pointing(clock.t);
    if (!ray) return false;
    const sighting = makeSkySighting(skyKey(sel), skyCode(sys.seed, sel), clock.t, ray, mode === 'scope' ? 'scope' : 'wide', note);
    if (!sighting) return false;
    const current = useGame.getState(), previous = (current.skySightings ?? []).at(-1);
    if (previous && previous.key === sighting.key && previous.at === sighting.at && previous.lon === sighting.lon && previous.lat === sighting.lat && previous.note === sighting.note) { toast('That paused pointing is already in your notebook.'); return false; }
    current.set({ skySightings: [...(current.skySightings ?? []), sighting] });
    toast(`${sighting.code}: sighting logged`); sfx('shutter'); return true;
  };
  const focusWide = () => {
    if (!sel || obscured(clock.t)) return;
    const p = toHorizontal(objDir(sel, clock.t), localFrame(sys, clock.t, sys.site));
    if (p.alt <= skyline(land, p.az)) return;
    cam.current.az = p.az; cam.current.alt = Math.max(-5 * DEG, Math.min(85 * DEG, p.alt)); refreshCamera((n) => n + 1);
  };
  const nudgeImage = (x: number, y: number) => { aim.current = { a: aim.current.a + x * fov * .06, b: aim.current.b + y * fov * .06 }; lastMotion.current = performance.now(); refreshCamera((n) => n + 1); };
  const adjustWire = (direction: number, fine = false) => {
    const selected = wireRef.current;
    if (selected === 'pan') return;
    const key = selected === 'A' ? 'x1' : 'x2';
    calip.current[key] = nudgeWire(calip.current[key], direction * wireStep * (fine ? .1 : 1), fov);
    lastMotion.current = performance.now(); refreshCamera((n) => n + 1);
  };
  useEffect(() => {
    const release = () => { scopePointer.current = null; calip.current.dragging = 0; };
    window.addEventListener('blur', release); return () => window.removeEventListener('blur', release);
  }, []);

  const selectionCue = () => {
    if (!sel || !available) return 'The selected light is outside the observable field or obscured.';
    const variation = sel.kind === 'catalog' ? 'Brightness variation is visible (also provided as a text cue).' : 'Brightness is comparatively steady.';
    if (mode === 'sky') { const light = skyLights.find((v) => v.key === skyKey(sel)); return `${light?.tint ?? 'Selected light'} · ${light?.variation ?? ''}.`; }
    const center = pointing(t)!;
    const projection = scopeProjector({ center, fov, w: viewSize.current.w, h: viewSize.current.h }), point = projection.project(objDir(sel, t))!;
    const dx = point.x - viewSize.current.w / 2, dy = point.y - viewSize.current.h / 2, tolerance = Math.max(12 * viewSize.current.dpr, viewSize.current.w * .04);
    const alignment = Math.abs(dx) < tolerance && Math.abs(dy) < tolerance ? 'Near the crosshair.' : `${Math.abs(dx) >= tolerance ? dx < 0 ? 'Left of crosshair. ' : 'Right of crosshair. ' : ''}${Math.abs(dy) >= tolerance ? dy < 0 ? 'Above crosshair.' : 'Below crosshair.' : ''}`;
    if (sel.kind === 'star') return `Solar-filter disk. ${alignment}`;
    let image = 'Point-like image at this scale.';
    if (sel.kind === 'target' || sel.kind === 'giant') {
      const body = sel.kind === 'giant' ? sys.giant! : sys.target;
      const radius = Math.asin(body.radius / Math.hypot(...topocentric(sys, sel.kind, t, sys.site))) * projection.k;
      image = radius >= Math.max(1.5 * viewSize.current.dpr, SEEING * seeingFactor(s, t) * projection.k) ? 'Resolved disk at this scale.' : 'A point-like or blurred image at this scale.';
    }
    return `${image} ${variation} ${alignment}`;
  };

  // Pick the light nearest a tap in the wide view.
  const pick = (px: number, py: number, w: number, h: number) => {
    let best: Sel | null = null;
    let bd = 30 * Math.min(2, window.devicePixelRatio || 1);
    for (const light of visibleSkyLights(sys, catalog, clock.t, { ...cam.current, w, h }, land, obscured(clock.t))) { const distance = Math.hypot(light.x - px, light.y - py); if (distance < bd) [bd, best] = [distance, light.ref]; }
    if (best) selectLight(best);
  };

  /** The relay shows only in a dark sky while it is still in sunlight, above the horizon. */
  function relayVisible(tt: number) {
    const f = localFrame(sys, tt, sys.site);
    if (toHorizontal(topocentric(sys, 'star', tt, sys.site), f).alt > -6 * DEG) return false;
    if (toHorizontal(relayTopocentric(sys, tt, sys.site), f).alt < 3 * DEG) return false;
    return relaySunlit(sys, tt);
  }

  const identify = () => {
    if (!inspectable(sel, clock.t)) return toast('Bring an observable light into the telescope first.');
    if (sel?.kind === 'target') {
      useGame.setState({ identified: true });
      useGame.getState().unlock('codex', 'twinkle');
      toast('Identified: the blue planet!');
      sfx('unlock');
      checkMissions();
      useGame.getState().say(ECHO.track);
    } else {
      toast(sel?.kind === 'giant' ? 'An extended disk, but this candidate has different visible features. Keep comparing your observations.' : 'Target not confirmed. Compare the point-like image, brightness variation and your recorded sightings.');
      sfx('detent');
    }
  };

  return (
    <div className={`tool ${tab === 'moon' && moonChartFocus ? 'moon-analysis-focus' : ''}`}>
      <div className="tool-stage" data-tut="obs-stage">
        {mode === 'sky' ? (
          <CanvasView
            tabIndex={0} role="img" aria-label="Wide sky; arrow keys pan and plus or minus zoom"
            onKeyDown={(e) => { if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'].includes(e.key)) { e.preventDefault(); if (e.key === 'ArrowLeft') panSky(-5, 0); else if (e.key === 'ArrowRight') panSky(5, 0); else if (e.key === 'ArrowUp') panSky(0, 5); else if (e.key === 'ArrowDown') panSky(0, -5); else zoomSky(e.key === '+' || e.key === '=' ? .8 : 1.25); } }}
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture(e.pointerId);
              ptr.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
              const pts = [...ptr.current.values()];
              gesture.current = { ...cam.current, x: e.clientX, y: e.clientY, dist: pts.length > 1 ? Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y) : 0 };
            }}
            onPointerMove={(e) => {
              if (gesture.current) lastMotion.current = performance.now();
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
            onPointerCancel={(e) => { ptr.current.delete(e.pointerId); gesture.current = null; }}
            onWheel={(e) => (cam.current.fov = Math.max(15 * DEG, Math.min(120 * DEG, cam.current.fov * (e.deltaY > 0 ? 1.1 : 0.9))))}
            draw={({ ctx, w, h, dpr, now, canvas }) => {
              viewSize.current = { w, h, dpr };
              setInstrument('scope', now - lastMotion.current < 120 ? 0.6 : 0);
              const camera = { az: cam.current.az, alt: cam.current.alt, fov: cam.current.fov, w, h };
              const { scene, P } = paintSky(ctx, camera, sys, catalog, land, clock.t, now, dpr, { showEcliptic: showEcl, reduceFlicker: !!s.settings.skyReducedFlicker });
              if (obscured(clock.t)) {
                ctx.fillStyle = flareAt(sys, clock.t) ? 'rgba(40,8,12,.92)' : 'rgba(54,61,73,.97)'; ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = '#e2e8f3'; ctx.textAlign = 'center'; ctx.font = `600 ${14 * dpr}px Inter`;
                ctx.fillText(flareAt(sys, clock.t) ? 'Flare glare — wait for clear observing conditions' : 'Cloud cover — comparison lights are obscured', w / 2, h / 2); return;
              }
              // Let Flight School point at the blue planet.
              const tp = P.project(scene.target);
              if (tp && scene.target[2] > 0 && tp.x > 0 && tp.y > 0 && tp.x < w && tp.y < h) {
                const r = canvas.getBoundingClientRect();
                setAnchor('planet', r.left + tp.x / dpr, r.top + tp.y / dpr);
              }
              cam.current.scale = P.scale;
              // Historical two-coordinate measurements, fixed against the star chart.
              if (s.settings.skyTrackTrail && tab === 'track') {
                ctx.strokeStyle = '#ffc46b'; ctx.lineWidth = 1.2 * dpr;
                for (const measurement of s.track.filter((o) => o.at <= clock.t)) {
                  const ray = savedSkyDirection(measurement);
                  if (!ray) continue;
                  const local = toLocalDir(ray, scene.frame), horizontal = toHorizontal(ray, scene.frame), point = P.project(local);
                  if (!point || horizontal.alt <= skyline(land, horizontal.az) || point.x < 0 || point.x > w || point.y < 0 || point.y > h) continue;
                  ctx.beginPath(); ctx.arc(point.x, point.y, 3 * dpr, 0, Math.PI * 2); ctx.stroke();
                }
              }
              // Selection ring and labels.
              const label = (d: [number, number, number], text: string, color: string) => {
                const p = P.project(d);
                if (!p || Math.asin(Math.max(-1, Math.min(1, d[2]))) <= skyline(land, Math.atan2(d[0], d[1]))) return;
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
              const visible = visibleSkyLights(sys, catalog, clock.t, camera, land);
              if (s.identified && sel?.kind !== 'target' && visible.some((v) => v.ref.kind === 'target')) label(scene.target, 'Blue planet', 'rgba(108,196,255,0.9)');
              if (labels) for (const light of visible.filter((v) => (!sel || v.key !== skyKey(sel)) && !(s.identified && v.ref.kind === 'target') && !(s.logs.includes('relay') && v.ref.kind === 'relay'))) label(toLocalDir(light.dir, scene.frame), `${light.variation === 'steadier' ? '—' : '≈'} ${light.code}`, 'rgba(218,229,248,.85)');
              // The Halcyon relay: a faint light that moves across the sky in minutes.
              if (relayVisible(clock.t)) {
                const rd = toLocalDir(relayTopocentric(sys, clock.t, sys.site), scene.frame);
                const rp = P.project(rd);
                if (rp && Math.asin(Math.max(-1, Math.min(1, rd[2]))) > skyline(land, Math.atan2(rd[0], rd[1]))) {
                  ctx.fillStyle = 'rgba(235,240,255,0.85)';
                  ctx.beginPath();
                  ctx.arc(rp.x, rp.y, 1.4 * dpr, 0, Math.PI * 2);
                  ctx.fill();
                  if (s.logs.includes('relay') && sel?.kind !== 'relay') label(rd, 'Halcyon relay', 'rgba(181,156,255,0.9)');
                }
              }
              if (sel && visible.some((v) => v.key === skyKey(sel))) label(toLocalDir(objDir(sel, clock.t), scene.frame), skyCode(sys.seed, sel), 'rgba(255,196,107,0.95)');
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
            tabIndex={0} role="img" aria-label={tab === 'micro' ? 'Micrometer. 1 selects wire A, 2 selects wire B, 0 selects image pan. Left and right move the selected wire, Shift makes finer adjustments. Up and down aim; plus and minus zoom.' : 'Telescope; arrow keys nudge the image and plus or minus zoom'}
            onKeyDown={(e) => {
              if (e.ctrlKey || e.metaKey || e.altKey) return;
              if (tab === 'micro' && ['0', '1', '2'].includes(e.key)) { e.preventDefault(); chooseWire(e.key === '0' ? 'pan' : e.key === '1' ? 'A' : 'B'); if (!e.repeat) sfx('detent'); return; }
              if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_'].includes(e.key)) return;
              e.preventDefault();
              if (tab === 'micro' && wireRef.current !== 'pan' && ['ArrowLeft', 'ArrowRight'].includes(e.key)) { adjustWire(e.key === 'ArrowLeft' ? -1 : 1, e.shiftKey); if (!e.repeat) sfx('detent'); }
              else if (e.key === 'ArrowLeft') nudgeImage(1, 0);
              else if (e.key === 'ArrowRight') nudgeImage(-1, 0);
              else if (e.key === 'ArrowUp') nudgeImage(0, -1);
              else if (e.key === 'ArrowDown') nudgeImage(0, 1);
              else setFovLog((v) => Math.max(Math.log10(.015), Math.min(Math.log10(4), v + (e.key === '+' || e.key === '=' ? -.1 : .1))));
            }}
            onPointerDown={(e) => {
              if (e.button !== 0 || scopePointer.current !== null) return;
              scopePointer.current = e.pointerId; e.currentTarget.focus();
              e.currentTarget.setPointerCapture(e.pointerId);
              const p = canvasPoint(e);
              const c = e.currentTarget;
              const C = calip.current;
              C.start = { x: p.x, a: aim.current.a, b: aim.current.b };
              C.dragging = 3;
              if (tab === 'micro') {
                const x1 = c.width / 2 + C.x1 * scopeK.current;
                const x2 = c.width / 2 + C.x2 * scopeK.current;
                const selected = wireRef.current === 'pan' ? 'pan' : pickWire(p.x, x1, x2, Math.min(window.devicePixelRatio || 1, 2), wireRef.current);
                chooseWire(selected); wireGrab.current = selected === 'A' ? p.x - x1 : selected === 'B' ? p.x - x2 : 0; C.dragging = selected === 'A' ? 1 : selected === 'B' ? 2 : 3;
              }
              (C.start as { y?: number }).y = p.y;
            }}
            onPointerMove={(e) => {
              if (calip.current.dragging) lastMotion.current = performance.now();
              const C = calip.current;
              if (!C.dragging || scopePointer.current !== e.pointerId) return;
              const p = canvasPoint(e);
              const c = e.currentTarget;
              const k = scopeK.current;
              if (C.dragging === 1) C.x1 = (Math.max(0, Math.min(c.width, p.x - wireGrab.current)) - c.width / 2) / k;
              else if (C.dragging === 2) C.x2 = (Math.max(0, Math.min(c.width, p.x - wireGrab.current)) - c.width / 2) / k;
              else {
                // Fine pointing: drag moves the telescope by a quarter of the screen motion.
                const sy = (C.start as { y?: number }).y ?? p.y;
                aim.current = { a: C.start.a - ((p.x - C.start.x) / k) * 0.25, b: C.start.b + ((p.y - sy) / k) * 0.25 };
              }
            }}
            onPointerUp={(e) => { if (scopePointer.current === e.pointerId) { scopePointer.current = null; calip.current.dragging = 0; } }}
            onPointerCancel={(e) => { if (scopePointer.current === e.pointerId) { scopePointer.current = null; calip.current.dragging = 0; } }}
            onWheel={(e) => setFovLog((v) => Math.max(Math.log10(0.015), Math.min(Math.log10(4), v + (e.deltaY > 0 ? 0.05 : -0.05))))}
            draw={({ ctx, w, h, dpr, now }) => {
              viewSize.current = { w, h, dpr };
              setInstrument('scope', now - lastMotion.current < 120 ? 0.5 : 0);
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
                  brightStars: catalog,
                  reduceFlicker: !!s.settings.skyReducedFlicker,
                  extraLights: [
                    ...(sys.giant ? [{ dir: unit(topocentric(sys, 'giant', tt, sys.site)), radius: Math.asin(sys.giant.radius / Math.hypot(...topocentric(sys, 'giant', tt, sys.site))), style: 'giant' as const, color: [255, 236, 200] as [number, number, number] }] : []),
                    ...(relayVisible(tt) ? [{ dir: unit(relayTopocentric(sys, tt, sys.site)), radius: 0, color: [235, 240, 255] as [number, number, number] }] : []),
                  ],
                  filter,
                  targetInFront: sys.features.inner && Math.hypot(...tgtV) < Math.hypot(...sunV),
                  shimmer: { x: 0.35 * ARCSEC * seeingFactor(useGame.getState(), tt) * Math.sin(ts * 2.1) * Math.sin(ts * 0.7), y: 0.35 * ARCSEC * seeingFactor(useGame.getState(), tt) * Math.sin(ts * 1.7 + 1) },
                },
                dpr,
              );
              scopeK.current = P.k;
              scopeSample.current = { at: tt, realTime: now, seeing: seeingFactor(useGame.getState(), tt), field: fov, target: sel?.kind === 'target', observable: inspectable(sel, tt) };
              if (obscured(tt)) {
                ctx.fillStyle = 'rgba(10,8,6,0.94)';
                ctx.fillRect(0, 0, w, h);
                ctx.fillStyle = '#c9a';
                ctx.font = `600 ${15 * dpr}px Inter`;
                ctx.textAlign = 'center';
                ctx.fillText('Observing conditions obscure the field', w / 2, h / 2);
              } else {
                // Mask the actual ridge through the field, including when the
                // crosshair is above it but an object is below it.
                const below = (x: number, y: number) => { const p = toHorizontal(P.unproject(x, y), f); return p.alt <= skyline(land, p.az); };
                const ridge: { x: number; y: number }[] = [];
                if (toHorizontal(center, f).alt < Math.atan(sys.hillHeight / 5200) + 4 * DEG + fov * h / w) for (let i = 0; i <= 24; i++) {
                  const x = w * i / 24;
                  let lo = 0, hi = h;
                  if (below(x, 0)) hi = 0;
                  else if (!below(x, h)) lo = h;
                  else for (let j = 0; j < 11; j++) { const mid = (lo + hi) / 2; if (below(x, mid)) hi = mid; else lo = mid; }
                  ridge.push({ x, y: (lo + hi) / 2 });
                }
                if (ridge.some((p) => p.y < h)) { ctx.fillStyle = '#100e0e'; ctx.beginPath(); ctx.moveTo(0, h); for (const p of ridge) ctx.lineTo(p.x, p.y); ctx.lineTo(w, h); ctx.closePath(); ctx.fill(); }
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
                for (const [key, x, color] of [['A', calip.current.x1, '#6cf0ff'], ['B', calip.current.x2, '#78ffaa']] as const) {
                  const X = w / 2 + x * P.k, active = wire === key;
                  ctx.strokeStyle = active ? '#ffc46b' : color; ctx.lineWidth = (active ? 1.8 : 1) * dpr;
                  ctx.beginPath(); ctx.moveTo(X, h * .15); ctx.lineTo(X, h * .83); ctx.stroke();
                  ctx.fillStyle = active ? '#ffc46b' : color;
                  ctx.beginPath(); ctx.arc(X, h * .66, 9 * dpr, 0, Math.PI * 2); ctx.fill();
                  ctx.fillStyle = '#07101d'; ctx.font = `700 ${11 * dpr}px Inter`; ctx.textAlign = 'center'; ctx.fillText(key, X, h * .66 + 4 * dpr);
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
        {tab !== 'micro' && (
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
        )}
        {mode === 'scope' && tab !== 'micro' && (
          <div className="panel panel-pad stage-bottom" data-tut="obs-fov" style={{ width: 'min(440px, calc(100% - 16px))', padding: '8px 12px' }}>
            <div className="row between">
              <span className="muted" style={{ fontSize: 13 }}>Field of view</span>
              <span className="mono">{fov > 0.1 * DEG ? `${fmt(fov / DEG, 2)}°` : `${fmt(fov / ARCSEC, 0)}″`}</span>
            </div>
            <input type="range" aria-label="Telescope field of view" aria-valuetext={`${Math.pow(10, fovLog).toFixed(3)} degrees`} min={Math.log10(0.015)} max={Math.log10(4)} step={0.01} value={fovLog} onChange={(e) => setFovLog(Number(e.target.value))} />
            <div className="row sky-pan"><button className="btn small" aria-label="Move telescope image left" onClick={() => nudgeImage(1, 0)}>◀</button><button className="btn small" aria-label="Move telescope image up" onClick={() => nudgeImage(0, -1)}>▲</button><button className="btn small" aria-label="Move telescope image down" onClick={() => nudgeImage(0, 1)}>▼</button><button className="btn small" aria-label="Move telescope image right" onClick={() => nudgeImage(-1, 0)}>▶</button></div>
            <div className="faint hide-phone" style={{ fontSize: 12 }}>Drag to fine-tune the pointing. The drive keeps tracking your target.</div>
          </div>
        )}
        {mode === 'scope' && tab === 'micro' && <div className="panel micrometer-controls" role="group" aria-label="Micrometer wire controls">
          <div className="row">{(['A', 'B', 'pan'] as const).map((value) => <button key={value} className="btn small" aria-pressed={wire === value} onClick={() => { chooseWire(value); sfx('detent'); }}>{value === 'pan' ? 'Pan image' : `Wire ${value}`}</button>)}</div>
          <div className="row"><button className="btn small" aria-label="Move selected wire left" disabled={wire === 'pan'} onClick={() => { adjustWire(-1); sfx('detent'); }}>← Wire</button><button className="btn small" aria-label="Move selected wire right" disabled={wire === 'pan'} onClick={() => { adjustWire(1); sfx('detent'); }}>Wire →</button><select className="input" aria-label="Wire step in arcseconds" value={wireStep} onChange={(e) => setWireStep(Number(e.target.value))}><option value={1}>1″</option><option value={.1}>0.1″</option><option value={.01}>0.01″</option></select></div>
          <div className="row"><button className="btn small" aria-label="Magnify micrometer image" onClick={() => setFovLog((v) => Math.max(Math.log10(.015), v - .1))}>Zoom +</button><button className="btn small" aria-label="Widen micrometer image" onClick={() => setFovLog((v) => Math.min(Math.log10(4), v + .1))}>Zoom −</button><span className="faint">{wire === 'pan' ? 'Image pan selected' : `Wire ${wire} selected`}</span></div>
        </div>}
      </div>

      <div className="tool-side">
        <ToolHeader title="Observatory" sub="Tracker + telescope. Positions are measured against the background stars." />
        {tab === 'moon' && <button className="btn small" onClick={() => setMoonChartFocus(!moonChartFocus)}>{moonChartFocus ? 'Show sky beside the chart' : 'Focus on the moon chart'}</button>}
        {mode === 'scope' && <SeeingConditions />}
        <div className="panel panel-pad" style={{ padding: 6 }}>
          <div className="row" style={{ gap: 4 }}>
            {TABS.filter((tb) => (tb.id !== 'transit' || sys.features.inner) && (tb.id !== 'orbit' || !!sys.target.e || !!sys.giant) && (tb.id !== 'giant' || !!sys.giant) && (tb.id !== 'stars' || !!sys.features.stars)).map((tb) => (
              <button
                key={tb.id}
                data-tut={`obs-tab-${tb.id}`}
                className={`btn small ${tab === tb.id ? 'primary' : 'ghost'}`}
                onClick={() => {
                  setTab(tb.id);
                  if (tb.id === 'micro') { calip.current = { ...calip.current, x1: -Math.tan(fov / 10), x2: Math.tan(fov / 10) }; chooseWire('A'); }
                }}
                style={{ flex: 1 }}
              >
                {tb.label}
              </button>
            ))}
          </div>
        </div>

        {tab === 'sky' && (
          <>
          <SkyExplorer lights={skyLights} selected={sel} known={s.identified} wide={mode === 'sky'} az={cam.current.az} alt={cam.current.alt} field={cam.current.fov} labels={labels} onLabels={() => setLabels(!labels)} pan={panSky} zoom={zoomSky} select={selectLight} focus={focusWide} coaching={rules.coaching} />
          <div className="panel panel-pad stack" aria-label="Selected light observations">
            <b>{selLabel(sel)}</b>
            {sel && available && <div className="muted" style={{ fontSize: 13 }}>Altitude {fmt(altOf(sel) / DEG, 1)}°</div>}
            {sel && <div className="callout tip" role="status">{selectionCue()}</div>}
            <div className="muted" style={{ fontSize: 13 }}>
              Drag to look around, pinch or scroll to zoom, tap a light to select it. Then open the telescope.
            </div>
            {sel?.kind === 'relay' && available && <RelayInfo />}
            {mode === 'scope' && sel && sel.kind !== 'star' && sel.kind !== 'relay' && !s.identified && (
              <button className="btn primary" disabled={!available} onClick={identify} data-tut="obs-identify">
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
          <SkyNotebook selectedKey={sel ? skyKey(sel) : undefined} code={sel ? skyCode(sys.seed, sel) : ''} canLog={notebookAllowed} reason={!sel ? 'Select a comparison light to begin.' : sel.kind === 'star' ? 'Use the Year tab for solar-filter star-position observations.' : !available ? 'Bring the selected light into an unobscured field.' : 'A background star field is needed for these comparison notes.'} onLog={logSighting} />
          </>
        )}

        {tab === 'year' && sys.features.locked && (
          <YearPanel
            locked
            onPoint={() => {}}
            canLog={!obscured(t)}
            reason="Clouds or flare glare obscure the reference stars. Wait for clear observing conditions."
            onLog={() => {
              if (obscured(clock.t)) return;
              const lastObs = useGame.getState().starObs.at(-1);
              if (lastObs && clock.t - lastObs.at < 0.5 * DAY) return toast('Already logged today. Log again on another day, so the sky has moved on.');
              // The reference star's hour angle: how far the sky has turned (with a small reading error).
              const v = (((meridianAngle(sys, clock.t, sys.site) + (Math.random() - 0.5) * 0.04 * DEG) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
              useGame.setState((st) => ({ starObs: [...st.starObs, { at: clock.t, v, source: 'tracker' }] }));
              toast('Sky position logged');
              sfx('shutter');
            }}
          />
        )}
        {tab === 'year' && !sys.features.locked && (
          <YearPanel
            onPoint={() => (pointAt('star', 2), flag('scope-star'))}
            canLog={mode === 'scope' && sel?.kind === 'star' && twilight && !obscured(t)}
            reason={obscured(t) ? 'Clouds or flare glare obscure the field. Wait for clear observing conditions.' : sel?.kind !== 'star' ? 'Select the star and open the telescope (the solar filter fits automatically).' : mode !== 'scope' ? 'Open the telescope.' : !twilight ? 'Wait for sunrise or sunset: the tracker needs the star low in a twilight sky to see reference stars.' : ''}
            onLog={() => {
              const c = pointing(clock.t);
              if (!c || mode !== 'scope' || sel?.kind !== 'star' || obscured(clock.t)) return;
              const sunNow = toHorizontal(topocentric(sys, 'star', clock.t, sys.site), localFrame(sys, clock.t, sys.site)).alt / DEG;
              if (sunNow <= -1 || sunNow >= 8) return;
              const lastObs = useGame.getState().starObs.at(-1);
              if (lastObs && clock.t - lastObs.at < 0.5 * DAY) return toast('Already logged today. Log again on another day, so the sky has moved on.');
              const v = eclLon(c);
              useGame.setState((st) => ({ starObs: [...st.starObs, { at: clock.t, v, source: 'manual', environment: { instrument: 'telescope', at: clock.t, rawValue: v, seeing: { factor: seeingFactor(st, clock.t), frozen: false } } }] }));
              toast('Star position logged');
              sfx('shutter');
            }}
          />
        )}

        {tab === 'track' && <TrackerPanel onWide={() => setMode('sky')} />}
        {tab === 'transit' && <TransitPanel onPoint={() => pointAt('star', 1.2)} />}

        {tab === 'micro' && (
          <div className="panel panel-pad stack">
            <b>Filar micrometer</b>
            <div className="row"><button className={`btn small ${mode === 'sky' ? 'primary' : ''}`} onClick={() => setMode('sky')}>Wide sky</button><button data-tut="obs-scope-btn" className={`btn small ${mode === 'scope' ? 'primary' : ''}`} onClick={() => sel ? setMode('scope') : toast('Point at a light first')}>Telescope</button></div>
            <div className="muted" style={{ fontSize: 13 }}>
              Frame the whole disk first; widen the field if a limb is off-screen. Then place A and B on opposite edges. Drag either wire or select it and use the fine controls. Keyboard 1/2 selects a wire; 0 pans the image; Shift makes left/right adjustments finer.
            </div>
            <button className="btn" data-tut="micro-point" onClick={() => (pointAt('target', 1 / 60), flag('micro-ready'))} disabled={!s.identified}>
              Point at the blue planet (1′ field)
            </button>
            <div className="stack" data-tut="obs-fov">
              <label className="field">Field of view · {fmt(fov / ARCSEC, 1)}″<input type="range" aria-label="Telescope field of view" aria-valuetext={`${Math.pow(10, fovLog).toFixed(3)} degrees`} min={Math.log10(.015)} max={Math.log10(4)} step={.01} value={fovLog} onChange={(e) => setFovLog(Number(e.target.value))} /></label>
              <div className="row sky-pan"><button className="btn small" aria-label="Move telescope image left" onClick={() => nudgeImage(1, 0)}>◀</button><button className="btn small" aria-label="Move telescope image up" onClick={() => nudgeImage(0, -1)}>▲</button><button className="btn small" aria-label="Move telescope image down" onClick={() => nudgeImage(0, 1)}>▼</button><button className="btn small" aria-label="Move telescope image right" onClick={() => nudgeImage(-1, 0)}>▶</button></div>
            </div>
            <MicroReadout calip={calip} />
            <button
              data-tut="micro-log"
              className="btn primary"
              disabled={!(mode === 'scope' && sel?.kind === 'target' && s.identified && inspectable(sel, t))}
              onClick={() => {
                const a = wireDiameter(calip.current.x1, calip.current.x2), sample = scopeSample.current;
                if (!sample || !sample.target || !sample.observable || !inspectable(sel, clock.t)) return toast('Bring an observable target into the current field first.');
                if (obscured(clock.t)) return toast('The field is obscured. Wait for clear observing conditions.');
                const { system: sysNow } = currentWorld();
                const altNow = toHorizontal(topocentric(sysNow, 'target', clock.t, sysNow.site), localFrame(sysNow, clock.t, sysNow.site)).alt;
                if (altNow < 0) return toast('The blue planet is below the horizon — wait for it to rise.');
                if (a === null || a < 0.3 * ARCSEC) return toast('The wires are on top of each other. Set them on opposite edges of the disk.');
                const limit = Math.tan(sample.field / 2);
                if (Math.abs(calip.current.x1) > limit || Math.abs(calip.current.x2) > limit) return toast('Both wires must be visible in the field.');
                const sightingId = `${s.runId}:${sample.at}`, prior = s.readings.find((r) => r.key === 'alpha2' && r.micrometer?.sightingId === sightingId);
                const reading = { key: 'alpha2' as const, value: a, at: sample.at, note: `day ${fmt(sample.at / DAY, 4)} · manual micrometer`,
                  micrometer: { sightingId, wireA: calip.current.x1, wireB: calip.current.x2, field: sample.field, stepArcsec: wireStep, realSampleMs: sample.realTime, revisions: prior ? prior.micrometer!.revisions + 1 : 0 },
                  environment: { instrument: 'telescope' as const, at: sample.at, rawValue: a, seeing: { factor: sample.seeing, frozen: false } } };
                if (prior) s.set({ readings: s.readings.map((r) => r.id === prior.id ? { ...r, ...reading, kept: true } : r) });
                else s.addReading(reading);
                const warn = outlierNote(a, s.readings.filter((r) => r.key === 'alpha2' && r.kept && r.id !== prior?.id).map((r) => r.value), 0.15);
                toast(warn ? `${prior ? 'Revised' : 'Logged'} ${fmt(a / ARCSEC, 2)}″ — far from your other sightings. Check the wires.` : `${prior ? 'Sighting revised' : 'Diameter logged'}: ${fmt(a / ARCSEC, 2)}″`);
                sfx('shutter');
              }}
            >
              Log diameter
            </button>
            {!inspectable(sel, t) && <div className="faint">The selected target must be above the local horizon, clear of cloud/flare obstruction and inside the current field to log a diameter.</div>}
            <div className="faint">At a paused observation time, logging again updates that sighting. New dates alone do not guarantee independent errors.</div>
            <details className="measurement-help"><summary>Optional: diameter, distance and repeat observations</summary><p>Separate sights after the image changes can test repeatability. Re-marking the same observation time updates one reading. Shared blur, limb judgement and alignment offsets remain even with many dates. Fine wire steps improve control; they do not certify that precision.</p><p>Use the distance at the diameter’s date to infer radius. Distance uncertainty and angular uncertainty both matter; Flight School offers optional practice with their contributions.</p></details>
            <Formula>R₂ = d(t) · tan(α₂/2)</Formula>
            <ReadingsTable k="alpha2" render={(v) => `${fmt(v / ARCSEC, 2)}″`} />
            <SendReadings k="alpha2" tut="micro-send" />
            <AngularSizeInvestigation />
          </div>
        )}

        {tab === 'orbit' && <OrbitPanel />}
        {tab === 'giant' && <GiantPanel />}
        {tab === 'stars' && <StarsPanel />}
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
  const [, refresh] = useState(0);
  useEffect(() => { const timer = setInterval(() => refresh((n) => n + 1), 80); return () => clearInterval(timer); }, []);
  return <div className="stack"><div className="readout" aria-label="Measured angular diameter">{fmt((wireDiameter(calip.current.x1, calip.current.x2) ?? 0) / ARCSEC, 3)}″</div><div className="faint">A <output aria-label="Wire A position">{fmt(Math.atan(calip.current.x1) / ARCSEC, 3)}</output>″ · B <output aria-label="Wire B position">{fmt(Math.atan(calip.current.x2) / ARCSEC, 3)}</output>″ relative to the optical axis.</div></div>;
}

function YearPanel({ canLog, reason, onLog, onPoint, locked = false }: { canLog: boolean; reason: string; onLog: () => void; onPoint: () => void; locked?: boolean }) {
  const obs = useGame((s) => s.starObs);
  const [band, setBand] = useState<[number, number] | null>(null);
  const manual = hasChallenge(useGame.getState(), 'handFit');
  const analysis = analyzeYear(obs, band), { fit } = analysis, pts = analysis.points;
  return (
    <div className="panel panel-pad stack">
      <b>Length of the year</b>
      {locked ? (
        <div className="muted" style={{ fontSize: 13 }}>
          The star never moves here — this planet keeps one face to it. But it still turns once per orbit, so the whole starry sky wheels overhead
          once a year. Log where a reference star stands (its hour angle) now and again over days or weeks: it turns 360° per year.
        </div>
      ) : (
        <div className="muted" style={{ fontSize: 13 }}>
          At sunrise or sunset, centre the star in the telescope and log its position against the background stars. Come back days or weeks later.
          The star drifts east by 360° per year.
        </div>
      )}
      {!locked && (
        <button className="btn" data-tut="year-point" onClick={onPoint}>
          Point at the star (solar filter)
        </button>
      )}
      <button className="btn primary" disabled={!canLog} onClick={onLog} data-tut="year-log">
        {locked ? 'Log the sky’s turn' : 'Log star position'}
      </button>
      {!canLog && <div className="amber" style={{ fontSize: 13 }}>{reason}</div>}
      {locked && <MeasurementSources instrument="locked-year" />}
      <div data-tut="year-fit" className="stack">
      <YearPlot analysis={analysis} manual={manual} band={band} onBand={setBand} />
      {pts.length > 0 && <>
        <div className="faint">Drag across the chart to select dates, or use these range fields. Excluded observations remain visible.</div>
        <div className="row year-date-range"><label className="field">From day<input className="input" type="number" step="any" value={band?.[0] ?? pts[0].x} onChange={(e) => { if (e.target.value !== '' && Number.isFinite(Number(e.target.value))) setBand([Number(e.target.value), band?.[1] ?? pts.at(-1)!.x]); }} /></label><label className="field">To day<input className="input" type="number" step="any" value={band?.[1] ?? pts.at(-1)!.x} onChange={(e) => { if (e.target.value !== '' && Number.isFinite(Number(e.target.value))) setBand([band?.[0] ?? pts[0].x, Number(e.target.value)]); }} /></label></div>
        <button className="btn small" onClick={() => setBand(null)}>Use all observing dates</button>
        <details className="measurement-help"><summary>Observation log and conditions</summary><table className="log"><thead><tr><th>Day</th><th>Chart position (°)</th><th>Image / source</th></tr></thead><tbody>{pts.map((p, i) => <tr key={`${p.x}:${i}`}><td>{fmt(p.x, 3)}</td><td>{fmt(p.y, 3)}</td><td>{p.observation.environment?.seeing ? p.observation.environment.seeing.factor > 1.5 ? 'Turbulent' : 'Steadier' : 'Not recorded'}{p.observation.source === 'echo' ? ' · ECHO supplied' : p.observation.source === 'manual' ? ' · manual' : p.observation.source === 'tracker' ? ' · tracker sample' : ' · source not recorded'}</td></tr>)}</tbody></table></details>
      </>}
      <YearFitDetails analysis={analysis} manual={manual} send />
      <details className="measurement-help"><summary>What can these dates establish?</summary><p>One date provides no time baseline. Two dates define an early line but cannot establish scatter. More separated dates can test that line; extra readings at the same instant do not provide more time coverage.</p><p>The fitted rate assumes approximately steady angular drift over the selected interval. Curvature, shared centring offsets and changing image quality can make a straight line inadequate. The shortest-turn unwrap also assumes no unobserved extra revolutions between successive dates; very long gaps can hide a turn.</p><p>Keep your observations and choose another date if the drift is small relative to your aiming uncertainty. More observations do not guarantee a narrower or more accurate result.</p></details>
      <Formula>{locked ? 'P₁ = 360° / (sky turn rate)' : 'P₁ = 360° / (daily drift)'}</Formula>
      </div>
      <YearInvestigation observations={obs} locked={locked} manual={manual} />
      {!locked && <ReadingPredictionPractice kind="star" />}
      {pts.length >= 2 && !locked && <StarPrediction pts={pts} fit={manual ? null : fit} />}
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

function TrackerPanel({ onWide }: { onWide: () => void }) {
  const s = useGame();
  const t = useGameTime(4);
  const [cursor, setCursor] = useState<number | null>(null);
  const obs = targetObservable(t);
  const { system: sysT } = currentWorld();
  const inner = sysT.features.inner;
  const transformed = inner ? s.track.map((o) => ({ ...o, v: (((o.v - starLongitude(sysT, o.at, sysT.site)) / DEG + 540) % 360 - 180) * DEG })) : s.track;
  const cadence = sysT.features.locked ? DAY / 8 : currentWorld().solarDay;
  const replay = observedMotion(transformed, cadence), pts = replay.map(({ x, y }) => ({ x, y }));
  const picks = inner ? [] : [...new Set(s.oppPicks.filter(Number.isFinite))].sort((a, b) => a - b);
  const S = picks.length >= 2 && picks.at(-1)! > picks[0] ? (picks.at(-1)! - picks[0]) / (picks.length - 1) : null;
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
            {obs.ok ? 'Tracking now: target visible.' : obs.flare ? 'A flare is washing out the sky — the tracker waits it out.' : obs.cloudy ? 'Clouded out tonight.' : obs.sunAlt > obs.lim.sun ? (obs.lim.sun > -10 * DEG ? 'Waiting for twilight.' : 'Waiting for a dark sky.') : `Target below ${Math.round(obs.lim.track / DEG)}° altitude.`} Warp time to
            collect weeks of data.
          </div>
        </>
      )}
      <label className="row" style={{ fontSize: 13 }}><input type="checkbox" checked={!!s.settings.skyTrackTrail} onChange={(e) => { s.set({ settings: { ...s.settings, skyTrackTrail: e.target.checked } }); if (e.target.checked) onWide(); }} />Show saved sightings on the wide sky</label>
      {s.settings.skyTrackTrail && <div className="faint">Gold rings are past recorded pointings in the current clear field. Only logs with a saved latitude can be placed here; older longitude-only records stay available in the chart replay. Pan the wide view to inspect them.</div>}
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
          Drag across a region to zoom in, tap to place a date cursor. For an outer planet, opposition lies within the backward interval, distinct from its two turning points. Near-circular examples can place it near the middle; an exact symmetry is not guaranteed.
        </div>
      )}
      {inner && pts.length > 1 && (
        <div className="faint" style={{ fontSize: 12 }}>
          When the planet passes in front of the star it vanishes from the twilight for a while. The middle of that gap is the moment it passed the
          star (a rougher alternative to timing a transit).
        </div>
      )}
      {pts.length > 0 && <><ObservationReplay points={replay} inner={inner} onCursor={setCursor} /><label className="field">Chart cursor day<input className="input" type="number" step="any" value={cursor ?? ''} min={pts[0].x} max={pts.at(-1)!.x} onChange={(e) => { const v = Number(e.target.value); setCursor(e.target.value !== '' && Number.isFinite(v) && v >= pts[0].x && v <= pts.at(-1)!.x ? v : null); }} /></label></>}
      {cursor !== null && (
        <div className="row between">
          <span className="mono">day {fmt(cursor, 2)}</span>
          <button
            className="btn primary small"
            onClick={() => {
              if (s.oppPicks.some((at) => Math.abs(at - cursor * DAY) < 1)) return;
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
      {!inner && <><RetroInvestigation /><RetroPrediction pts={pts} /></>}
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
      helper={`Bracket it: it can't be before opposition. A near-circular symmetry model gives a rough forecast, not an exact rule. It turned back around day ${start.toFixed(0)}; ${opp !== undefined ? `you marked opposition on day ${opp.toFixed(0)}, so mirror the gap.` : 'find the middle of the loop (opposition) and mirror the gap.'}`}
      pts={pts.slice(Math.max(0, iMax - 30))}
      axis="x"
      xMax={t / DAY + 120}
      xLabel="day"
      yLabel="longitude (°)"
      ownFit={hasChallenge(s, 'handFit') ? null : own}
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
  return <MoonAnalysisPanel renderPrediction={(pts, fit) => <MoonPrediction pts={pts} fit={fit} />} />;
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
      {(mode.coaching || mode.missions === 'goals') && now && <div className="green" style={{ fontSize: 13 }}>A transit is happening now.</div>}
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
