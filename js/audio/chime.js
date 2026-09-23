// @ts-check

/** The alert: picks one of the sounds and plays it, with a cooldown so it can't nag. */

import { pickSound, playSound } from './sounds.js';

/** Overall volume (0..1). Kept moderate: it should be noticed, not startle. */
const DEFAULT_VOLUME = 0.35;

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
 * @param {AudioContext} ctx a running context
 * @param {{ cooldownMs?: number, volume?: number }} [options]
 */
export function createChime(ctx, { cooldownMs = 3000, volume = DEFAULT_VOLUME } = {}) {
  const cooldown = createCooldown(cooldownMs);
  /** @type {string | null} */
  let previousId = null;

  /**
   * @param {string} setting a sound id or "random"
   * @returns {number} length of the sound in ms
   */
  const play = (setting) => {
    const sound = pickSound(setting, previousId);
    previousId = sound.id;
    return playSound(ctx, sound, volume);
  };

  return {
    /**
     * Plays the alert unless it played within the cooldown.
     * @param {number} nowMs
     * @param {string} setting a sound id or "random"
     * @returns {number} length of the sound in ms, or 0 if it didn't play
     */
    ring(nowMs, setting) {
      return cooldown.tryFire(nowMs) ? play(setting) : 0;
    },
    /** Plays immediately, ignoring the cooldown (for the Test button). */
    play,
  };
}
