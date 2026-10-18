import { describe, expect, it } from 'vitest';
import { computeStats, searchVideos } from '../src/core/stats';
import type { VideoRecord } from '../src/core/storage';

const r = (count: number, last: number, title: string, channel: string, imported = 0): VideoRecord => ({
  count,
  ...(imported ? { imported } : {}),
  firstViewedAt: 1,
  lastViewedAt: last,
  title,
  channel,
});

const records = new Map([
  ['aaaaaaaaaaa', r(5, 10, 'Me at the zoo', 'jawed')],
  ['bbbbbbbbbbb', r(1, 30, 'Жуки обзор', 'Woodmark', 2)],
  ['ccccccccccc', r(2, 20, 'Another zoo video', 'jawed')],
  ['ddddddddddd', r(0, 40, 'Empty', 'Nobody')],
]);

describe('computeStats', () => {
  it('sums counted and imported views', () => {
    const stats = computeStats(records);
    expect(stats).toMatchObject({ views: 10, counted: 8, imported: 2, videos: 3 });
  });

  it('orders most watched, recent and channels', () => {
    const stats = computeStats(records);
    expect(stats.mostWatched.map((e) => e.videoId)).toEqual(['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc']);
    expect(stats.recent.map((e) => e.videoId)).toEqual(['bbbbbbbbbbb', 'ccccccccccc', 'aaaaaaaaaaa']);
    expect(stats.channels).toEqual([
      { channel: 'jawed', views: 7, videos: 2 },
      { channel: 'Woodmark', views: 3, videos: 1 },
    ]);
  });
});

describe('searchVideos', () => {
  it('matches every word in title or channel, case-insensitively', () => {
    expect(searchVideos(records, 'ZOO jawed').results.map((e) => e.videoId)).toEqual([
      'ccccccccccc',
      'aaaaaaaaaaa',
    ]);
    expect(searchVideos(records, 'жуки').total).toBe(1);
    expect(searchVideos(records, 'missing').total).toBe(0);
  });

  it('lists everything with views for an empty query', () => {
    expect(searchVideos(records, '  ').total).toBe(3);
  });
});
