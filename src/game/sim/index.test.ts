import { simulate } from './index';
import { createWorld } from './world';

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
    world.ball.pos.x = 19.9;
    world.ball.vel.x = 10;
    world.ball.vel.z = 0;

    simulate(world, 0.1);

    expect(world.ball.pos.x).toBe(20);
    expect(world.ball.vel.x).toBeLessThan(0);
    expect(world.ball.pos.z).toBeGreaterThanOrEqual(-20);
    expect(world.ball.pos.z).toBeLessThanOrEqual(20);
  });

  it('bounces the ball off the z boundary and clamps inside the pitch', () => {
    const world = createWorld(7);
    world.ball.pos.z = -19.9;
    world.ball.vel.x = 0;
    world.ball.vel.z = -10;

    simulate(world, 0.1);

    expect(world.ball.pos.z).toBe(-20);
    expect(world.ball.vel.z).toBeGreaterThan(0);
    expect(world.ball.pos.x).toBeGreaterThanOrEqual(-20);
    expect(world.ball.pos.x).toBeLessThanOrEqual(20);
  });

  it('leaves feel events queued for presentation to drain', () => {
    const world = createWorld(8);
    world.events.push({ type: 'bounce', tick: 0 });

    simulate(world, 1 / 60);

    expect(world.events).toEqual([{ type: 'bounce', tick: 0 }]);
  });
});
