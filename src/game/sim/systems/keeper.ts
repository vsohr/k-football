import { GOAL, PITCH, PLAYER_RADIUS } from '../../config/dimensions';
import { BALL, KEEPER, PASS } from '../../config/pace';
import type { Player, Vec3, World } from '../world';

const SHOT_SPEED_THRESHOLD = PASS.minSpeed * 0.5;
const SAVE_COOLDOWN_TICKS = 8;
const RECOVER_TRACK_SPEED_SCALE = 0.45;

interface IncomingShot {
  predictedZ: number;
  speed: number;
}

function copyVec3(target: Vec3, source: Vec3): void {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function horizontalSpeed(vec: Vec3): number {
  return Math.hypot(vec.x, vec.z);
}

function defendedGoalX(player: Player): number {
  return player.team === 0 ? -PITCH.halfX : PITCH.halfX;
}

function towardGoalSign(player: Player): -1 | 1 {
  return player.team === 0 ? -1 : 1;
}

function awayFromGoalSign(player: Player): -1 | 1 {
  return player.team === 0 ? 1 : -1;
}

function keeperLineX(player: Player): number {
  return defendedGoalX(player) - towardGoalSign(player) * KEEPER.lineInset;
}

function isOnDefendingHalf(player: Player, x: number): boolean {
  return player.team === 0 ? x <= 0 : x >= 0;
}

function detectIncomingShot(world: World, keeper: Player): IncomingShot | undefined {
  const { ball } = world;

  if (ball.owner !== null || !isOnDefendingHalf(keeper, ball.pos.x)) {
    return undefined;
  }

  const speed = horizontalSpeed(ball.vel);
  const goalSign = towardGoalSign(keeper);

  if (speed <= SHOT_SPEED_THRESHOLD || ball.vel.x * goalSign <= 0) {
    return undefined;
  }

  const timeToLine = (keeperLineX(keeper) - ball.pos.x) / ball.vel.x;

  if (timeToLine <= 0) {
    return undefined;
  }

  return {
    predictedZ: ball.pos.z + ball.vel.z * timeToLine,
    speed,
  };
}

function faceBall(keeper: Player, ballPos: Vec3): void {
  keeper.facing = Math.atan2(ballPos.x - keeper.pos.x, ballPos.z - keeper.pos.z);
}

function moveToward(keeper: Player, targetX: number, targetZ: number, speed: number, dt: number): void {
  const dx = targetX - keeper.pos.x;
  const dz = targetZ - keeper.pos.z;
  const distance = Math.hypot(dx, dz);
  const maxStep = speed * dt;

  if (distance === 0) {
    keeper.vel.x = 0;
    keeper.vel.y = 0;
    keeper.vel.z = 0;
    return;
  }

  if (distance <= maxStep) {
    keeper.vel.x = dx / dt;
    keeper.vel.y = 0;
    keeper.vel.z = dz / dt;
    keeper.pos.x = targetX;
    keeper.pos.y = 0;
    keeper.pos.z = targetZ;
    return;
  }

  const stepScale = maxStep / distance;
  keeper.vel.x = (dx / distance) * speed;
  keeper.vel.y = 0;
  keeper.vel.z = (dz / distance) * speed;
  keeper.pos.x += dx * stepScale;
  keeper.pos.y = 0;
  keeper.pos.z += dz * stepScale;
}

function clampKeeperToPitch(keeper: Player): void {
  keeper.pos.x = clamp(keeper.pos.x, -PITCH.halfX + PLAYER_RADIUS, PITCH.halfX - PLAYER_RADIUS);
  keeper.pos.y = 0;
  keeper.pos.z = clamp(keeper.pos.z, -KEEPER.zClamp, KEEPER.zClamp);
  keeper.vel.y = 0;
}

function setDiveVelocity(keeper: Player, targetZ: number): void {
  const dx = keeperLineX(keeper) - keeper.pos.x;
  const dz = targetZ - keeper.pos.z;
  const distance = Math.hypot(dx, dz);

  if (distance === 0) {
    keeper.vel.x = 0;
    keeper.vel.y = 0;
    keeper.vel.z = 0;
    return;
  }

  keeper.vel.x = (dx / distance) * KEEPER.diveSpeed;
  keeper.vel.y = 0;
  keeper.vel.z = (dz / distance) * KEEPER.diveSpeed;
}

function enterCommit(keeper: Player, predictedZ: number): void {
  keeper.keeperState = 'COMMIT';
  keeper.keeperTimer = 0;
  setDiveVelocity(keeper, clamp(predictedZ, -KEEPER.zClamp, KEEPER.zClamp));
}

function integrateDive(keeper: Player, dt: number): void {
  const speed = horizontalSpeed(keeper.vel);

  if (speed > KEEPER.diveSpeed && speed > 0) {
    const scale = KEEPER.diveSpeed / speed;
    keeper.vel.x *= scale;
    keeper.vel.z *= scale;
  }

  keeper.pos.x += keeper.vel.x * dt;
  keeper.pos.y = 0;
  keeper.pos.z += keeper.vel.z * dt;
  clampKeeperToPitch(keeper);
}

function nearestTeammate(world: World, keeper: Player): Player | undefined {
  let nearest: Player | undefined;
  let nearestDistance = Infinity;

  for (const player of world.players) {
    if (player.team !== keeper.team || player.id === keeper.id) {
      continue;
    }

    const distance = Math.hypot(player.pos.x - keeper.pos.x, player.pos.z - keeper.pos.z);

    if (distance < nearestDistance) {
      nearest = player;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function distribute(world: World, keeper: Player): void {
  const target = nearestTeammate(world, keeper);

  if (target === undefined) {
    return;
  }

  const dx = target.pos.x - keeper.pos.x;
  const dz = target.pos.z - keeper.pos.z;
  const distance = Math.hypot(dx, dz);

  if (distance === 0) {
    return;
  }

  world.ball.owner = null;
  world.ball.pendingImpulse = null;
  world.ball.vel.x = (dx / distance) * PASS.speed;
  world.ball.vel.y = 0;
  world.ball.vel.z = (dz / distance) * PASS.speed;
  world.ball.cooldown = SAVE_COOLDOWN_TICKS;
  keeper.keeperState = 'SET';
  keeper.keeperTimer = 0;
  keeper.holdTimer = 0;
}

function handleKeeperPossession(world: World, keeper: Player): boolean {
  if (world.ball.owner !== keeper.id) {
    return false;
  }

  if (keeper.holdTimer > 0) {
    keeper.holdTimer -= 1;
    return true;
  }

  distribute(world, keeper);
  return true;
}

function isNearLineRegion(world: World, keeper: Player): boolean {
  const lineX = keeperLineX(keeper);
  const goalX = defendedGoalX(keeper);
  const minX = Math.min(lineX, goalX) - KEEPER.reach;
  const maxX = Math.max(lineX, goalX) + KEEPER.reach;

  return world.ball.pos.x >= minX && world.ball.pos.x <= maxX;
}

function isHardAngle(world: World): boolean {
  const speed = horizontalSpeed(world.ball.vel);

  if (speed === 0) {
    return false;
  }

  const lateralShare = Math.abs(world.ball.vel.z) / speed;
  return lateralShare > 0.45 || Math.abs(world.ball.pos.z) > GOAL.halfWidth * 0.85;
}

function catchBall(world: World, keeper: Player): void {
  world.ball.owner = keeper.id;
  world.ball.pendingImpulse = null;
  world.ball.vel.x = 0;
  world.ball.vel.y = 0;
  world.ball.vel.z = 0;
  world.ball.cooldown = 0;
  keeper.keeperState = 'SET';
  keeper.keeperTimer = 0;
  keeper.holdTimer = KEEPER.distributeTicks;
}

function parryBall(world: World, keeper: Player): void {
  const speed = horizontalSpeed(world.ball.vel);
  const awayX = awayFromGoalSign(keeper);
  const deflectZ = clamp(world.ball.vel.z / Math.max(speed, 1) + world.rng.range(-0.35, 0.35), -0.75, 0.75);
  const length = Math.hypot(awayX, deflectZ);
  const parrySpeed = Math.max(PASS.minSpeed, Math.min(BALL.shotSpeed, speed) * 0.65);

  world.ball.owner = null;
  world.ball.pendingImpulse = null;
  world.ball.vel.x = (awayX / length) * parrySpeed;
  world.ball.vel.y = 0;
  world.ball.vel.z = (deflectZ / length) * parrySpeed;
  world.ball.cooldown = SAVE_COOLDOWN_TICKS;
}

function resolveSave(world: World, keeper: Player, incoming: IncomingShot | undefined): boolean {
  if (world.ball.owner !== null || !isNearLineRegion(world, keeper)) {
    return false;
  }

  if (keeper.keeperState === 'SET' && keeper.keeperTimer > 0 && incoming !== undefined) {
    return false;
  }

  const distance = Math.hypot(world.ball.pos.x - keeper.pos.x, world.ball.pos.z - keeper.pos.z);

  if (distance > KEEPER.reach) {
    return false;
  }

  world.events.push({
    type: 'save',
    tick: world.tick,
    at: { ...world.ball.pos },
  });

  const canCatch = incoming !== undefined && incoming.speed <= KEEPER.catchSpeedMax && !isHardAngle(world);

  if (canCatch) {
    catchBall(world, keeper);
  } else {
    parryBall(world, keeper);

    if (keeper.keeperState === 'COMMIT') {
      keeper.keeperState = 'RECOVER';
      keeper.keeperTimer = KEEPER.recoverTicks;
    }
  }

  return true;
}

function updateSetKeeper(world: World, keeper: Player, incoming: IncomingShot | undefined, dt: number): void {
  if (incoming === undefined) {
    keeper.keeperTimer = 0;
  } else if (keeper.keeperTimer === 0) {
    keeper.keeperTimer = KEEPER.reactionTicks;
  } else {
    keeper.keeperTimer = Math.max(0, keeper.keeperTimer - 1);

    if (keeper.keeperTimer === 0) {
      enterCommit(keeper, incoming.predictedZ);
    }
  }

  if (keeper.keeperState === 'SET') {
    moveToward(
      keeper,
      keeperLineX(keeper),
      clamp(world.ball.pos.z, -KEEPER.zClamp, KEEPER.zClamp),
      KEEPER.trackSpeed,
      dt,
    );
  }
}

function updateRecoverKeeper(keeper: Player, dt: number): void {
  keeper.keeperTimer = Math.max(0, keeper.keeperTimer - 1);

  if (keeper.keeperTimer === 0) {
    keeper.keeperState = 'SET';
  }

  moveToward(
    keeper,
    keeperLineX(keeper),
    0,
    KEEPER.trackSpeed * RECOVER_TRACK_SPEED_SCALE,
    dt,
  );
}

function updateKeeper(world: World, keeper: Player, dt: number): void {
  copyVec3(keeper.prevPos, keeper.pos);
  keeper.prevFacing = keeper.facing;

  if (handleKeeperPossession(world, keeper)) {
    faceBall(keeper, world.ball.pos);
    return;
  }

  const incoming = detectIncomingShot(world, keeper);

  if (keeper.keeperState === 'RECOVER') {
    updateRecoverKeeper(keeper, dt);
  } else if (keeper.keeperState === 'SET') {
    updateSetKeeper(world, keeper, incoming, dt);
  }

  if (keeper.keeperState === 'COMMIT') {
    integrateDive(keeper, dt);
  }

  clampKeeperToPitch(keeper);
  faceBall(keeper, world.ball.pos);

  const saved = resolveSave(world, keeper, incoming);

  if (!saved && keeper.keeperState === 'COMMIT' && incoming === undefined) {
    keeper.keeperState = 'RECOVER';
    keeper.keeperTimer = KEEPER.recoverTicks;
  }
}

export function keeperSystem(world: World, dt: number): void {
  for (const player of world.players) {
    if (player.role === 'GK') {
      updateKeeper(world, player, dt);
    }
  }
}
