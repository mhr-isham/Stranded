import { useMemo, type RefObject } from 'react';
import type { LandingSite } from '../../engine/landingScan';
import type { Terrain } from '../../engine/descent';
import { campDistances } from '../../game/surface';
import { CanvasView } from './CanvasView';

const SITE = {
  flat: { name: 'Flat plain', color: '#80d8b5', use: 'Gentler approach' },
  ice: { name: 'Ice basin', color: '#bfe6ff', use: 'Closer to water ice' },
  hill: { name: 'Highlands', color: '#ffc46b', use: 'More demanding approach' },
};

export const landingSiteName = (site: LandingSite['kind']) => SITE[site].name;
const distance = (km: number) => km < 0.05 ? 'at the site' : `${km.toFixed(1)} km away`;

export function LandingScan({ terrain, sites, fromX, waypoint, panel, onSelect, onClose }: {
  terrain: Terrain; sites: LandingSite[]; fromX: number; waypoint: LandingSite | null; panel: RefObject<HTMLElement | null>;
  onSelect: (site: LandingSite | null) => void; onClose: () => void;
}) {
  const from = Math.min(fromX, ...terrain.features.map((feature) => feature.x0)) - 600;
  const to = Math.max(fromX, ...terrain.features.map((feature) => feature.x1)) + 600;
  const heights = useMemo(() => Array.from({ length: 161 }, (_, i) => terrain.height(from + (to - from) * i / 160)), [from, to, terrain]);
  const low = Math.min(...heights), range = Math.max(1, Math.max(...heights) - low);
  return <section className="landing-scan panel stack" ref={panel} tabIndex={-1} aria-label="Landing scan"
    onKeyDown={(event) => { if (event.key === 'Escape') onClose(); }}>
    <div className="row between">
      <strong>Landing scan</strong>
      <button className="btn small ghost" onClick={onClose}>Close scan</button>
    </div>
    <p className="muted">Estimated from your descent path and fuel. Select a waypoint, then fly the approach.</p>
    <div className="landing-scan-profile" aria-hidden="true">
      <CanvasView draw={({ ctx, w, h, dpr }) => {
        const X = (x: number) => (0.04 + 0.92 * (x - from) / (to - from)) * w;
        const Y = (y: number) => (0.82 - 0.48 * (y - low) / range) * h;
        ctx.fillStyle = '#0a1424';
        ctx.fillRect(0, 0, w, h);
        ctx.lineWidth = dpr;
        ctx.strokeStyle = '#628aa34d';
        for (const fraction of [0.25, 0.5, 0.75]) {
          ctx.beginPath();
          ctx.moveTo(0, h * fraction);
          ctx.lineTo(w, h * fraction);
          ctx.stroke();
        }
        ctx.beginPath();
        heights.forEach((y, i) => {
          const x = X(from + (to - from) * i / 160);
          if (!i) ctx.moveTo(x, Y(y)); else ctx.lineTo(x, Y(y));
        });
        ctx.strokeStyle = '#8bb4c8';
        ctx.stroke();
        ctx.lineTo(X(to), h);
        ctx.lineTo(X(from), h);
        ctx.closePath();
        ctx.fillStyle = '#1c3448a6';
        ctx.fill();
        const craftX = X(fromX);
        ctx.fillStyle = '#f0f6ff';
        ctx.beginPath();
        ctx.moveTo(craftX, h * 0.36);
        ctx.lineTo(craftX - 5 * dpr, h * 0.15);
        ctx.lineTo(craftX + 5 * dpr, h * 0.15);
        ctx.closePath();
        ctx.fill();
        for (const site of sites) {
          const x = X(site.x), y = Y(terrain.height(site.x));
          ctx.fillStyle = SITE[site.kind].color;
          ctx.fillRect(x - dpr, y - 11 * dpr, 2 * dpr, 11 * dpr);
          ctx.beginPath();
          ctx.arc(x, y - 11 * dpr, 4 * dpr, 0, Math.PI * 2);
          ctx.fill();
        }
      }} />
    </div>
    {sites.length ? <div className="landing-scan-sites">
      {sites.map((site) => {
        const { iceKm, hillKm } = campDistances(terrain, site.x);
        return <button key={site.kind} className="btn landing-site" aria-pressed={waypoint?.kind === site.kind} onClick={() => onSelect(site)}
          style={{ borderTopColor: SITE[site.kind].color }}>
          <strong>{SITE[site.kind].name}</strong><span>{SITE[site.kind].use}</span>
          <span className="mono">{site.kind === 'hill' ? `Survey hill ${distance(hillKm)}` : `Ice ${distance(iceKm)}`}</span>
        </button>;
      })}
    </div> : <p className="amber">No approach confirmed from this position. Keep flying toward clear ground.</p>}
    {waypoint && <button className="btn small ghost" onClick={() => onSelect(null)}>Clear waypoint</button>}
  </section>;
}
