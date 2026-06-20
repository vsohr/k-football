import { AI } from '../../config/ai';
import { BALL_RADIUS, PITCH, PLAYER_RADIUS } from '../../config/dimensions';
import { simulate } from '../index';
import { createWorld, type Player, type Vec3, type World } from '../world';
import { aiSystem } from './ai';
import { ballSystem } from './ball';
import { movementSystem } from './movement';

const STEP = 1 / 60;

interface AiSnapshot {
  chaser: [number, number];
  controlledId: number;
  ballOwner: number | null;
  ballPendingImpulse: Vec3 | null;
  events: string[];
  players: Array<{
    id: number;
    aiMoveX: number;
    aiMoveZ: number;
    aiSprint: boolean;
    decisionTimer: number;
    recoverFrames: number;
  }>;
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
  player.vel.x = 0;
  player.vel.y = 0;
  player.vel.z = 0;
}

function setBall(world: World, x: number, z: number): void {
  world.ball.pos.x = x;
  world.ball.pos.y = 0;
  world.ball.pos.z = z;
  world.ball.prevPos.x = x;
  world.ball.prevPos.y = 0;
  world.ball.prevPos.z = z;
  world.ball.vel.x = 0;
  world.ball.vel.y = 0;
  world.ball.vel.z = 0;
}

function snapshotAi(world: World): AiSnapshot {
  return {
    chaser: [...world.chaser],
    controlledId: world.controlledId,
    ballOwner: world.ball.owner,
    ballPendingImpulse:
      world.ball.pendingImpulse === null ? null : { ...world.ball.pendingImpulse },
    events: world.events.map((event) => event.type),
    players: world.players.map((player) => ({
      id: player.id,
      aiMoveX: player.aiMoveX,
      aiMoveZ: player.aiMoveZ,
      aiSprint: player.aiSprint,
      decisionTimer: player.decisionTimer,
      recoverFrames: player.recoverFrames,
    })),
  };
}

function horizontalDistance(a: Vec3, b: Vec3): number {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

describe('aiSystem', () => {
  it('designates the nearest outfield chaser and keeps it through small hysteresis changes', () => {
    const world = createWorld(1);
    const chaser = playerById(world, 6);
    const challenger = playerById(world, 7);
    setBall(world, 0, 0);
    movePlayer(chaser, 2, 0);
    movePlayer(challenger, 5, 0);

    aiSystem(world, STEP);

    expect(world.chaser[1]).toBe(chaser.id);

    movePlayer(chaser, 2.1, 0);
    movePlayer(challenger, 1.4, 0);

    aiSystem(world, STEP);

    expect(world.chaser[1]).toBe(chaser.id);

    movePlayer(challenger, 0.3, 0);

    aiSystem(world, STEP);

    expect(world.chaser[1]).toBe(challenger.id);
  });

  it('steers the defensive chaser toward the predicted ball position', () => {
    const world = createWorld(2);
    const chaser = playerById(world, 6);
    const carrier = playerById(world, 3);
    movePlayer(chaser, 7, 0);
    movePlayer(playerById(world, 7), 12, 0);
    movePlayer(playerById(world, 8), 12, 10);
    movePlayer(playerById(world, 9), 12, -10);
    movePlayer(carrier, 0, 0);
    setBall(world, 0, 0);
    world.ball.vel.x = 5;
    world.ball.owner = carrier.id;

    aiSystem(world, STEP);

    expect(world.chaser[1]).toBe(chaser.id);
    expect(chaser.aiMoveX).toBeLessThan(0);
    expect(Math.abs(chaser.aiMoveZ)).toBeLessThan(0.05);
    expect(chaser.aiSprint).toBe(true);
  });

  it('lets a non-chaser press and tackle when an opponent carrier enters its local zone', () => {
    const world = createWorld(3);
    const retainedChaser = playerById(world, 6);
    const localDefender = playerById(world, 7);
    const carrier = playerById(world, 3);
    world.chaser[1] = retainedChaser.id;
    movePlayer(carrier, 0, 0);
    movePlayer(retainedChaser, 1.6, 0);
    movePlayer(localDefender, 1.0, 0);
    setBall(world, 0, 0);
    world.ball.owner = carrier.id;

    aiSystem(world, STEP);

    expect(world.chaser[1]).toBe(retainedChaser.id);
    expect(world.ball.owner).toBeNull();
    expect(localDefender.recoverFrames).toBeGreaterThan(0);
    expect(carrier.recoverFrames).toBeGreaterThan(0);
    expect(world.events.at(-1)?.type).toBe('tackleClean');
  });

  it('pulls defending shape toward the ball without sending every defender straight to it', () => {
    const world = createWorld(4);
    const defender = playerById(world, 6);
    const chaser = playerById(world, 8);
    setBall(world, -6, 10);
    movePlayer(defender, defender.anchor.x, defender.anchor.z);
    movePlayer(chaser, -5, 9);
    world.chaser[1] = chaser.id;

    aiSystem(world, STEP);
    movementSystem(world, 0.5);

    expect(world.chaser[1]).toBe(chaser.id);
    expect(defender.pos.x).toBeLessThan(defender.anchor.x);
    expect(horizontalDistance(defender.pos, defender.anchor)).toBeLessThan(5);
    expect(horizontalDistance(defender.pos, world.ball.pos)).toBeGreaterThan(8);
  });

  it("moves an attacking AI forward into space ahead of the carrier's position", () => {
    const world = createWorld(5);
    const carrier = playerById(world, 3);
    const runner = playerById(world, 4);
    movePlayer(carrier, 0, 0);
    movePlayer(runner, -2, 4);
    setBall(world, 0, 0);
    world.ball.owner = carrier.id;

    aiSystem(world, STEP);

    expect(runner.aiMoveX).toBeGreaterThan(0);
    expect(runner.aiSprint).toBe(true);
  });

  it('shoots an AI carrier in range through an open central lane using a deferred impulse', () => {
    const world = createWorld(6);
    const shooter = playerById(world, 8);
    movePlayer(shooter, -PITCH.halfX + AI.shotRangeX - 1, 0);
    setBall(world, shooter.pos.x, shooter.pos.z);
    world.ball.owner = shooter.id;

    aiSystem(world, STEP);

    expect(world.ball.owner).toBeNull();
    expect(world.ball.vel).toEqual({ x: 0, y: 0, z: 0 });
    expect(world.ball.pendingImpulse?.x).toBeLessThan(0);
    expect(Math.abs(world.ball.pendingImpulse?.z ?? 0)).toBeLessThan(2);
    expect(world.pendingHitstopFrames).toBeGreaterThan(0);
    expect(world.events).toEqual([
      {
        type: 'shoot',
        tick: 0,
        power: 1,
        at: { ...world.ball.pos },
      },
    ]);

    const contactX = world.ball.pos.x;
    ballSystem(world, STEP);

    expect(world.ball.pendingImpulse).toBeNull();
    expect(world.ball.pos.x).toBeLessThan(contactX);
  });

  it('dribbles an AI carrier goalward when it is out of shooting range', () => {
    const world = createWorld(7);
    const carrier = playerById(world, 8);
    movePlayer(carrier, 0, 6);
    setBall(world, carrier.pos.x, carrier.pos.z);
    world.ball.owner = carrier.id;

    aiSystem(world, STEP);

    expect(world.ball.owner).toBe(carrier.id);
    expect(world.ball.pendingImpulse).toBeNull();
    expect(carrier.aiMoveX).toBeLessThan(0);
    expect(carrier.aiMoveZ).toBeLessThan(0);
  });

  it('passes to a clearly better teammate without changing human control', () => {
    const world = createWorld(19);
    const originalControlledId = world.controlledId;
    const passer = playerById(world, 8);
    const receiver = playerById(world, 9);
    movePlayer(passer, 0, 0);
    movePlayer(receiver, -8, 1);
    passer.facing = -Math.PI / 2;
    setBall(world, passer.pos.x, passer.pos.z);
    world.ball.owner = passer.id;

    aiSystem(world, STEP);

    expect(world.ball.owner).toBeNull();
    expect(world.ball.pendingImpulse).toBeNull();
    expect(world.ball.vel.x).toBeLessThan(0);
    expect(world.events.at(-1)?.type).toBe('pass');
    expect(world.controlledId).toBe(originalControlledId);
    expect(playerById(world, originalControlledId).control).toBe('human');
  });

  it('is deterministic for the same seed and scripted state', () => {
    const first = createWorld(20);
    const second = createWorld(20);

    for (const world of [first, second]) {
      const passer = playerById(world, 8);
      const receiver = playerById(world, 9);
      movePlayer(passer, 0, 0);
      movePlayer(receiver, -8, 1);
      passer.facing = -Math.PI / 2;
      setBall(world, passer.pos.x, passer.pos.z);
      world.ball.owner = passer.id;
      aiSystem(world, STEP);
    }

    expect(snapshotAi(first)).toEqual(snapshotAi(second));
  });

  it('runs a long simulation without frozen teams, swarming, or players leaving the pitch', () => {
    const world = createWorld(21);
    world.match.phase = 'PLAYING';

    for (let i = 0; i < 360; i += 1) {
      simulate(world, STEP);
    }

    const maxX = PITCH.halfX - PLAYER_RADIUS;
    const maxZ = PITCH.halfZ - PLAYER_RADIUS;
    const outfieldMoved = world.players.filter(
      (player) =>
        player.role !== 'GK' &&
        horizontalDistance(player.pos, player.anchor) > 0.5,
    );
    const nearBall = world.players.filter(
      (player) => player.role !== 'GK' && horizontalDistance(player.pos, world.ball.pos) < 3,
    );

    for (const player of world.players) {
      expect(player.pos.x).toBeGreaterThanOrEqual(-maxX);
      expect(player.pos.x).toBeLessThanOrEqual(maxX);
      expect(player.pos.z).toBeGreaterThanOrEqual(-maxZ);
      expect(player.pos.z).toBeLessThanOrEqual(maxZ);
      expect(player.pos.y).toBe(0);
    }

    expect(world.chaser[0]).not.toBe(-1);
    expect(world.chaser[1]).not.toBe(-1);
    expect(outfieldMoved.length).toBeGreaterThanOrEqual(4);
    expect(nearBall.length).toBeGreaterThanOrEqual(1);
    expect(nearBall.length).toBeLessThanOrEqual(5);
    expect(Math.hypot(world.ball.vel.x, world.ball.vel.z) + (world.ball.owner === null ? 0 : 1)).toBeGreaterThan(
      BALL_RADIUS,
    );
  });
});
