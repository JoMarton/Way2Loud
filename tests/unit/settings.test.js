import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  formatDb,
  loadSettings,
  normalizeSettings,
  saveSettings,
} from '../../js/ui/settings.js';

const memoryStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, String(v)),
  };
};

describe('normalizeSettings', () => {
  it('falls back to defaults for missing or junk input', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ sensitivityDb: 'loud' })).toEqual(DEFAULT_SETTINGS);
  });

  it('accepts numeric strings (range inputs give strings) and rounds', () => {
    expect(normalizeSettings({ sensitivityDb: '7.6' }).sensitivityDb).toBe(8);
  });

  it('keeps chimeEnabled only if it is a boolean', () => {
    expect(normalizeSettings({ chimeEnabled: false }).chimeEnabled).toBe(false);
    expect(normalizeSettings({ chimeEnabled: 'no' }).chimeEnabled).toBe(true);
  });

  it('keeps a known sound or "random", and resets an unknown one', () => {
    expect(normalizeSettings({ chimeSound: 'boing' }).chimeSound).toBe('boing');
    expect(normalizeSettings({ chimeSound: 'random' }).chimeSound).toBe('random');
    expect(normalizeSettings({ chimeSound: 'kazoo' }).chimeSound).toBe(DEFAULT_SETTINGS.chimeSound);
  });

  it('upgrades settings saved before the newer options existed', () => {
    expect(normalizeSettings({ sensitivityDb: 5, chimeEnabled: false })).toEqual({
      ...DEFAULT_SETTINGS,
      sensitivityDb: 5,
      chimeEnabled: false,
    });
  });

  it('clamps sensitivity to ±30 dB', () => {
    expect(normalizeSettings({ sensitivityDb: 99 }).sensitivityDb).toBe(30);
    expect(normalizeSettings({ sensitivityDb: -99 }).sensitivityDb).toBe(-30);
  });
});

describe('loadSettings / saveSettings', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage();
    const saved = {
      sensitivityDb: 12,
      chimeEnabled: false,
      chimeSound: 'quack',
      keepScreenOn: true,
    };
    saveSettings(saved, storage);
    expect(loadSettings(storage)).toEqual(saved);
  });

  it('returns defaults when storage is empty, corrupt or missing', () => {
    const storage = memoryStorage();
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    storage.setItem('way2loud.settings', '{not json');
    expect(loadSettings(storage)).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings(null)).toEqual(DEFAULT_SETTINGS);
  });

  it('ignores storage that throws', () => {
    const broken = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    };
    expect(() => saveSettings(DEFAULT_SETTINGS, broken)).not.toThrow();
    expect(loadSettings(broken)).toEqual(DEFAULT_SETTINGS);
  });
});

describe('formatDb', () => {
  it('shows a sign for boosts', () => {
    expect(formatDb(6)).toBe('+6 dB');
    expect(formatDb(0)).toBe('0 dB');
    expect(formatDb(-4)).toBe('-4 dB');
  });
});
