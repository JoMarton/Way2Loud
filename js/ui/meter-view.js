// @ts-check

import { dbToLevel } from '../audio/levels.js';

/** How often the dB number changes; at 60 fps it would be unreadable. */
const TEXT_INTERVAL_MS = 150;

/**
 * Creates a view that renders readings: the bar follows every frame via the
 * --level custom property, while the number updates at a readable pace.
 * @param {HTMLElement} meterEl element whose --level (0..1) drives the bar
 * @param {HTMLElement} readoutEl element that shows the dB number
 */
export function createMeterView(meterEl, readoutEl) {
  let lastText = -Infinity;

  return {
    /** @param {{ db: number, time: number }} reading */
    render({ db, time }) {
      meterEl.style.setProperty('--level', dbToLevel(db).toFixed(3));
      if (time - lastText >= TEXT_INTERVAL_MS) {
        readoutEl.textContent = `${Math.round(db)} dB`;
        lastText = time;
      }
    },
    reset() {
      meterEl.style.setProperty('--level', '0');
      readoutEl.textContent = '– dB';
      lastText = -Infinity;
    },
  };
}
