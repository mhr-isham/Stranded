import { lazy, Suspense, useRef, useState } from 'react';
import { useGame } from '../../game/store';

const TransitArchive = lazy(() => import('./TransitArchive'));

export function ArchiveButton({ className = 'btn small' }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const opener = useRef<HTMLButtonElement>(null);
  const discovered = useGame(s => !!s.transitArchive?.discovery);
  return <>
    <button ref={opener} type="button" className={className} onClick={() => setOpen(true)}>
      {discovered ? 'Transit Archive · discovery logged' : 'Open Transit Archive'}
    </button>
    {open && <Suspense fallback={null}><TransitArchive close={() => {
      setOpen(false);
      requestAnimationFrame(() => opener.current?.focus({ preventScroll: true }));
    }} /></Suspense>}
  </>;
}
