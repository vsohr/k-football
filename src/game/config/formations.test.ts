import { PITCH } from './dimensions';
import { FORMATION_2_2, anchorFor } from './formations';

describe('formations', () => {
  it('mirrors anchor x positions for team 1', () => {
    for (const slot of FORMATION_2_2) {
      const home = anchorFor(slot, 0);
      const away = anchorFor(slot, 1);

      expect(away.x).toBeCloseTo(-home.x);
      expect(away.y).toBe(0);
      expect(away.z).toBeCloseTo(home.z);
    }
  });

  it('places each goalkeeper near its own goal', () => {
    const goalkeeperSlot = FORMATION_2_2[0];
    const homeGoalkeeper = anchorFor(goalkeeperSlot, 0);
    const awayGoalkeeper = anchorFor(goalkeeperSlot, 1);

    expect(goalkeeperSlot.role).toBe('GK');
    expect(homeGoalkeeper.x).toBeLessThan(-PITCH.halfX * 0.8);
    expect(awayGoalkeeper.x).toBeGreaterThan(PITCH.halfX * 0.8);
    expect(homeGoalkeeper.z).toBe(0);
    expect(awayGoalkeeper.z).toBe(0);
  });

  it('scales all anchors within the pitch', () => {
    for (const slot of FORMATION_2_2) {
      for (const team of [0, 1] as const) {
        const anchor = anchorFor(slot, team);

        expect(Math.abs(anchor.x)).toBeLessThanOrEqual(PITCH.halfX * 0.92);
        expect(Math.abs(anchor.z)).toBeLessThanOrEqual(PITCH.halfZ * 0.85);
        expect(anchor.y).toBe(0);
      }
    }
  });
});
