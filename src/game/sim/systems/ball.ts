import { BALL_RADIUS, GOAL, PITCH } from '../../config/dimensions';
import { BALL, DRIBBLE } from '../../config/pace';
import type { Player, Vec3, World } from '../world';

function copyVec3(target: Vec3, source: Vec3): void {
  target.x = source.x;
  target.y = source.y;
  target.z = source.z;
}

function setVec3(target: Vec3, x: number, y: number, z: number): void {
  target.x = x;
  target.y = y;
  target.z = z;
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

interface SweptHit {
  t: number;
  normalX: number;
  normalZ: number;
  x: number;
  z: number;
  kind: 'board' | 'post';
}

function resolveSweptPitchCollision(world: World, start: Vec3, target: Vec3): void {
  const hit = findEarliestHit(start, target);

  if (hit === undefined) {
    setVec3(world.ball.pos, target.x, 0, target.z);
    return;
  }

  const push = hit.kind === 'post' ? 0.0001 : 0;
  setVec3(
    world.ball.pos,
    hit.x + hit.normalX * push,
    0,
    hit.z + hit.normalZ * push,
  );
  reflectHorizontalVelocity(world.ball.vel, hit.normalX, hit.normalZ);

  if (hit.kind === 'post') {
    world.events.push({
      type: 'post',
      tick: world.tick,
      at: { ...world.ball.pos },
    });
  }
}

function findEarliestHit(start: Vec3, target: Vec3): SweptHit | undefined {
  const dx = target.x - start.x;
  const dz = target.z - start.z;
  let best: SweptHit | undefined;

  best = chooseEarlier(best, sideBoardHit(start, dx, dz, PITCH.halfZ - BALL_RADIUS, -1));
  best = chooseEarlier(best, sideBoardHit(start, dx, dz, -PITCH.halfZ + BALL_RADIUS, 1));
  best = chooseEarlier(best, endBoardHit(start, dx, dz, PITCH.halfX - BALL_RADIUS, -1));
  best = chooseEarlier(best, endBoardHit(start, dx, dz, -PITCH.halfX + BALL_RADIUS, 1));

  for (const postX of [-PITCH.halfX, PITCH.halfX] as const) {
    for (const postZ of [-GOAL.halfWidth, GOAL.halfWidth] as const) {
      best = chooseEarlier(best, postHit(start, dx, dz, postX, postZ));
    }
  }

  return best;
}

function chooseEarlier(current: SweptHit | undefined, candidate: SweptHit | undefined): SweptHit | undefined {
  if (candidate === undefined) {
    return current;
  }

  if (current === undefined || candidate.t < current.t) {
    return candidate;
  }

  return current;
}

function sideBoardHit(
  start: Vec3,
  dx: number,
  dz: number,
  boardZ: number,
  normalZ: number,
): SweptHit | undefined {
  if (dz === 0) {
    return undefined;
  }

  const movingTowardBoard = normalZ < 0 ? dz > 0 : dz < 0;

  if (!movingTowardBoard) {
    return undefined;
  }

  const t = (boardZ - start.z) / dz;

  if (!isValidHitTime(t)) {
    return undefined;
  }

  return {
    t,
    normalX: 0,
    normalZ,
    x: start.x + dx * t,
    z: boardZ,
    kind: 'board',
  };
}

function endBoardHit(
  start: Vec3,
  dx: number,
  dz: number,
  boardX: number,
  normalX: number,
): SweptHit | undefined {
  if (dx === 0) {
    return undefined;
  }

  const movingTowardBoard = normalX < 0 ? dx > 0 : dx < 0;

  if (!movingTowardBoard) {
    return undefined;
  }

  const t = (boardX - start.x) / dx;

  if (!isValidHitTime(t)) {
    return undefined;
  }

  const z = start.z + dz * t;

  if (Math.abs(z) <= GOAL.halfWidth) {
    return undefined;
  }

  return {
    t,
    normalX,
    normalZ: 0,
    x: boardX,
    z,
    kind: 'board',
  };
}

function postHit(
  start: Vec3,
  dx: number,
  dz: number,
  postX: number,
  postZ: number,
): SweptHit | undefined {
  const a = dx * dx + dz * dz;

  if (a === 0) {
    return undefined;
  }

  const fromPostX = start.x - postX;
  const fromPostZ = start.z - postZ;
  const b = 2 * (fromPostX * dx + fromPostZ * dz);
  const c = fromPostX * fromPostX + fromPostZ * fromPostZ - BALL_RADIUS * BALL_RADIUS;
  const discriminant = b * b - 4 * a * c;

  if (discriminant < 0) {
    return undefined;
  }

  const root = Math.sqrt(discriminant);
  const firstT = (-b - root) / (2 * a);
  const secondT = (-b + root) / (2 * a);
  const t = isValidHitTime(firstT) ? firstT : secondT;

  if (!isValidHitTime(t)) {
    return undefined;
  }

  const x = start.x + dx * t;
  const z = start.z + dz * t;
  const normal = normalFromPoint(postX, postZ, x, z, dx, dz);

  return {
    t,
    normalX: normal.x,
    normalZ: normal.z,
    x,
    z,
    kind: 'post',
  };
}

function normalFromPoint(
  pointX: number,
  pointZ: number,
  hitX: number,
  hitZ: number,
  dx: number,
  dz: number,
): { x: number; z: number } {
  const normalX = hitX - pointX;
  const normalZ = hitZ - pointZ;
  const length = Math.hypot(normalX, normalZ);

  if (length > 0) {
    return {
      x: normalX / length,
      z: normalZ / length,
    };
  }

  const movementLength = Math.hypot(dx, dz);

  if (movementLength === 0) {
    return { x: -1, z: 0 };
  }

  return {
    x: -dx / movementLength,
    z: -dz / movementLength,
  };
}

function isValidHitTime(t: number): boolean {
  return t >= 0 && t <= 1;
}

function reflectHorizontalVelocity(velocity: Vec3, normalX: number, normalZ: number): void {
  const dot = velocity.x * normalX + velocity.z * normalZ;

  velocity.x -= 2 * dot * normalX;
  velocity.z -= 2 * dot * normalZ;
}

export function ballSystem(world: World, dt: number): void {
  const { ball } = world;

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

  const target = {
    x: ball.pos.x + ball.vel.x * dt,
    y: 0,
    z: ball.pos.z + ball.vel.z * dt,
  };

  resolveSweptPitchCollision(world, ball.pos, target);
  ball.vel.y = 0;
  reduceHorizontalSpeed(ball.vel, BALL.drag * dt);

  ball.cooldown = Math.max(0, ball.cooldown - 1);
  if (ball.cooldown === 0 && ball.owner === null) {
    pickupBall(world);
  }
}
