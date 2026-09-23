// @ts-check

import { rms, toDb } from './levels.js';

/**
 * @typedef {object} Reading
 * @property {number} db loudness of the latest block, in dBFS
 * @property {number} time timestamp from requestAnimationFrame, in ms
 */

/** The browser kept audio paused, usually because it didn't count the tap. */
export class AudioSuspendedError extends Error {
  constructor() {
    super('The browser kept audio paused.');
    this.name = 'AudioSuspendedError';
  }
}

/**
 * @typedef {object} Meter
 * @property {() => void} stop releases the mic and audio context
 * @property {AudioContext} context the running context, for playing the chime
 */

/**
 * Creates an audio context, including on older Safari that only has the prefixed name.
 * @returns {AudioContext}
 */
export function createAudioContext() {
  const AudioCtx =
    window.AudioContext ??
    /** @type {typeof AudioContext} */ (/** @type {any} */ (window).webkitAudioContext);
  return new AudioCtx();
}

/** How long to wait for the browser to let audio run before giving up. */
const RESUME_TIMEOUT_MS = 3000;

/**
 * Opens the mic and calls `onReading` once per animation frame.
 * This is the only module that touches browser audio. It must be called
 * directly from a tap: iOS Safari only lets audio start inside a user gesture,
 * so the audio context is created and resumed before anything is awaited.
 * @param {(reading: Reading) => void} onReading
 * @returns {Promise<Meter>}
 */
export async function startMeter(onReading) {
  const ctx = createAudioContext();
  const resumed = ctx.resume();

  /** @type {MediaStream | undefined} */
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      // Auto gain would level out exactly the loudness we want to measure.
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    await Promise.race([resumed, new Promise((r) => setTimeout(r, RESUME_TIMEOUT_MS))]);
    if (ctx.state !== 'running') throw new AudioSuspendedError();
  } catch (err) {
    for (const track of stream?.getTracks() ?? []) track.stop();
    void ctx.close();
    throw err;
  }

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048; // ~43 ms per block at 48 kHz
  // Safari only processes nodes that lead to the speakers, so end the chain
  // there through a muted gain; nothing is actually played back.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  source.connect(analyser);
  analyser.connect(mute);
  mute.connect(ctx.destination);

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
    context: ctx,
    stop() {
      cancelAnimationFrame(frame);
      source.disconnect();
      mute.disconnect();
      for (const track of stream.getTracks()) track.stop();
      void ctx.close();
    },
  };
}
