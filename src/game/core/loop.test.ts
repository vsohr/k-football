import { createLoop } from './loop';
import { createTime } from './time';

describe('createLoop', () => {
  it('runs fixed simulation steps and accumulates fractional real time', () => {
    const time = createTime();
    const simulatedDts: number[] = [];
    const loop = createLoop({
      time,
      simulate: (dt) => {
        simulatedDts.push(dt);
      },
    });

    expect(loop.advance(1 / 60)).toEqual({ steps: 1, alpha: 0 });
    expect(simulatedDts).toEqual([1 / 60]);

    expect(loop.advance(1 / 120)).toEqual({ steps: 0, alpha: 0.5 });
    expect(loop.advance(1 / 120)).toEqual({ steps: 1, alpha: 0 });
    expect(simulatedDts).toEqual([1 / 60, 1 / 60]);
  });

  it('freezes simulation during hitstop while real-time effects continue', () => {
    const time = createTime();
    time.hitstopRemaining = 0.1;
    const realDts: number[] = [];
    let simSteps = 0;
    const loop = createLoop({
      time,
      simulate: () => {
        simSteps += 1;
      },
      onRealTime: (dt) => {
        realDts.push(dt);
      },
    });

    const result = loop.advance(1 / 60);

    expect(result.steps).toBe(0);
    expect(result.alpha).toBe(0);
    expect(simSteps).toBe(0);
    expect(realDts).toEqual([1 / 60]);
    expect(time.hitstopRemaining).toBeCloseTo(0.1 - 1 / 60);
    expect(loop.accumulator).toBe(0);
  });

  it('does not spend accumulated time when hitstop is active at the frame start', () => {
    const time = createTime();
    let simSteps = 0;
    const loop = createLoop({
      time,
      simulate: () => {
        simSteps += 1;
      },
    });

    expect(loop.advance(1 / 120)).toEqual({ steps: 0, alpha: 0.5 });
    time.hitstopRemaining = 1 / 60;

    const result = loop.advance(1 / 60);

    expect(result.steps).toBe(0);
    expect(result.alpha).toBeCloseTo(0.5);
    expect(simSteps).toBe(0);
    expect(time.hitstopRemaining).toBe(0);
    expect(loop.accumulator).toBeCloseTo(1 / 120);
  });

  it('stops stepping in the same frame when simulate activates hitstop', () => {
    const time = createTime();
    let simSteps = 0;
    const loop = createLoop({
      time,
      simulate: () => {
        simSteps += 1;
        if (simSteps === 1) {
          time.hitstopRemaining = 3 / 60;
        }
      },
    });

    const result = loop.advance(3 / 60);

    expect(result.steps).toBe(1);
    expect(simSteps).toBe(1);
    expect(time.hitstopRemaining).toBeCloseTo(3 / 60);
  });

  it('feeds the accumulator slower during slow-mo while simulate dt stays fixed', () => {
    const normalTime = createTime();
    const slowTime = createTime();
    slowTime.scale = 0.25;
    const normalDts: number[] = [];
    const slowDts: number[] = [];
    const normalLoop = createLoop({
      time: normalTime,
      simulate: (dt) => {
        normalDts.push(dt);
      },
    });
    const slowLoop = createLoop({
      time: slowTime,
      simulate: (dt) => {
        slowDts.push(dt);
      },
    });

    for (let frame = 0; frame < 60; frame += 1) {
      normalLoop.advance(1 / 60);
      slowLoop.advance(1 / 60);
    }

    expect(normalDts).toHaveLength(60);
    expect(slowDts).toHaveLength(15);
    expect(slowDts.every((dt) => dt === 1 / 60)).toBe(true);
  });

  it('does not simulate while paused but still calls real-time effects', () => {
    const time = createTime();
    time.paused = true;
    const realDts: number[] = [];
    let simSteps = 0;
    const loop = createLoop({
      time,
      simulate: () => {
        simSteps += 1;
      },
      onRealTime: (dt) => {
        realDts.push(dt);
      },
    });

    expect(loop.advance(1 / 60)).toEqual({ steps: 0, alpha: 0 });
    expect(simSteps).toBe(0);
    expect(realDts).toEqual([1 / 60]);
    expect(loop.accumulator).toBe(0);
  });

  it('caps large stalls to the maximum number of fixed steps', () => {
    const time = createTime();
    const simulatedDts: number[] = [];
    const loop = createLoop({
      time,
      maxSteps: 5,
      simulate: (dt) => {
        simulatedDts.push(dt);
      },
    });

    const result = loop.advance(10);

    expect(result.steps).toBe(5);
    expect(simulatedDts).toEqual([1 / 60, 1 / 60, 1 / 60, 1 / 60, 1 / 60]);
  });

  it('returns alpha as accumulator divided by step in [0, 1)', () => {
    const time = createTime();
    const loop = createLoop({
      time,
      simulate: () => undefined,
    });

    const result = loop.advance(1 / 120);

    expect(result.steps).toBe(0);
    expect(result.alpha).toBe(0.5);
    expect(result.alpha).toBeGreaterThanOrEqual(0);
    expect(result.alpha).toBeLessThan(1);
    expect(result.alpha).toBe(loop.accumulator / (1 / 60));
  });
});
