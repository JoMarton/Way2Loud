// @ts-check

/** Parent settings: stored per device, since every device's mic differs. */

import { RANDOM_SOUND, SOUNDS, findSound } from '../audio/sounds.js';

const STORAGE_KEY = 'way2loud.settings';

export const SENSITIVITY_MIN_DB = -30;
export const SENSITIVITY_MAX_DB = 30;

/**
 * @typedef {object} Settings
 * @property {number} sensitivityDb gain added to every reading, in dB
 * @property {boolean} chimeEnabled whether to play a sound when the voice gets too loud
 * @property {string} chimeSound a sound id, or "random" for a different one each time
 * @property {boolean} keepScreenOn whether to keep the screen on while listening
 * @property {boolean} backgroundAudio experimental: play an inaudible tone so Android keeps listening with the screen off
 */

/** @type {Readonly<Settings>} */
export const DEFAULT_SETTINGS = Object.freeze({
  sensitivityDb: 0,
  chimeEnabled: true,
  chimeSound: RANDOM_SOUND,
  keepScreenOn: true,
  backgroundAudio: false,
});

/**
 * @typedef {Pick<Storage, 'getItem' | 'setItem'>} StorageLike
 */

/** @returns {StorageLike | null} */
function defaultStorage() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // blocked storage (e.g. some private modes) throws on access
  }
}

/**
 * Coerces untrusted input (old or hand-edited storage) into valid settings.
 * @param {unknown} raw
 * @returns {Settings}
 */
export function normalizeSettings(raw) {
  const obj = raw && typeof raw === 'object' ? /** @type {Record<string, unknown>} */ (raw) : {};
  const sensitivity = Number(obj.sensitivityDb);
  return {
    sensitivityDb: Number.isFinite(sensitivity)
      ? Math.min(SENSITIVITY_MAX_DB, Math.max(SENSITIVITY_MIN_DB, Math.round(sensitivity)))
      : DEFAULT_SETTINGS.sensitivityDb,
    chimeEnabled:
      typeof obj.chimeEnabled === 'boolean' ? obj.chimeEnabled : DEFAULT_SETTINGS.chimeEnabled,
    chimeSound:
      typeof obj.chimeSound === 'string' &&
      (obj.chimeSound === RANDOM_SOUND || findSound(obj.chimeSound))
        ? obj.chimeSound
        : DEFAULT_SETTINGS.chimeSound,
    keepScreenOn:
      typeof obj.keepScreenOn === 'boolean' ? obj.keepScreenOn : DEFAULT_SETTINGS.keepScreenOn,
    backgroundAudio:
      typeof obj.backgroundAudio === 'boolean'
        ? obj.backgroundAudio
        : DEFAULT_SETTINGS.backgroundAudio,
  };
}

/**
 * @param {StorageLike | null} [storage]
 * @returns {Settings}
 */
export function loadSettings(storage = defaultStorage()) {
  try {
    const text = storage?.getItem(STORAGE_KEY);
    return normalizeSettings(text ? JSON.parse(text) : null);
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * Saves settings; failures are ignored, as the app works fine without storage.
 * @param {Settings} settings
 * @param {StorageLike | null} [storage]
 */
export function saveSettings(settings, storage = defaultStorage()) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Quota or privacy mode: keep the in-memory value only.
  }
}

/** @param {number} db */
export const formatDb = (db) => `${db > 0 ? '+' : ''}${db} dB`;

/**
 * @typedef {object} SettingsElements
 * @property {HTMLInputElement} sensitivity
 * @property {HTMLOutputElement} sensitivityValue
 * @property {HTMLInputElement} chime
 * @property {HTMLSelectElement} sound
 * @property {HTMLInputElement} keepScreenOn
 * @property {HTMLInputElement} backgroundAudio
 */

/**
 * Connects the settings panel controls to stored settings.
 * @param {SettingsElements} els
 * @param {(settings: Settings) => void} [onChange] called after any change
 * @returns {{ readonly current: Settings }}
 */
export function bindSettings(els, onChange = () => {}) {
  let current = loadSettings();

  /** @param {Partial<Settings>} patch */
  const update = (patch) => {
    current = normalizeSettings({ ...current, ...patch });
    saveSettings(current);
    onChange(current);
  };

  els.sensitivity.min = String(SENSITIVITY_MIN_DB);
  els.sensitivity.max = String(SENSITIVITY_MAX_DB);
  els.sensitivity.value = String(current.sensitivityDb);
  els.sensitivityValue.value = formatDb(current.sensitivityDb);
  els.sensitivity.addEventListener('input', () => {
    update({ sensitivityDb: Number(els.sensitivity.value) });
    els.sensitivityValue.value = formatDb(current.sensitivityDb);
  });

  els.chime.checked = current.chimeEnabled;
  els.chime.addEventListener('change', () => update({ chimeEnabled: els.chime.checked }));

  els.sound.replaceChildren(
    new Option('Surprise me (a different one each time)', RANDOM_SOUND),
    ...SOUNDS.map((sound) => new Option(sound.name, sound.id)),
  );
  els.sound.value = current.chimeSound;
  els.sound.addEventListener('change', () => update({ chimeSound: els.sound.value }));

  els.keepScreenOn.checked = current.keepScreenOn;
  els.keepScreenOn.addEventListener('change', () =>
    update({ keepScreenOn: els.keepScreenOn.checked }),
  );

  els.backgroundAudio.checked = current.backgroundAudio;
  els.backgroundAudio.addEventListener('change', () =>
    update({ backgroundAudio: els.backgroundAudio.checked }),
  );

  return {
    get current() {
      return current;
    },
  };
}
