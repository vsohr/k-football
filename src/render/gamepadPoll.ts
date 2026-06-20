import { applyGamepad, type GamepadSnapshot, type World } from '@/game';

/** The human always controls the home side (team 0). */
export function homeTeamInPossession(world: World): boolean {
  const owner = world.ball.owner;
  if (owner === null) {
    return false;
  }
  const carrier = world.players.find((player) => player.id === owner);
  return carrier?.team === 0;
}

/** Read the active standard-mapping gamepad into a plain, sim-friendly snapshot. */
export function readGamepadSnapshot(): GamepadSnapshot | null {
  if (typeof navigator === 'undefined' || typeof navigator.getGamepads !== 'function') {
    return null;
  }

  let chosen: Gamepad | null = null;
  for (const pad of navigator.getGamepads()) {
    if (pad === null) {
      continue;
    }
    if (pad.mapping === 'standard') {
      chosen = pad;
      break;
    }
    chosen ??= pad;
  }

  if (chosen === null) {
    return null;
  }

  return {
    axes: chosen.axes,
    buttons: chosen.buttons.map((button) => button.pressed),
  };
}

/**
 * Per-frame gamepad poll (presentation glue): reads the pad, unlocks audio on the first
 * button press, and maps it onto the sim's InputSource via the pure `applyGamepad`.
 * Returns the button snapshot to thread back in as `prevButtons` next frame.
 */
export function pollGamepad(
  world: World,
  prevButtons: boolean[],
  onActivate?: () => void,
): boolean[] {
  const snapshot = readGamepadSnapshot();
  if (snapshot === null) {
    return prevButtons;
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
