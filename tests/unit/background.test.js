import { describe, expect, it } from 'vitest';
import { describeTimeAway, formatDuration } from '../../js/ui/background.js';

describe('describeTimeAway', () => {
  it('stays silent for a short time away', () => {
    expect(describeTimeAway(3000, 0, 0)).toBeNull();
  });

  it('reports that listening continued when readings kept coming', () => {
    const msg = describeTimeAway(120_000, 120 * 45, 3);
    expect(msg).toContain('Kept listening');
    expect(msg).toContain('2 min');
    expect(msg).toContain('3 sounds');
  });

  it('uses the singular for one sound', () => {
    expect(describeTimeAway(10_000, 450, 1)).toContain('played 1 sound.');
  });

  it('reports a pause and suggests keeping the screen on', () => {
    const msg = describeTimeAway(60_000, 12, 0);
    expect(msg).toContain('paused');
    expect(msg).toContain('Keep screen on');
  });
});

describe('formatDuration', () => {
  it('uses seconds under a minute, then minutes', () => {
    expect(formatDuration(45_000)).toBe('45 s');
    expect(formatDuration(150_000)).toBe('3 min');
  });
});
