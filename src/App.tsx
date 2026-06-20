import { GameCanvas } from './render/GameCanvas';
import { Hud } from './ui/Hud';
import { Menu } from './ui/Menu';

export function App() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <GameCanvas />
      <Hud />
      <Menu />
    </div>
  );
}
