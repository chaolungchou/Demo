class ClassroomSoundEngine {
  private ctx: AudioContext | null = null;
  private enabled = true;
  private volume = 0.65;

  private ensureContext(): AudioContext | null {
    if (!this.enabled || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  setEnabled(enabled: boolean) {
    this.enabled = enabled;
  }

  setVolume(volume: number) {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  /**
   * Short crisp wooden/marimba tick used during name cycling or wheel pegs.
   * Progress (0..1) subtly raises the pitch to build anticipation.
   */
  playTick(progress = 0.5) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const baseFreq = 420 + progress * 260;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.62, now + 0.045);

    const peak = 0.22 * this.volume;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.06);
  }

  /**
   * Celebratory warm marimba + bright bell arpeggio when a student is selected.
   */
  playReveal() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // C5 -> E5 -> G5 -> C6 bright classroom chime
    const notes = [523.25, 659.25, 783.99, 1046.5];

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.075;
      const osc = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      overtone.type = 'triangle';
      overtone.frequency.setValueAtTime(freq * 2, start);

      const overtoneGain = ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.18, start);

      const duration = idx === notes.length - 1 ? 0.85 : 0.42;
      const peak = (idx === notes.length - 1 ? 0.28 : 0.2) * this.volume;

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      osc.connect(gain);
      overtone.connect(overtoneGain);
      overtoneGain.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      overtone.start(start);
      osc.stop(start + duration + 0.02);
      overtone.stop(start + duration + 0.02);
    });
  }

  /**
   * Gentle ascending confirmation chime for auto-grouping completion.
   */
  playGroupComplete() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [440, 554.37, 659.25];

    notes.forEach((freq, idx) => {
      const start = now + idx * 0.06;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);

      const peak = 0.18 * this.volume;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(peak, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(start);
      osc.stop(start + 0.38);
    });
  }

  /**
   * Soft click for student swap or subtle confirmation.
   */
  playPop() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(760, now + 0.06);

    const peak = 0.14 * this.volume;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(peak, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }
}

export const soundEngine = new ClassroomSoundEngine();
