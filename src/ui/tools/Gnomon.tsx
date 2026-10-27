// Chapter 3: Eratosthenes' method. A 2 m stick at camp and another on the
// rover, driven due north. At local noon the sun is lower at the northern site;
// the difference in the sun's angle is the arc between the sites, so
// R₁ = distance / Δangle. The shadow tip is fuzzy because the sun is a disk.

import { useMemo, useRef, useState } from 'react';
import { DAY, DEG } from '../../engine/constants';
import { localFrame, toHorizontal, topocentric } from '../../engine/sky';
import type { Site } from '../../engine/types';
import { sfx } from '../../game/audio';
import { clock } from '../../game/clock';
import { fmt } from '../../game/format';
import { currentWorld } from '../../game/sim';
import { useGame } from '../../game/store';
import { hhmm, localSolarHours } from '../../game/time';
import { CanvasView, canvasPoint } from '../common/CanvasView';
import { Formula, SanityWarning, SendToSheet, ToolHeader } from '../common/sheetBits';
import { toast, useGameTime } from '../common/widgets';

const STICK = 2; // m
const SPEED = 400e3; // rover m/day

/** Sun altitude seen at a site, with the thick air's (small, high-sun) refraction. */
function sunAlt(t: number, site: Site, refraction: number) {
  const { system: sys } = currentWorld();
  const f = localFrame(sys, t, site);
  const alt = toHorizontal(topocentric(sys, 'star', t, site), f).alt;
  // Refraction lifts the sun by ~1′·cot(alt) in normal air; thicker air, more.
  const lift = alt > 2 * DEG ? (refraction * 2 * (1 / 60) * DEG) / Math.tan(alt) : 0;
  return alt + lift;
}

export function northSite(site: Site, dist: number, R: number): Site {
  return { lat: site.lat + dist / R, lon: site.lon };
}

export function Gnomon() {
  const { system: sys } = currentWorld();
  const s = useGame();
  const t = useGameTime(8);
  const [where, setWhere] = useState<'camp' | 'rover'>('camp');
  const [km, setKm] = useState(800);
  const mark = useRef<number | null>(null);
  const [markL, setMarkL] = useState<number | null>(null);
  const geom = useRef({ x0: 0, k: 1 });
  const trip = s.northTrip;
  const driving = trip.arriveAt > t;
  const rSite = northSite(sys.site, trip.dist, sys.home.radius);
  const site = where === 'camp' ? sys.site : rSite;
  const alt = sunAlt(t, site, sys.features.refraction || 0.5);
  const sunR = Math.asin(sys.star.radius / Math.hypot(...topocentric(sys, 'star', t, site)));
  const L = alt > 0 ? STICK / Math.tan(alt) : Infinity;
  const hours = localSolarHours(sys, t);
  const canRead = alt > 5 * DEG && (where === 'camp' || (trip.dist > 0 && !driving));

  // Noon readings: the highest sun of the most recent day at each site.
  const day = (x: number) => Math.floor(x / DAY);
  const noon = useMemo(() => {
    const best: Record<string, { alt: number; at: number } | undefined> = {};
    for (const r of s.shadows) {
      const k = `${r.site}:${day(r.at)}:${r.dist}`;
      if (!best[k] || r.alt > best[k]!.alt) best[k] = { alt: r.alt, at: r.at };
    }
    // Pair camp and rover noons from the same day.
    const pairs: { day: number; dist: number; camp: number; rover: number }[] = [];
    for (const [k, v] of Object.entries(best)) {
      const [st, d, dist] = k.split(':');
      if (st !== 'rover' || !v) continue;
      const c = best[`camp:${d}:0`] ?? Object.entries(best).find(([kk]) => kk.startsWith(`camp:${d}:`))?.[1];
      if (c) pairs.push({ day: Number(d), dist: Number(dist), camp: c.alt, rover: v.alt });
    }
    return pairs.sort((a, b) => b.day - a.day);
  }, [s.shadows]);
  const pair = noon[0];
  // Moving along the meridian changes the noon sun's angle by the arc travelled (either way, depending on the season).
  const dAlt = pair ? Math.abs(pair.camp - pair.rover) : null;
  const R1 = pair && dAlt && dAlt > 0 ? pair.dist / dAlt : null;

  const log = () => {
    if (markL === null) return toast('Drag the marker to the tip of the shadow first.');
    const readAlt = Math.atan(STICK / markL);
    useGame.setState({ shadows: [...s.shadows, { site: where, at: clock.t, alt: readAlt, dist: where === 'camp' ? 0 : trip.dist }] });
    sfx('log');
    toast(`Shadow ${fmt(markL, 3)} m → sun at ${fmt(readAlt / DEG, 3)}°`);
  };

  const drive = (dist: number) => {
    if (s.rover.dist > 0 || s.rover.arriveAt > t) return toast('The rover is out east. Bring it back first (Rover screen).');
    const legs = Math.abs(dist - trip.dist);
    useGame.setState({ northTrip: { dist, arriveAt: clock.t + (legs / SPEED) * DAY } });
    toast(dist ? `Rover heading north: ${fmt(legs / SPEED, 1)} days` : 'Rover returning to camp');
  };

  return (
    <div className="tool">
      <div className="tool-stage" style={{ background: 'linear-gradient(#2b4a7e, #c9a27a)' }}>
        <CanvasView
          onPointerDown={(e) => {
            (e.target as Element).setPointerCapture(e.pointerId);
            const p = canvasPoint(e);
            mark.current = (p.x - geom.current.x0) / geom.current.k;
            setMarkL(Math.max(0, mark.current));
          }}
          onPointerMove={(e) => {
            if (!e.buttons) return;
            const p = canvasPoint(e);
            setMarkL(Math.max(0, (p.x - geom.current.x0) / geom.current.k));
          }}
          draw={({ ctx, w, h, dpr }) => {
            const ground = h * 0.62;
            const x0 = w * 0.12;
            const span = Math.min(12, Math.max(3, (Number.isFinite(L) ? L : 6) * 1.3));
            const k = (w * 0.8) / span; // px per metre
            geom.current = { x0, k };
            ctx.fillStyle = '#6b5a41';
            ctx.fillRect(0, ground, w, h - ground);
            // Ruler along the ground.
            ctx.fillStyle = '#e8dcc0';
            ctx.fillRect(x0, ground + 4 * dpr, span * k, 16 * dpr);
            ctx.fillStyle = '#3a3020';
            ctx.font = `${10 * dpr}px JetBrains Mono`;
            ctx.textAlign = 'center';
            for (let m = 0; m <= span * 10; m++) {
              const x = x0 + (m / 10) * k;
              const major = m % 10 === 0;
              ctx.fillRect(x, ground + 4 * dpr, dpr, (major ? 12 : m % 5 === 0 ? 8 : 4) * dpr);
              if (major) ctx.fillText(`${m / 10} m`, x, ground + 32 * dpr);
            }
            if (alt > 0) {
              // Fuzzy shadow: the sun's disk gives a penumbra at the tip.
              const Lin = STICK / Math.tan(alt + sunR);
              const Lout = STICK / Math.tan(Math.max(0.01, alt - sunR));
              const g = ctx.createLinearGradient(x0 + Lin * k, 0, x0 + Lout * k, 0);
              g.addColorStop(0, 'rgba(20,14,8,0.75)');
              g.addColorStop(1, 'rgba(20,14,8,0)');
              ctx.fillStyle = 'rgba(20,14,8,0.75)';
              ctx.fillRect(x0, ground - 3 * dpr, Lin * k, 6 * dpr);
              ctx.fillStyle = g;
              ctx.fillRect(x0 + Lin * k, ground - 3 * dpr, (Lout - Lin) * k, 6 * dpr);
              // Sun rays over the stick.
              ctx.strokeStyle = 'rgba(255,230,160,0.35)';
              ctx.lineWidth = dpr;
              ctx.beginPath();
              ctx.moveTo(x0, ground - STICK * k);
              ctx.lineTo(x0 + L * k, ground);
              ctx.stroke();
            }
            // The stick.
            ctx.fillStyle = '#d9d2c3';
            ctx.fillRect(x0 - 2 * dpr, ground - STICK * k, 4 * dpr, STICK * k);
            // Player's marker.
            if (markL !== null) {
              const x = x0 + markL * k;
              ctx.strokeStyle = '#6cc4ff';
              ctx.lineWidth = 2 * dpr;
              ctx.beginPath();
              ctx.moveTo(x, ground - 30 * dpr);
              ctx.lineTo(x, ground + 22 * dpr);
              ctx.stroke();
              ctx.fillStyle = '#6cc4ff';
              ctx.textAlign = 'left';
              ctx.fillText(`${fmt(markL, 3)} m`, x + 5 * dpr, ground - 34 * dpr);
            }
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.textAlign = 'left';
            ctx.font = `600 ${12 * dpr}px Inter`;
            ctx.fillText(where === 'camp' ? 'Camp gnomon' : `Rover gnomon · ${fmt(trip.dist / 1000, 0)} km north`, 14 * dpr, 96 * dpr);
          }}
        />
      </div>
      <div className="tool-side">
        <ToolHeader title="Noon shadows" sub="Eratosthenes’ method: the same noon sun, two places on one meridian." />
        <div className="panel panel-pad stack">
          <div className="row" style={{ gap: 6 }}>
            <button className={`btn small ${where === 'camp' ? 'primary' : ''}`} onClick={() => (setWhere('camp'), setMarkL(null))}>
              Camp
            </button>
            <button className={`btn small ${where === 'rover' ? 'primary' : ''}`} onClick={() => (setWhere('rover'), setMarkL(null))} disabled={trip.dist === 0}>
              Rover {trip.dist ? `(${fmt(trip.dist / 1000, 0)} km N)` : ''}
            </button>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>
            Local time {hhmm(hours)}. Drag the marker to the middle of the shadow’s fuzzy tip and log it. The shortest shadow of the day is noon —
            take a few readings around it.
          </div>
          {where === 'rover' && driving && <div className="amber" style={{ fontSize: 13 }}>Rover driving — arrives in {fmt((trip.arriveAt - t) / DAY, 1)} days.</div>}
          {alt <= 5 * DEG && <div className="amber" style={{ fontSize: 13 }}>The sun is too low. Come back near midday.</div>}
          <button className="btn primary" disabled={!canRead} onClick={log}>
            Log shadow length
          </button>
          <Formula>sun altitude = atan(stick / shadow)</Formula>
        </div>
        <div className="panel panel-pad stack">
          <b>Send the rover north</b>
          <div className="row">
            <input type="range" min={200} max={2000} step={50} value={km} onChange={(e) => setKm(Number(e.target.value))} style={{ flex: 1 }} />
            <span className="mono">{km} km</span>
          </div>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn" disabled={driving} onClick={() => drive(km * 1000)}>
              Drive north
            </button>
            <button className="btn ghost" disabled={driving || trip.dist === 0} onClick={() => drive(0)}>
              Return to camp
            </button>
          </div>
          <div className="hint">A longer baseline makes the angle difference bigger and your radius more precise — but the drive costs days.</div>
        </div>
        <div className="panel panel-pad stack">
          <b>Noon comparison</b>
          {pair ? (
            <>
              <dl className="kv">
                <dt>Day</dt>
                <dd>{pair.day + 1}</dd>
                <dt>Noon sun at camp</dt>
                <dd>{fmt(pair.camp / DEG, 3)}°</dd>
                <dt>Noon sun at the rover</dt>
                <dd>{fmt(pair.rover / DEG, 3)}°</dd>
                <dt>Difference Δ</dt>
                <dd>{dAlt ? `${fmt(dAlt / DEG, 3)}°` : '—'}</dd>
                <dt>Distance north</dt>
                <dd>{fmt(pair.dist / 1000, 0)} km</dd>
                <dt>R₁ = distance / Δ</dt>
                <dd className="blue">{R1 ? `${fmt(R1 / 1000, 0)} km` : '—'}</dd>
              </dl>
              <SanityWarning
                msgs={[
                  dAlt !== null && dAlt < 0.2 * DEG && 'The two noon angles are almost the same. Were both taken at noon on the same day? A longer drive helps.',
                  Math.max(pair.camp, pair.rover) > 82 * DEG && 'The sun was nearly overhead at noon: if it passed between the two sites, this simple method fails. Try another season or a different distance.',
                ]}
              />
              <Formula>R₁ = d / Δ (Δ in radians)</Formula>
              {R1 && <SendToSheet k="R1" value={R1} />}
            </>
          ) : (
            <div className="faint" style={{ fontSize: 13 }}>Log the noon shadow at camp and at the rover on the same day.</div>
          )}
        </div>
      </div>
    </div>
  );
}
