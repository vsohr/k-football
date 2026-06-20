import { PITCH, PLAYER_RADIUS } from '../../config/dimensions';
import { MOVE } from '../../config/pace';
import type { Player, Vec3, World } from '../world';

const ARRIVAL_RADIUS = 2;
const ANCHOR_STOP_RADIUS = 0.15;

function copyVec3(target: Vec3, source: Vec3): void {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
}

function normalizeAngle(angle: number): number {
  let normalized = angle;

  while (normalized <= -Math.PI) {
    normalized += Math.PI * 2;
  }

  while (normalized > Math.PI) {
    normalized -= Math.PI * 2;
  }

  return normalized;
}

function slewAngle(current: number, target: number, maxStep: number): number {
  const delta = normalizeAngle(target - current);

  if (Math.abs(delta) <= maxStep) {
    return normalizeAngle(target);
  }

  return normalizeAngle(current + Math.sign(delta) * maxStep);
}

function capHorizontalSpeed(velocity: Vec3, maxSpeed: number): void {
  const speed = Math.hypot(velocity.x, velocity.z);

  if (speed > maxSpeed && speed > 0) {
    const scale = maxSpeed / speed;
    velocity.x *= scale;
    velocity.z *= scale;
  }
}

function moveVelocityToward(velocity: Vec3, targetX: number, targetZ: number, maxDelta: number): void {
  const deltaX = targetX - velocity.x;
  const deltaZ = targetZ - velocity.z;
  const deltaSpeed = Math.hypot(deltaX, deltaZ);

  if (deltaSpeed <= maxDelta || deltaSpeed === 0) {
    velocity.x = targetX;
    velocity.z = targetZ;
    return;
  }

  const scale = maxDelta / deltaSpeed;
  velocity.x += deltaX * scale;
  velocity.z += deltaZ * scale;
}

function applyFriction(velocity: Vec3, decel: number): void {
  const speed = Math.hypot(velocity.x, velocity.z);

  if (speed <= decel || speed === 0) {
    velocity.x = 0;
    velocity.z = 0;
    return;
  }

  const scale = (speed - decel) / speed;
  velocity.x *= scale;
  velocity.z *= scale;
}

function clampPlayerToPitch(pos: Vec3, vel: Vec3): void {
  const minX = -PITCH.halfX + PLAYER_RADIUS;
  const maxX = PITCH.halfX - PLAYER_RADIUS;
  const minZ = -PITCH.halfZ + PLAYER_RADIUS;
  const maxZ = PITCH.halfZ - PLAYER_RADIUS;

  if (pos.x < minX) {
    pos.x = minX;
    vel.x = 0;
  } else if (pos.x > maxX) {
    pos.x = maxX;
    vel.x = 0;
  }

  if (pos.z < minZ) {
    pos.z = minZ;
    vel.z = 0;
  } else if (pos.z > maxZ) {
    pos.z = maxZ;
    vel.z = 0;
  }
}

export function movementSystem(world: World, dt: number): void {
  for (const player of world.players) {
    copyVec3(player.prevPos, player.pos);
    player.prevFacing = player.facing;

    if (player.id === world.controlledId) {
      movePlayer(player, world.intent.moveX, world.intent.moveZ, world.intent.sprint, dt);
    } else {
      moveAiPlayer(player, dt);
    }
  }
}

function movePlayer(
  player: Player,
  inputX: number,
  inputZ: number,
  sprint: boolean,
  dt: number,
): void {
  let dirX = inputX;
  let dirZ = inputZ;
  const dirLen = Math.hypot(dirX, dirZ);

  if (dirLen > 1) {
    dirX /= dirLen;
    dirZ /= dirLen;
  }

  if (dirLen > 0) {
    const maxSpeed = sprint ? MOVE.sprintMaxSpeed : MOVE.maxSpeed;
    moveVelocityToward(player.vel, dirX * maxSpeed, dirZ * maxSpeed, MOVE.accel * dt);
    capHorizontalSpeed(player.vel, maxSpeed);
    player.facing = slewAngle(
      player.facing,
      Math.atan2(dirX, dirZ),
      (sprint ? MOVE.sprintTurnRate : MOVE.turnRate) * dt,
    );
  } else {
    applyFriction(player.vel, MOVE.friction * dt);
  }

  player.pos.x += player.vel.x * dt;
  player.pos.y = 0;
  player.pos.z += player.vel.z * dt;
  player.vel.y = 0;
  clampPlayerToPitch(player.pos, player.vel);
}

function moveAiPlayer(player: Player, dt: number): void {
  const toAnchorX = player.anchor.x - player.pos.x;
  const toAnchorZ = player.anchor.z - player.pos.z;
  const distance = Math.hypot(toAnchorX, toAnchorZ);

  if (distance <= ANCHOR_STOP_RADIUS) {
    movePlayer(player, 0, 0, false, dt);
    snapIfSettled(player);
    return;
  }

  const arrivalScale = Math.min(1, distance / ARRIVAL_RADIUS);
  const dirX = (toAnchorX / distance) * arrivalScale;
  const dirZ = (toAnchorZ / distance) * arrivalScale;

  movePlayer(player, dirX, dirZ, false, dt);
  snapIfOvershotAnchor(player, toAnchorX, toAnchorZ, distance);
}

function snapIfSettled(player: Player): void {
  const distance = Math.hypot(player.anchor.x - player.pos.x, player.anchor.z - player.pos.z);

  if (distance <= ANCHOR_STOP_RADIUS && Math.hypot(player.vel.x, player.vel.z) === 0) {
    copyVec3(player.pos, player.anchor);
    player.vel.x = 0;
    player.vel.z = 0;
  }
}

function snapIfOvershotAnchor(
  player: Player,
  previousToAnchorX: number,
  previousToAnchorZ: number,
  previousDistance: number,
): void {
  const nextToAnchorX = player.anchor.x - player.pos.x;
  const nextToAnchorZ = player.anchor.z - player.pos.z;
  const crossedAnchor =
    previousToAnchorX * nextToAnchorX + previousToAnchorZ * nextToAnchorZ <= 0;

  if (crossedAnchor && previousDistance <= ARRIVAL_RADIUS) {
    copyVec3(player.pos, player.anchor);
    player.vel.x = 0;
    player.vel.z = 0;
  }
}
