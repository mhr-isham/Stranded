import { derivedFor, keysFor, type PrimaryKey, type QuantityKey } from '../engine/chain';
import { currentVariant } from './sim';
import { modeOf } from './modes';
import { useGame } from './store';

/** Unlock the displayed next level once, even if a stale callback is repeated. */
export function unlockHint(key: QuantityKey, level: number) {
  const s = useGame.getState(), mode = modeOf(s.settings.difficulty);
  if (s.phase !== 'play' || !Number.isInteger(level) || level < 1 || level > mode.hints) return false;
  const variant = currentVariant();
  if (!keysFor(variant).includes(key as PrimaryKey) && !(key in derivedFor(variant))) return false;
  const current = s.hintsSeen?.[key] ?? 0;
  if (level !== current + 1) return false;
  useGame.setState({ hintsSeen: { ...s.hintsSeen, [key]: level }, hintsUsed: s.hintsUsed + (mode.hintsCost ? 1 : 0) });
  return true;
}
