import { createWorld, resetWorld, type World } from './world';

interface WorldSnapshot {
  tick: number;
  ball: {
    pos: { x: number; y: number; z: number };
    prevPos: { x: number; y: number; z: number };
    vel: { x: number; y: number; z: number };
  };
  match: {
    phase: string;
    scoreHome: number;
    scoreAway: number;
    clockSec: number;
    half: 1 | 2;
  };
  eventsLength: number;
  rngDraws: number[];
}

function snapshotWorld(world: World): WorldSnapshot {
  return {
    tick: world.tick,
    ball: {
      pos: { ...world.ball.pos },
      prevPos: { ...world.ball.prevPos },
      vel: { ...world.ball.vel },
    },
    match: { ...world.match },
    eventsLength: world.events.length,
    rngDraws: [world.rng.next(), world.rng.next(), world.rng.next()],
  };
}

describe('world state', () => {
  it('creates deterministic initial world state for a seed', () => {
    const first = createWorld(1234);
    const second = createWorld(1234);

    expect(snapshotWorld(first)).toEqual(snapshotWorld(second));
    expect(first.match.phase).toBe('PLAYING');
    expect(first.ball.pos).toEqual({ x: 0, y: 0, z: 0 });
    expect(first.ball.prevPos).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('resets an existing world to its initial state', () => {
    const world = createWorld(42);
    const initialEvents = world.events;

    world.tick = 99;
    world.ball.pos.x = 10;
    world.ball.prevPos.z = -8;
    world.ball.vel.x = -100;
    world.match.phase = 'GOAL';
    world.match.scoreHome = 2;
    world.match.clockSec = 88;
    world.events.push({ type: 'bounce', tick: world.tick });
    world.rng.next();

    resetWorld(world);

    expect(snapshotWorld(world)).toEqual(snapshotWorld(createWorld(42)));
    expect(world.events).toBe(initialEvents);
  });

  it('can reset with an explicit replacement seed', () => {
    const world = createWorld(1);

    resetWorld(world, 2);

    expect(snapshotWorld(world)).toEqual(snapshotWorld(createWorld(2)));
  });
});
