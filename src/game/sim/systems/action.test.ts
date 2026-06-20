import { FEEL, shootHitstopFrames } from '../../config/feel';
import { BALL, DRIBBLE, PASS, TACKLE } from '../../config/pace';
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

function playerById(world: World, id: number): Player {
  const player = world.players.find((candidate) => candidate.id === id);

  if (player === undefined) {
    throw new Error(`missing player ${id}`);
  }

  return player;
}

function movePlayer(player: Player, x: number, z: number): void {
  player.pos.x = x;
  player.pos.y = 0;
  player.pos.z = z;
  player.prevPos.x = x;
  player.prevPos.y = 0;
  player.prevPos.z = z;
}

function normalizeHorizontal(x: number, z: number): { x: number; z: number } {
  const length = Math.hypot(x, z);

  if (length === 0) {
    throw new Error('cannot normalize zero vector');
  }

  return {
    x: x / length,
    z: z / length,
  };
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

  it('passes toward the receiver lead point and switches control to the target', () => {
    const world = createWorld(3);
    const passer = getControlledPlayer(world);
    const receiver = playerById(world, 4);
    const alternate = playerById(world, 1);
    movePlayer(passer, 0, 0);
    movePlayer(receiver, 8, 2);
    movePlayer(alternate, -4, 0);
    receiver.vel.x = 4;
    receiver.vel.z = 0;
    passer.facing = Math.PI / 2;
    world.ball.owner = passer.id;
    world.ball.pos = { x: 0, y: 0, z: 0 };
    world.intent.pass = true;
    pressAction(world.input, 'pass');

    actionSystem(world, 1 / 60);

    const aimX = receiver.pos.x + receiver.vel.x * PASS.leadTime;
    const aimZ = receiver.pos.z + receiver.vel.z * PASS.leadTime;
    const expectedDirection = normalizeHorizontal(aimX - passer.pos.x, aimZ - passer.pos.z);
    const actualDirection = normalizeHorizontal(world.ball.vel.x, world.ball.vel.z);
    expect(actualDirection.x).toBeCloseTo(expectedDirection.x);
    expect(actualDirection.z).toBeCloseTo(expectedDirection.z);
    expect(Math.hypot(world.ball.vel.x, world.ball.vel.z)).toBeLessThanOrEqual(PASS.speed);
    expect(Math.hypot(world.ball.vel.x, world.ball.vel.z)).toBeGreaterThanOrEqual(PASS.minSpeed);
    expect(world.ball.owner).toBeNull();
    expect(world.ball.pendingImpulse).toBeNull();
    expect(world.ball.cooldown).toBe(PASS.cooldownTicks);
    expect(world.controlledId).toBe(receiver.id);
    expect(world.switchCooldown).toBeGreaterThanOrEqual(30);
    expect(receiver.control).toBe('human');
    expect(passer.control).toBe('ai');
    expect(world.pendingHitstopFrames).toBe(FEEL.pass.hitstopFrames);
    expect(world.events).toEqual([
      {
        type: 'pass',
        tick: 0,
        at: { x: 0, y: 0, z: 0 },
      },
    ]);
    expect(world.input.passBuf).toBe(0);
  });

  it('does not pass or consume the buffer when the controlled player does not own the ball', () => {
    const world = createWorld(4);
    world.ball.owner = null;
    world.ball.vel.x = 2;
    world.intent.pass = true;
    pressAction(world.input, 'pass');

    actionSystem(world, 1 / 60);

    expect(world.ball.owner).toBeNull();
    expect(world.ball.vel.x).toBe(2);
    expect(world.events).toEqual([]);
    expect(world.input.passBuf).toBeGreaterThan(0);
  });

  it('picks the better forward teammate when multiple pass targets are available', () => {
    const world = createWorld(5);
    const passer = getControlledPlayer(world);
    const better = playerById(world, 4);
    const worse = playerById(world, 1);
    movePlayer(passer, 0, 0);
    movePlayer(better, 6, 0);
    movePlayer(worse, 3, 4);
    passer.facing = Math.PI / 2;
    world.ball.owner = passer.id;
    world.intent.pass = true;
    pressAction(world.input, 'pass');

    actionSystem(world, 1 / 60);

    expect(world.controlledId).toBe(better.id);
  });

  it('cleanly tackles a nearby opponent ball carrier and staggers both players', () => {
    const world = createWorld(6);
    const tackler = getControlledPlayer(world);
    const carrier = playerById(world, 8);
    movePlayer(tackler, 0, 0);
    movePlayer(carrier, 1, 0);
    world.ball.owner = carrier.id;
    world.ball.pos = { x: 1, y: 0, z: 0 };
    world.intent.tackle = true;
    pressAction(world.input, 'tackle');

    actionSystem(world, 1 / 60);

    expect(world.ball.owner).toBeNull();
    expect(world.ball.cooldown).toBeGreaterThan(0);
    expect(world.ball.vel.x).toBeCloseTo(TACKLE.popSpeed);
    expect(world.ball.vel.z).toBeCloseTo(0);
    expect(tackler.recoverFrames).toBe(TACKLE.cleanRecoverTicks);
    expect(carrier.recoverFrames).toBe(TACKLE.cleanRecoverTicks + 4);
    expect(world.pendingHitstopFrames).toBe(FEEL.tackleClean.hitstopFrames);
    expect(world.events).toEqual([
      {
        type: 'tackleClean',
        tick: 0,
        at: { x: 1, y: 0, z: 0 },
      },
    ]);
    expect(world.input.tackleBuf).toBe(0);
  });

  it('whiffs an out-of-range tackle and leaves the ball unchanged', () => {
    const world = createWorld(7);
    const tackler = getControlledPlayer(world);
    const carrier = playerById(world, 8);
    movePlayer(tackler, 0, 0);
    movePlayer(carrier, TACKLE.range + 1, 0);
    world.ball.owner = carrier.id;
    world.ball.vel.x = 3;
    world.ball.vel.z = -2;
    world.intent.tackle = true;
    pressAction(world.input, 'tackle');

    actionSystem(world, 1 / 60);

    expect(world.ball.owner).toBe(carrier.id);
    expect(world.ball.vel).toEqual({ x: 3, y: 0, z: -2 });
    expect(tackler.recoverFrames).toBe(TACKLE.whiffRecoverTicks);
    expect(carrier.recoverFrames).toBe(0);
    expect(world.pendingHitstopFrames).toBe(0);
    expect(world.events).toEqual([
      {
        type: 'tackleWhiff',
        tick: 0,
        at: { x: 0, y: 0, z: 0 },
      },
    ]);
    expect(world.input.tackleBuf).toBe(0);
  });

  it('does not initiate pass or tackle actions while the controlled player is recovering', () => {
    const tackleWorld = createWorld(8);
    const tackler = getControlledPlayer(tackleWorld);
    const carrier = playerById(tackleWorld, 8);
    movePlayer(tackler, 0, 0);
    movePlayer(carrier, 1, 0);
    tackler.recoverFrames = 3;
    tackleWorld.ball.owner = carrier.id;
    tackleWorld.intent.tackle = true;
    pressAction(tackleWorld.input, 'tackle');

    actionSystem(tackleWorld, 1 / 60);

    expect(tackleWorld.ball.owner).toBe(carrier.id);
    expect(tackler.recoverFrames).toBe(3);
    expect(tackleWorld.events).toEqual([]);
    expect(tackleWorld.input.tackleBuf).toBeGreaterThan(0);

    const passWorld = createWorld(9);
    const passer = getControlledPlayer(passWorld);
    const receiver = playerById(passWorld, 4);
    movePlayer(passer, 0, 0);
    movePlayer(receiver, 6, 0);
    passer.facing = Math.PI / 2;
    passer.recoverFrames = 2;
    passWorld.ball.owner = passer.id;
    passWorld.intent.pass = true;
    pressAction(passWorld.input, 'pass');

    actionSystem(passWorld, 1 / 60);

    expect(passWorld.ball.owner).toBe(passer.id);
    expect(passWorld.controlledId).toBe(passer.id);
    expect(passer.recoverFrames).toBe(2);
    expect(passWorld.events).toEqual([]);
    expect(passWorld.input.passBuf).toBeGreaterThan(0);
  });
});
