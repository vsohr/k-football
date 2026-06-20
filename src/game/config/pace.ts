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

export const PASS = {
  arcDeg: 120,
  leadTime: 0.25,
  speed: 16,
  minSpeed: 9,
  cooldownTicks: 12,
} as const;

export const TACKLE = {
  range: 1.5,
  cleanRecoverTicks: 8,
  whiffRecoverTicks: 24,
  popSpeed: 5,
  popHitstop: 4,
} as const;

export const KEEPER = {
  reach: 2.2,
  reactionTicks: 6,
  diveSpeed: 15,
  trackSpeed: 7,
  lineInset: 1.2,
  recoverTicks: 22,
  distributeTicks: 24,
  catchSpeedMax: 14,
  zClamp: 4.5,
} as const;

export const MATCH = {
  halfLengthSec: 120,
  kickoffBeatSec: 0.75,
  celebrationSec: 2.5,
} as const;
