import {
  createLoop,
  createRng,
  createTime,
  createWorld,
  requestHitstop,
  resetWorld,
  simulate,
  type LoopResult,
  type Rng,
  type World,
} from './index';

describe('game public API', () => {
  it('re-exports the deterministic core and sim surface', () => {
    const rng: Rng = createRng(10);
    const time = createTime();
    const world: World = createWorld(10);

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
    expect(result.steps).toBe(0);
  });
});
