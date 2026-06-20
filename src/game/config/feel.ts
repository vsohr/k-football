export const FEEL = {
  shoot: {
    hitstopMinFrames: 3,
    hitstopMaxFrames: 7,
    traumaMin: 0.3,
    traumaMax: 0.6,
    sfx: 'shoot',
  },
} as const;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function lerp(from: number, to: number, t: number): number {
  return from + (to - from) * t;
}

export function shootHitstopFrames(power: number): number {
  return Math.round(
    lerp(
      FEEL.shoot.hitstopMinFrames,
      FEEL.shoot.hitstopMaxFrames,
      clamp01(power),
    ),
  );
}

export function shootTrauma(power: number): number {
  return lerp(FEEL.shoot.traumaMin, FEEL.shoot.traumaMax, clamp01(power));
}
