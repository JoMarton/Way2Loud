/**
 * AudioWorklet that runs on the audio thread: it sums the mic signal into ~21 ms
 * blocks and posts each block's RMS. Unlike an animation-frame loop, this keeps
 * running when the screen is off, as long as the browser keeps the page alive.
 * (Worklet globals aren't in TypeScript's DOM types, so this file isn't type-checked.)
 */

const BLOCK_SAMPLES = 1024;

class LevelProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.sum = 0;
    this.count = 0;
  }

  /** @param {Float32Array[][]} inputs */
  process(inputs) {
    const channel = inputs[0]?.[0];
    if (channel) {
      for (let i = 0; i < channel.length; i++) this.sum += channel[i] * channel[i];
      this.count += channel.length;
      if (this.count >= BLOCK_SAMPLES) {
        this.port.postMessage(Math.sqrt(this.sum / this.count));
        this.sum = 0;
        this.count = 0;
      }
    }
    return true;
  }
}

registerProcessor('level-processor', LevelProcessor);
