export const SHOOT_BUFFER_TICKS = 6;

export const BINDINGS: Record<
  string,
  'up' | 'down' | 'left' | 'right' | 'shoot' | 'pass' | 'tackle' | 'sprint'
> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  KeyJ: 'shoot',
  Space: 'shoot',
  KeyK: 'pass',
  ShiftLeft: 'sprint',
  ShiftRight: 'sprint',
};
