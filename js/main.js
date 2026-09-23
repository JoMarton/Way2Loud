// @ts-check

/** Entry point. Wires screens: Start → Calibrate → Listen (calibration comes in milestone 4). */

import { createChime } from './audio/chime.js';
import { applyGain, createLoudnessDetector } from './audio/levels.js';
import { AudioSuspendedError, createAudioContext, startMeter } from './audio/meter.js';
import { describeTimeAway } from './ui/background.js';
import { createMeterView } from './ui/meter-view.js';
import { bindSettings } from './ui/settings.js';
import { createWakeLock } from './ui/wake-lock.js';

/** Extra quiet time after a sound, so its echo in the room isn't measured either. */
const SOUND_TAIL_MS = 150;

/**
 * @param {string} id
 * @returns {HTMLElement}
 */
const byId = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

const statusEl = byId('status');
const toggleEl = /** @type {HTMLButtonElement} */ (byId('toggle'));
const testChimeEl = byId('test-chime');
const keepScreenOnEl = /** @type {HTMLInputElement} */ (byId('keep-screen-on'));
const view = createMeterView({
  root: document.documentElement,
  meter: byId('meter'),
  readout: byId('readout'),
  label: byId('zone-label'),
});
const wakeLock = createWakeLock();
const settings = bindSettings(
  {
    sensitivity: /** @type {HTMLInputElement} */ (byId('sensitivity')),
    sensitivityValue: /** @type {HTMLOutputElement} */ (byId('sensitivity-value')),
    chime: /** @type {HTMLInputElement} */ (byId('chime')),
    sound: /** @type {HTMLSelectElement} */ (byId('sound')),
    keepScreenOn: keepScreenOnEl,
  },
  (current) => {
    if (session) wakeLock.set(current.keepScreenOn);
  },
);

if (!wakeLock.supported) {
  keepScreenOnEl.disabled = true;
  byId('keep-screen-on-hint').textContent = "This browser can't keep the screen on.";
}

/**
 * @typedef {object} Session
 * @property {import('./audio/meter.js').Meter} meter
 * @property {ReturnType<typeof createLoudnessDetector>} detector
 * @property {ReturnType<typeof createChime>} chime
 */

/** @type {Session | null} */
let session = null;

/** Counts what happened while the page was hidden, to report it on return. */
const away = { since: 0, readings: 0, sounds: 0 };

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
    const meter = await startMeter(({ db, time }) => {
      const decision = detector.update(applyGain(db, settings.current.sensitivityDb), time);
      view.render({ ...decision, time });
      if (document.hidden) away.readings++;
      if (decision.becameLoud && settings.current.chimeEnabled && chime) {
        const soundMs = chime.ring(time, settings.current.chimeSound);
        if (soundMs) {
          detector.pauseUntil(time + soundMs + SOUND_TAIL_MS);
          if (document.hidden) away.sounds++;
        }
      }
    });
    chime = createChime(meter.context);
    session = { meter, detector, chime };
    wakeLock.set(settings.current.keepScreenOn);
    toggleEl.textContent = 'Stop';
    statusEl.textContent = 'Listening. Try talking, then talking louder.';
  } catch (err) {
    statusEl.textContent = describeError(err);
  } finally {
    toggleEl.disabled = false;
  }
}

function stop() {
  session?.meter.stop();
  session = null;
  wakeLock.set(false);
  view.reset();
  toggleEl.textContent = 'Start';
  statusEl.textContent = 'Stopped.';
}

/** Plays the selected sound on demand, so a parent can check the phone's sound works. */
function testSound() {
  const sound = settings.current.chimeSound;
  if (session) {
    const soundMs = session.chime.play(sound);
    session.detector.pauseUntil(performance.now() + soundMs + SOUND_TAIL_MS);
  } else {
    // Not listening: use a short-lived context, created inside the tap as browsers require.
    const ctx = createAudioContext();
    void ctx.resume().then(() => {
      const soundMs = createChime(ctx).play(sound);
      setTimeout(() => void ctx.close(), soundMs + 500);
    });
  }
  statusEl.textContent = 'Played the sound. Heard nothing? Turn up the media volume.';
}

document.addEventListener('visibilitychange', () => {
  if (!session) return;
  if (document.hidden) {
    Object.assign(away, { since: performance.now(), readings: 0, sounds: 0 });
    return;
  }
  const message = describeTimeAway(performance.now() - away.since, away.readings, away.sounds);
  if (message) statusEl.textContent = message;
});

testChimeEl.addEventListener('click', testSound);
toggleEl.addEventListener('click', () => (session ? stop() : void start()));
view.reset();
statusEl.textContent = 'Tap Start and allow the microphone.';
