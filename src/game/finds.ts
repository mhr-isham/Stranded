// Picking up a find the rover has reached (shared by the map and the driving screen).

import { toast } from '../ui/common/widgets';
import { sfx } from './audio';
import { useGame } from './store';
import { unlockLog } from './story';
import type { Find } from './surface';

export const FIND_TEXT: Record<Find['kind'], { icon: string; name: string; text: string }> = {
  parts: { icon: '🔩', name: 'Wreckage', text: 'A torn hull panel from the crash, with usable parts.' },
  meteorite: { icon: '☄️', name: 'Meteorite', text: 'A heavy, rust-crusted stone — iron and nickel. Meteorites like this are leftovers from when the planets formed.' },
  clue: { icon: '🧰', name: 'Halcyon toolbox', text: 'A dented toolbox stamped HALCYON. Inside: a page of horizon-dip readings in neat handwriting, each with an error bar.' },
};

export function collectFind(f: Find) {
  const s = useGame.getState();
  const sf = s.surface;
  if (sf.collected.includes(f.id)) return;
  const patch: Record<string, unknown> = { surface: { ...sf, found: sf.found.includes(f.id) ? sf.found : [...sf.found, f.id], collected: [...sf.collected, f.id] } };
  if (f.kind === 'parts' && s.settings.survival) patch.survival = { ...s.survival, parts: s.survival.parts + 2 };
  if (f.kind === 'meteorite') s.unlock('codex', 'meteorite');
  useGame.setState(patch);
  if (f.kind === 'clue') unlockLog('toolbox');
  toast(`${FIND_TEXT[f.kind].name} collected${f.kind === 'parts' && s.settings.survival ? ': +2 spare parts' : ''}`);
  sfx('unlock');
}
