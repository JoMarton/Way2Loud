// @ts-check

/** Parent settings: stored per device, since every device's mic differs. */

const STORAGE_KEY = 'way2loud.settings';

export const SENSITIVITY_MIN_DB = -30;
export const SENSITIVITY_MAX_DB = 30;

/**
 * @typedef {object} Settings
 * @property {number} sensitivityDb gain added to every reading, in dB
 */

/** @type {Readonly<Settings>} */
export const DEFAULT_SETTINGS = Object.freeze({ sensitivityDb: 0 });

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
 * Connects the settings panel controls to stored settings.
 * @param {{ sensitivity: HTMLInputElement, sensitivityValue: HTMLOutputElement }} els
 * @returns {{ readonly current: Settings }}
 */
export function bindSettings(els) {
  let current = loadSettings();

  els.sensitivity.min = String(SENSITIVITY_MIN_DB);
  els.sensitivity.max = String(SENSITIVITY_MAX_DB);
  els.sensitivity.value = String(current.sensitivityDb);
  els.sensitivityValue.value = formatDb(current.sensitivityDb);

  els.sensitivity.addEventListener('input', () => {
    current = normalizeSettings({ ...current, sensitivityDb: els.sensitivity.value });
    els.sensitivityValue.value = formatDb(current.sensitivityDb);
    saveSettings(current);
  });

  return {
    get current() {
      return current;
    },
  };
}
