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

  const acquire = async () => {
    if (!supported || !wanted || sentinel || document.visibilityState !== 'visible') return;
    try {
      sentinel = await navigator.wakeLock.request('screen');
      sentinel.addEventListener('release', () => {
        sentinel = null;
      });
    } catch {
      // Denied (e.g. battery saver). The app still works; the screen may turn off.
    }
  };

  document.addEventListener('visibilitychange', () => void acquire());

  return {
    supported,
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
