import { describe, expect, it } from 'vitest';
import { viewsMessageKey } from '../src/core/format';
import { applyView, recordKey, videoIdFromKey } from '../src/core/storage';

describe('viewsMessageKey', () => {
  it('picks Russian plural forms', () => {
    expect(viewsMessageKey('ru', 1)).toBe('viewsOne');
    expect(viewsMessageKey('ru', 21)).toBe('viewsOne');
    expect(viewsMessageKey('ru', 3)).toBe('viewsFew');
    expect(viewsMessageKey('ru', 5)).toBe('viewsMany');
    expect(viewsMessageKey('ru', 11)).toBe('viewsMany');
  });

  it('picks English plural forms', () => {
    expect(viewsMessageKey('en', 1)).toBe('viewsOne');
    expect(viewsMessageKey('en', 2)).toBe('viewsOther');
  });
});

describe('applyView', () => {
  const meta = { title: 'Me at the zoo', channel: 'jawed' };

  it('creates a record on the first view', () => {
    expect(applyView(null, meta, 100)).toEqual({
      count: 1,
      firstViewedAt: 100,
      lastViewedAt: 100,
      title: 'Me at the zoo',
      channel: 'jawed',
    });
  });

  it('increments the count and keeps the first view time', () => {
    const record = applyView(applyView(null, meta, 100), { title: '', channel: '' }, 200);
    expect(record).toMatchObject({ count: 2, firstViewedAt: 100, lastViewedAt: 200 });
    expect(record.title).toBe('Me at the zoo');
  });
});

describe('record keys', () => {
  it('round-trips the video id', () => {
    expect(videoIdFromKey(recordKey('jNQXAC9IVRw'))).toBe('jNQXAC9IVRw');
    expect(videoIdFromKey('settings')).toBeNull();
  });
});
