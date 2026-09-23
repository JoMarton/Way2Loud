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
    expect(normalizeSettings({ sensitivityDb: '7.6' })).toEqual({ sensitivityDb: 8 });
  });

  it('clamps sensitivity to ±30 dB', () => {
    expect(normalizeSettings({ sensitivityDb: 99 }).sensitivityDb).toBe(30);
    expect(normalizeSettings({ sensitivityDb: -99 }).sensitivityDb).toBe(-30);
  });
});

describe('loadSettings / saveSettings', () => {
  it('round-trips through storage', () => {
    const storage = memoryStorage();
    saveSettings({ sensitivityDb: 12 }, storage);
    expect(loadSettings(storage)).toEqual({ sensitivityDb: 12 });
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
    expect(() => saveSettings({ sensitivityDb: 3 }, broken)).not.toThrow();
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
