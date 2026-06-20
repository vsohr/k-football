import {
  BALL_RADIUS,
  BINDINGS,
  MOVE,
  PITCH,
  PLAYER_RADIUS,
  SHOOT_BUFFER_TICKS,
  ballSystem,
  consumeAction,
  createLoop,
  createInputSource,
  createRng,
  createTime,
  createWorld,
  inputSystem,
  movementSystem,
  pressAction,
  requestHitstop,
  resetWorld,
  sampleIntent,
  simulate,
  setMove,
  setSprint,
  type InputIntent,
  type InputSource,
  type LoopResult,
  type Player,
  type Rng,
  type World,
} from './index';

describe('game public API', () => {
  it('re-exports the deterministic core and sim surface', () => {
    const rng: Rng = createRng(10);
    const time = createTime();
    const world: World = createWorld(10);
    const source: InputSource = createInputSource();
    const player: Player = world.players[0];
    const intent: InputIntent = sampleIntent(source);

    setMove(source, 1, 0);
    setSprint(source, true);
    pressAction(source, 'shoot');
    consumeAction(source, 'shoot');
    inputSystem(world);
    movementSystem(world, 0);
    ballSystem(world, 0);
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
    expect(player.id).toBe(0);
    expect(intent.shoot).toBe(false);
    expect(PITCH.halfX).toBe(21);
    expect(PLAYER_RADIUS).toBe(0.5);
    expect(BALL_RADIUS).toBe(0.22);
    expect(MOVE.maxSpeed).toBe(8);
    expect(BINDINGS.KeyW).toBe('up');
    expect(SHOOT_BUFFER_TICKS).toBe(6);
    expect(result.steps).toBe(0);
  });
});
