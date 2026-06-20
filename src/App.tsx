import { GameCanvas } from './render/GameCanvas';

export function App() {
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <GameCanvas />
    </div>
  );
}
