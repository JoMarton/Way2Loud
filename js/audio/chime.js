// @ts-check

/** A soft chime synthesized in code (no audio files), with a cooldown so it can't nag. */

/** Length of the chime, including its fade-out. */
export const CHIME_MS = 900;

/**
 * Allows an action at most once per `cooldownMs`.
 * @param {number} cooldownMs
 */
export function createCooldown(cooldownMs) {
  let last = -Infinity;
  return {
    /**
     * @param {number} nowMs
     * @returns {boolean} true if the action may run now (and starts the cooldown)
     */
    tryFire(nowMs) {
      if (nowMs - last < cooldownMs) return false;
      last = nowMs;
      return true;
    },
  };
}

/**
 * @param {AudioContext} ctx the meter's context, already running
 * @param {{ cooldownMs?: number, volume?: number }} [options]
 */
export function createChime(ctx, { cooldownMs = 3000, volume = 0.2 } = {}) {
  const cooldown = createCooldown(cooldownMs);

  /** Two gentle sine partials with a quick attack and a long exponential fade. */
  const play = () => {
    const start = ctx.currentTime + 0.01;
    const end = start + CHIME_MS / 1000;
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, start);
    out.gain.exponentialRampToValueAtTime(volume, start + 0.015);
    out.gain.exponentialRampToValueAtTime(0.0001, end);
    out.connect(ctx.destination);

    for (const [freq, level] of [
      [880, 1],
      [1320, 0.35],
    ]) {
      const osc = ctx.createOscillator();
      const partial = ctx.createGain();
      osc.frequency.value = freq;
      partial.gain.value = level;
      osc.connect(partial).connect(out);
      osc.start(start);
      osc.stop(end);
      osc.onended = () => partial.disconnect();
    }
    setTimeout(() => out.disconnect(), CHIME_MS + 100);
  };

  return {
    /**
     * Plays the chime unless it played within the cooldown.
     * @param {number} nowMs
     * @returns {boolean} whether it played
     */
    ring(nowMs) {
      if (!cooldown.tryFire(nowMs)) return false;
      play();
      return true;
    },
  };
}
