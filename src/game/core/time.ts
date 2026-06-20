export interface TimeState {
  scale: number;
  hitstopRemaining: number;
  paused: boolean;
}

export function createTime(): TimeState {
  return {
    scale: 1,
    hitstopRemaining: 0,
    paused: false,
  };
}

export function requestHitstop(
  time: TimeState,
  frames: number,
  maxWindowSec = 0.2,
): void {
  time.hitstopRemaining = Math.min(
    maxWindowSec,
    time.hitstopRemaining + frames / 60,
  );
}
