import { SHOOT_BUFFER_TICKS } from '../config/controls';
import { applyGamepad, STICK_DEADZONE, XBOX_BUTTON } from './gamepad';
import { createInputSource } from './source';

describe('gamepad input mapping', () => {
  it('maps B rising edge to shoot', () => {
    const input = createInputSource();

    applyGamepad(input, { axes: [], buttons: [false, true] }, [], { inPossession: true });

    expect(input.shootBuf).toBe(SHOOT_BUFFER_TICKS);
  });

  it('maps A rising edge to pass while in possession', () => {
    const input = createInputSource();

    applyGamepad(input, { axes: [], buttons: [true] }, [], { inPossession: true });

    expect(input.passBuf).toBe(SHOOT_BUFFER_TICKS);
    expect(input.tackleBuf).toBe(0);
  });

  it('maps A rising edge to tackle while out of possession', () => {
    const input = createInputSource();

    applyGamepad(input, { axes: [], buttons: [true] }, [], { inPossession: false });

    expect(input.tackleBuf).toBe(SHOOT_BUFFER_TICKS);
    expect(input.passBuf).toBe(0);
  });

  it('maps Y rising edge to switch only while out of possession', () => {
    const input = createInputSource();
    const buttons = [false, false, false, true];

    applyGamepad(input, { axes: [], buttons }, [], { inPossession: true });
    expect(input.switchBuf).toBe(0);

    applyGamepad(input, { axes: [], buttons }, [], { inPossession: false });
    expect(input.switchBuf).toBe(SHOOT_BUFFER_TICKS);
  });

  it('does not fire actions when the same button stays held', () => {
    const input = createInputSource();
    const buttons = [true, true, false, true];

    const prev = applyGamepad(input, { axes: [], buttons }, [], { inPossession: false });
    input.shootBuf = 0;
    input.tackleBuf = 0;
    input.switchBuf = 0;

    applyGamepad(input, { axes: [], buttons }, prev, { inPossession: false });

    expect(input.shootBuf).toBe(0);
    expect(input.tackleBuf).toBe(0);
    expect(input.switchBuf).toBe(0);
  });

  it('maps left stick movement outside the radial dead-zone', () => {
    const input = createInputSource();

    applyGamepad(input, { axes: [0.4, -0.5], buttons: [] }, [], { inPossession: true });

    expect(input.moveX).toBeCloseTo(0.4);
    expect(input.moveZ).toBeCloseTo(-0.5);
  });

  it('zeroes left stick movement inside the radial dead-zone', () => {
    const input = createInputSource();

    applyGamepad(input, { axes: [STICK_DEADZONE / 2, STICK_DEADZONE / 2], buttons: [] }, [], {
      inPossession: true,
    });

    expect(input.moveX).toBe(0);
    expect(input.moveZ).toBe(0);
  });

  it('adds d-pad movement contributions', () => {
    const input = createInputSource();
    const buttons = Array.from({ length: XBOX_BUTTON.dpadRight + 1 }, () => false);
    buttons[XBOX_BUTTON.dpadUp] = true;
    buttons[XBOX_BUTTON.dpadRight] = true;

    applyGamepad(input, { axes: [], buttons }, [], { inPossession: true });

    expect(input.moveX).toBe(1);
    expect(input.moveZ).toBe(-1);
  });

  it('sets sprint from RB held state', () => {
    const input = createInputSource();
    const buttons = Array.from({ length: XBOX_BUTTON.rb + 1 }, () => false);
    buttons[XBOX_BUTTON.rb] = true;

    applyGamepad(input, { axes: [], buttons }, [], { inPossession: true });

    expect(input.sprint).toBe(true);
  });

  it('returns the current frame buttons for next-frame edge detection', () => {
    const input = createInputSource();
    const buttons = [true, false, true];

    const prev = applyGamepad(input, { axes: [], buttons }, [false], { inPossession: true });

    expect(prev).toEqual(buttons);
    expect(prev).not.toBe(buttons);
  });
});
