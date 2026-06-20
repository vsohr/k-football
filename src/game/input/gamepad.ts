import {
  pressAction,
  setMove,
  setSprint,
  type InputSource,
} from './source';

export interface GamepadSnapshot {
  axes: readonly number[];
  /** pressed state per button index (already extracted from GamepadButton.pressed) */
  buttons: readonly boolean[];
}

export interface GamepadApplyContext {
  /** true when the human team (team 0) currently owns the ball */
  inPossession: boolean;
}

export const XBOX_BUTTON = {
  a: 0,
  b: 1,
  x: 2,
  y: 3,
  lb: 4,
  rb: 5,
  lt: 6,
  rt: 7,
  back: 8,
  start: 9,
  l3: 10,
  r3: 11,
  dpadUp: 12,
  dpadDown: 13,
  dpadLeft: 14,
  dpadRight: 15,
} as const;

export const XBOX_AXIS = {
  leftX: 0,
  leftY: 1,
  rightX: 2,
  rightY: 3,
} as const;

export const STICK_DEADZONE = 0.18;

function pressed(buttons: readonly boolean[], index: number): boolean {
  return buttons[index] === true;
}

function edge(buttons: readonly boolean[], prevButtons: readonly boolean[], index: number): boolean {
  return pressed(buttons, index) && prevButtons[index] !== true;
}

function axis(axes: readonly number[], index: number): number {
  return axes[index] ?? 0;
}

function deadZone(valueX: number, valueZ: number): { x: number; z: number } {
  return Math.hypot(valueX, valueZ) < STICK_DEADZONE
    ? { x: 0, z: 0 }
    : { x: valueX, z: valueZ };
}

function dpadAxis(buttons: readonly boolean[]): { x: number; z: number } {
  return {
    x: Number(pressed(buttons, XBOX_BUTTON.dpadRight)) - Number(pressed(buttons, XBOX_BUTTON.dpadLeft)),
    z: Number(pressed(buttons, XBOX_BUTTON.dpadDown)) - Number(pressed(buttons, XBOX_BUTTON.dpadUp)),
  };
}

function applyMovement(input: InputSource, snapshot: GamepadSnapshot): void {
  const stick = deadZone(axis(snapshot.axes, XBOX_AXIS.leftX), axis(snapshot.axes, XBOX_AXIS.leftY));
  const dpad = dpadAxis(snapshot.buttons);

  setMove(input, stick.x + dpad.x, stick.z + dpad.z);
}

function applyActions(
  input: InputSource,
  buttons: readonly boolean[],
  prevButtons: readonly boolean[],
  ctx: GamepadApplyContext,
): void {
  if (edge(buttons, prevButtons, XBOX_BUTTON.b)) {
    pressAction(input, 'shoot');
  }

  if (edge(buttons, prevButtons, XBOX_BUTTON.a)) {
    pressAction(input, ctx.inPossession ? 'pass' : 'tackle');
  }

  if (!ctx.inPossession && edge(buttons, prevButtons, XBOX_BUTTON.y)) {
    pressAction(input, 'switch');
  }
}

export function applyGamepad(
  input: InputSource,
  snapshot: GamepadSnapshot,
  prevButtons: readonly boolean[],
  ctx: GamepadApplyContext,
): boolean[] {
  applyMovement(input, snapshot);
  setSprint(input, pressed(snapshot.buttons, XBOX_BUTTON.rb));
  applyActions(input, snapshot.buttons, prevButtons, ctx);

  return [...snapshot.buttons];
}
