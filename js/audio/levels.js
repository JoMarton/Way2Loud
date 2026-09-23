// @ts-check

/** Pure loudness math. No browser APIs here, so everything is unit-testable. */

/** Quietest dBFS value we report; digital silence would otherwise be -Infinity. */
export const DB_FLOOR = -100;

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
export function dbToLevel(db, min = -70, max = 0) {
  return Math.min(1, Math.max(0, (db - min) / (max - min)));
}
