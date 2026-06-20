/**
 * Real-time feel state: trauma-model screen shake, directional camera kick, and a flash
 * level. Updated on REAL time (so it keeps animating during hitstop/slow-mo — feel §8).
 * Framework-free; the render loop reads `cameraOffset()` / `flash` each frame.
 */
const TRAUMA_DECAY = 1.4; // per second
const FLASH_DECAY = 3.0; // per second
const SQUASH_DECAY = 6.0; // per second (fast snap back)
const KICK_RETURN = 12; // per second (exponential-ish ease back)

export class FeelController {
  trauma = 0;
  flash = 0;
  squash = 0;
  private kickX = 0;
  private kickZ = 0;
  private seed = 0x2545f491;

  /** Additive trauma, clamped to 1 (rapid hits stack then decay) — feel §2. */
  addTrauma(amount: number): void {
    this.trauma = Math.min(1, this.trauma + amount);
  }

  addFlash(amount: number): void {
    this.flash = Math.min(1, this.flash + amount);
  }

  /** One-shot squash pulse (0..1), e.g. on a strike. Decays fast. */
  addSquash(amount: number): void {
    this.squash = Math.min(1, this.squash + amount);
  }

  /** One-shot directional camera impulse (springs back). */
  kick(dx: number, dz: number): void {
    this.kickX += dx;
    this.kickZ += dz;
  }

  /** Decay everything on real time. Call once per render frame. */
  update(dt: number): void {
    this.trauma = Math.max(0, this.trauma - TRAUMA_DECAY * dt);
    this.flash = Math.max(0, this.flash - FLASH_DECAY * dt);
    this.squash = Math.max(0, this.squash - SQUASH_DECAY * dt);
    const ease = Math.max(0, 1 - KICK_RETURN * dt);
    this.kickX *= ease;
    this.kickZ *= ease;
  }

  private rand(): number {
    // xorshift32 — render-side randomness (not the sim rng); fine to be non-deterministic.
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return (this.seed / 0xffffffff) * 2 - 1;
  }

  /** Camera position offset = trauma² shake + spring kick. Add to the camera base pos. */
  cameraOffset(maxShake = 0.7): [number, number, number] {
    const amt = this.trauma * this.trauma * maxShake;
    return [this.rand() * amt + this.kickX, this.rand() * amt * 0.4, this.rand() * amt + this.kickZ];
  }
}
