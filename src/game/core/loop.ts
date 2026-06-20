import type { TimeState } from './time';

export interface LoopOptions {
  time: TimeState;
  simulate: (dt: number) => void;
  onRealTime?: (dt: number) => void;
  step?: number;
  maxSteps?: number;
  maxDt?: number;
}

export interface LoopResult {
  steps: number;
  alpha: number;
}

export interface Loop {
  advance(realDt: number): LoopResult;
  readonly accumulator: number;
}

const DEFAULT_STEP = 1 / 60;
const DEFAULT_MAX_STEPS = 5;
const DEFAULT_MAX_DT = 0.25;

export function createLoop(opts: LoopOptions): Loop {
  const step = opts.step ?? DEFAULT_STEP;
  const maxSteps = opts.maxSteps ?? DEFAULT_MAX_STEPS;
  const maxDt = opts.maxDt ?? DEFAULT_MAX_DT;
  let accumulator = 0;

  return {
    get accumulator(): number {
      return accumulator;
    },

    advance(realDt: number): LoopResult {
      const dt = Math.min(realDt, maxDt);

      opts.onRealTime?.(dt);

      if (opts.time.hitstopRemaining > 0) {
        opts.time.hitstopRemaining = Math.max(
          0,
          opts.time.hitstopRemaining - dt,
        );
      } else if (!opts.time.paused) {
        accumulator += dt * opts.time.scale;
      }

      let steps = 0;
      while (accumulator >= step && steps < maxSteps && opts.time.hitstopRemaining <= 0) {
        opts.simulate(step);
        accumulator -= step;
        steps += 1;
      }

      if (accumulator >= step) {
        accumulator %= step;
      }

      return {
        steps,
        alpha: accumulator / step,
      };
    },
  };
}
