import { describe, expect, it } from 'vitest';
import {
  DB_FLOOR,
  DISPLAY_MAX_DB,
  DISPLAY_MIN_DB,
  ZONES,
  applyGain,
  createLoudnessDetector,
  dbToLevel,
  rms,
  toDb,
} from '../../js/audio/levels.js';

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
  it('maps the display window onto 0..1', () => {
    expect(dbToLevel(DISPLAY_MIN_DB)).toBe(0);
    expect(dbToLevel(DISPLAY_MAX_DB)).toBe(1);
  });

  it('puts the threshold at two thirds of the bar', () => {
    expect(dbToLevel(ZONES.thresholdDb)).toBeCloseTo(2 / 3);
  });

  it('clamps outside the range', () => {
    expect(dbToLevel(DB_FLOOR)).toBe(0);
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

/**
 * Feeds a constant level at 60 fps for `ms` and returns every decision.
 * @param {ReturnType<typeof createLoudnessDetector>} detector
 * @param {{ t: number }} clock shared time, advanced in place
 * @param {number} db
 * @param {number} ms
 */
const feed = (detector, clock, db, ms) => {
  const out = [];
  for (const end = clock.t + ms; clock.t < end; clock.t += 1000 / 60) {
    out.push(detector.update(db, clock.t));
  }
  return out;
};
const last = (arr) => arr[arr.length - 1];

describe('createLoudnessDetector', () => {
  const QUIET = -40;
  const NORMAL = -30;
  const LOUD = -15;

  it('reports quiet, then good, for the room and normal talking', () => {
    const d = createLoudnessDetector();
    const clock = { t: 0 };
    expect(last(feed(d, clock, QUIET, 500)).zone).toBe('quiet');
    expect(last(feed(d, clock, NORMAL, 1000)).zone).toBe('good');
  });

  it('smooths: the level moves toward a step instead of jumping', () => {
    const d = createLoudnessDetector({ smoothingMs: 200 });
    const clock = { t: 0 };
    feed(d, clock, QUIET, 1000);
    const first = d.update(NORMAL, (clock.t += 1000 / 60));
    expect(first.smoothedDb).toBeGreaterThan(QUIET);
    expect(first.smoothedDb).toBeLessThan(QUIET + 2);
    // After one time constant it has covered about 63% of the step.
    const after = last(feed(d, clock, NORMAL, 200));
    expect(after.smoothedDb).toBeCloseTo(QUIET + 0.63 * (NORMAL - QUIET), 0);
  });

  it('ignores a short spike like a clap or cough', () => {
    const d = createLoudnessDetector();
    const clock = { t: 0 };
    feed(d, clock, NORMAL, 1000);
    const spike = feed(d, clock, -5, 150);
    const settle = feed(d, clock, NORMAL, 1000);
    expect([...spike, ...settle].some((x) => x.zone === 'loud')).toBe(false);
  });

  it('turns loud only after the level stays above the threshold for the hold time', () => {
    const d = createLoudnessDetector({ holdMs: 400 });
    const clock = { t: 0 };
    feed(d, clock, NORMAL, 1000);
    const start = clock.t;
    const out = feed(d, clock, LOUD, 2000);
    const firstLoud = out.findIndex((x) => x.zone === 'loud');
    expect(firstLoud).toBeGreaterThan(-1);
    const loudAt = start + (firstLoud * 1000) / 60;
    // Smoothing needs a moment to cross the line, then the hold adds 400 ms.
    expect(loudAt - start).toBeGreaterThanOrEqual(400);
    expect(loudAt - start).toBeLessThan(800);
  });

  it('flags becameLoud exactly once per loud episode', () => {
    const d = createLoudnessDetector();
    const clock = { t: 0 };
    feed(d, clock, NORMAL, 1000);
    const out = feed(d, clock, LOUD, 3000);
    expect(out.filter((x) => x.becameLoud)).toHaveLength(1);
  });

  it('stays loud just under the threshold, and resets once clearly below (hysteresis)', () => {
    const d = createLoudnessDetector();
    const clock = { t: 0 };
    feed(d, clock, LOUD, 2000);
    const justUnder = ZONES.thresholdDb - ZONES.releaseDb / 2;
    expect(last(feed(d, clock, justUnder, 2000)).zone).toBe('loud');
    expect(last(feed(d, clock, NORMAL, 2000)).zone).toBe('good');
  });

  it('can become loud again after resetting', () => {
    const d = createLoudnessDetector();
    const clock = { t: 0 };
    feed(d, clock, LOUD, 2000);
    feed(d, clock, NORMAL, 2000);
    expect(feed(d, clock, LOUD, 2000).filter((x) => x.becameLoud)).toHaveLength(1);
  });

  it('freezes while paused, so the chime is not measured', () => {
    const d = createLoudnessDetector();
    const clock = { t: 0 };
    const before = last(feed(d, clock, NORMAL, 1000));
    d.pauseUntil(clock.t + 1000);
    const during = feed(d, clock, -3, 1000);
    expect(during.every((x) => x.smoothedDb === before.smoothedDb && x.zone === 'good')).toBe(true);
    // Afterwards it resumes smoothly from the frozen level rather than jumping.
    const next = d.update(NORMAL, (clock.t += 1000 / 60));
    expect(next.smoothedDb).toBeCloseTo(before.smoothedDb, 0);
  });

  it('bridges a long gap between readings without jumping', () => {
    const d = createLoudnessDetector();
    const clock = { t: 0 };
    feed(d, clock, QUIET, 1000);
    const afterGap = d.update(LOUD, clock.t + 5000);
    expect(afterGap.smoothedDb).toBeLessThan(QUIET + (LOUD - QUIET) * 0.5);
  });
});
