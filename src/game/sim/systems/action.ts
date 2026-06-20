import { FEEL, shootHitstopFrames } from '../../config/feel';
import { BALL, DRIBBLE, PASS, TACKLE } from '../../config/pace';
import { consumeAction } from '../../input/source';
import type { Player, Vec3, World } from '../world';

const PASS_SWITCH_COOLDOWN_TICKS = 30;
const TACKLE_BALL_COOLDOWN_TICKS = 10;

interface HorizontalDirection {
  x: number;
  z: number;
}

export function actionSystem(world: World, _dt: number): void {
  const player = world.players.find((candidate) => candidate.id === world.controlledId);

  if (player === undefined) {
    return;
  }

  const ownsBall = world.ball.owner === player.id;

  if (world.intent.shoot && ownsBall) {
    performShoot(world, player);
    consumeAction(world.input, 'shoot');
    return;
  }

  if (world.intent.pass && ownsBall && !world.intent.shoot && player.recoverFrames === 0) {
    if (performPass(world, player)) {
      consumeAction(world.input, 'pass');
    }
    return;
  }

  if (world.intent.tackle && !ownsBall && player.recoverFrames === 0) {
    performTackle(world, player);
    consumeAction(world.input, 'tackle');
  }
}

export function performShoot(world: World, player: Player, power = 1): void {
  const dirX = Math.sin(player.facing);
  const dirZ = Math.cos(player.facing);

  world.ball.pendingImpulse = {
    x: dirX * BALL.shotSpeed * power,
    y: 0,
    z: dirZ * BALL.shotSpeed * power,
  };
  world.ball.owner = null;
  world.ball.cooldown = DRIBBLE.shotCooldownTicks;
  world.pendingHitstopFrames = shootHitstopFrames(power);
  world.events.push({
    type: FEEL.shoot.sfx,
    tick: world.tick,
    power,
    at: { ...world.ball.pos },
  });
}

export function performPass(
  world: World,
  player: Player,
  switchControl = true,
  lateralAimNoise = 0,
): boolean {
  const target = selectPassTarget(world, player);

  if (target === undefined) {
    return false;
  }

  const baseAimX = target.pos.x + target.vel.x * PASS.leadTime;
  const baseAimZ = target.pos.z + target.vel.z * PASS.leadTime;
  const baseDir = directionFromDelta(baseAimX - player.pos.x, baseAimZ - player.pos.z);

  if (baseDir === undefined) {
    return false;
  }

  const aimX = baseAimX - baseDir.z * lateralAimNoise;
  const aimZ = baseAimZ + baseDir.x * lateralAimNoise;
  const dir = directionFromDelta(aimX - player.pos.x, aimZ - player.pos.z);

  if (dir === undefined) {
    return false;
  }

  const distance = Math.hypot(aimX - player.pos.x, aimZ - player.pos.z);
  const speed = clamp(distance / PASS.leadTime, PASS.minSpeed, PASS.speed);

  world.ball.vel.x = dir.x * speed;
  world.ball.vel.y = 0;
  world.ball.vel.z = dir.z * speed;
  world.ball.pendingImpulse = null;
  world.ball.owner = null;
  world.ball.cooldown = PASS.cooldownTicks;
  if (switchControl) {
    world.controlledId = target.id;
    world.switchCooldown = PASS_SWITCH_COOLDOWN_TICKS;
    updateControlFlags(world);
  }
  world.pendingHitstopFrames = FEEL.pass.hitstopFrames;
  world.events.push({
    type: 'pass',
    tick: world.tick,
    at: { ...world.ball.pos },
  });
  return true;
}

export function performTackle(world: World, player: Player): 'clean' | 'whiff' {
  const carrier = findTackleCarrier(world, player);

  if (carrier === undefined) {
    player.recoverFrames = TACKLE.whiffRecoverTicks;
    world.pendingHitstopFrames = FEEL.tackleWhiff.hitstopFrames;
    world.events.push({
      type: 'tackleWhiff',
      tick: world.tick,
      at: { ...player.pos },
    });
    return 'whiff';
  }

  const popDir =
    directionBetween(player.pos, world.ball.pos) ??
    directionBetween(player.pos, carrier.pos) ??
    facingDirection(player);

  world.ball.owner = null;
  world.ball.pendingImpulse = null;
  world.ball.vel.x = popDir.x * TACKLE.popSpeed;
  world.ball.vel.y = 0;
  world.ball.vel.z = popDir.z * TACKLE.popSpeed;
  world.ball.cooldown = TACKLE_BALL_COOLDOWN_TICKS;
  player.recoverFrames = TACKLE.cleanRecoverTicks;
  carrier.recoverFrames = TACKLE.cleanRecoverTicks + 4;
  world.pendingHitstopFrames = FEEL.tackleClean.hitstopFrames;
  world.events.push({
    type: 'tackleClean',
    tick: world.tick,
    at: { ...world.ball.pos },
  });
  return 'clean';
}

function updateControlFlags(world: World): void {
  for (const player of world.players) {
    player.control = player.id === world.controlledId ? 'human' : 'ai';
  }
}

function selectPassTarget(world: World, player: Player): Player | undefined {
  let best: Player | undefined;
  let bestScore = -Infinity;

  for (const candidate of world.players) {
    if (!isPassCandidate(player, candidate) || !isInsidePassArc(player, candidate)) {
      continue;
    }

    const score = scorePassTarget(world, player, candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best ?? nearestTeammateInFront(world, player);
}

function isPassCandidate(player: Player, candidate: Player): boolean {
  return candidate.team === player.team && candidate.id !== player.id && candidate.role !== 'GK';
}

function isInsidePassArc(player: Player, candidate: Player): boolean {
  const dir = directionBetween(player.pos, candidate.pos);

  if (dir === undefined) {
    return false;
  }

  const halfArcRadians = (PASS.arcDeg / 2) * (Math.PI / 180);
  return dot(dir, facingDirection(player)) >= Math.cos(halfArcRadians);
}

function nearestTeammateInFront(world: World, player: Player): Player | undefined {
  let nearest: Player | undefined;
  let nearestDistance = Infinity;

  for (const candidate of world.players) {
    if (!isPassCandidate(player, candidate) || !isInFront(player, candidate)) {
      continue;
    }

    const distance = horizontalDistance(player.pos, candidate.pos);
    if (distance < nearestDistance) {
      nearest = candidate;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function isInFront(player: Player, candidate: Player): boolean {
  const dir = directionBetween(player.pos, candidate.pos);

  if (dir === undefined) {
    return false;
  }

  return dot(dir, facingDirection(player)) > 0;
}

function scorePassTarget(world: World, player: Player, candidate: Player): number {
  const distance = horizontalDistance(player.pos, candidate.pos);
  const attackSign = player.team === 0 ? 1 : -1;
  const forwardProgress = (candidate.pos.x - player.pos.x) * attackSign;
  const lanePenalty = passingLanePenalty(world, player, candidate);

  return forwardProgress * 1.2 - distance * 0.35 - lanePenalty;
}

function passingLanePenalty(world: World, player: Player, candidate: Player): number {
  let penalty = 0;

  for (const opponent of world.players) {
    if (opponent.team === player.team) {
      continue;
    }

    const distance = distanceToSegment(opponent.pos, player.pos, candidate.pos);
    if (distance < 1.2) {
      penalty += (1.2 - distance) * 2;
    }
  }

  return penalty;
}

function findTackleCarrier(world: World, player: Player): Player | undefined {
  if (world.ball.owner === null) {
    return undefined;
  }

  const carrier = world.players.find((candidate) => candidate.id === world.ball.owner);

  if (
    carrier === undefined ||
    carrier.team === player.team ||
    horizontalDistance(player.pos, carrier.pos) > TACKLE.range
  ) {
    return undefined;
  }

  return carrier;
}

function directionBetween(from: Vec3, to: Vec3): HorizontalDirection | undefined {
  return directionFromDelta(to.x - from.x, to.z - from.z);
}

function directionFromDelta(x: number, z: number): HorizontalDirection | undefined {
  const length = Math.hypot(x, z);

  if (length === 0) {
    return undefined;
  }

  return {
    x: x / length,
    z: z / length,
  };
}

function facingDirection(player: Player): HorizontalDirection {
  return {
    x: Math.sin(player.facing),
    z: Math.cos(player.facing),
  };
}

function dot(a: HorizontalDirection, b: HorizontalDirection): number {
  return a.x * b.x + a.z * b.z;
}

function horizontalDistance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function distanceToSegment(point: Vec3, start: Vec3, end: Vec3): number {
  const segmentX = end.x - start.x;
  const segmentZ = end.z - start.z;
  const segmentLengthSquared = segmentX * segmentX + segmentZ * segmentZ;

  if (segmentLengthSquared === 0) {
    return horizontalDistance(point, start);
  }

  const projected =
    ((point.x - start.x) * segmentX + (point.z - start.z) * segmentZ) /
    segmentLengthSquared;
  const t = clamp(projected, 0, 1);
  const closestX = start.x + segmentX * t;
  const closestZ = start.z + segmentZ * t;

  return Math.hypot(point.x - closestX, point.z - closestZ);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
