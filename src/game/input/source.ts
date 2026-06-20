import { SHOOT_BUFFER_TICKS } from '../config/controls';

export interface InputIntent {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  shoot: boolean;
  pass: boolean;
  tackle: boolean;
}

export interface InputSource {
  moveX: number;
  moveZ: number;
  sprint: boolean;
  shootBuf: number;
  passBuf: number;
  tackleBuf: number;
}

function clampUnit(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function decrementBuffer(value: number): number {
  return Math.max(0, value - 1);
}

export function createInputSource(): InputSource {
  return {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    shootBuf: 0,
    passBuf: 0,
    tackleBuf: 0,
  };
}

export function setMove(src: InputSource, x: number, z: number): void {
  src.moveX = clampUnit(x);
  src.moveZ = clampUnit(z);
}

export function setSprint(src: InputSource, on: boolean): void {
  src.sprint = on;
}

export function pressAction(src: InputSource, a: 'shoot' | 'pass' | 'tackle'): void {
  if (a === 'shoot') {
    src.shootBuf = SHOOT_BUFFER_TICKS;
  } else if (a === 'pass') {
    src.passBuf = SHOOT_BUFFER_TICKS;
  } else {
    src.tackleBuf = SHOOT_BUFFER_TICKS;
  }
}

export function sampleIntent(src: InputSource): InputIntent {
  const intent: InputIntent = {
    moveX: src.moveX,
    moveZ: src.moveZ,
    sprint: src.sprint,
    shoot: src.shootBuf > 0,
    pass: src.passBuf > 0,
    tackle: src.tackleBuf > 0,
  };

  src.shootBuf = decrementBuffer(src.shootBuf);
  src.passBuf = decrementBuffer(src.passBuf);
  src.tackleBuf = decrementBuffer(src.tackleBuf);

  return intent;
}

export function consumeAction(src: InputSource, a: 'shoot' | 'pass' | 'tackle'): void {
  if (a === 'shoot') {
    src.shootBuf = 0;
  } else if (a === 'pass') {
    src.passBuf = 0;
  } else {
    src.tackleBuf = 0;
  }
}
