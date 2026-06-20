import { BALL_RADIUS, GOAL, PITCH } from '../../config/dimensions';
import { MATCH } from '../../config/pace';
import { setMove } from '../../input/source';
import { simulate } from '../index';
import { createWorld, type Player, type Vec3, type World } from '../world';
import { ballSystem } from './ball';
import { matchSystem } from './match';

const STEP = 1 / 60;

function setVec3(target: Vec3, x: number, y: number, z: number): void {
  target.x = x;
  target.y = y;
  target.z = z;
}

function getControlledPlayer(world: World): Player {
  const player = world.players.find((candidate) => candidate.id === world.controlledId);

  if (player === undefined) {
    throw new Error(`missing controlled player ${world.controlledId}`);
  }

  return player;
}

function moveAllPlayersAway(world: World): void {
  for (const player of world.players) {
    player.pos.x = 10 + player.id;
    player.pos.z = 10;
  }
}

function putBallCrossingEndLine(world: World, endLineX: number, z: number): void {
  const direction = Math.sign(endLineX);
  setVec3(world.ball.prevPos, endLineX - direction * 0.5, 0, z);
  setVec3(world.ball.pos, endLineX + direction * 0.5, 0, z);
  setVec3(world.ball.vel, direction * 20, 0, 0);
}

describe('matchSystem goal detection', () => {
  it('scores home from a swept crossing of the +X goal mouth', () => {
    const world = createWorld(1);
    world.match.phase = 'PLAYING';
    putBallCrossingEndLine(world, PITCH.halfX, GOAL.halfWidth - 0.1);

    matchSystem(world, STEP);

    expect(world.match.scoreHome).toBe(1);
    expect(world.match.scoreAway).toBe(0);
    expect(world.match.kickoffTeam).toBe(1);
    expect(world.match.phase).toBe('GOAL');
    expect(world.match.phaseTimer).toBe(MATCH.celebrationSec);
    expect(world.events).toEqual([
      {
        type: 'goal',
        tick: 0,
        at: { ...world.ball.pos },
      },
    ]);
  });

  it('scores away from a swept crossing of the -X goal mouth', () => {
    const world = createWorld(2);
    world.match.phase = 'PLAYING';
    putBallCrossingEndLine(world, -PITCH.halfX, -GOAL.halfWidth + 0.1);

    matchSystem(world, STEP);

    expect(world.match.scoreHome).toBe(0);
    expect(world.match.scoreAway).toBe(1);
    expect(world.match.kickoffTeam).toBe(0);
    expect(world.match.phase).toBe('GOAL');
  });

  it('does not score when a fast ball crosses outside the posts and bounces', () => {
    const world = createWorld(3);
    const maxX = PITCH.halfX - BALL_RADIUS;
    world.match.phase = 'PLAYING';
    moveAllPlayersAway(world);
    setVec3(world.ball.pos, maxX - 0.05, 0, GOAL.halfWidth + 0.5);
    setVec3(world.ball.vel, 30, 0, 0);
    world.ball.cooldown = 2;

    ballSystem(world, STEP);
    matchSystem(world, STEP);

    expect(world.match.scoreHome).toBe(0);
    expect(world.match.scoreAway).toBe(0);
    expect(world.match.phase).toBe('PLAYING');
    expect(world.ball.vel.x).toBeLessThan(0);
    expect(world.ball.pos.x).toBeLessThan(PITCH.halfX);
  });
});

describe('matchSystem phase machine', () => {
  it('starts with kickoff, holds reset positions, then enters playing', () => {
    const world = createWorld(4);
    const player = getControlledPlayer(world);
    setVec3(player.pos, player.anchor.x + 4, 0, player.anchor.z);
    setVec3(world.ball.pos, 6, 0, 2);

    matchSystem(world, MATCH.kickoffBeatSec / 2);

    expect(world.match.phase).toBe('KICKOFF');
    expect(world.match.clockSec).toBe(0);
    expect(player.pos).toEqual(player.anchor);
    expect(world.ball.pos).toEqual({ x: 0, y: 0, z: 0 });

    matchSystem(world, MATCH.kickoffBeatSec / 2);

    expect(world.match.phase).toBe('PLAYING');
    expect(world.match.clockSec).toBe(0);

    matchSystem(world, 1);

    expect(world.match.clockSec).toBe(1);
  });

  it('moves from half one to half-time, then half two kickoff with a reset clock', () => {
    const world = createWorld(5);
    world.match.phase = 'PLAYING';
    world.match.clockSec = MATCH.halfLengthSec - 0.1;
    setVec3(world.ball.pos, 8, 0, 2);

    matchSystem(world, 0.2);

    expect(world.match.phase).toBe('HALF_TIME');
    expect(world.match.half).toBe(1);
    expect(world.match.clockSec).toBe(MATCH.halfLengthSec);
    expect(world.match.phaseTimer).toBeGreaterThan(0);

    matchSystem(world, world.match.phaseTimer);

    expect(world.match.phase).toBe('KICKOFF');
    expect(world.match.half).toBe(2);
    expect(world.match.clockSec).toBe(0);
    expect(world.ball.pos).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('enters full-time after the second half reaches the match length', () => {
    const world = createWorld(6);
    world.match.phase = 'PLAYING';
    world.match.half = 2;
    world.match.clockSec = MATCH.halfLengthSec - 0.1;

    matchSystem(world, 0.2);

    expect(world.match.phase).toBe('FULL_TIME');
    expect(world.match.half).toBe(2);
    expect(world.match.clockSec).toBe(MATCH.halfLengthSec);
  });

  it('resets players and the ball when goal celebration returns to kickoff', () => {
    const world = createWorld(7);
    const player = getControlledPlayer(world);
    world.match.phase = 'GOAL';
    world.match.phaseTimer = 0.1;
    setVec3(player.pos, player.anchor.x + 3, 0, player.anchor.z + 2);
    setVec3(player.vel, 2, 0, 1);
    player.recoverFrames = 5;
    player.aiMoveX = 1;
    player.aiMoveZ = -1;
    player.aiSprint = true;
    player.decisionTimer = 4;
    world.chaser[0] = 1;
    world.chaser[1] = 8;
    setVec3(world.ball.pos, PITCH.halfX + 1, 0, 0);
    setVec3(world.ball.vel, 10, 0, 0);
    world.ball.owner = player.id;
    world.ball.pendingImpulse = { x: 1, y: 0, z: 1 };
    world.ball.cooldown = 9;

    matchSystem(world, 0.1);

    expect(world.match.phase).toBe('KICKOFF');
    expect(world.match.phaseTimer).toBe(MATCH.kickoffBeatSec);
    expect(player.pos).toEqual(player.anchor);
    expect(player.vel).toEqual({ x: 0, y: 0, z: 0 });
    expect(player.recoverFrames).toBe(0);
    expect(player.aiMoveX).toBe(0);
    expect(player.aiMoveZ).toBe(0);
    expect(player.aiSprint).toBe(false);
    expect(player.decisionTimer).toBe(0);
    expect(player.facing).toBe(Math.PI / 2);
    expect(world.ball.pos).toEqual({ x: 0, y: 0, z: 0 });
    expect(world.ball.vel).toEqual({ x: 0, y: 0, z: 0 });
    expect(world.ball.owner).toBeNull();
    expect(world.ball.pendingImpulse).toBeNull();
    expect(world.ball.cooldown).toBe(0);
    expect(world.chaser).toEqual([-1, -1]);
  });
});

describe('simulate gameplay gating', () => {
  it('does not move players or the ball from input before kickoff completes', () => {
    const world = createWorld(8);
    const player = getControlledPlayer(world);
    setMove(world.input, 1, 0);
    setVec3(world.ball.vel, 10, 0, 0);

    simulate(world, STEP);

    expect(world.match.phase).toBe('KICKOFF');
    expect(player.pos).toEqual(player.anchor);
    expect(player.vel).toEqual({ x: 0, y: 0, z: 0 });
    expect(world.ball.pos).toEqual({ x: 0, y: 0, z: 0 });
    expect(world.ball.vel).toEqual({ x: 0, y: 0, z: 0 });
  });
});
