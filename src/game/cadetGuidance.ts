import { activeMission, type Mission } from './missions';
import { useGame, type GameState } from './store';

/** Cadet expedition help is separate from Flight School and sandbox guidance. */
export const isCadetExpedition = (s: Pick<GameState, 'settings' | 'tutorial'>) =>
  s.settings.difficulty === 'cadet' && !s.tutorial.active && !s.settings.freeRoam;

export const cadetGuidanceEnabled = (s: Pick<GameState, 'settings' | 'tutorial'>) =>
  isCadetExpedition(s) && s.settings.cadetGuidance !== false;

/** Only explicit attempts with visible warnings count; elapsed time never does. */
export function noteCadetWarning() {
  const s = useGame.getState();
  const m = activeMission(s);
  if (!cadetGuidanceEnabled(s) || !m || m.screen !== s.screen || s.settings.challenges?.includes('noSanity')) return;
  const help = s.cadetHelp ?? { warnings: {}, offered: [] };
  if (help.offered.includes(m.id) || (help.warnings[m.id] ?? 0) >= 3) return;
  useGame.setState({ cadetHelp: { ...help, warnings: { ...help.warnings, [m.id]: (help.warnings[m.id] ?? 0) + 1 } } });
}

export function dismissCadetOffer(id: string) {
  const help = useGame.getState().cadetHelp ?? { warnings: {}, offered: [] };
  if (!help.offered.includes(id)) useGame.setState({ cadetHelp: { ...help, offered: [...help.offered, id] } });
}

/** Instructions use the player's observations; no hidden system values. */
export function walkthroughFor(m: Mission): string[] {
  if (m.id === 'gravity') return [
    'Set a string length, then move the red marker on the scale to read from the pivot to the bob’s centre. The knob setting is approximate.',
    'Use a small release angle. Release the bob, start the watch at one end, and count full swings: there and back. Time 10 or more if comfortable, then stop at the same end.',
    'Enter the number of full swings. Compare the result with your other readings and check any warnings. Repeat, keep at least three useful readings, then send their average and your error estimate to the sheet.',
  ];
  if (m.id === 'radius') return [
    'Choose a higher station on the hill. Walking and climbing take expedition time; the survey markers supply your height.',
    'Drag the view to align the horizon with the red crosshair. Zoom in, brace, and read the dip when the view is steady.',
    'Repeat and compare your readings. Check the height, alignment and air conditions before deciding which to keep. Send the average and your error estimate to the sheet.',
  ];
  if (m.id === 'mass') return [
    'Open g on the progress sheet. Use your gravity readings and state an uncertainty in the displayed units.',
    'Open R₁ and enter your measured radius with its uncertainty. Each instrument can also send its average directly.',
    'Inspect the mass and escape-speed nodes that become available. ECHO calculates these from your inputs; their uncertainties follow yours.',
  ];
  // Chapter-specific methods are authored in missionsFor, including inner,
  // locked, probe and giant scenarios. Keep those instructions authoritative.
  return [m.goal, 'Compare repeated observations and the information in the tool before committing your estimate. You can return to camp or explore another activity at any time.'];
}
