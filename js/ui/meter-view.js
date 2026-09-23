// @ts-check

import { ZONES, dbToLevel } from '../audio/levels.js';

/** How often the dB number changes; at 60 fps it would be unreadable. */
const TEXT_INTERVAL_MS = 150;

/** @type {Record<import('../audio/levels.js').Zone, string>} */
const ZONE_LABELS = {
  quiet: 'Listening…',
  good: 'Just right',
  loud: 'A bit loud',
};

/**
 * Creates a view that renders decisions. The bar follows every frame via the
 * --level custom property and the zone via data-zone on the root element, so CSS
 * does the colors and transitions; the text updates at a readable pace.
 * @param {{ root: HTMLElement, meter: HTMLElement, readout: HTMLElement, label: HTMLElement }} els
 */
export function createMeterView(els) {
  let lastText = -Infinity;
  // Section boundaries (quiet | normal voice | too loud), shared by the bar and its legend.
  els.root.style.setProperty('--quiet-at', dbToLevel(ZONES.quietDb).toFixed(3));
  els.root.style.setProperty('--threshold', dbToLevel(ZONES.thresholdDb).toFixed(3));

  return {
    /** @param {{ smoothedDb: number, zone: import('../audio/levels.js').Zone, time: number }} state */
    render({ smoothedDb, zone, time }) {
      els.meter.style.setProperty('--level', dbToLevel(smoothedDb).toFixed(3));
      if (els.root.dataset.zone !== zone) {
        els.root.dataset.zone = zone;
        els.label.textContent = ZONE_LABELS[zone];
      }
      if (time - lastText >= TEXT_INTERVAL_MS) {
        els.readout.textContent = `${Math.round(smoothedDb)} dB`;
        lastText = time;
      }
    },
    reset() {
      els.meter.style.setProperty('--level', '0');
      delete els.root.dataset.zone;
      els.label.textContent = ' ';
      els.readout.textContent = '– dB';
      lastText = -Infinity;
    },
  };
}
