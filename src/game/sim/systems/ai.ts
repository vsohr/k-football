import { AI } from '../../config/ai';
import { GOAL, PITCH } from '../../config/dimensions';
import { FORMATION_2_2, anchorFor } from '../../config/formations';
import type { Player, Vec3, World } from '../world';
import { performPass, performShoot, performTackle } from './action';

type Possession = 'OURS' | 'THEIRS' | 'LOOSE';
type AttackSign = -1 | 1;

interface HorizontalDirection {
  x: number;
  z: number;
}

interface TeamContext {
  possession: Possession;
  carrier: Player | undefined;
  opponentCarrier: Player | undefined;
  attackSign: AttackSign;
}

const ARRIVE_RADIUS = 2;
const STOP_RADIUS = 0.3;
const DEFEND_PULL_X = 5;
const DEFEND_PULL_Z = 3;
const OPEN_LANE_RADIUS = 1.25;
const MIN_PASS_PROGRESS = 3;
const MIN_PASS_DISTANCE = 2;
const MAX_PASS_DISTANCE = 18;
const PITCH_TARGET_MARGIN = 1;

export function aiSystem(world: World, _dt: number): void {
  for (const team of [0, 1] as const) {
    world.chaser[team] = selectChaser(world, team);
  }

  const contexts: [TeamContext, TeamContext] = [
    createTeamContext(world, 0),
    createTeamContext(world, 1),
  ];

  for (const player of world.players) {
    if (player.role === 'GK' || player.id === world.controlledId) {
      if (player.id === world.controlledId) {
        stopAiMove(player);
      }
      continue;
    }

    if (player.recoverFrames > 0) {
      stopAiMove(player);
      continue;
    }

    const context = contexts[player.team];

    if (world.ball.owner === player.id) {
      playOnBall(world, player, context);
    } else {
      playOffBall(world, player, context);
    }
  }
}

function createTeamContext(world: World, team: 0 | 1): TeamContext {
  const owner = world.ball.owner === null ? undefined : findPlayer(world, world.ball.owner);
  const possession: Possession =
    owner === undefined ? 'LOOSE' : owner.team === team ? 'OURS' : 'THEIRS';

  return {
    possession,
    carrier: owner?.team === team ? owner : undefined,
    opponentCarrier: owner !== undefined && owner.team !== team ? owner : undefined,
    attackSign: team === 0 ? 1 : -1,
  };
}

function playOnBall(world: World, player: Player, context: TeamContext): void {
  if (player.decisionTimer > 0) {
    player.decisionTimer -= 1;
    return;
  }

  player.decisionTimer = AI.decisionTicks;

  if (shouldShoot(world, player, context.attackSign)) {
    const goalX = context.attackSign * PITCH.halfX;
    const noisyGoalZ = world.rng.range(-AI.shotNoise, AI.shotNoise);
    facePoint(player, goalX, noisyGoalZ);
    stopAiMove(player);
    performShoot(world, player);
    return;
  }

  const passTarget = findAiPassTarget(world, player, context.attackSign);
  if (passTarget !== undefined && world.rng.next() < AI.passProb) {
    facePoint(
      player,
      passTarget.pos.x + passTarget.vel.x * AI.ballLeadTime,
      passTarget.pos.z + passTarget.vel.z * AI.ballLeadTime,
    );

    if (performPass(world, player, false, world.rng.range(-AI.passNoise, AI.passNoise))) {
      stopAiMove(player);
      return;
    }
  }

  dribbleTowardGoal(player, context.attackSign);
}

function playOffBall(world: World, player: Player, context: TeamContext): void {
  if (player.id === world.chaser[player.team] && context.possession !== 'OURS') {
    const target = {
      x: world.ball.pos.x + world.ball.vel.x * AI.ballLeadTime,
      y: 0,
      z: world.ball.pos.z + world.ball.vel.z * AI.ballLeadTime,
    };
    const distance = horizontalDistance(player.pos, target);
    setSeekMove(player, target, distance > AI.pressDistance);
    return;
  }

  if (context.opponentCarrier !== undefined) {
    const distanceToCarrier = horizontalDistance(player.pos, context.opponentCarrier.pos);

    if (distanceToCarrier <= AI.pressDistance) {
      setSeekMove(player, context.opponentCarrier.pos, distanceToCarrier > 2);
      facePoint(player, context.opponentCarrier.pos.x, context.opponentCarrier.pos.z);

      if (distanceToCarrier <= AI.tackleTriggerDist && player.recoverFrames === 0) {
        performTackle(world, player);
      }
      return;
    }
  }

  if (context.possession === 'OURS' && context.carrier !== undefined) {
    setArriveMove(player, attackingTarget(player, context.carrier, context.attackSign), true);
    return;
  }

  const target = defendingTarget(player, world.ball.pos);
  setArriveMove(player, target, false);
  facePoint(player, world.ball.pos.x, world.ball.pos.z);
}

function shouldShoot(world: World, player: Player, attackSign: AttackSign): boolean {
  const goalX = attackSign * PITCH.halfX;
  const distToGoalLine = Math.abs(goalX - player.pos.x);

  if (distToGoalLine > AI.shotRangeX || Math.abs(player.pos.z) > AI.shotLaneTolerance) {
    return false;
  }

  return isLaneOpen(world, player, { x: goalX, y: 0, z: 0 }, OPEN_LANE_RADIUS);
}

function findAiPassTarget(
  world: World,
  player: Player,
  attackSign: AttackSign,
): Player | undefined {
  let best: Player | undefined;
  let bestScore = -Infinity;

  for (const candidate of world.players) {
    if (
      candidate.team !== player.team ||
      candidate.id === player.id ||
      candidate.role === 'GK'
    ) {
      continue;
    }

    const forwardProgress = (candidate.pos.x - player.pos.x) * attackSign;
    const distance = horizontalDistance(player.pos, candidate.pos);

    if (
      forwardProgress < MIN_PASS_PROGRESS ||
      distance < MIN_PASS_DISTANCE ||
      distance > MAX_PASS_DISTANCE ||
      !isLaneOpen(world, player, candidate.pos, OPEN_LANE_RADIUS)
    ) {
      continue;
    }

    const centrality = GOAL.halfWidth - Math.min(GOAL.halfWidth, Math.abs(candidate.pos.z));
    const score = forwardProgress * 1.5 + centrality * 0.4 - distance * 0.2;

    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  return best;
}

function dribbleTowardGoal(player: Player, attackSign: AttackSign): void {
  const centerBiasZ = -player.pos.z * 0.08;
  const direction = directionFromDelta(attackSign, centerBiasZ);

  if (direction === undefined) {
    stopAiMove(player);
    return;
  }

  player.aiMoveX = direction.x;
  player.aiMoveZ = direction.z;
  player.aiSprint = false;
  faceDirection(player, direction.x, direction.z);
}

function attackingTarget(player: Player, carrier: Player, attackSign: AttackSign): Vec3 {
  const base = staticAnchor(player);
  const target =
    player.role === 'FWD'
      ? {
          x: carrier.pos.x + attackSign * AI.supportAhead,
          z: base.z,
        }
      : {
          x: carrier.pos.x - attackSign * AI.supportAhead * 0.7,
          z: base.z * 0.65 + carrier.pos.z * 0.35,
        };

  return clampedTarget(target.x, target.z);
}

function defendingTarget(player: Player, ballPos: Vec3): Vec3 {
  const base = staticAnchor(player);
  const pullX = clamp(ballPos.x - base.x, -DEFEND_PULL_X, DEFEND_PULL_X);
  const pullZ = clamp(ballPos.z - base.z, -DEFEND_PULL_Z, DEFEND_PULL_Z);

  return clampedTarget(base.x + pullX, base.z + pullZ);
}

function staticAnchor(player: Player): Vec3 {
  return anchorFor(FORMATION_2_2[player.id % FORMATION_2_2.length], player.team);
}

function selectChaser(world: World, team: 0 | 1): number {
  const current = findPlayer(world, world.chaser[team]);
  const nearest = nearestChaserCandidate(world, team);

  if (nearest === undefined) {
    return -1;
  }

  if (current !== undefined && isChaserCandidate(world, current, team)) {
    const currentDistance = horizontalDistance(current.pos, world.ball.pos);
    const nearestDistance = horizontalDistance(nearest.pos, world.ball.pos);

    if (
      nearest.id !== current.id &&
      currentDistance - nearestDistance > AI.chaserHysteresis
    ) {
      return nearest.id;
    }

    return current.id;
  }

  return nearest.id;
}

function nearestChaserCandidate(world: World, team: 0 | 1): Player | undefined {
  let nearest: Player | undefined;
  let nearestDistance = Infinity;

  for (const player of world.players) {
    if (!isChaserCandidate(world, player, team)) {
      continue;
    }

    const distance = horizontalDistance(player.pos, world.ball.pos);
    if (distance < nearestDistance) {
      nearest = player;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function isChaserCandidate(world: World, player: Player, team: 0 | 1): boolean {
  return (
    player.team === team &&
    player.role !== 'GK' &&
    player.id !== world.controlledId &&
    player.recoverFrames === 0
  );
}

function isLaneOpen(
  world: World,
  player: Player,
  target: Vec3,
  tolerance: number,
): boolean {
  for (const opponent of world.players) {
    if (opponent.team === player.team || opponent.role === 'GK') {
      continue;
    }

    if (distanceToSegment(opponent.pos, player.pos, target) < tolerance) {
      return false;
    }
  }

  return true;
}

function setSeekMove(player: Player, target: Vec3, sprint: boolean): void {
  const direction = directionFromDelta(target.x - player.pos.x, target.z - player.pos.z);

  if (direction === undefined) {
    stopAiMove(player);
    return;
  }

  player.aiMoveX = direction.x;
  player.aiMoveZ = direction.z;
  player.aiSprint = sprint;
  faceDirection(player, direction.x, direction.z);
}

function setArriveMove(player: Player, target: Vec3, sprint: boolean): void {
  const dx = target.x - player.pos.x;
  const dz = target.z - player.pos.z;
  const distance = Math.hypot(dx, dz);

  if (distance <= STOP_RADIUS) {
    stopAiMove(player);
    return;
  }

  const scale = Math.min(1, distance / ARRIVE_RADIUS);
  player.aiMoveX = (dx / distance) * scale;
  player.aiMoveZ = (dz / distance) * scale;
  player.aiSprint = sprint && distance > AI.pressDistance;
  faceDirection(player, player.aiMoveX, player.aiMoveZ);
}

function stopAiMove(player: Player): void {
  player.aiMoveX = 0;
  player.aiMoveZ = 0;
  player.aiSprint = false;
}

function facePoint(player: Player, x: number, z: number): void {
  faceDirection(player, x - player.pos.x, z - player.pos.z);
}

function faceDirection(player: Player, x: number, z: number): void {
  if (Math.hypot(x, z) === 0) {
    return;
  }

  player.facing = Math.atan2(x, z);
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

function findPlayer(world: World, id: number): Player | undefined {
  return world.players.find((player) => player.id === id);
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

function clampedTarget(x: number, z: number): Vec3 {
  return {
    x: clamp(x, -PITCH.halfX + PITCH_TARGET_MARGIN, PITCH.halfX - PITCH_TARGET_MARGIN),
    y: 0,
    z: clamp(z, -PITCH.halfZ + PITCH_TARGET_MARGIN, PITCH.halfZ - PITCH_TARGET_MARGIN),
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
