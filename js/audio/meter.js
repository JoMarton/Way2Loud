// @ts-check

import { rms, toDb } from './levels.js';

/**
 * @typedef {object} Reading
 * @property {number} db loudness of the latest block, in dBFS
 * @property {number} time timestamp from requestAnimationFrame, in ms
 */

/**
 * @typedef {object} Meter
 * @property {() => void} stop releases the mic and audio context
 */

/**
 * Opens the mic and calls `onReading` once per animation frame.
 * This is the only module that touches browser audio. It must be called from a
 * user gesture (a tap), or iOS Safari keeps the audio context suspended.
 * @param {(reading: Reading) => void} onReading
 * @returns {Promise<Meter>}
 */
export async function startMeter(onReading) {
  const stream = await navigator.mediaDevices.getUserMedia({
    // Auto gain would level out exactly the loudness we want to measure.
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });

  const ctx = new AudioContext();
  await ctx.resume();
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048; // ~43 ms per block at 48 kHz
  source.connect(analyser);

  const samples = new Float32Array(analyser.fftSize);
  let frame = 0;

  /** @param {number} time */
  const tick = (time) => {
    analyser.getFloatTimeDomainData(samples);
    onReading({ db: toDb(rms(samples)), time });
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  return {
    stop() {
      cancelAnimationFrame(frame);
      source.disconnect();
      for (const track of stream.getTracks()) track.stop();
      void ctx.close();
    },
  };
}
