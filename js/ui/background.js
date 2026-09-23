// @ts-check

/** Reports whether listening continued while the screen was off, which varies by phone and browser. */

import { DB_FLOOR } from '../audio/levels.js';

/** Time away shorter than this isn't worth a message (e.g. a quick app switch). */
export const MIN_REPORT_MS = 5000;

/** Readings per second that count as "kept listening"; the meter sends ~43–47 per second. */
const MIN_READINGS_PER_SECOND = 20;

/** A loudest reading below this means the mic delivered silence the whole time. */
const SILENCE_DB = -90;

/**
 * @typedef {object} AwayStats
 * @property {number} readings readings handled while hidden
 * @property {number} maxDb loudest raw reading (before sensitivity) while hidden
 * @property {number} loudMoments times the level turned "too loud" while hidden
 * @property {number} sounds alert sounds played while hidden
 */

/** @returns {AwayStats} */
export const emptyAwayStats = () => ({ readings: 0, maxDb: DB_FLOOR, loudMoments: 0, sounds: 0 });

/** @param {number} ms */
export function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

/** @param {number} n @param {string} one @param {string} many */
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * @param {number} awayMs how long the page was hidden
 * @param {AwayStats} stats
 * @returns {string | null} a status message, or null if not worth reporting
 */
export function describeTimeAway(awayMs, stats) {
  if (awayMs < MIN_REPORT_MS) return null;
  const away = formatDuration(awayMs);
  if (stats.readings < (awayMs / 1000) * MIN_READINGS_PER_SECOND) {
    return `Listening paused while the screen was off (${away}). To avoid this, turn on "Keep screen on" in Settings, or try "Keep listening with screen off".`;
  }
  if (stats.maxDb < SILENCE_DB) {
    return `The page kept running while the screen was off (${away}), but the phone gave it silence instead of the mic, so it couldn't hear anything. Use "Keep screen on" instead.`;
  }
  return `Kept listening while the screen was off (${away}): loudest ${Math.round(stats.maxDb)} dB, ${count(stats.loudMoments, 'loud moment', 'loud moments')}, ${count(stats.sounds, 'sound', 'sounds')} played.`;
}
