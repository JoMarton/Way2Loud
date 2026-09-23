// @ts-check

/**
 * Keeps the screen on while listening, using the Screen Wake Lock API. Browsers
 * drop the lock whenever the page is hidden, so it is re-requested on return.
 */
export function createWakeLock() {
  const supported = 'wakeLock' in navigator;
  let wanted = false;
  /** @type {WakeLockSentinel | null} */
  let sentinel = null;
  /** Why the last request failed, for the troubleshooting panel. */
  let lastError = '';

  const acquire = async () => {
    if (!supported || !wanted || sentinel || document.visibilityState !== 'visible') return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
      lastError = '';
      sentinel.addEventListener('release', () => {
        sentinel = null;
      });
    } catch (err) {
      // Denied (e.g. battery saver). The app still works; the screen may turn off.
      lastError = err instanceof Error ? err.message : String(err);
    }
  };

  document.addEventListener('visibilitychange', () => void acquire());

  return {
    supported,
    /** @returns {string} a short description, for the troubleshooting panel */
    status() {
      if (!supported) return 'not supported by this browser';
      if (sentinel) return 'on (screen stays on)';
      if (wanted && lastError) return `refused: ${lastError}`;
      if (wanted) return 'waiting (page not visible)';
      return 'off';
    },
    /** @param {boolean} on */
    set(on) {
      wanted = on;
      if (on) void acquire();
      else {
        void sentinel?.release();
        sentinel = null;
      }
    },
  };
}
