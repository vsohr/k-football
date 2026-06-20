export const MOVE = {
  accel: 45,
  maxSpeed: 8,
  sprintMaxSpeed: 11,
  friction: 30,
  turnRate: 12,
  sprintTurnRate: 7,
} as const;

export const BALL = {
  drag: 1.2,
  shotSpeed: 22,
  stopThreshold: 0.05,
} as const;

export const DRIBBLE = {
  distance: 0.9,
  pickupRadius: 0.9,
  shotCooldownTicks: 18,
} as const;
