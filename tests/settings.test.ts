import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, normalizeSettings } from '../src/shared/settings';

describe('normalizeSettings', () => {
  it('returns the defaults for missing or broken data', () => {
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('x')).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ format: 'huge', color: 'red', showOn: 'all' })).toEqual(
      DEFAULT_SETTINGS,
    );
  });

  it('keeps valid values', () => {
    const settings = {
      thresholdMode: 'percent',
      thresholdSeconds: 30,
      thresholdPercent: 50,
      format: 'eye',
      showZero: false,
      color: '#FF0000',
      showOn: { watch: true, home: false, recommendations: true, history: false },
    };
    expect(normalizeSettings(settings)).toEqual({ ...settings, color: '#ff0000' });
  });

  it('clamps and rounds thresholds', () => {
    const s = normalizeSettings({ thresholdSeconds: 9999, thresholdPercent: 0.4 });
    expect(s.thresholdSeconds).toBe(600);
    expect(s.thresholdPercent).toBe(1);
    expect(normalizeSettings({ thresholdSeconds: 7.6 }).thresholdSeconds).toBe(8);
  });

  it('fills in missing surfaces', () => {
    expect(normalizeSettings({ showOn: { home: false } }).showOn).toEqual({
      watch: true,
      home: false,
      recommendations: true,
      history: true,
    });
  });
});
