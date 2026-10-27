import { useEffect } from 'react';
import { checkMissions } from '../game/sim';
import { ECHO } from '../game/echo';
import { modeOf } from '../game/modes';
import { useGame, type Screen } from '../game/store';
import { Echo } from './Echo';
import { Hub } from './Hub';
import { Hud } from './Hud';
import { MissionPanel } from './MissionPanel';
import { Pendulum } from './tools/Pendulum';
import { Hill } from './tools/Hill';
import { Observatory } from './tools/Observatory';
import { Rover } from './tools/Rover';
import { Sheet } from './sheet/Sheet';
import { Launch } from './launch/Launch';
import { Workshop } from './tools/Workshop';
import { Codex } from './Codex';
import { ActCard } from './ActCard';
import { ProbeBay } from './tools/ProbeBay';
import { SurfaceMap } from './tools/SurfaceMap';
import { Gnomon } from './tools/Gnomon';

const NAV: { screen: Screen; label: string; ico: string }[] = [
  { screen: 'hub', label: 'Camp', ico: '⛺' },
  { screen: 'observatory', label: 'Sky', ico: '🔭' },
  { screen: 'sheet', label: 'Sheet', ico: '✦' },
  { screen: 'launch', label: 'Launch', ico: '🚀' },
  { screen: 'codex', label: 'Codex', ico: '📜' },
];

export function Game() {
  const screen = useGame((s) => s.screen);
  const go = useGame((s) => s.go);
  const tutorial = useGame((s) => s.tutorial.active);

  useEffect(() => {
    const g = useGame.getState();
    g.say(modeOf(g.settings.difficulty).coaching ? ECHO.welcome : ECHO.welcomeQuiet);
    checkMissions();
  }, []);

  return (
    <div className="screen">
      {screen === 'hub' && <Hub />}
      {screen === 'pendulum' && <Pendulum />}
      {screen === 'hill' && <Hill />}
      {screen === 'observatory' && <Observatory />}
      {screen === 'rover' && <Rover />}
      {screen === 'sheet' && <Sheet />}
      {screen === 'launch' && <Launch />}
      {screen === 'workshop' && <Workshop />}
      {screen === 'codex' && <Codex />}
      {screen === 'probe' && <ProbeBay />}
      {screen === 'map' && <SurfaceMap />}
      {screen === 'gnomon' && <Gnomon />}
      <Hud />
      {screen === 'hub' && !tutorial && <MissionPanel />}
      <nav className="nav panel" data-tut="nav">
        {NAV.map((n) => (
          <button key={n.screen} data-tut={`nav-${n.label.toLowerCase()}`} className={`btn ghost ${screen === n.screen ? 'active' : ''}`} onClick={() => go(n.screen)}>
            <span className="ico">{n.ico}</span>
            {n.label}
          </button>
        ))}
      </nav>
      {!tutorial && <Echo />}
      <ActCard />
    </div>
  );
}
