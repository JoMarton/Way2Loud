// @ts-check

/** Entry point. Wires screens: Start → Calibrate → Listen (calibration comes in milestone 4). */

import { applyGain } from './audio/levels.js';
import { startMeter } from './audio/meter.js';
import { createMeterView } from './ui/meter-view.js';
import { bindSettings } from './ui/settings.js';

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
const byId = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

const statusEl = byId('status');
const toggleEl = /** @type {HTMLButtonElement} */ (byId('toggle'));
const view = createMeterView(byId('meter'), byId('readout'));
const settings = bindSettings({
  sensitivity: /** @type {HTMLInputElement} */ (byId('sensitivity')),
  sensitivityValue: /** @type {HTMLOutputElement} */ (byId('sensitivity-value')),
});

/** @type {import('./audio/meter.js').Meter | null} */
let meter = null;

/** @param {unknown} err */
function describeError(err) {
  if (!window.isSecureContext) return 'The mic needs a secure (https) page.';
  if (!navigator.mediaDevices?.getUserMedia) return 'This browser cannot use the mic.';
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError') return 'Mic access was blocked. Allow it in browser settings.';
  if (name === 'NotFoundError') return 'No microphone was found.';
  return `Could not start the mic: ${err instanceof Error ? err.message : String(err)}`;
}

async function start() {
  toggleEl.disabled = true;
  statusEl.textContent = 'Starting the mic…';
  try {
    meter = await startMeter(({ db, time }) =>
      view.render({ db: applyGain(db, settings.current.sensitivityDb), time }),
    );
    toggleEl.textContent = 'Stop';
    statusEl.textContent = 'Listening. Try talking, then talking louder.';
  } catch (err) {
    statusEl.textContent = describeError(err);
  } finally {
    toggleEl.disabled = false;
  }
}

function stop() {
  meter?.stop();
  meter = null;
  view.reset();
  toggleEl.textContent = 'Start';
  statusEl.textContent = 'Stopped.';
}

toggleEl.addEventListener('click', () => (meter ? stop() : void start()));
view.reset();
statusEl.textContent = 'Tap Start and allow the microphone.';
