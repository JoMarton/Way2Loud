// @ts-check

/** Entry point. Wires screens: Start → Calibrate → Listen (calibration comes in milestone 4). */

import { CHIME_MS, createChime } from './audio/chime.js';
import { applyGain, createLoudnessDetector } from './audio/levels.js';
import { AudioSuspendedError, startMeter } from './audio/meter.js';
import { createMeterView } from './ui/meter-view.js';
import { bindSettings } from './ui/settings.js';

/** Extra quiet time after the chime, so its echo in the room isn't measured either. */
const CHIME_TAIL_MS = 150;

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
const byId = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

const statusEl = byId('status');
const toggleEl = /** @type {HTMLButtonElement} */ (byId('toggle'));
const view = createMeterView({
  root: document.documentElement,
  meter: byId('meter'),
  readout: byId('readout'),
  label: byId('zone-label'),
});
const settings = bindSettings({
  sensitivity: /** @type {HTMLInputElement} */ (byId('sensitivity')),
  sensitivityValue: /** @type {HTMLOutputElement} */ (byId('sensitivity-value')),
  chime: /** @type {HTMLInputElement} */ (byId('chime')),
});

/** @type {import('./audio/meter.js').Meter | null} */
let meter = null;

/** @param {unknown} err */
function describeError(err) {
  if (!window.isSecureContext) return 'The mic needs a secure (https) page.';
  if (!navigator.mediaDevices?.getUserMedia) return 'This browser cannot use the mic.';
  if (err instanceof AudioSuspendedError) return 'The browser kept audio paused. Tap Start again.';
  const name = err instanceof DOMException ? err.name : '';
  if (name === 'NotAllowedError') return 'Mic access was blocked. Allow it in browser settings.';
  if (name === 'NotFoundError') return 'No microphone was found.';
  return `Could not start the mic: ${err instanceof Error ? err.message : String(err)}`;
}

async function start() {
  toggleEl.disabled = true;
  statusEl.textContent = 'Starting the mic…';
  const detector = createLoudnessDetector();
  /** @type {ReturnType<typeof createChime> | null} */
  let chime = null;
  try {
    meter = await startMeter(({ db, time }) => {
      const decision = detector.update(applyGain(db, settings.current.sensitivityDb), time);
      view.render({ ...decision, time });
      if (decision.becameLoud && settings.current.chimeEnabled && chime?.ring(time)) {
        detector.pauseUntil(time + CHIME_MS + CHIME_TAIL_MS);
      }
    });
    chime = createChime(meter.context);
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
