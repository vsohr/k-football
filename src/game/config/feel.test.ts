import { FEEL, shootHitstopFrames, shootTrauma } from './feel';

describe('shoot feel tuning', () => {
  it('lerps and clamps authored shoot hitstop frames', () => {
    expect(FEEL.shoot.sfx).toBe('shoot');
    expect(shootHitstopFrames(0)).toBe(3);
    expect(shootHitstopFrames(0.5)).toBe(5);
    expect(shootHitstopFrames(1)).toBe(7);
    expect(shootHitstopFrames(-1)).toBe(3);
    expect(shootHitstopFrames(2)).toBe(7);
  });

  it('lerps and clamps authored shoot trauma', () => {
    expect(shootTrauma(0)).toBeCloseTo(0.3);
    expect(shootTrauma(0.5)).toBeCloseTo(0.45);
    expect(shootTrauma(1)).toBeCloseTo(0.6);
    expect(shootTrauma(-1)).toBeCloseTo(0.3);
    expect(shootTrauma(2)).toBeCloseTo(0.6);
  });

  it('keeps pass and tackle below the authored shot loudness ceiling', () => {
    expect(FEEL.pass.hitstopFrames).toBeLessThanOrEqual(1);
    expect(FEEL.pass.hitstopFrames).toBeLessThanOrEqual(
      FEEL.tackleClean.hitstopFrames,
    );
    expect(FEEL.tackleClean.hitstopFrames).toBeLessThanOrEqual(
      FEEL.shoot.hitstopMaxFrames,
    );
    expect(FEEL.tackleWhiff.hitstopFrames).toBe(0);
  });
});
