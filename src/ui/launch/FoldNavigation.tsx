import { useEffect, useMemo, useRef, useState } from 'react';
import { mulberry32 } from '../../engine/rng';
import { jumpFromStellarFix } from '../../game/foldNavigation';
import { currentWorld } from '../../game/sim';
import { stellarEvidence } from '../../game/stellarFix';
import { useGame } from '../../game/store';
import { CanvasView } from '../common/CanvasView';
import { ToolHeader } from '../common/sheetBits';
import { toast } from '../common/widgets';

export function FoldNavigation({ openStars }: { openStars: () => void }) {
  const s = useGame();
  const { system } = currentWorld();
  const evidence = useMemo(() => stellarEvidence(s, system), [s.sheet, s.starPar, system]);
  const briefed = s.settings.freeRoam || s.tutorial.active || s.logs.includes('cache8');
  const location = briefed && s.navFix && evidence.matches.length === 1 && evidence.matches[0].label === s.navFix ? s.navFix : null;
  return <div className="screen scroll fold-navigation">
    <section className="panel panel-pad stack fold-console" aria-label="Fold navigation">
      <ToolHeader title="Fold navigation" sub="Send the fold drive a position from Mira’s catalogue." />
      {location ? <>
        <div className="fold-location"><span className="meter-label">ORIGIN FIX LOCKED</span><strong>{location}</strong></div>
        <p className="muted">The drive has your origin. The Kestrel is ready to jump.</p>
        <button className="btn primary big" disabled={!!s.storyQueue.length} onClick={() => {
          const error = jumpFromStellarFix();
          if (error) toast(error);
        }}>Engage fold drive</button>
      </> : <>
        <div className="fold-location"><span className="meter-label">AWAITING ORIGIN FIX</span><strong>{evidence.stars.filter(star => star.fit).length} of 3 stellar fits</strong></div>
        <p>Compare the three measured distances with Mira’s catalogue and confirm a location using the current survey.</p>
        <button className="btn primary" onClick={openStars}>Open stellar survey</button>
      </>}
    </section>
  </div>;
}

export function FoldTransit() {
  const elapsed = useRef(0);
  const reduced = useMemo(() => window.matchMedia('(prefers-reduced-motion: reduce)'), []);
  const [ready, setReady] = useState(reduced.matches);
  const points = useMemo(() => {
    const rng = mulberry32(831);
    return Array.from({ length: 170 }, () => [rng() * Math.PI * 2, .04 + rng() * .72, rng()]);
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 2400);
    return () => window.clearTimeout(timer);
  }, []);
  const finish = () => {
    if (useGame.getState().phase === 'fold') useGame.setState({ phase: 'results' });
  };
  return <div className="screen fold-transit">
    <CanvasView draw={({ ctx, w, h, dpr, dt }) => {
      elapsed.current = Math.min(2.4, elapsed.current + dt);
      const progress = reduced.matches ? 0 : Math.sin(Math.PI * elapsed.current / 2.4) ** 2;
      ctx.fillStyle = '#050814';
      ctx.fillRect(0, 0, w, h);
      const x = w / 2, y = h * .44, scale = Math.hypot(w, h);
      const glow = ctx.createRadialGradient(x, y, 0, x, y, scale * .34);
      glow.addColorStop(0, `rgba(112,147,244,${.14 + progress * .38})`);
      glow.addColorStop(1, 'rgba(35,55,150,0)');
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      for (const [angle, radius, brightness] of points) {
        const r = radius * scale * (1 + progress * .55);
        const tail = r * (1 - progress * (.10 + brightness * .12));
        const u = Math.cos(angle), v = Math.sin(angle);
        ctx.strokeStyle = `rgba(199,221,255,${.19 + brightness * .66})`;
        ctx.lineWidth = (.65 + brightness) * dpr;
        ctx.beginPath();
        ctx.moveTo(x + tail * u, y + tail * v);
        ctx.lineTo(x + (r + dpr) * u, y + (r + dpr) * v);
        ctx.stroke();
      }
    }} />
    <div className="panel panel-pad fold-transit-readout stack">
      <strong role="status">{ready ? 'Fold complete' : 'Crossing the fold'}</strong>
      <button className="btn primary" onClick={finish}>{ready ? 'Open debrief' : 'Skip transit'}</button>
    </div>
  </div>;
}
