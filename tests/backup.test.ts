import { describe, expect, it } from 'vitest';
import { BackupError, createBackup, mergeBackup, parseBackup } from '../src/core/backup';
import { mergeRecords, sanitizeRecord } from '../src/core/records';
import type { VideoRecord } from '../src/core/storage';

const NOW = Date.UTC(2026, 9, 18);
const T1 = Date.UTC(2026, 0, 1);
const T2 = Date.UTC(2026, 5, 1);

const record = (overrides: Partial<VideoRecord> = {}): VideoRecord => ({
  count: 2,
  firstViewedAt: T1,
  lastViewedAt: T2,
  title: 'Me at the zoo',
  channel: 'jawed',
  ...overrides,
});

describe('sanitizeRecord', () => {
  it('accepts a valid record', () => {
    expect(sanitizeRecord(record(), NOW)).toEqual(record());
  });

  it('rejects broken counts and dates', () => {
    for (const bad of [
      { count: -1 },
      { count: 1.5 },
      { count: '2' },
      { count: 0 },
      { firstViewedAt: 'yesterday' },
      { firstViewedAt: Date.UTC(1999, 0, 1) },
      { lastViewedAt: NOW + 7 * 86_400_000 },
      { firstViewedAt: T2, lastViewedAt: T1 },
    ]) {
      expect(sanitizeRecord(record(bad as Partial<VideoRecord>), NOW)).toBeNull();
    }
  });

  it('caps text and drops unknown fields', () => {
    const r = sanitizeRecord({ ...record(), title: 'x'.repeat(1000), evil: '<script>' }, NOW);
    expect(r?.title).toHaveLength(300);
    expect(r).not.toHaveProperty('evil');
  });

  it('keeps imported views', () => {
    expect(sanitizeRecord(record({ count: 0, imported: 4 }), NOW)).toEqual(
      record({ count: 0, imported: 4 }),
    );
  });
});

describe('mergeRecords', () => {
  it('takes the larger counts and the widest date range', () => {
    const merged = mergeRecords(
      record({ count: 5, firstViewedAt: T2, lastViewedAt: T2, title: '' }),
      record({ count: 3, imported: 2, firstViewedAt: T1, lastViewedAt: T1, title: 'Old title' }),
    );
    expect(merged).toEqual(
      record({ count: 5, imported: 2, firstViewedAt: T1, lastViewedAt: T2, title: 'Old title' }),
    );
  });
});

describe('backups', () => {
  it('round-trips the history', () => {
    const records = new Map([['jNQXAC9IVRw', record()]]);
    const text = JSON.stringify(createBackup(records, T1, NOW));
    expect(parseBackup(text, NOW)).toEqual({ records, trackingSince: T1, skipped: 0 });
  });

  it('skips invalid entries and counts them', () => {
    const text = JSON.stringify({
      format: 'local-views-for-youtube',
      version: 1,
      videos: { jNQXAC9IVRw: record(), 'not-an-id': record(), btDvx9zgRtY: { count: 'many' } },
    });
    const parsed = parseBackup(text, NOW);
    expect([...parsed.records.keys()]).toEqual(['jNQXAC9IVRw']);
    expect(parsed.skipped).toBe(2);
  });

  it('rejects files that are not backups', () => {
    expect(() => parseBackup('nope', NOW)).toThrow(BackupError);
    expect(() => parseBackup('[]', NOW)).toThrow(BackupError);
    expect(() => parseBackup(JSON.stringify({ format: 'other' }), NOW)).toThrow(BackupError);
    expect(() =>
      parseBackup(JSON.stringify({ format: 'local-views-for-youtube', version: 99, videos: {} }), NOW),
    ).toThrow(BackupError);
  });

  it('restoring the same backup twice does not double counts', () => {
    const backup = new Map([['jNQXAC9IVRw', record({ count: 3 })]]);
    const once = mergeBackup(new Map(), backup);
    const twice = mergeBackup(once, backup);
    expect(twice.get('jNQXAC9IVRw')?.count).toBe(3);
  });
});
