import { applyGamepad, setMove, setSprint, type GamepadSnapshot, type World } from '@/game';

// Shared empty snapshot returned when no pad is present (avoids per-frame allocation).
const NO_BUTTONS: boolean[] = [];

/** The human always controls the home side (team 0). */
export function homeTeamInPossession(world: World): boolean {
  const owner = world.ball.owner;
  if (owner === null) {
    return false;
  }
  const carrier = world.players.find((player) => player.id === owner);
  return carrier?.team === 0;
}

/**
 * Read the active W3C "standard"-mapping gamepad into a plain, sim-friendly snapshot.
 * Non-standard pads are ignored because the button/axis indices assume the standard
 * layout, and `getGamepads()` slots can be null/undefined (sparse array).
 */
export function readGamepadSnapshot(): GamepadSnapshot | null {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return null;
  }

  for (const pad of navigator.getGamepads()) {
    if (!pad || pad.mapping !== 'standard') {
      continue;
    }
    return {
      axes: pad.axes,
      buttons: pad.buttons.map((button) => button.pressed),
    };
  }

  return null;
}

/**
 * Per-frame gamepad poll (presentation glue): reads the pad, unlocks audio on the first
 * button press, and maps it onto the sim's InputSource via the pure `applyGamepad`.
 * Returns the button snapshot to thread back in as `prevButtons` next frame. When a pad
 * is connected it owns movement/sprint; on disconnect those are cleared once so input
 * does not stick (keyboard resumes on its next event).
 */
export function pollGamepad(
  world: World,
  prevButtons: boolean[],
  onActivate?: () => void,
): boolean[] {
  const snapshot = readGamepadSnapshot();
  if (snapshot === null) {
    if (prevButtons.length > 0) {
      setMove(world.input, 0, 0);
      setSprint(world.input, false);
    }
    return NO_BUTTONS;
  }

  if (onActivate !== undefined) {
    const pressedNow = snapshot.buttons.some((pressed, i) => pressed && prevButtons[i] !== true);
    if (pressedNow) {
      onActivate();
    }
  }

  return applyGamepad(world.input, snapshot, prevButtons, {
    inPossession: homeTeamInPossession(world),
  });
}
