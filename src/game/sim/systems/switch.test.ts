import { createWorld, type Player, type World } from '../world';
import { switchSystem } from './switch';

function playerById(world: World, id: number): Player {
  const player = world.players.find((candidate) => candidate.id === id);

  if (player === undefined) {
    throw new Error(`missing player ${id}`);
  }

  return player;
}

function expectSingleHuman(world: World): void {
  expect(world.players.filter((player) => player.control === 'human').map((player) => player.id)).toEqual([
    world.controlledId,
  ]);
}

describe('switchSystem', () => {
  it('auto-switches to the nearest home outfield player when the ball is loose', () => {
    const world = createWorld(1);
    const defender = playerById(world, 1);
    const forward = playerById(world, 4);

    world.ball.owner = null;
    world.ball.pos.x = forward.pos.x + 0.2;
    world.ball.pos.z = forward.pos.z;
    defender.pos.x = world.ball.pos.x - 0.1;
    defender.pos.z = world.ball.pos.z;

    switchSystem(world);

    expect(world.controlledId).toBe(defender.id);
    expect(world.switchCooldown).toBe(18);
    expectSingleHuman(world);
  });

  it('prevents auto-switching again while dwell cooldown remains active', () => {
    const world = createWorld(2);
    const current = playerById(world, world.controlledId);
    const nearer = playerById(world, 1);

    world.ball.owner = null;
    world.ball.pos.x = nearer.pos.x;
    world.ball.pos.z = nearer.pos.z;
    world.switchCooldown = 5;

    switchSystem(world);

    expect(world.controlledId).toBe(current.id);
    expect(world.switchCooldown).toBe(4);
    expectSingleHuman(world);
  });

  it('hands control to the home player that owns the ball', () => {
    const world = createWorld(3);
    const owner = playerById(world, 4);

    world.ball.owner = owner.id;
    world.switchCooldown = 7;

    switchSystem(world);

    expect(world.controlledId).toBe(owner.id);
    expect(world.switchCooldown).toBe(0);
    expectSingleHuman(world);
  });

  it('never auto-selects the goalkeeper for a loose ball', () => {
    const world = createWorld(4);
    const goalkeeper = playerById(world, 0);
    const defender = playerById(world, 1);

    world.ball.owner = null;
    world.ball.pos.x = goalkeeper.pos.x;
    world.ball.pos.z = goalkeeper.pos.z;
    defender.pos.x = goalkeeper.pos.x + 3;
    defender.pos.z = goalkeeper.pos.z;

    switchSystem(world);

    expect(world.controlledId).toBe(defender.id);
    expect(playerById(world, world.controlledId).role).not.toBe('GK');
    expectSingleHuman(world);
  });
});
