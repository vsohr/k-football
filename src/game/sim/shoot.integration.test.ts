import { createLoop } from '../core/loop';
import { createTime, requestHitstop } from '../core/time';
import { BALL, DRIBBLE } from '../config/pace';
import { pressAction } from '../input/source';
import { simulate } from './index';
import { createWorld, type Player, type World } from './world';

const STEP = 1 / 60;

function getControlledPlayer(world: World): Player {
  const player = world.players.find((candidate) => candidate.id === world.controlledId);

  if (player === undefined) {
    throw new Error(`missing controlled player ${world.controlledId}`);
  }

  return player;
}

describe('shoot deferred impulse integration', () => {
  it('freezes with the ball at contact before launching after hitstop clears', () => {
    const world = createWorld(1);
    const time = createTime();
    const player = getControlledPlayer(world);
    world.match.phase = 'PLAYING';
    player.pos.x = 0;
    player.pos.z = 0;
    player.vel.x = 0;
    player.vel.z = 0;
    player.facing = Math.PI / 2;
    world.ball.owner = player.id;
    world.ball.pos.x = 0;
    world.ball.pos.z = 0;
    world.ball.vel.x = 0;
    world.ball.vel.z = 0;

    const sim = (dt: number): void => {
      simulate(world, dt);
      if (world.pendingHitstopFrames > 0) {
        requestHitstop(time, world.pendingHitstopFrames);
        world.pendingHitstopFrames = 0;
      }
    };
    const loop = createLoop({ time, simulate: sim });

    pressAction(world.input, 'shoot');

    const contactX = player.pos.x + DRIBBLE.distance;
    const contactZ = player.pos.z;

    expect(loop.advance(STEP).steps).toBe(1);
    expect(world.events).toEqual([
      {
        type: 'shoot',
        tick: 0,
        power: 1,
        at: { x: expect.closeTo(contactX), y: 0, z: expect.closeTo(contactZ) },
      },
    ]);
    expect(world.ball.owner).toBeNull();
    expect(world.ball.pos.x).toBeCloseTo(contactX);
    expect(world.ball.pos.z).toBeCloseTo(contactZ);
    expect(world.ball.vel.x).toBe(0);
    expect(world.ball.vel.z).toBe(0);
    expect(time.hitstopRemaining).toBeGreaterThan(0);

    let hitstopFrames = 0;
    while (time.hitstopRemaining > 0 && hitstopFrames < 20) {
      const result = loop.advance(STEP);
      expect(result.steps).toBe(0);
      expect(world.ball.pos.x).toBeCloseTo(contactX);
      expect(world.ball.pos.z).toBeCloseTo(contactZ);
      hitstopFrames += 1;
    }

    expect(hitstopFrames).toBeGreaterThan(0);
    expect(time.hitstopRemaining).toBe(0);

    expect(loop.advance(STEP).steps).toBe(1);
    expect(world.ball.pos.x).toBeGreaterThan(contactX + 0.2);
    expect(world.ball.pos.z).toBeCloseTo(contactZ);
    expect(world.ball.vel.x).toBeCloseTo(BALL.shotSpeed, 1);
    expect(world.ball.vel.z).toBeCloseTo(0);
  });
});
