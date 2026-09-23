import { describe, expect, it } from 'vitest';
import { DB_FLOOR, applyGain, dbToLevel, rms, toDb } from '../../js/audio/levels.js';

/** @param {number} amplitude @param {number} length */
const sine = (amplitude, length = 4800) =>
  Float32Array.from({ length }, (_, i) => amplitude * Math.sin((2 * Math.PI * 440 * i) / 48000));

describe('rms', () => {
  it('is 0 for silence and empty input', () => {
    expect(rms(new Float32Array(128))).toBe(0);
    expect(rms([])).toBe(0);
  });

  it('equals the amplitude of a constant signal', () => {
    expect(rms(new Float32Array(64).fill(0.5))).toBeCloseTo(0.5);
  });

  it('is amplitude / sqrt(2) for a sine', () => {
    expect(rms(sine(1))).toBeCloseTo(Math.SQRT1_2, 3);
  });
});

describe('toDb', () => {
  it('is 0 dB at full scale', () => {
    expect(toDb(1)).toBeCloseTo(0);
  });

  it('drops about 6 dB when the amplitude halves', () => {
    expect(toDb(0.5)).toBeCloseTo(-6.02, 2);
  });

  it('clamps silence and tiny values to the floor', () => {
    expect(toDb(0)).toBe(DB_FLOOR);
    expect(toDb(1e-9)).toBe(DB_FLOOR);
  });

  it('gives about -3 dB for a full-scale sine', () => {
    expect(toDb(rms(sine(1)))).toBeCloseTo(-3.01, 1);
  });
});

describe('dbToLevel', () => {
  it('maps the range onto 0..1', () => {
    expect(dbToLevel(-70)).toBe(0);
    expect(dbToLevel(-35)).toBeCloseTo(0.5);
    expect(dbToLevel(0)).toBe(1);
  });

  it('clamps outside the range', () => {
    expect(dbToLevel(-100)).toBe(0);
    expect(dbToLevel(6)).toBe(1);
  });

  it('accepts a custom range', () => {
    expect(dbToLevel(-20, -40, 0)).toBeCloseTo(0.5);
  });
});

describe('applyGain', () => {
  it('shifts readings by the gain', () => {
    expect(applyGain(-40, 10)).toBe(-30);
    expect(applyGain(-40, -10)).toBe(-50);
  });

  it('keeps silence at the floor even when boosted', () => {
    expect(applyGain(DB_FLOOR, 20)).toBe(DB_FLOOR);
  });

  it('never goes below the floor', () => {
    expect(applyGain(-95, -20)).toBe(DB_FLOOR);
  });
});
