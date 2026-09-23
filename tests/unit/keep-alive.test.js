import { describe, expect, it } from 'vitest';
import { makeToneWav } from '../../js/audio/keep-alive.js';

const read = (bytes) => new DataView(bytes.buffer);
const ascii = (bytes, offset, length) =>
  String.fromCharCode(...bytes.slice(offset, offset + length));
const samplesOf = (bytes) => {
  const view = read(bytes);
  return Array.from({ length: (bytes.length - 44) / 2 }, (_, i) => view.getInt16(44 + i * 2, true));
};

describe('makeToneWav', () => {
  it('writes a valid mono 16-bit PCM WAV header', () => {
    const wav = makeToneWav({ sampleRate: 8000, seconds: 1 });
    const view = read(wav);
    expect(ascii(wav, 0, 4)).toBe('RIFF');
    expect(ascii(wav, 8, 4)).toBe('WAVE');
    expect(ascii(wav, 36, 4)).toBe('data');
    expect(view.getUint16(20, true)).toBe(1); // PCM
    expect(view.getUint16(22, true)).toBe(1); // mono
    expect(view.getUint32(24, true)).toBe(8000);
    expect(view.getUint16(34, true)).toBe(16);
    expect(view.getUint32(40, true)).toBe(16000);
    expect(view.getUint32(4, true)).toBe(wav.length - 8);
  });

  it('plays the tone at the requested level (-45 dBFS by default)', () => {
    const samples = samplesOf(makeToneWav());
    const peak = Math.max(...samples.map(Math.abs));
    expect(20 * Math.log10(peak / 32767)).toBeCloseTo(-45, 0);
  });

  it('loops without a click: a whole number of cycles, ending just before the start', () => {
    const samples = samplesOf(makeToneWav({ sampleRate: 8000, seconds: 1, freq: 25 }));
    expect(samples[0]).toBe(0);
    const step = Math.abs(samples[1] - samples[0]);
    expect(Math.abs(samples[0] - samples[samples.length - 1])).toBeLessThanOrEqual(step + 1);
  });
});
