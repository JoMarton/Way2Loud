// @ts-check

/**
 * The alert sounds, all synthesized in code (no audio files). Each recipe
 * schedules its notes into `out` starting at time `t` (seconds, on the context's
 * clock) and returns its length in seconds. They are kept short (≤ 1.3 s). Each
 * sound's `gain` evens out loudness: rendered offline, each measures about -20 dB
 * RMS (±1) over its audible part at the default volume.
 */

/**
 * @typedef {(ctx: BaseAudioContext, out: AudioNode, t: number) => number} Recipe
 * @typedef {{ id: string, name: string, gain: number, recipe: Recipe }} Sound
 */

/**
 * An oscillator, started and stopped at the given times.
 * @param {BaseAudioContext} ctx
 * @param {OscillatorType} type
 * @param {number} freq
 * @param {number} start
 * @param {number} end
 */
function osc(ctx, type, freq, start, end) {
  const node = ctx.createOscillator();
  node.type = type;
  node.frequency.setValueAtTime(freq, start);
  node.start(start);
  node.stop(end);
  return node;
}

/**
 * A gain node with a quick attack and exponential fade, connected to `out`.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} out
 * @param {number} start
 * @param {number} length seconds until silent
 * @param {{ peak?: number, attack?: number, hold?: number }} [shape]
 */
function envelope(ctx, out, start, length, { peak = 1, attack = 0.01, hold = 0 } = {}) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(peak, start + attack);
  if (hold > 0) g.gain.setValueAtTime(peak, start + attack + hold);
  g.gain.exponentialRampToValueAtTime(0.0001, start + length);
  g.connect(out);
  return g;
}

/**
 * A bell-like note: a sine plus quieter overtones, fading out.
 * @param {BaseAudioContext} ctx
 * @param {AudioNode} out
 * @param {number} freq
 * @param {number} start
 * @param {number} length
 * @param {Array<[number, number]>} [partials] [frequency ratio, level] pairs
 */
function bell(ctx, out, freq, start, length, partials = [[1, 1]]) {
  const env = envelope(ctx, out, start, length, { attack: 0.012 });
  for (const [ratio, level] of partials) {
    const lvl = ctx.createGain();
    lvl.gain.value = level;
    osc(ctx, 'sine', freq * ratio, start, start + length)
      .connect(lvl)
      .connect(env);
  }
}

/** @param {BaseAudioContext} ctx @param {number} seconds */
function noiseBuffer(ctx, seconds) {
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** @type {readonly Sound[]} */
export const SOUNDS = Object.freeze([
  {
    id: 'chime',
    name: 'Soft chime',
    gain: 1.1,
    recipe(ctx, out, t) {
      bell(ctx, out, 880, t, 0.9, [
        [1, 1],
        [1.5, 0.35],
      ]);
      return 0.9;
    },
  },
  {
    id: 'ding-dong',
    name: 'Ding-dong',
    gain: 1.15,
    recipe(ctx, out, t) {
      const partials = /** @type {Array<[number, number]>} */ ([
        [1, 1],
        [2, 0.25],
        [3, 0.08],
      ]);
      bell(ctx, out, 659, t, 0.8, partials);
      bell(ctx, out, 523, t + 0.45, 0.85, partials);
      return 1.3;
    },
  },
  {
    id: 'xylophone',
    name: 'Xylophone',
    gain: 0.95,
    recipe(ctx, out, t) {
      [523, 659, 784, 1047].forEach((freq, i) =>
        bell(ctx, out, freq, t + i * 0.11, 0.4, [
          [1, 1],
          [3.9, 0.15],
        ]),
      );
      return 0.33 + 0.4;
    },
  },
  {
    id: 'boing',
    name: 'Boing',
    gain: 1.4,
    recipe(ctx, out, t) {
      const end = t + 0.75;
      const tone = osc(ctx, 'triangle', 180, t, end);
      tone.frequency.exponentialRampToValueAtTime(480, t + 0.09);
      tone.frequency.exponentialRampToValueAtTime(330, end);
      // A fast wobble that dies away: the "oing-oing-oing".
      const wobble = osc(ctx, 'sine', 17, t, end);
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(90, t + 0.09);
      depth.gain.exponentialRampToValueAtTime(1, end);
      wobble.connect(depth).connect(tone.frequency);
      tone.connect(envelope(ctx, out, t, 0.75, { attack: 0.005 }));
      return 0.75;
    },
  },
  {
    id: 'slide-whistle',
    name: 'Slide whistle',
    gain: 0.43,
    recipe(ctx, out, t) {
      const end = t + 0.8;
      const tone = osc(ctx, 'sine', 600, t, end);
      tone.frequency.exponentialRampToValueAtTime(1500, t + 0.35);
      tone.frequency.exponentialRampToValueAtTime(700, end);
      const vibrato = osc(ctx, 'sine', 6, t, end);
      const depth = ctx.createGain();
      depth.gain.value = 18;
      vibrato.connect(depth).connect(tone.frequency);
      tone.connect(envelope(ctx, out, t, 0.8, { attack: 0.05, hold: 0.55 }));
      return 0.8;
    },
  },
  {
    id: 'bloop',
    name: 'Bloop bloop',
    gain: 0.5,
    recipe(ctx, out, t) {
      for (const start of [t, t + 0.2]) {
        const tone = osc(ctx, 'sine', 280, start, start + 0.18);
        tone.frequency.exponentialRampToValueAtTime(1100, start + 0.12);
        tone.connect(envelope(ctx, out, start, 0.18, { attack: 0.005, hold: 0.08 }));
      }
      return 0.4;
    },
  },
  {
    id: 'quack',
    name: 'Duck',
    gain: 2.6,
    recipe(ctx, out, t) {
      for (const start of [t, t + 0.26]) {
        const end = start + 0.17;
        const voice = osc(ctx, 'sawtooth', 240, start, end);
        voice.frequency.exponentialRampToValueAtTime(190, end);
        // Two resonances give the nasal "quack" vowel.
        const env = envelope(ctx, out, start, 0.17, { attack: 0.012, hold: 0.07 });
        for (const [freq, q] of [
          [1100, 4],
          [2300, 6],
        ]) {
          const formant = ctx.createBiquadFilter();
          formant.type = 'bandpass';
          formant.frequency.value = freq;
          formant.Q.value = q;
          voice.connect(formant).connect(env);
        }
      }
      return 0.45;
    },
  },
  {
    id: 'robot',
    name: 'Robot beep-boop',
    gain: 0.37,
    recipe(ctx, out, t) {
      const soften = ctx.createBiquadFilter();
      soften.type = 'lowpass';
      soften.frequency.value = 2500;
      soften.connect(out);
      [880, 440, 660].forEach((freq, i) => {
        const start = t + i * 0.15;
        osc(ctx, 'square', freq, start, start + 0.11).connect(
          envelope(ctx, soften, start, 0.11, { attack: 0.005, hold: 0.08 }),
        );
      });
      return 0.45;
    },
  },
  {
    id: 'cuckoo',
    name: 'Cuckoo',
    gain: 0.52,
    recipe(ctx, out, t) {
      for (const [freq, start] of [
        [698, t],
        [554, t + 0.38],
      ]) {
        const tone = osc(ctx, 'sine', freq, start, start + 0.32);
        tone.connect(envelope(ctx, out, start, 0.32, { attack: 0.03, hold: 0.12 }));
      }
      return 0.7;
    },
  },
  {
    id: 'shh',
    name: 'Shh',
    gain: 1.4,
    recipe(ctx, out, t) {
      const noise = ctx.createBufferSource();
      noise.buffer = noiseBuffer(ctx, 1.1);
      const shape = ctx.createBiquadFilter();
      shape.type = 'bandpass';
      shape.frequency.value = 3200;
      shape.Q.value = 0.9;
      noise.connect(shape).connect(envelope(ctx, out, t, 1.1, { attack: 0.18, hold: 0.45 }));
      noise.start(t);
      noise.stop(t + 1.1);
      return 1.1;
    },
  },
]);

/** Setting value that picks a different sound each time. */
export const RANDOM_SOUND = 'random';

/** @param {string} id */
export const findSound = (id) => SOUNDS.find((s) => s.id === id);

/**
 * Resolves the sound setting to a concrete sound. "Random" never repeats the
 * previous sound back to back, so it stays surprising.
 * @param {string} setting a sound id or RANDOM_SOUND
 * @param {string | null} previousId
 * @param {() => number} [random] returns a number in [0, 1)
 * @returns {Sound}
 */
export function pickSound(setting, previousId, random = Math.random) {
  if (setting !== RANDOM_SOUND) return findSound(setting) ?? SOUNDS[0];
  const choices = SOUNDS.filter((s) => s.id !== previousId);
  return choices[Math.floor(random() * choices.length)] ?? SOUNDS[0];
}

/**
 * Plays a sound now.
 * @param {BaseAudioContext} ctx a running context
 * @param {Sound} sound
 * @param {number} volume overall volume (0..1)
 * @returns {number} length in ms
 */
export function playSound(ctx, sound, volume) {
  const out = ctx.createGain();
  out.gain.value = volume * sound.gain;
  out.connect(ctx.destination);
  const seconds = sound.recipe(ctx, out, ctx.currentTime + 0.01);
  setTimeout(() => out.disconnect(), seconds * 1000 + 200);
  return Math.round(seconds * 1000);
}
