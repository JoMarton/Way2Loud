import { describe, expect, it } from 'vitest';
import { createCooldown } from '../../js/audio/chime.js';

describe('createCooldown', () => {
  it('allows the first action and blocks repeats within the cooldown', () => {
    const c = createCooldown(3000);
    expect(c.tryFire(0)).toBe(true);
    expect(c.tryFire(1000)).toBe(false);
    expect(c.tryFire(2999)).toBe(false);
  });

  it('allows the action again once the cooldown has passed', () => {
    const c = createCooldown(3000);
    c.tryFire(0);
    expect(c.tryFire(3000)).toBe(true);
    expect(c.tryFire(4000)).toBe(false);
  });

  it('does not extend the cooldown when an attempt is blocked', () => {
    const c = createCooldown(3000);
    c.tryFire(0);
    c.tryFire(2500);
    expect(c.tryFire(3000)).toBe(true);
  });
});
