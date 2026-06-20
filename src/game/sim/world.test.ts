import { createWorld, resetWorld, type World } from './world';

interface WorldSnapshot {
  tick: number;
  ball: {
    pos: { x: number; y: number; z: number };
    prevPos: { x: number; y: number; z: number };
    vel: { x: number; y: number; z: number };
    owner: number | null;
    pendingImpulse: { x: number; y: number; z: number } | null;
    cooldown: number;
  };
  players: Array<{
    id: number;
    team: 0 | 1;
    control: 'human' | 'ai';
    pos: { x: number; y: number; z: number };
    prevPos: { x: number; y: number; z: number };
    vel: { x: number; y: number; z: number };
    facing: number;
    prevFacing: number;
  }>;
  controlledId: number;
  intent: {
    moveX: number;
    moveZ: number;
    sprint: boolean;
    shoot: boolean;
    pass: boolean;
    tackle: boolean;
  };
  input: {
    moveX: number;
    moveZ: number;
    sprint: boolean;
    shootBuf: number;
    passBuf: number;
    tackleBuf: number;
  };
  match: {
    phase: string;
    scoreHome: number;
    scoreAway: number;
    clockSec: number;
    half: 1 | 2;
  };
  eventsLength: number;
  pendingHitstopFrames: number;
  rngDraws: number[];
}

function snapshotWorld(world: World): WorldSnapshot {
  return {
    tick: world.tick,
    ball: {
      pos: { ...world.ball.pos },
      prevPos: { ...world.ball.prevPos },
      vel: { ...world.ball.vel },
      owner: world.ball.owner,
      pendingImpulse:
        world.ball.pendingImpulse === null ? null : { ...world.ball.pendingImpulse },
      cooldown: world.ball.cooldown,
    },
    players: world.players.map((player) => ({
      id: player.id,
      team: player.team,
      control: player.control,
      pos: { ...player.pos },
      prevPos: { ...player.prevPos },
      vel: { ...player.vel },
      facing: player.facing,
      prevFacing: player.prevFacing,
    })),
    controlledId: world.controlledId,
    intent: { ...world.intent },
    input: { ...world.input },
    match: { ...world.match },
    eventsLength: world.events.length,
    pendingHitstopFrames: world.pendingHitstopFrames,
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
    expect(first.ball.owner).toBeNull();
    expect(first.ball.pendingImpulse).toBeNull();
    expect(first.ball.cooldown).toBe(0);
    expect(first.pendingHitstopFrames).toBe(0);
    expect(first.players).toHaveLength(1);
    expect(first.players[0]).toMatchObject({
      id: 0,
      team: 0,
      control: 'human',
      pos: { x: -3, y: 0, z: 0 },
      prevPos: { x: -3, y: 0, z: 0 },
      vel: { x: 0, y: 0, z: 0 },
      facing: 0,
      prevFacing: 0,
    });
    expect(first.controlledId).toBe(0);
  });

  it('resets an existing world to its initial state', () => {
    const world = createWorld(42);
    const initialEvents = world.events;

    world.tick = 99;
    world.ball.pos.x = 10;
    world.ball.prevPos.z = -8;
    world.ball.vel.x = -100;
    world.ball.owner = 0;
    world.ball.pendingImpulse = { x: 3, y: 0, z: 4 };
    world.ball.cooldown = 12;
    world.players[0].pos.x = 12;
    world.players[0].vel.z = 7;
    world.players[0].facing = 3;
    world.intent.shoot = true;
    world.input.moveX = 1;
    world.input.shootBuf = 4;
    world.match.phase = 'GOAL';
    world.match.scoreHome = 2;
    world.match.clockSec = 88;
    world.events.push({ type: 'bounce', tick: world.tick });
    world.pendingHitstopFrames = 3;
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
