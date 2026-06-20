import { BALL, DRIBBLE } from '../../config/pace';
import { shootHitstopFrames } from '../../config/feel';
import { pressAction } from '../../input/source';
import { createWorld, type Player, type World } from '../world';
import { actionSystem } from './action';

function getControlledPlayer(world: World): Player {
  const player = world.players.find((candidate) => candidate.id === world.controlledId);

  if (player === undefined) {
    throw new Error(`missing controlled player ${world.controlledId}`);
  }

  return player;
}

describe('actionSystem', () => {
  it('shoots once when the controlled player owns the ball', () => {
    const world = createWorld(1);
    const player = getControlledPlayer(world);
    player.facing = Math.PI / 2;
    world.ball.owner = player.id;
    world.ball.pos.x = 1;
    world.ball.pos.z = 2;
    world.intent.shoot = true;
    pressAction(world.input, 'shoot');

    actionSystem(world, 1 / 60);

    expect(world.ball.owner).toBeNull();
    expect(world.ball.cooldown).toBe(DRIBBLE.shotCooldownTicks);
    expect(world.ball.pendingImpulse).toEqual({
      x: BALL.shotSpeed,
      y: 0,
      z: expect.closeTo(0),
    });
    expect(world.pendingHitstopFrames).toBe(shootHitstopFrames(1));
    expect(world.events).toEqual([
      {
        type: 'shoot',
        tick: 0,
        power: 1,
        at: { x: 1, y: 0, z: 2 },
      },
    ]);
    expect(world.input.shootBuf).toBe(0);
  });

  it('does not shoot or consume the buffer when the controlled player does not own the ball', () => {
    const world = createWorld(2);
    world.ball.owner = null;
    world.intent.shoot = true;
    pressAction(world.input, 'shoot');

    actionSystem(world, 1 / 60);

    expect(world.ball.pendingImpulse).toBeNull();
    expect(world.ball.cooldown).toBe(0);
    expect(world.pendingHitstopFrames).toBe(0);
    expect(world.events).toEqual([]);
    expect(world.input.shootBuf).toBeGreaterThan(0);
  });
});
