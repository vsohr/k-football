import {
  BALL_RADIUS,
  BALL,
  BINDINGS,
  DRIBBLE,
  FEEL,
  GOAL,
  KEEPER,
  MATCH,
  MOVE,
  PASS,
  PITCH,
  PLAYER_RADIUS,
  SHOOT_BUFFER_TICKS,
  TACKLE,
  FORMATION_2_2,
  actionSystem,
  anchorFor,
  ballSystem,
  consumeAction,
  createLoop,
  createInputSource,
  createRng,
  createTime,
  createWorld,
  inputSystem,
  keeperSystem,
  matchSystem,
  movementSystem,
  pressAction,
  requestHitstop,
  resetWorld,
  sampleIntent,
  simulate,
  shootHitstopFrames,
  shootTrauma,
  setMove,
  setSprint,
  switchSystem,
  type InputIntent,
  type InputSource,
  type KeeperState,
  type LoopResult,
  type Player,
  type Role,
  type Slot,
  type Rng,
  type World,
} from './index';

function getControlledPlayer(world: World): Player {
  const player = world.players.find((candidate) => candidate.id === world.controlledId);

  if (player === undefined) {
    throw new Error(`missing controlled player ${world.controlledId}`);
  }

  return player;
}

describe('game public API', () => {
  it('re-exports the deterministic core and sim surface', () => {
    const rng: Rng = createRng(10);
    const time = createTime();
    const world: World = createWorld(10);
    const source: InputSource = createInputSource();
    const player: Player = getControlledPlayer(world);
    const intent: InputIntent = sampleIntent(source);
    const keeperState: KeeperState = 'SET';
    const role: Role = 'FWD';
    const slot: Slot = FORMATION_2_2[0];

    setMove(source, 1, 0);
    setSprint(source, true);
    pressAction(source, 'shoot');
    consumeAction(source, 'shoot');
    inputSystem(world);
    switchSystem(world);
    movementSystem(world, 0);
    ballSystem(world, 0);
    actionSystem(world, 0);
    keeperSystem(world, 0);
    matchSystem(world, 0);
    requestHitstop(time, 1);
    simulate(world, 1 / 60);
    resetWorld(world, 10);

    const result: LoopResult = createLoop({
      time,
      simulate: () => undefined,
    }).advance(0);

    expect(rng.next()).toBeGreaterThanOrEqual(0);
    expect(time.hitstopRemaining).toBeCloseTo(1 / 60);
    expect(world.tick).toBe(0);
    expect(player.id).toBe(3);
    expect(role).toBe('FWD');
    expect(keeperState).toBe('SET');
    expect(slot.role).toBe('GK');
    expect(anchorFor(slot, 1).x).toBeGreaterThan(0);
    expect(intent.shoot).toBe(false);
    expect(PITCH.halfX).toBe(21);
    expect(GOAL.halfWidth).toBe(3.5);
    expect(PLAYER_RADIUS).toBe(0.5);
    expect(BALL_RADIUS).toBe(0.22);
    expect(MOVE.maxSpeed).toBe(8);
    expect(MATCH.halfLengthSec).toBe(120);
    expect(BALL.shotSpeed).toBe(22);
    expect(KEEPER.reach).toBe(2.2);
    expect(DRIBBLE.distance).toBe(0.9);
    expect(PASS.speed).toBe(16);
    expect(TACKLE.range).toBe(1.5);
    expect(FEEL.shoot.sfx).toBe('shoot');
    expect(shootHitstopFrames(1)).toBe(7);
    expect(shootTrauma(1)).toBeCloseTo(0.6);
    expect(BINDINGS.KeyW).toBe('up');
    expect(SHOOT_BUFFER_TICKS).toBe(6);
    expect(result.steps).toBe(0);
  });
});
