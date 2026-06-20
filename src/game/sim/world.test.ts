import { FORMATION_2_2, anchorFor, type Role } from '../config/formations';
import { MATCH } from '../config/pace';
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
    role: Role;
    control: 'human' | 'ai';
    anchor: { x: number; y: number; z: number };
    pos: { x: number; y: number; z: number };
    prevPos: { x: number; y: number; z: number };
    vel: { x: number; y: number; z: number };
    facing: number;
    prevFacing: number;
    recoverFrames: number;
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
    phaseTimer: number;
    kickoffTeam: 0 | 1;
  };
  eventsLength: number;
  pendingHitstopFrames: number;
  switchCooldown: number;
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
      role: player.role,
      control: player.control,
      anchor: { ...player.anchor },
      pos: { ...player.pos },
      prevPos: { ...player.prevPos },
      vel: { ...player.vel },
      facing: player.facing,
      prevFacing: player.prevFacing,
      recoverFrames: player.recoverFrames,
    })),
    controlledId: world.controlledId,
    intent: { ...world.intent },
    input: { ...world.input },
    match: { ...world.match },
    eventsLength: world.events.length,
    pendingHitstopFrames: world.pendingHitstopFrames,
    switchCooldown: world.switchCooldown,
    rngDraws: [world.rng.next(), world.rng.next(), world.rng.next()],
  };
}

describe('world state', () => {
  it('creates deterministic initial world state for a seed', () => {
    const first = createWorld(1234);
    const second = createWorld(1234);

    expect(snapshotWorld(first)).toEqual(snapshotWorld(second));
    expect(first.match.phase).toBe('KICKOFF');
    expect(first.match.phaseTimer).toBe(MATCH.kickoffBeatSec);
    expect(first.match.kickoffTeam).toBe(0);
    expect(first.ball.pos).toEqual({ x: 0, y: 0, z: 0 });
    expect(first.ball.prevPos).toEqual({ x: 0, y: 0, z: 0 });
    expect(first.ball.vel).toEqual({ x: 0, y: 0, z: 0 });
    expect(first.ball.owner).toBeNull();
    expect(first.ball.pendingImpulse).toBeNull();
    expect(first.ball.cooldown).toBe(0);
    expect(first.pendingHitstopFrames).toBe(0);
    expect(first.switchCooldown).toBe(0);
    expect(first.players).toHaveLength(10);
    expect(first.players.filter((player) => player.team === 0)).toHaveLength(5);
    expect(first.players.filter((player) => player.team === 1)).toHaveLength(5);

    for (const team of [0, 1] as const) {
      const facing = team === 0 ? Math.PI / 2 : -Math.PI / 2;
      for (let slotIndex = 0; slotIndex < FORMATION_2_2.length; slotIndex += 1) {
        const slot = FORMATION_2_2[slotIndex];
        const player = first.players[team * 5 + slotIndex];
        const anchor = anchorFor(slot, team);

        expect(player).toMatchObject({
          id: team * 5 + slotIndex,
          team,
          role: slot.role,
          anchor,
          pos: anchor,
          prevPos: anchor,
          vel: { x: 0, y: 0, z: 0 },
          facing,
          prevFacing: facing,
          recoverFrames: 0,
        });
      }
    }

    const controlled = first.players.find((player) => player.id === first.controlledId);
    expect(controlled).toMatchObject({ id: 3, team: 0, role: 'FWD', control: 'human' });
    expect(first.players.filter((player) => player.control === 'human')).toHaveLength(1);
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
    world.switchCooldown = 9;
    world.players[0].pos.x = 12;
    world.players[0].vel.z = 7;
    world.players[0].facing = 3;
    world.players[0].recoverFrames = 11;
    world.players[0].control = 'human';
    world.players[3].control = 'ai';
    world.controlledId = 0;
    world.intent.shoot = true;
    world.input.moveX = 1;
    world.input.shootBuf = 4;
    world.match.phase = 'GOAL';
    world.match.scoreHome = 2;
    world.match.clockSec = 88;
    world.match.phaseTimer = 1.2;
    world.match.kickoffTeam = 1;
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
