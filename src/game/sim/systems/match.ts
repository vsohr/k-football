import { GOAL, PITCH } from '../../config/dimensions';
import { FORMATION_2_2, anchorFor } from '../../config/formations';
import { MATCH } from '../../config/pace';
import type { Player, Vec3, World } from '../world';

const HALF_TIME_SEC = 1.5;

interface GoalCrossing {
  scorer: 0 | 1;
  kickoffTeam: 0 | 1;
}

function setVec3(target: Vec3, x: number, y: number, z: number): void {
  target.x = x;
  target.y = y;
  target.z = z;
}

function resetPlayerForKickoff(player: Player): void {
  const slot = FORMATION_2_2[player.id % FORMATION_2_2.length];
  const anchor = anchorFor(slot, player.team);
  const facing = player.team === 0 ? Math.PI / 2 : -Math.PI / 2;

  setVec3(player.anchor, anchor.x, anchor.y, anchor.z);
  setVec3(player.pos, anchor.x, anchor.y, anchor.z);
  setVec3(player.prevPos, anchor.x, anchor.y, anchor.z);
  setVec3(player.vel, 0, 0, 0);
  player.facing = facing;
  player.prevFacing = facing;
  player.recoverFrames = 0;
}

export function resetForKickoff(world: World): void {
  for (const player of world.players) {
    resetPlayerForKickoff(player);
    player.control = player.id === world.controlledId ? 'human' : 'ai';
  }

  setVec3(world.ball.pos, 0, 0, 0);
  setVec3(world.ball.prevPos, 0, 0, 0);
  setVec3(world.ball.vel, 0, 0, 0);
  world.ball.owner = null;
  world.ball.cooldown = 0;
  world.ball.pendingImpulse = null;
  world.switchCooldown = 0;
}

export function matchSystem(world: World, dt: number): void {
  if (world.match.phase === 'KICKOFF') {
    resetForKickoff(world);
    countDownPhase(world, dt);

    if (world.match.phaseTimer <= 0) {
      world.match.phase = 'PLAYING';
      world.match.phaseTimer = 0;
    }

    return;
  }

  if (world.match.phase === 'PLAYING') {
    const goal = detectGoalCrossing(world.ball.prevPos, world.ball.pos);

    if (goal !== undefined) {
      scoreGoal(world, goal);
      return;
    }

    world.match.clockSec = Math.min(MATCH.halfLengthSec, world.match.clockSec + dt);

    if (world.match.clockSec >= MATCH.halfLengthSec) {
      if (world.match.half === 1) {
        world.match.phase = 'HALF_TIME';
        world.match.phaseTimer = HALF_TIME_SEC;
      } else {
        world.match.phase = 'FULL_TIME';
        world.match.phaseTimer = 0;
      }
    }

    return;
  }

  if (world.match.phase === 'GOAL') {
    countDownPhase(world, dt);

    if (world.match.phaseTimer <= 0) {
      world.match.phase = 'KICKOFF';
      world.match.phaseTimer = MATCH.kickoffBeatSec;
      resetForKickoff(world);
    }

    return;
  }

  if (world.match.phase === 'HALF_TIME') {
    countDownPhase(world, dt);

    if (world.match.phaseTimer <= 0) {
      world.match.half = 2;
      world.match.clockSec = 0;
      world.match.phase = 'KICKOFF';
      world.match.phaseTimer = MATCH.kickoffBeatSec;
      resetForKickoff(world);
    }
  }
}

function countDownPhase(world: World, dt: number): void {
  world.match.phaseTimer = Math.max(0, world.match.phaseTimer - dt);
}

function scoreGoal(world: World, goal: GoalCrossing): void {
  if (goal.scorer === 0) {
    world.match.scoreHome += 1;
  } else {
    world.match.scoreAway += 1;
  }

  world.match.kickoffTeam = goal.kickoffTeam;
  world.match.phase = 'GOAL';
  world.match.phaseTimer = MATCH.celebrationSec;
  world.events.push({
    type: 'goal',
    tick: world.tick,
    at: { ...world.ball.pos },
  });
}

function detectGoalCrossing(prev: Vec3, pos: Vec3): GoalCrossing | undefined {
  const plusCrossingZ = crossingZAtLine(prev, pos, PITCH.halfX);
  const minusCrossingZ = crossingZAtLine(prev, pos, -PITCH.halfX);

  if (plusCrossingZ !== undefined && Math.abs(plusCrossingZ) <= GOAL.halfWidth) {
    return { scorer: 0, kickoffTeam: 1 };
  }

  if (minusCrossingZ !== undefined && Math.abs(minusCrossingZ) <= GOAL.halfWidth) {
    return { scorer: 1, kickoffTeam: 0 };
  }

  return undefined;
}

function crossingZAtLine(prev: Vec3, pos: Vec3, lineX: number): number | undefined {
  const dx = pos.x - prev.x;

  if (dx === 0) {
    return undefined;
  }

  const crossesPositiveLine = lineX > 0 && prev.x < lineX && pos.x >= lineX;
  const crossesNegativeLine = lineX < 0 && prev.x > lineX && pos.x <= lineX;

  if (!crossesPositiveLine && !crossesNegativeLine) {
    return undefined;
  }

  const t = (lineX - prev.x) / dx;

  if (t < 0 || t > 1) {
    return undefined;
  }

  return prev.z + (pos.z - prev.z) * t;
}
