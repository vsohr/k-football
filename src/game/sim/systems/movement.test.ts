import { PITCH, PLAYER_RADIUS } from '../../config/dimensions';
import { MOVE } from '../../config/pace';
import type { InputIntent } from '../../input/source';
import { createWorld } from '../world';
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

function horizontalSpeed(x: number, z: number): number {
  return Math.hypot(x, z);
}

describe('movementSystem', () => {
  it('accelerates the controlled player toward intent and caps regular speed', () => {
    const world = createWorld(1);
    const player = world.players[0];
    setIntent(world, { moveX: 1 });

    movementSystem(world, 1);

    expect(player.prevPos).toEqual({ x: -3, y: 0, z: 0 });
    expect(player.vel.x).toBeCloseTo(MOVE.maxSpeed);
    expect(player.vel.z).toBeCloseTo(0);
    expect(horizontalSpeed(player.vel.x, player.vel.z)).toBeLessThanOrEqual(MOVE.maxSpeed);
    expect(player.pos.x).toBeGreaterThan(-3);
  });

  it('raises the speed cap while sprinting', () => {
    const world = createWorld(2);
    const player = world.players[0];
    setIntent(world, { moveX: 1, sprint: true });

    movementSystem(world, 1);

    expect(horizontalSpeed(player.vel.x, player.vel.z)).toBeCloseTo(MOVE.sprintMaxSpeed);
    expect(player.vel.x).toBeGreaterThan(MOVE.maxSpeed);
  });

  it('applies friction toward zero when there is no movement input', () => {
    const world = createWorld(3);
    const player = world.players[0];
    player.vel.x = 5;
    setIntent(world, {});

    movementSystem(world, 1);

    expect(player.vel.x).toBeCloseTo(0);
    expect(player.vel.z).toBeCloseTo(0);
  });

  it('slews facing toward the movement direction', () => {
    const world = createWorld(4);
    const player = world.players[0];
    setIntent(world, { moveX: 1 });

    movementSystem(world, 1 / 60);

    expect(player.prevFacing).toBe(0);
    expect(player.facing).toBeGreaterThan(0);
    expect(player.facing).toBeLessThanOrEqual(MOVE.turnRate / 60);
  });

  it('clamps the controlled player inside the pitch and zeros clamped velocity', () => {
    const world = createWorld(5);
    const player = world.players[0];
    const maxX = PITCH.halfX - PLAYER_RADIUS;
    player.pos.x = maxX - 0.1;
    player.vel.x = MOVE.maxSpeed;
    setIntent(world, { moveX: 1 });

    movementSystem(world, 1);

    expect(player.pos.x).toBeCloseTo(maxX);
    expect(player.pos.y).toBe(0);
    expect(player.vel.x).toBe(0);
  });
});
