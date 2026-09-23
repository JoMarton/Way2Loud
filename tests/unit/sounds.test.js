import { describe, expect, it } from 'vitest';
import { RANDOM_SOUND, SOUNDS, findSound, pickSound } from '../../js/audio/sounds.js';

describe('SOUNDS', () => {
  it('has ten sounds with unique ids and names', () => {
    expect(SOUNDS).toHaveLength(10);
    expect(new Set(SOUNDS.map((s) => s.id)).size).toBe(10);
    expect(new Set(SOUNDS.map((s) => s.name)).size).toBe(10);
  });

  it('never uses the reserved "random" id', () => {
    expect(findSound(RANDOM_SOUND)).toBeUndefined();
  });
});

describe('pickSound', () => {
  it('returns the chosen sound', () => {
    expect(pickSound('quack', null).id).toBe('quack');
  });

  it('falls back to the first sound for an unknown id', () => {
    expect(pickSound('kazoo', null).id).toBe(SOUNDS[0].id);
  });

  it('picks at random, never repeating the previous sound', () => {
    for (const previous of SOUNDS.map((s) => s.id)) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
        expect(pickSound(RANDOM_SOUND, previous, () => r).id).not.toBe(previous);
      }
    }
  });

  it('can reach every sound when picking at random', () => {
    const seen = new Set();
    for (let i = 0; i < 9; i++) seen.add(pickSound(RANDOM_SOUND, null, () => i / 9).id);
    seen.add(pickSound(RANDOM_SOUND, null, () => 0.95).id);
    expect(seen.size).toBe(10);
  });
});
