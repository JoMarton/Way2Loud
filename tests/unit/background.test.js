import { describe, expect, it } from 'vitest';
import { describeTimeAway, emptyAwayStats, formatDuration } from '../../js/ui/background.js';

/** @param {Partial<ReturnType<typeof emptyAwayStats>>} stats */
const stats = (s) => ({ ...emptyAwayStats(), ...s });

describe('describeTimeAway', () => {
  it('stays silent for a short time away', () => {
    expect(describeTimeAway(3000, stats({}))).toBeNull();
  });

  it('reports a pause when readings stopped, and suggests keeping the screen on', () => {
    const msg = describeTimeAway(60_000, stats({ readings: 12 }));
    expect(msg).toContain('paused');
    expect(msg).toContain('Keep screen on');
  });

  it('reports when the page ran but the mic only gave silence', () => {
    const msg = describeTimeAway(420_000, stats({ readings: 420 * 45, maxDb: -100 }));
    expect(msg).toContain('gave it silence');
    expect(msg).toContain('7 min');
  });

  it('reports what it heard and did when listening worked', () => {
    const msg = describeTimeAway(
      120_000,
      stats({ readings: 120 * 45, maxDb: -17.6, loudMoments: 3, sounds: 2 }),
    );
    expect(msg).toContain('Kept listening');
    expect(msg).toContain('loudest -18 dB');
    expect(msg).toContain('3 loud moments');
    expect(msg).toContain('2 sounds played');
  });

  it('uses the singular for one', () => {
    const msg = describeTimeAway(
      10_000,
      stats({ readings: 450, maxDb: -20, loudMoments: 1, sounds: 1 }),
    );
    expect(msg).toContain('1 loud moment,');
    expect(msg).toContain('1 sound played');
  });
});

describe('formatDuration', () => {
  it('uses seconds under a minute, then minutes', () => {
    expect(formatDuration(45_000)).toBe('45 s');
    expect(formatDuration(150_000)).toBe('3 min');
  });
});
