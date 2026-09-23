// @ts-check

/** Reports whether listening continued while the screen was off, which varies by phone and browser. */

/** Time away shorter than this isn't worth a message (e.g. a quick app switch). */
export const MIN_REPORT_MS = 5000;

/** Readings per second that count as "kept listening"; the meter sends ~43–47 per second. */
const MIN_READINGS_PER_SECOND = 20;

/** @param {number} ms */
export function formatDuration(ms) {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} min`;
}

/**
 * @param {number} awayMs how long the page was hidden
 * @param {number} readings readings handled while hidden
 * @param {number} sounds alert sounds played while hidden
 * @returns {string | null} a status message, or null if not worth reporting
 */
export function describeTimeAway(awayMs, readings, sounds) {
  if (awayMs < MIN_REPORT_MS) return null;
  const away = formatDuration(awayMs);
  if (readings >= (awayMs / 1000) * MIN_READINGS_PER_SECOND) {
    const played = sounds === 1 ? '1 sound' : `${sounds} sounds`;
    return `Kept listening while the screen was off (${away}) and played ${played}.`;
  }
  return `Listening paused while the screen was off (${away}). To avoid this, turn on "Keep screen on" in Settings, or try "Keep listening with screen off".`;
}
