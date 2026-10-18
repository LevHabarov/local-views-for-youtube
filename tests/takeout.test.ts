import { describe, expect, it } from 'vitest';
import type { VideoRecord } from '../src/core/storage';
import {
  detectTitlePrefix,
  parseTakeout,
  planTakeoutImport,
  TakeoutError,
} from '../src/core/takeout';

const TRACKING_SINCE = Date.UTC(2026, 9, 1);

function watch(videoId: string, time: string, title = 'Some video', channel = 'Some channel') {
  return {
    header: 'YouTube',
    title: `Watched ${title}`,
    titleUrl: `https://www.youtube.com/watch?v=${videoId}`,
    subtitles: [{ name: channel, url: 'https://www.youtube.com/channel/UC123' }],
    time,
    products: ['YouTube'],
    activityControls: ['YouTube watch history'],
  };
}

describe('detectTitlePrefix', () => {
  it('finds the shared localized verb', () => {
    expect(detectTitlePrefix(['Watched A', 'Watched B c', 'Watched D'])).toBe('Watched ');
    expect(detectTitlePrefix(['Вы посмотрели A', 'Вы посмотрели B'])).toBe('Вы посмотрели ');
  });

  it('finds nothing when titles do not share a prefix', () => {
    expect(detectTitlePrefix(['Alpha one', 'Beta two', 'Gamma three'])).toBe('');
  });
});

describe('parseTakeout', () => {
  const file = [
    watch('jNQXAC9IVRw', '2024-05-01T10:00:00Z', 'Me at the zoo', 'jawed'),
    watch('jNQXAC9IVRw', '2025-01-01T10:00:00Z', 'Me at the zoo', 'jawed'),
    watch('btDvx9zgRtY', '2025-03-01T10:00:00Z', 'Жуки', 'Woodmark'),
    // After the extension started counting: left out.
    watch('btDvx9zgRtY', '2026-10-10T10:00:00Z', 'Жуки', 'Woodmark'),
    // An ad.
    { ...watch('3XDnQdpVsQw', '2025-01-01T00:00:00Z'), details: [{ name: 'From Google Ads' }] },
    // YouTube Music.
    { ...watch('qCXNndiXDX8', '2025-01-01T00:00:00Z'), header: 'YouTube Music' },
    // A removed video has no link.
    { header: 'YouTube', title: 'Watched a video that has been removed', time: '2025-01-01T00:00:00Z' },
    // A link that is not a YouTube video.
    { ...watch('jNQXAC9IVRw', '2025-01-01T00:00:00Z'), titleUrl: 'https://evil.example/watch?v=jNQXAC9IVRw' },
  ];

  it('counts watches per video before tracking started', () => {
    const summary = parseTakeout(JSON.stringify(file), TRACKING_SINCE);
    expect(summary.views).toBe(3);
    expect(summary.afterTracking).toBe(1);
    expect(summary.skipped).toBe(4);
    expect(summary.videos.get('jNQXAC9IVRw')).toEqual({
      views: 2,
      firstViewedAt: Date.parse('2024-05-01T10:00:00Z'),
      lastViewedAt: Date.parse('2025-01-01T10:00:00Z'),
      title: 'Me at the zoo',
      channel: 'jawed',
    });
    expect(summary.videos.get('btDvx9zgRtY')?.views).toBe(1);
  });

  it('rejects files that are not a watch history', () => {
    expect(() => parseTakeout('{', TRACKING_SINCE)).toThrow(TakeoutError);
    expect(() => parseTakeout('{"a":1}', TRACKING_SINCE)).toThrow(TakeoutError);
    expect(() => parseTakeout('[{"foo":"bar"}]', TRACKING_SINCE)).toThrow(TakeoutError);
  });

  it('accepts an empty history', () => {
    expect(parseTakeout('[]', TRACKING_SINCE).views).toBe(0);
  });
});

describe('planTakeoutImport', () => {
  const T = Date.UTC(2025, 0, 1);
  const takeoutVideo = { views: 3, firstViewedAt: T, lastViewedAt: T, title: 'From Takeout', channel: 'C' };
  const local = (overrides: Partial<VideoRecord>): VideoRecord => ({
    count: 2,
    firstViewedAt: TRACKING_SINCE,
    lastViewedAt: TRACKING_SINCE,
    title: 'From player',
    channel: 'C',
    ...overrides,
  });

  it('adds imported views to existing records, keeping the player title', () => {
    const { writes, removed } = planTakeoutImport(
      new Map([['jNQXAC9IVRw', local({})]]),
      new Map([['jNQXAC9IVRw', takeoutVideo]]),
    );
    expect(writes.get('jNQXAC9IVRw')).toEqual(
      local({ imported: 3, firstViewedAt: T, title: 'From player' }),
    );
    expect(removed).toEqual([]);
  });

  it('creates records for videos the extension has not seen', () => {
    const { writes } = planTakeoutImport(new Map(), new Map([['btDvx9zgRtY', takeoutVideo]]));
    expect(writes.get('btDvx9zgRtY')).toEqual({
      count: 0,
      imported: 3,
      firstViewedAt: T,
      lastViewedAt: T,
      title: 'From Takeout',
      channel: 'C',
    });
  });

  it('replaces an earlier import instead of adding to it', () => {
    const current = new Map([
      ['jNQXAC9IVRw', local({ imported: 5 })],
      ['btDvx9zgRtY', local({ count: 0, imported: 2 })],
      ['3XDnQdpVsQw', local({ count: 1, imported: 2 })],
    ]);
    const { writes, removed } = planTakeoutImport(current, new Map([['jNQXAC9IVRw', takeoutVideo]]));
    expect(writes.get('jNQXAC9IVRw')?.imported).toBe(3);
    expect(writes.get('3XDnQdpVsQw')).toEqual(local({ count: 1 }));
    expect(removed).toEqual(['btDvx9zgRtY']);
  });
});
