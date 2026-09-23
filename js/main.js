// @ts-check

/** Entry point. Wires screens: Start → Calibrate → Listen (calibration comes in milestone 4). */

import { createChime } from './audio/chime.js';
import { createKeepAlive } from './audio/keep-alive.js';
import { applyGain, createLoudnessDetector } from './audio/levels.js';
import { AudioSuspendedError, createAudioContext, startMeter } from './audio/meter.js';
import { describeTimeAway, emptyAwayStats } from './ui/background.js';
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
const dimEl = byId('dim');
const dimOverlayEl = byId('dim-overlay');
const diagnosticsEl = byId('diagnostics');
const troubleshootingEl = /** @type {HTMLDetailsElement} */ (
  document.querySelector('.troubleshooting')
);
const view = createMeterView({
  root: document.documentElement,
  meter: byId('meter'),
  readout: byId('readout'),
  label: byId('zone-label'),
});
const wakeLock = createWakeLock();
const keepAlive = createKeepAlive();
const settings = bindSettings(
  {
    sensitivity: /** @type {HTMLInputElement} */ (byId('sensitivity')),
    sensitivityValue: /** @type {HTMLOutputElement} */ (byId('sensitivity-value')),
    chime: /** @type {HTMLInputElement} */ (byId('chime')),
    sound: /** @type {HTMLSelectElement} */ (byId('sound')),
    keepScreenOn: keepScreenOnEl,
    backgroundAudio: /** @type {HTMLInputElement} */ (byId('background-audio')),
  },
  (current) => {
    if (!session) return;
    wakeLock.set(current.keepScreenOn);
    // Settings changes come from a tap, so starting playback here is allowed.
    if (current.backgroundAudio) keepAlive.start();
    else keepAlive.stop();
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
const away = { since: 0, stats: emptyAwayStats(), lastReport: 'none yet' };

/** The deploy folder this code was loaded from (e.g. "v8"), or "dev" when run locally. */
const CODE_VERSION = import.meta.url.match(/\/(v\d+)\/js\//)?.[1] ?? 'dev';

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
  // Must start inside the tap (before any await), or the browser blocks playback.
  if (settings.current.backgroundAudio) keepAlive.start();
  const detector = createLoudnessDetector();
  /** @type {ReturnType<typeof createChime> | null} */
  let chime = null;
  try {
    const meter = await startMeter(({ db, time }) => {
      const decision = detector.update(applyGain(db, settings.current.sensitivityDb), time);
      view.render({ ...decision, time });
      if (document.hidden) {
        away.stats.readings++;
        away.stats.maxDb = Math.max(away.stats.maxDb, db);
        if (decision.becameLoud) away.stats.loudMoments++;
      }
      if (decision.becameLoud && settings.current.chimeEnabled && chime) {
        const soundMs = chime.ring(time, settings.current.chimeSound);
        if (soundMs) {
          detector.pauseUntil(time + soundMs + SOUND_TAIL_MS);
          if (document.hidden) away.stats.sounds++;
        }
      }
    });
    chime = createChime(meter.context);
    session = { meter, detector, chime };
    wakeLock.set(settings.current.keepScreenOn);
    dimEl.hidden = false;
    toggleEl.textContent = 'Stop';
    statusEl.textContent = 'Listening. Try talking, then talking louder.';
  } catch (err) {
    keepAlive.stop();
    statusEl.textContent = describeError(err);
  } finally {
    toggleEl.disabled = false;
  }
}

function stop() {
  session?.meter.stop();
  session = null;
  wakeLock.set(false);
  keepAlive.stop();
  setDimmed(false);
  dimEl.hidden = true;
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
    Object.assign(away, { since: performance.now(), stats: emptyAwayStats() });
    return;
  }
  const message = describeTimeAway(performance.now() - away.since, away.stats);
  if (message) {
    statusEl.textContent = message;
    away.lastReport = message;
  }
});

/** Live status for the troubleshooting panel, so problems on a phone can be read off the screen. */
function renderDiagnostics() {
  const rows = {
    Page: document.querySelector('.version')?.textContent ?? '?',
    Code: CODE_VERSION,
    Listening: session ? `yes (${session.meter.mode})` : 'no',
    Audio: session?.meter.context.state ?? '–',
    'Screen on': `${wakeLock.status()} (setting ${settings.current.keepScreenOn ? 'on' : 'off'})`,
    'Screen-off tone': `${keepAlive.status()} (setting ${settings.current.backgroundAudio ? 'on' : 'off'})`,
    'Last screen-off': away.lastReport,
  };
  diagnosticsEl.replaceChildren(
    ...Object.entries(rows).flatMap(([label, value]) => {
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      return [dt, dd];
    }),
  );
}
setInterval(() => {
  if (troubleshootingEl.open) renderDiagnostics();
}, 1000);
troubleshootingEl.addEventListener('toggle', renderDiagnostics);

/** @param {boolean} dimmed */
function setDimmed(dimmed) {
  dimOverlayEl.hidden = !dimmed;
}

testChimeEl.addEventListener('click', testSound);
dimEl.addEventListener('click', () => setDimmed(true));
dimOverlayEl.addEventListener('click', () => setDimmed(false));
toggleEl.addEventListener('click', () => (session ? stop() : void start()));
view.reset();
statusEl.textContent = 'Tap Start and allow the microphone.';
