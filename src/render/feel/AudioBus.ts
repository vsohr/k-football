/**
 * Minimal procedural audio bus (WebAudio). M1 synthesizes SFX (no asset pipeline yet —
 * real samples come at M7). Starts suspended; `unlock()` must be called from a user
 * gesture (browser autoplay policy, tech §17). Degrades silently if audio is unavailable.
 */
export class AudioBus {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private unlocked = false;

  unlock(): void {
    if (this.unlocked) return;
    try {
      const Ctor =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.6;
      this.master.connect(this.ctx.destination);
      this.unlocked = true;
    } catch {
      // audio unavailable — game stays playable muted
    }
  }

  /** Shot "thump": low triangle with a fast pitch + amplitude decay. Power 0..1. */
  shoot(power = 1): void {
    const base = 60 + power * 40;
    this.thump(base, 0.011, 0.2, power * 0.5 + 0.35, 'triangle');
  }

  /** Generic percussive blip used by other events later. */
  private thump(freq: number, attack: number, duration: number, gain: number, type: OscillatorType): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq * 2.2, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freq), t0 + duration);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(g).connect(master);
    osc.start(t0);
    osc.stop(t0 + duration + 0.02);
  }
}
