import { createRng } from './rng';

describe('createRng', () => {
  it('produces the same sequence for the same seed', () => {
    const first = createRng(12345);
    const second = createRng(12345);

    for (let draw = 0; draw < 1000; draw += 1) {
      expect(first.next()).toBe(second.next());
    }
  });

  it('returns next values in [0, 1)', () => {
    const rng = createRng(7);

    for (let draw = 0; draw < 1000; draw += 1) {
      const value = rng.next();

      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('returns range values in [min, max)', () => {
    const rng = createRng(99);

    for (let draw = 0; draw < 1000; draw += 1) {
      const value = rng.range(-3.5, 8.25);

      expect(value).toBeGreaterThanOrEqual(-3.5);
      expect(value).toBeLessThan(8.25);
    }
  });

  it('returns int values inside the inclusive bounds', () => {
    const rng = createRng(123);

    for (let draw = 0; draw < 1000; draw += 1) {
      const value = rng.int(-2, 3);

      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(-2);
      expect(value).toBeLessThanOrEqual(3);
    }
  });
});
