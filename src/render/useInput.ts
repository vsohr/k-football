import { useEffect } from 'react';
import { BINDINGS, pressAction, setMove, setSprint, type InputSource } from '@/game';

type Dir = 'up' | 'down' | 'left' | 'right';

/**
 * DOM keyboard → InputSource. Held arrows/WASD become analog move axes; shoot/pass/
 * tackle are buffered edges; sprint is held. Clears all held state on window blur so
 * an alt-tab mid-sprint can't leave a key stuck (tech §16).
 */
export function usePlayerInput(input: InputSource): void {
  useEffect(() => {
    const held = new Set<Dir>();

    const applyAxes = (): void => {
      setMove(
        input,
        (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0),
        // screen-away (W/up) is -Z under our tilted camera; toward camera (S/down) is +Z.
        (held.has('down') ? 1 : 0) - (held.has('up') ? 1 : 0),
      );
    };

    const onDown = (e: KeyboardEvent): void => {
      const b = BINDINGS[e.code];
      if (!b) return;
      if (b === 'up' || b === 'down' || b === 'left' || b === 'right') {
        if (!e.repeat) {
          held.add(b);
          applyAxes();
        }
      } else if (b === 'sprint') {
        setSprint(input, true);
      } else if (!e.repeat) {
        pressAction(input, b);
      }
      if (b === 'shoot' || b === 'pass') e.preventDefault();
    };

    const onUp = (e: KeyboardEvent): void => {
      const b = BINDINGS[e.code];
      if (!b) return;
      if (b === 'up' || b === 'down' || b === 'left' || b === 'right') {
        held.delete(b);
        applyAxes();
      } else if (b === 'sprint') {
        setSprint(input, false);
      }
    };

    const clear = (): void => {
      held.clear();
      setMove(input, 0, 0);
      setSprint(input, false);
    };

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', clear);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', clear);
    };
  }, [input]);
}
