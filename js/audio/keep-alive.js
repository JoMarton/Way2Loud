// @ts-check

/**
 * Experimental: keeps the page running with the screen off. Android browsers
 * freeze background pages after ~20 s unless they are playing audible media, and
 * using the mic doesn't count. So this loops a 25 Hz tone at -45 dBFS through a
 * normal <audio> element: loud enough for the browser to count as "playing",
 * far below what phone speakers can reproduce or anyone can hear. Android shows
 * a media notification while it plays.
 */

const SAMPLE_RATE = 8000;
const TONE_HZ = 25;
const TONE_DB = -45;

/**
 * Builds a mono 16-bit WAV of a sine tone. With a whole number of cycles in
 * `seconds`, it loops without a click.
 * @param {{ sampleRate?: number, seconds?: number, freq?: number, db?: number }} [options]
 * @returns {Uint8Array}
 */
export function makeToneWav({
  sampleRate = SAMPLE_RATE,
  seconds = 1,
  freq = TONE_HZ,
  db = TONE_DB,
} = {}) {
  const samples = Math.round(sampleRate * seconds);
  const bytes = new Uint8Array(44 + samples * 2);
  const view = new DataView(bytes.buffer);
  /** @param {number} offset @param {string} text */
  const ascii = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  ascii(0, 'RIFF');
  view.setUint32(4, 36 + samples * 2, true);
  ascii(8, 'WAVE');
  ascii(12, 'fmt ');
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // byte rate
  view.setUint16(32, 2, true); // block align
  view.setUint16(34, 16, true); // bits per sample
  ascii(36, 'data');
  view.setUint32(40, samples * 2, true);
  const amplitude = 10 ** (db / 20) * 32767;
  for (let i = 0; i < samples; i++) {
    const value = Math.round(amplitude * Math.sin((2 * Math.PI * freq * i) / sampleRate));
    view.setInt16(44 + i * 2, value, true);
  }
  return bytes;
}

export function createKeepAlive() {
  /** @type {HTMLAudioElement | null} */
  let audio = null;
  /** Why the last play() failed, for the troubleshooting panel. */
  let lastError = '';

  return {
    /** Starts the tone. Call from a tap, or the browser may block playback. */
    start() {
      if (!audio) {
        const wav = new Blob([/** @type {Uint8Array<ArrayBuffer>} */ (makeToneWav())], {
          type: 'audio/wav',
        });
        audio = new Audio(URL.createObjectURL(wav));
        audio.loop = true;
      }
      lastError = '';
      audio.play().catch((err) => {
        // Blocked or unsupported: listening still works while the screen is on.
        lastError = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      });
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: 'Way2Loud is listening',
          artist: 'Tap to open',
        });
        navigator.mediaSession.playbackState = 'playing';
      }
    },
    /** @returns {string} a short description, for the troubleshooting panel */
    status() {
      if (lastError) return `blocked: ${lastError}`;
      if (!audio || audio.paused) return 'off';
      return `playing (${audio.currentTime.toFixed(1)} s into the loop)`;
    },
    stop() {
      audio?.pause();
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
        navigator.mediaSession.playbackState = 'none';
      }
    },
  };
}
