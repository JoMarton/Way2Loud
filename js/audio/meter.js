// @ts-check

import { rms, toDb } from './levels.js';

/**
 * @typedef {object} Reading
 * @property {number} db loudness of the latest block, in dBFS
 * @property {number} time timestamp in ms, on the performance.now() clock
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
 * @property {AudioContext} context the running context, for playing sounds
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

/** Polling interval for browsers without AudioWorklet. */
const FALLBACK_INTERVAL_MS = 25;

/**
 * Opens the mic and calls `onReading` for every ~21 ms block of audio.
 * This is the only module that touches the mic. It must be called directly from
 * a tap: iOS Safari only lets audio start inside a user gesture, so the audio
 * context is created and resumed before anything is awaited.
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
  // Browsers only process nodes that lead to the speakers, so end the chain
  // there through a muted gain; nothing is actually played back.
  const mute = ctx.createGain();
  mute.gain.value = 0;
  mute.connect(ctx.destination);

  /** @type {() => void} */
  let stopMeasuring;
  try {
    stopMeasuring = await measureOnAudioThread(ctx, source, mute, onReading);
  } catch {
    stopMeasuring = measureByPolling(ctx, source, mute, onReading);
  }

  return {
    context: ctx,
    stop() {
      stopMeasuring();
      source.disconnect();
      mute.disconnect();
      for (const track of stream.getTracks()) track.stop();
      void ctx.close();
    },
  };
}

/**
 * Measures with an AudioWorklet, which keeps running when the screen is off.
 * @param {AudioContext} ctx
 * @param {AudioNode} source
 * @param {AudioNode} sink
 * @param {(reading: Reading) => void} onReading
 * @returns {Promise<() => void>} stops measuring
 */
async function measureOnAudioThread(ctx, source, sink, onReading) {
  if (!ctx.audioWorklet) throw new Error('AudioWorklet not supported');
  await ctx.audioWorklet.addModule(new URL('./level-processor.js', import.meta.url));
  const node = new AudioWorkletNode(ctx, 'level-processor');
  node.port.onmessage = (event) => {
    onReading({ db: toDb(/** @type {number} */ (event.data)), time: performance.now() });
  };
  source.connect(node);
  node.connect(sink);
  return () => {
    node.port.onmessage = null;
    node.disconnect();
  };
}

/**
 * Fallback for browsers without AudioWorklet: polls an analyser on a timer.
 * @param {AudioContext} ctx
 * @param {AudioNode} source
 * @param {AudioNode} sink
 * @param {(reading: Reading) => void} onReading
 * @returns {() => void} stops measuring
 */
function measureByPolling(ctx, source, sink, onReading) {
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  analyser.connect(sink);
  const samples = new Float32Array(analyser.fftSize);
  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    onReading({ db: toDb(rms(samples)), time: performance.now() });
  }, FALLBACK_INTERVAL_MS);
  return () => {
    clearInterval(timer);
    analyser.disconnect();
  };
}
