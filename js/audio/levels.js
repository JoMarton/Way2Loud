// @ts-check

/** Pure loudness math and the loud/ok decision. No browser APIs here, so everything is unit-testable. */

/** Quietest dBFS value we report; digital silence would otherwise be -Infinity. */
export const DB_FLOOR = -100;

/**
 * Where the zones sit, in dB after sensitivity gain. Tuned on a phone where a quiet
 * room read about -40, normal talking -30 ± 5 and loud talking -20 ± 5 at 0 dB gain;
 * the sensitivity setting shifts other devices onto the same scale.
 */
export const ZONES = Object.freeze({
  /** Above this (after the hold time) counts as too loud. */
  thresholdDb: -23,
  /** Once loud, the level must drop this far below the threshold to count as OK again. */
  releaseDb: 3,
  /** Below this counts as not talking. */
  quietDb: -35,
});

/** The bar shows this window, which puts the threshold at two thirds of its width. */
export const DISPLAY_MIN_DB = ZONES.thresholdDb - 30;
export const DISPLAY_MAX_DB = ZONES.thresholdDb + 15;

/**
 * Root mean square of a block of samples in the range [-1, 1].
 * @param {ArrayLike<number>} samples
 * @returns {number}
 */
export function rms(samples) {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return Math.sqrt(sum / samples.length);
}

/**
 * Converts an RMS amplitude to dBFS (0 dB = full scale), clamped to DB_FLOOR.
 * @param {number} amplitude
 * @returns {number}
 */
export function toDb(amplitude) {
  if (amplitude <= 0) return DB_FLOOR;
  return Math.max(DB_FLOOR, 20 * Math.log10(amplitude));
}

/**
 * Applies the sensitivity setting: shifts a reading by `gainDb`, like an input
 * gain knob. Silence stays at DB_FLOOR so boosting never invents sound.
 * @param {number} db
 * @param {number} gainDb
 * @returns {number}
 */
export function applyGain(db, gainDb) {
  if (db <= DB_FLOOR) return DB_FLOOR;
  return Math.max(DB_FLOOR, db + gainDb);
}

/**
 * Maps a dB value onto 0..1 for display, clamping outside [min, max].
 * @param {number} db
 * @param {number} [min] dB shown as an empty meter
 * @param {number} [max] dB shown as a full meter
 * @returns {number}
 */
export function dbToLevel(db, min = DISPLAY_MIN_DB, max = DISPLAY_MAX_DB) {
  return Math.min(1, Math.max(0, (db - min) / (max - min)));
}

/** @typedef {'quiet' | 'good' | 'loud'} Zone */

/**
 * @typedef {object} Decision
 * @property {number} smoothedDb the smoothed level, used for display and decisions
 * @property {Zone} zone
 * @property {boolean} becameLoud true only on the reading where the zone turns loud
 */

/**
 * @typedef {object} DetectorOptions
 * @property {number} [thresholdDb]
 * @property {number} [releaseDb]
 * @property {number} [quietDb]
 * @property {number} [smoothingMs] time constant of the moving average
 * @property {number} [holdMs] how long the level must stay above the threshold
 */

/** Longest gap between readings the smoothing will bridge (e.g. after a pause). */
const MAX_STEP_MS = 100;

/**
 * Turns raw readings into zones. It smooths out spikes (a clap, a cough), needs
 * the level to stay above the threshold for `holdMs` before calling it loud, and
 * needs it to drop `releaseDb` below the threshold before calling it OK again,
 * so the display doesn't flicker around the line.
 * @param {DetectorOptions} [options]
 */
export function createLoudnessDetector({
  thresholdDb = ZONES.thresholdDb,
  releaseDb = ZONES.releaseDb,
  quietDb = ZONES.quietDb,
  smoothingMs = 200,
  holdMs = 400,
} = {}) {
  /** @type {number | null} */
  let smoothed = null;
  /** @type {number | null} */
  let lastTime = null;
  /** @type {number | null} */
  let aboveSince = null;
  let loud = false;
  let pausedUntil = -Infinity;

  /** @returns {Zone} */
  const zone = () => {
    if (loud) return 'loud';
    return (smoothed ?? DB_FLOOR) < quietDb ? 'quiet' : 'good';
  };

  return {
    /**
     * @param {number} db reading after sensitivity gain
     * @param {number} timeMs timestamp of the reading
     * @returns {Decision}
     */
    update(db, timeMs) {
      if (timeMs < pausedUntil || smoothed === null || lastTime === null) {
        // While paused (our own chime is playing) the level is frozen.
        if (smoothed === null) smoothed = db;
        lastTime = timeMs;
        return { smoothedDb: smoothed, zone: zone(), becameLoud: false };
      }

      const dt = Math.min(MAX_STEP_MS, Math.max(0, timeMs - lastTime));
      lastTime = timeMs;
      smoothed += (1 - Math.exp(-dt / smoothingMs)) * (db - smoothed);

      let becameLoud = false;
      if (!loud) {
        if (smoothed > thresholdDb) {
          aboveSince ??= timeMs;
          if (timeMs - aboveSince >= holdMs) loud = becameLoud = true;
        } else {
          aboveSince = null;
        }
      } else if (smoothed < thresholdDb - releaseDb) {
        loud = false;
        aboveSince = null;
      }

      return { smoothedDb: smoothed, zone: zone(), becameLoud };
    },

    /**
     * Ignores input until `untilMs`, so the chime can't register as a loud voice.
     * @param {number} untilMs
     */
    pauseUntil(untilMs) {
      pausedUntil = Math.max(pausedUntil, untilMs);
    },
  };
}
