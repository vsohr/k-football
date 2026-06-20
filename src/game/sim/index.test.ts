import { simulate } from './index';
import { BALL_RADIUS, PITCH } from '../config/dimensions';
import { setMove } from '../input/source';
import { createWorld, type Player, type World } from './world';

function getControlledPlayer(world: World): Player {
  const player = world.players.find((candidate) => candidate.id === world.controlledId);

  if (player === undefined) {
    throw new Error(`missing controlled player ${world.controlledId}`);
  }

  return player;
}

describe('simulate', () => {
  it('advances the tick, stores prevPos, and integrates ball velocity', () => {
    const world = createWorld(5);
    world.ball.vel.x = 2;
    world.ball.vel.y = 9;
    world.ball.vel.z = -4;

    simulate(world, 0.5);

    expect(world.tick).toBe(1);
    expect(world.ball.prevPos).toEqual({ x: 0, y: 0, z: 0 });
    expect(world.ball.pos).toEqual({ x: 1, y: 0, z: -2 });
  });

  it('bounces the ball off the x boundary and clamps inside the pitch', () => {
    const world = createWorld(6);
    const maxX = PITCH.halfX - BALL_RADIUS;
    world.ball.pos.x = maxX - 0.1;
    world.ball.vel.x = 10;
    world.ball.vel.z = 0;

    simulate(world, 0.1);

    expect(world.ball.pos.x).toBeCloseTo(maxX);
    expect(world.ball.vel.x).toBeLessThan(0);
    expect(world.ball.pos.z).toBeGreaterThanOrEqual(-PITCH.halfZ + BALL_RADIUS);
    expect(world.ball.pos.z).toBeLessThanOrEqual(PITCH.halfZ - BALL_RADIUS);
  });

  it('bounces the ball off the z boundary and clamps inside the pitch', () => {
    const world = createWorld(7);
    const minZ = -PITCH.halfZ + BALL_RADIUS;
    world.ball.pos.z = minZ + 0.1;
    world.ball.vel.x = 0;
    world.ball.vel.z = -10;

    simulate(world, 0.1);

    expect(world.ball.pos.z).toBeCloseTo(minZ);
    expect(world.ball.vel.z).toBeGreaterThan(0);
    expect(world.ball.pos.x).toBeGreaterThanOrEqual(-PITCH.halfX + BALL_RADIUS);
    expect(world.ball.pos.x).toBeLessThanOrEqual(PITCH.halfX - BALL_RADIUS);
  });

  it('leaves feel events queued for presentation to drain', () => {
    const world = createWorld(8);
    world.events.push({ type: 'bounce', tick: 0 });

    simulate(world, 1 / 60);

    expect(world.events).toEqual([{ type: 'bounce', tick: 0 }]);
  });

  it('runs input, movement, and ball systems before incrementing the tick', () => {
    const world = createWorld(9);
    const player = getControlledPlayer(world);
    const initialPlayerX = player.pos.x;

    world.ball.owner = player.id;
    world.ball.pos.x = player.pos.x;
    world.ball.pos.z = player.pos.z;
    const initialBallX = world.ball.pos.x;
    setMove(world.input, 1, 0);

    for (let i = 0; i < 5; i += 1) {
      simulate(world, 1 / 60);
    }

    expect(world.tick).toBe(5);
    expect(world.intent.moveX).toBe(1);
    expect(player.pos.x).toBeGreaterThan(initialPlayerX);
    expect(world.ball.pos.x).toBeGreaterThan(initialBallX);
  });
});
