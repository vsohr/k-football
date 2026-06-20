import { BALL_RADIUS, PITCH } from '../../config/dimensions';
import { BALL, DRIBBLE } from '../../config/pace';
import { createWorld, type Player, type World } from '../world';
import { ballSystem } from './ball';

function playerById(world: World, id: number): Player {
  const player = world.players.find((candidate) => candidate.id === id);

  if (player === undefined) {
    throw new Error(`missing player ${id}`);
  }

  return player;
}

function getControlledPlayer(world: World): Player {
  return playerById(world, world.controlledId);
}

function moveAllPlayersAway(world: World): void {
  for (const player of world.players) {
    player.pos.x = 10 + player.id;
    player.pos.z = 10;
  }
}

describe('ballSystem', () => {
  it('soft-attaches an owned ball in front of the owner each dribble tick', () => {
    const world = createWorld(1);
    const owner = getControlledPlayer(world);
    owner.pos.x = 2;
    owner.pos.z = 3;
    owner.vel.x = 1.5;
    owner.vel.z = -0.5;
    owner.facing = Math.PI / 2;
    world.ball.owner = owner.id;
    world.ball.pos.x = -1;
    world.ball.pos.y = 4;
    world.ball.pos.z = -2;

    ballSystem(world, 1 / 60);

    expect(world.ball.prevPos).toEqual({ x: -1, y: 4, z: -2 });
    expect(world.ball.pos.x).toBeCloseTo(owner.pos.x + DRIBBLE.distance);
    expect(world.ball.pos.y).toBe(0);
    expect(world.ball.pos.z).toBeCloseTo(owner.pos.z);
    expect(world.ball.vel).toEqual(owner.vel);
  });

  it('integrates a loose ball and applies linear drag toward rest', () => {
    const world = createWorld(2);
    world.ball.vel.x = 2;
    world.ball.vel.z = 0;

    ballSystem(world, 1);

    expect(world.ball.pos.x).toBeCloseTo(2);
    expect(world.ball.vel.x).toBeCloseTo(2 - BALL.drag);
    expect(world.ball.vel.z).toBe(0);
  });

  it('stops loose horizontal velocity below the stop threshold', () => {
    const world = createWorld(3);
    world.ball.vel.x = BALL.stopThreshold / 2;
    world.ball.vel.z = 0;

    ballSystem(world, 1 / 60);

    expect(world.ball.vel.x).toBe(0);
    expect(world.ball.vel.z).toBe(0);
  });

  it('bounces a loose ball off the pitch boards and clamps it inside bounds', () => {
    const world = createWorld(4);
    const maxX = PITCH.halfX - BALL_RADIUS;
    world.ball.pos.x = maxX - 0.05;
    world.ball.vel.x = 10;
    world.ball.vel.z = 0;

    ballSystem(world, 0.1);

    expect(world.ball.pos.x).toBe(maxX);
    expect(world.ball.vel.x).toBeLessThan(0);
    expect(world.ball.pos.z).toBeGreaterThanOrEqual(-PITCH.halfZ + BALL_RADIUS);
    expect(world.ball.pos.z).toBeLessThanOrEqual(PITCH.halfZ - BALL_RADIUS);
  });

  it('picks up a loose ball at cooldown zero and prefers the controlled player', () => {
    const world = createWorld(5);
    const controlled = getControlledPlayer(world);
    const opponent = playerById(world, 6);

    controlled.pos.x = 0.8;
    controlled.pos.z = 0;
    opponent.pos.x = 0.1;
    opponent.pos.z = 0;
    world.ball.pos.x = 0;
    world.ball.pos.z = 0;
    world.ball.vel.x = 0;
    world.ball.vel.z = 0;
    world.ball.cooldown = 0;

    ballSystem(world, 0);

    expect(world.ball.owner).toBe(controlled.id);
  });

  it('picks up the nearest player when the controlled player is out of range', () => {
    const world = createWorld(6);
    moveAllPlayersAway(world);
    playerById(world, world.controlledId).pos.x = 3;
    playerById(world, 6).pos.x = 0.4;
    playerById(world, 6).pos.z = 0;
    playerById(world, 7).pos.x = 0.2;
    playerById(world, 7).pos.z = 0;
    world.ball.pos.x = 0;
    world.ball.pos.z = 0;
    world.ball.vel.x = 0;
    world.ball.vel.z = 0;

    ballSystem(world, 0);

    expect(world.ball.owner).toBe(7);
  });

  it('does not pick up a loose ball while cooldown remains active', () => {
    const world = createWorld(7);
    const controlled = getControlledPlayer(world);
    controlled.pos.x = 0;
    controlled.pos.z = 0;
    world.ball.pos.x = 0;
    world.ball.pos.z = 0;
    world.ball.vel.x = 0;
    world.ball.vel.z = 0;
    world.ball.cooldown = 2;

    ballSystem(world, 0);

    expect(world.ball.owner).toBeNull();
    expect(world.ball.cooldown).toBe(1);
  });
});
