// @ts-check

/** Entry point. Wires screens: Start → Calibrate → Listen (calibration comes in milestone 4). */

import { CHIME_MS, createChime, playChime } from './audio/chime.js';
import { applyGain, createLoudnessDetector } from './audio/levels.js';
import { AudioSuspendedError, createAudioContext, startMeter } from './audio/meter.js';
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
const testChimeEl = byId('test-chime');
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
/** @type {ReturnType<typeof createLoudnessDetector> | null} */
let detector = null;

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
  const listening = createLoudnessDetector();
  /** @type {ReturnType<typeof createChime> | null} */
  let chime = null;
  try {
    meter = await startMeter(({ db, time }) => {
      const decision = listening.update(applyGain(db, settings.current.sensitivityDb), time);
      view.render({ ...decision, time });
      if (decision.becameLoud && settings.current.chimeEnabled && chime?.ring(time)) {
        listening.pauseUntil(time + CHIME_MS + CHIME_TAIL_MS);
      }
    });
    detector = listening;
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
  detector = null;
  view.reset();
  toggleEl.textContent = 'Start';
  statusEl.textContent = 'Stopped.';
}

/** Plays the chime on demand, so a parent can check the phone's sound works. */
function testChime() {
  if (meter) {
    playChime(meter.context);
    detector?.pauseUntil(performance.now() + CHIME_MS + CHIME_TAIL_MS);
  } else {
    // Not listening: use a short-lived context, created inside the tap as browsers require.
    const ctx = createAudioContext();
    void ctx.resume().then(() => playChime(ctx));
    setTimeout(() => void ctx.close(), CHIME_MS + 500);
  }
  statusEl.textContent = 'Played the test chime. Heard nothing? Turn up the media volume.';
}

testChimeEl.addEventListener('click', testChime);
toggleEl.addEventListener('click', () => (meter ? stop() : void start()));
view.reset();
statusEl.textContent = 'Tap Start and allow the microphone.';
