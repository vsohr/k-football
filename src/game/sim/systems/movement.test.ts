import { PITCH, PLAYER_RADIUS } from '../../config/dimensions';
import { MOVE } from '../../config/pace';
import type { InputIntent } from '../../input/source';
import { createWorld, type Player, type World } from '../world';
import { movementSystem } from './movement';

const ZERO_INTENT: InputIntent = {
  moveX: 0,
  moveZ: 0,
  sprint: false,
  shoot: false,
  pass: false,
  tackle: false,
};

function setIntent(world: ReturnType<typeof createWorld>, intent: Partial<InputIntent>): void {
  world.intent = { ...ZERO_INTENT, ...intent };
}

function getControlledPlayer(world: World): Player {
  const player = world.players.find((candidate) => candidate.id === world.controlledId);

  if (player === undefined) {
    throw new Error(`missing controlled player ${world.controlledId}`);
  }

  return player;
}

function horizontalSpeed(x: number, z: number): number {
  return Math.hypot(x, z);
}

describe('movementSystem', () => {
  it('accelerates the controlled player toward intent and caps regular speed', () => {
    const world = createWorld(1);
    const player = getControlledPlayer(world);
    const initialX = player.pos.x;
    setIntent(world, { moveX: 1 });

    movementSystem(world, 1);

    expect(player.prevPos).toEqual(player.anchor);
    expect(player.vel.x).toBeCloseTo(MOVE.maxSpeed);
    expect(player.vel.z).toBeCloseTo(0);
    expect(horizontalSpeed(player.vel.x, player.vel.z)).toBeLessThanOrEqual(MOVE.maxSpeed);
    expect(player.pos.x).toBeGreaterThan(initialX);
  });

  it('raises the speed cap while sprinting', () => {
    const world = createWorld(2);
    const player = getControlledPlayer(world);
    setIntent(world, { moveX: 1, sprint: true });

    movementSystem(world, 1);

    expect(horizontalSpeed(player.vel.x, player.vel.z)).toBeCloseTo(MOVE.sprintMaxSpeed);
    expect(player.vel.x).toBeGreaterThan(MOVE.maxSpeed);
  });

  it('applies friction toward zero when there is no movement input', () => {
    const world = createWorld(3);
    const player = getControlledPlayer(world);
    player.vel.x = 5;
    setIntent(world, {});

    movementSystem(world, 1);

    expect(player.vel.x).toBeCloseTo(0);
    expect(player.vel.z).toBeCloseTo(0);
  });

  it('slews facing toward the movement direction', () => {
    const world = createWorld(4);
    const player = getControlledPlayer(world);
    setIntent(world, { moveZ: 1 });

    movementSystem(world, 1 / 60);

    expect(player.prevFacing).toBe(Math.PI / 2);
    expect(player.facing).toBeLessThan(Math.PI / 2);
    expect(player.facing).toBeGreaterThanOrEqual(Math.PI / 2 - MOVE.turnRate / 60);
  });

  it('clamps the controlled player inside the pitch and zeros clamped velocity', () => {
    const world = createWorld(5);
    const player = getControlledPlayer(world);
    const maxX = PITCH.halfX - PLAYER_RADIUS;
    player.pos.x = maxX - 0.1;
    player.vel.x = MOVE.maxSpeed;
    setIntent(world, { moveX: 1 });

    movementSystem(world, 1);

    expect(player.pos.x).toBeCloseTo(maxX);
    expect(player.pos.y).toBe(0);
    expect(player.vel.x).toBe(0);
  });

  it('moves every dummy back toward its anchor and settles without jitter', () => {
    const world = createWorld(6);
    const dummy = world.players.find(
      (player) => player.team === 0 && player.id !== world.controlledId && player.role === 'DEF',
    );

    if (dummy === undefined) {
      throw new Error('missing home defender dummy');
    }

    dummy.pos.x = dummy.anchor.x + 5;
    dummy.pos.z = dummy.anchor.z;
    dummy.prevPos.x = dummy.pos.x;
    dummy.prevPos.z = dummy.pos.z;

    const initialDistance = Math.hypot(dummy.pos.x - dummy.anchor.x, dummy.pos.z - dummy.anchor.z);

    for (let i = 0; i < 180; i += 1) {
      movementSystem(world, 1 / 60);
    }

    const settledDistance = Math.hypot(
      dummy.pos.x - dummy.anchor.x,
      dummy.pos.z - dummy.anchor.z,
    );
    expect(settledDistance).toBeLessThan(initialDistance);
    expect(settledDistance).toBeLessThan(0.16);
    expect(horizontalSpeed(dummy.vel.x, dummy.vel.z)).toBeLessThan(0.2);

    for (let i = 0; i < 30; i += 1) {
      movementSystem(world, 1 / 60);
    }

    expect(Math.hypot(dummy.pos.x - dummy.anchor.x, dummy.pos.z - dummy.anchor.z)).toBeLessThan(
      0.16,
    );
    expect(horizontalSpeed(dummy.vel.x, dummy.vel.z)).toBeLessThan(0.05);
  });

  it('keeps all players inside the pitch', () => {
    const world = createWorld(7);
    const maxX = PITCH.halfX - PLAYER_RADIUS;
    const maxZ = PITCH.halfZ - PLAYER_RADIUS;

    for (const player of world.players) {
      player.pos.x = maxX - 0.05;
      player.pos.z = maxZ - 0.05;
      player.vel.x = MOVE.maxSpeed;
      player.vel.z = MOVE.maxSpeed;
    }

    setIntent(world, { moveX: 1, moveZ: 1, sprint: true });
    movementSystem(world, 1);

    for (const player of world.players) {
      expect(player.pos.x).toBeLessThanOrEqual(maxX);
      expect(player.pos.z).toBeLessThanOrEqual(maxZ);
      expect(player.pos.y).toBe(0);
    }
  });

  it('locks recovering players to friction-only movement and decrements recovery', () => {
    const world = createWorld(8);
    const controlled = getControlledPlayer(world);
    const dummy = world.players.find(
      (player) => player.team === 0 && player.id !== world.controlledId && player.role === 'DEF',
    );

    if (dummy === undefined) {
      throw new Error('missing home defender dummy');
    }

    controlled.recoverFrames = 2;
    controlled.vel.x = 5;
    controlled.facing = Math.PI / 2;
    dummy.recoverFrames = 1;
    dummy.pos.x = dummy.anchor.x + 4;
    dummy.prevPos.x = dummy.pos.x;
    dummy.vel.x = -5;
    setIntent(world, { moveZ: 1 });

    movementSystem(world, 0.1);

    expect(controlled.recoverFrames).toBe(1);
    expect(controlled.vel.x).toBeCloseTo(2);
    expect(controlled.vel.z).toBeCloseTo(0);
    expect(controlled.facing).toBe(Math.PI / 2);
    expect(dummy.recoverFrames).toBe(0);
    expect(dummy.vel.x).toBeCloseTo(-2);
    expect(dummy.vel.z).toBeCloseTo(0);
  });
});
