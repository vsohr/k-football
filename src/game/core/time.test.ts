import { createTime, requestHitstop } from './time';

describe('time state', () => {
  it('creates the default time state', () => {
    expect(createTime()).toEqual({
      scale: 1,
      hitstopRemaining: 0,
      paused: false,
    });
  });

  it('adds authored hitstop frames as real-time seconds', () => {
    const time = createTime();

    requestHitstop(time, 3);
    requestHitstop(time, 6);

    expect(time.hitstopRemaining).toBeCloseTo(9 / 60);
  });

  it('clamps hitstop to the default max window', () => {
    const time = createTime();

    requestHitstop(time, 30);

    expect(time.hitstopRemaining).toBe(0.2);
  });

  it('clamps hitstop to a custom max window', () => {
    const time = createTime();

    requestHitstop(time, 30, 0.1);

    expect(time.hitstopRemaining).toBe(0.1);
  });
});
