import { BALL_RADIUS, PITCH } from '../../config/dimensions';
import { BALL, DRIBBLE } from '../../config/pace';
import type { Player, Vec3, World } from '../world';

function copyVec3(target: Vec3, source: Vec3): void {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
}

function findPlayer(world: World, id: number): Player | undefined {
  return world.players.find((player) => player.id === id);
}

function horizontalDistance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function reduceHorizontalSpeed(velocity: Vec3, maxDelta: number): void {
  const speed = Math.hypot(velocity.x, velocity.z);

  if (speed === 0) {
    return;
  }

  if (speed < BALL.stopThreshold || speed <= maxDelta) {
    velocity.x = 0;
    velocity.z = 0;
    return;
  }

  const nextSpeed = speed - maxDelta;
  const scale = nextSpeed / speed;
  velocity.x *= scale;
  velocity.z *= scale;

  if (nextSpeed < BALL.stopThreshold) {
    velocity.x = 0;
    velocity.z = 0;
  }
}

function pickupBall(world: World): void {
  const { ball } = world;
  const controlled = findPlayer(world, world.controlledId);

  if (
    controlled !== undefined &&
    horizontalDistance(controlled.pos, ball.pos) <= DRIBBLE.pickupRadius
  ) {
    ball.owner = controlled.id;
    return;
  }

  let nearest: Player | undefined;
  let nearestDistance = Infinity;

  for (const player of world.players) {
    const distance = horizontalDistance(player.pos, ball.pos);
    if (distance <= DRIBBLE.pickupRadius && distance < nearestDistance) {
      nearest = player;
      nearestDistance = distance;
    }
  }

  if (nearest !== undefined) {
    ball.owner = nearest.id;
  }
}

export function ballSystem(world: World, dt: number): void {
  const { ball } = world;
  const minX = -PITCH.halfX + BALL_RADIUS;
  const maxX = PITCH.halfX - BALL_RADIUS;
  const minZ = -PITCH.halfZ + BALL_RADIUS;
  const maxZ = PITCH.halfZ - BALL_RADIUS;

  ball.prevPos.x = ball.pos.x;
  ball.prevPos.y = ball.pos.y;
  ball.prevPos.z = ball.pos.z;

  if (ball.owner !== null) {
    const owner = findPlayer(world, ball.owner);

    if (owner !== undefined) {
      const facingX = Math.sin(owner.facing);
      const facingZ = Math.cos(owner.facing);
      ball.pos.x = owner.pos.x + facingX * DRIBBLE.distance;
      ball.pos.y = 0;
      ball.pos.z = owner.pos.z + facingZ * DRIBBLE.distance;
      copyVec3(ball.vel, owner.vel);
      return;
    }

    ball.owner = null;
  }

  if (ball.pendingImpulse !== null) {
    copyVec3(ball.vel, ball.pendingImpulse);
    ball.pendingImpulse = null;
  }

  ball.pos.x += ball.vel.x * dt;
  ball.pos.y = 0;
  ball.pos.z += ball.vel.z * dt;
  ball.vel.y = 0;
  reduceHorizontalSpeed(ball.vel, BALL.drag * dt);

  if (ball.pos.x < minX) {
    ball.pos.x = minX;
    ball.vel.x = -ball.vel.x;
  } else if (ball.pos.x > maxX) {
    ball.pos.x = maxX;
    ball.vel.x = -ball.vel.x;
  }

  if (ball.pos.z < minZ) {
    ball.pos.z = minZ;
    ball.vel.z = -ball.vel.z;
  } else if (ball.pos.z > maxZ) {
    ball.pos.z = maxZ;
    ball.vel.z = -ball.vel.z;
  }

  ball.cooldown = Math.max(0, ball.cooldown - 1);
  if (ball.cooldown === 0 && ball.owner === null) {
    pickupBall(world);
  }
}
