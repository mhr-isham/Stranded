import { sfx } from './audio';
import { clock } from './clock';
import { currentWorld, checkMissions } from './sim';
import { stellarEvidence, STELLAR_KEYS } from './stellarFix';
import { useGame } from './store';
import { playLog, unlockLog } from './story';
import { lifeSupportEnd } from './survival';

export function confirmStellarFix(location: string) {
  const s = useGame.getState();
  if (s.chapter !== 8 || s.phase !== 'play') return 'The fold drive is unavailable.';
  const { system } = currentWorld();
  const evidence = stellarEvidence(s, system);
  if (!evidence.ready || evidence.matches.length !== 1 || evidence.matches[0].label !== location) {
    return 'This choice is not supported by a unique fit. Review your distances and the catalogue.';
  }
  if (clock.t >= lifeSupportEnd(s, system)) return 'Camp supplies have run out.';
  const sheet = { ...s.sheet };
  STELLAR_KEYS.forEach((key, i) => {
    const fit = evidence.stars[i].fit!;
    sheet[key] = { value: fit.parallax, sigma: fit.sigma };
  });
  useGame.setState({ navFix: location, sheet, screen: 'launch' });
  checkMissions();
  sfx('unlock');
  if (!s.settings.freeRoam && !s.tutorial.active && (s.navFix !== location || !s.logs.includes('cache8'))) {
    unlockLog('cache8', false);
    playLog('cache8');
  }
  return null;
}

export function jumpFromStellarFix() {
  const s = useGame.getState();
  if (s.chapter !== 8 || s.phase !== 'play' || s.storyQueue.length) return 'Finish the navigation briefing before jumping.';
  const { system } = currentWorld();
  const { matches } = stellarEvidence(s, system);
  if (!s.navFix || matches.length !== 1 || matches[0].label !== s.navFix || (!s.settings.freeRoam && !s.tutorial.active && !s.logs.includes('cache8'))) {
    return 'Review and confirm your location fix before jumping.';
  }
  if (clock.t >= lifeSupportEnd(s, system)) return 'Camp supplies have run out.';
  clock.paused = true;
  clock.stopAt = Infinity;
  clock.pauseAtStop = false;
  useGame.setState({ foldJump: { location: s.navFix, at: clock.t }, outcome: null, phase: 'fold' });
  clock.emit();
  sfx('launch');
  return null;
}
