import { GOAL, PITCH } from '../../config/dimensions';
import { BALL, KEEPER } from '../../config/pace';
import { simulate } from '../index';
import { createWorld, type Player, type World } from '../world';
import { keeperSystem } from './keeper';

const DT = 1 / 60;

function playerById(world: World, id: number): Player {
  const player = world.players.find((candidate) => candidate.id === id);

  if (player === undefined) {
    throw new Error(`missing player ${id}`);
  }

  return player;
}

function keeperLineX(team: 0 | 1): number {
  return team === 0 ? -PITCH.halfX + KEEPER.lineInset : PITCH.halfX - KEEPER.lineInset;
}

function placeKeeper(keeper: Player, z: number): void {
  const lineX = keeperLineX(keeper.team);

  keeper.pos.x = lineX;
  keeper.pos.y = 0;
  keeper.pos.z = z;
  keeper.prevPos = { ...keeper.pos };
  keeper.vel.x = 0;
  keeper.vel.y = 0;
  keeper.vel.z = 0;
  keeper.keeperState = 'SET';
  keeper.keeperTimer = 0;
  keeper.holdTimer = 0;
}

function setLooseShot(world: World, x: number, z: number, velX: number, velZ: number): void {
  world.match.phase = 'PLAYING';
  world.ball.owner = null;
  world.ball.pendingImpulse = null;
  world.ball.cooldown = 30;
  world.ball.pos.x = x;
  world.ball.pos.y = 0;
  world.ball.pos.z = z;
  world.ball.prevPos = { ...world.ball.pos };
  world.ball.vel.x = velX;
  world.ball.vel.y = 0;
  world.ball.vel.z = velZ;
}

function saveEvents(world: World): number {
  return world.events.filter((event) => event.type === 'save').length;
}

describe('keeperSystem', () => {
  it('saves an on-target shot within reach and misses a placed shot outside reach', () => {
    const savedWorld = createWorld(1);
    const savedKeeper = playerById(savedWorld, 0);
    placeKeeper(savedKeeper, 0);
    setLooseShot(savedWorld, -17, 0, -BALL.shotSpeed, 0);

    for (let i = 0; i < 40 && saveEvents(savedWorld) === 0; i += 1) {
      simulate(savedWorld, DT);
    }

    expect(saveEvents(savedWorld)).toBe(1);
    expect(savedWorld.match.phase).toBe('PLAYING');
    expect(savedWorld.ball.vel.x).toBeGreaterThanOrEqual(0);

    const missedWorld = createWorld(2);
    const missedKeeper = playerById(missedWorld, 0);
    placeKeeper(missedKeeper, -KEEPER.zClamp);
    setLooseShot(missedWorld, -17, GOAL.halfWidth - 0.8, -BALL.shotSpeed, 0);

    for (let i = 0; i < 80 && missedWorld.match.phase === 'PLAYING'; i += 1) {
      simulate(missedWorld, DT);
    }

    expect(saveEvents(missedWorld)).toBe(0);
    expect(missedWorld.match.phase).toBe('GOAL');
  });

  it('tracks the ball z along the keeper line and clamps patrol width', () => {
    const world = createWorld(3);
    const keeper = playerById(world, 0);
    placeKeeper(keeper, 0);
    setLooseShot(world, 0, KEEPER.zClamp + 4, 0, 0);

    for (let i = 0; i < 80; i += 1) {
      keeperSystem(world, DT);
    }

    expect(keeper.pos.x).toBeCloseTo(keeperLineX(0));
    expect(keeper.pos.z).toBeCloseTo(KEEPER.zClamp);
    expect(keeper.facing).toBeGreaterThan(0);
  });

  it('delays commit by reaction ticks and keeps the original dive direction', () => {
    const world = createWorld(4);
    const keeper = playerById(world, 0);
    placeKeeper(keeper, 0);
    setLooseShot(world, keeperLineX(0) + 0.3, 0, -KEEPER.catchSpeedMax + 1, 0);

    for (let i = 0; i < KEEPER.reactionTicks; i += 1) {
      keeperSystem(world, DT);
      expect(saveEvents(world)).toBe(0);
      expect(world.ball.owner).toBeNull();
    }

    keeperSystem(world, DT);
    expect(saveEvents(world)).toBe(1);

    const diveWorld = createWorld(5);
    const diveKeeper = playerById(diveWorld, 0);
    placeKeeper(diveKeeper, 0);
    setLooseShot(diveWorld, keeperLineX(0) + 4, KEEPER.zClamp, -KEEPER.catchSpeedMax + 1, 0);

    for (let i = 0; i <= KEEPER.reactionTicks; i += 1) {
      keeperSystem(diveWorld, DT);
    }

    expect(diveKeeper.keeperState).toBe('COMMIT');
    expect(diveKeeper.vel.z).toBeGreaterThan(0);
    const zBeforeRedecisionAttempt = diveKeeper.pos.z;

    diveWorld.ball.pos.z = -KEEPER.zClamp;
    keeperSystem(diveWorld, DT);

    expect(diveKeeper.pos.z).toBeGreaterThan(zBeforeRedecisionAttempt);
    expect(diveKeeper.vel.z).toBeGreaterThan(0);
  });

  it('catches a slow central shot and auto-distributes to a teammate', () => {
    const world = createWorld(6);
    const keeper = playerById(world, 0);
    placeKeeper(keeper, 0);
    setLooseShot(world, keeperLineX(0) + 0.3, 0, -KEEPER.catchSpeedMax + 1, 0);

    for (let i = 0; i <= KEEPER.reactionTicks; i += 1) {
      keeperSystem(world, DT);
    }

    expect(saveEvents(world)).toBe(1);
    expect(world.ball.owner).toBe(keeper.id);
    expect(keeper.holdTimer).toBe(KEEPER.distributeTicks);

    for (let i = 0; i < KEEPER.distributeTicks; i += 1) {
      keeperSystem(world, DT);
      expect(world.ball.owner).toBe(keeper.id);
    }

    keeperSystem(world, DT);

    expect(world.ball.owner).toBeNull();
    expect(world.ball.vel.x).toBeGreaterThan(0);
    expect(Math.hypot(world.ball.vel.x, world.ball.vel.z)).toBeGreaterThan(0);
  });

  it('parries a fast shot loose instead of catching it', () => {
    const world = createWorld(7);
    const keeper = playerById(world, 0);
    placeKeeper(keeper, 0);
    setLooseShot(world, keeperLineX(0) + 0.3, 0, -BALL.shotSpeed, 0);

    for (let i = 0; i <= KEEPER.reactionTicks; i += 1) {
      keeperSystem(world, DT);
    }

    expect(saveEvents(world)).toBe(1);
    expect(world.ball.owner).toBeNull();
    expect(world.ball.vel.x).toBeGreaterThan(0);
    expect(keeper.keeperState).toBe('RECOVER');
    expect(keeper.keeperTimer).toBe(KEEPER.recoverTicks);
  });
});
