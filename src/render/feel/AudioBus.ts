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

  /** Pass: crisp light tick (stays quieter than the shot — loudness hierarchy). */
  pass(): void {
    this.thump(420, 0.004, 0.06, 0.16, 'triangle');
  }

  /** Tackle: short low crunch = lowpassed noise burst + a thud. */
  tackle(): void {
    this.noise(0.12, 0.5, 'lowpass', 1400, 250);
    this.thump(90, 0.005, 0.09, 0.3, 'square');
  }

  /** Whiff: airy rising swoosh (a mistimed tackle). */
  whiff(): void {
    this.noise(0.16, 0.18, 'bandpass', 500, 2200);
  }

  /** White-noise burst through a frequency-ramped biquad filter. */
  private noise(duration: number, gain: number, type: BiquadFilterType, fStart: number, fEnd: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t0 = ctx.currentTime;
    const frames = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.setValueAtTime(fStart, t0);
    filter.frequency.exponentialRampToValueAtTime(Math.max(1, fEnd), t0 + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    src.connect(filter).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + duration + 0.02);
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
