// Google Takeout import: YouTube watch history exported as JSON
// ("YouTube and YouTube Music" → history → format JSON), file
// watch-history.json. Each entry is one watch:
//
//   { "header": "YouTube", "title": "Watched <video title>",
//     "titleUrl": "https://www.youtube.com/watch?v=<id>",
//     "subtitles": [{ "name": "<channel>", "url": "..." }],
//     "time": "2024-01-02T03:04:05.678Z", "details": [...] }
//
// Only watches from before the extension started counting are taken, so
// they never overlap the extension's own counts.

import { MAX_TEXT_LENGTH } from '../shared/protocol';
import { isVideoId } from './records';
import type { VideoRecord } from './storage';

export interface TakeoutVideo {
  views: number;
  firstViewedAt: number;
  lastViewedAt: number;
  title: string;
  channel: string;
}

export interface TakeoutSummary {
  videos: Map<string, TakeoutVideo>;
  /** Watch entries taken into account. */
  views: number;
  /** Watches from after the extension started counting, left out. */
  afterTracking: number;
  /** Entries that are not video watches: ads, YouTube Music, removed videos. */
  skipped: number;
}

export class TakeoutError extends Error {}

interface TakeoutEntry {
  header?: unknown;
  title?: unknown;
  titleUrl?: unknown;
  subtitles?: unknown;
  time?: unknown;
  details?: unknown;
}

function videoIdFromUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (!/(^|\.)youtube\.com$/.test(parsed.hostname) || parsed.pathname !== '/watch') return null;
    const videoId = parsed.searchParams.get('v');
    return isVideoId(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

/** Ads watched on YouTube are listed with details "From Google Ads". */
function isAd(entry: TakeoutEntry): boolean {
  return Array.isArray(entry.details) && entry.details.length > 0;
}

function channelOf(entry: TakeoutEntry): string {
  if (!Array.isArray(entry.subtitles)) return '';
  const name = (entry.subtitles[0] as { name?: unknown } | undefined)?.name;
  return typeof name === 'string' ? name : '';
}

/**
 * Takeout titles start with a localized verb ("Watched ", "Вы посмотрели "…).
 * Finds that prefix as the longest run of up to three leading words shared by
 * at least 90% of the titles.
 */
export function detectTitlePrefix(titles: string[]): string {
  if (titles.length === 0) return '';
  const words = titles[0].split(' ');
  let prefix = '';
  for (let k = 1; k <= Math.min(3, words.length - 1); k++) {
    const candidate = words.slice(0, k).join(' ') + ' ';
    const share = titles.filter((title) => title.startsWith(candidate)).length / titles.length;
    if (share >= 0.9) prefix = candidate;
  }
  return prefix;
}

/** Reads watch-history.json. Throws TakeoutError if the file is not a Takeout watch history. */
export function parseTakeout(text: string, trackingSince: number): TakeoutSummary {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new TakeoutError('not-json');
  }
  if (!Array.isArray(raw)) throw new TakeoutError('not-takeout');

  const watches: { videoId: string; time: number; title: string; channel: string }[] = [];
  let skipped = 0;
  for (const item of raw as unknown[]) {
    const entry = (typeof item === 'object' && item !== null ? item : {}) as TakeoutEntry;
    const videoId = videoIdFromUrl(entry.titleUrl);
    const time = typeof entry.time === 'string' ? Date.parse(entry.time) : NaN;
    if (entry.header !== 'YouTube' || !videoId || !Number.isFinite(time) || isAd(entry)) {
      skipped++;
      continue;
    }
    watches.push({
      videoId,
      time,
      title: typeof entry.title === 'string' ? entry.title : '',
      channel: channelOf(entry),
    });
  }
  if (raw.length > 0 && watches.length === 0) throw new TakeoutError('not-takeout');

  const prefix = detectTitlePrefix(watches.map((w) => w.title));
  const videos = new Map<string, TakeoutVideo>();
  let views = 0;
  let afterTracking = 0;
  for (const watch of watches) {
    if (watch.time >= trackingSince) {
      afterTracking++;
      continue;
    }
    views++;
    const title = (watch.title.startsWith(prefix) ? watch.title.slice(prefix.length) : watch.title)
      .slice(0, MAX_TEXT_LENGTH);
    const channel = watch.channel.slice(0, MAX_TEXT_LENGTH);
    const video = videos.get(watch.videoId);
    if (!video) {
      videos.set(watch.videoId, { views: 1, firstViewedAt: watch.time, lastViewedAt: watch.time, title, channel });
      continue;
    }
    video.views++;
    video.firstViewedAt = Math.min(video.firstViewedAt, watch.time);
    if (watch.time > video.lastViewedAt) {
      // Keep the title and channel from the newest watch.
      video.lastViewedAt = watch.time;
      video.title = title || video.title;
      video.channel = channel || video.channel;
    }
  }
  return { videos, views, afterTracking, skipped };
}

/**
 * Changes to apply to the history for a Takeout import. The import replaces
 * any earlier one: every video's `imported` becomes its count in this file.
 */
export function planTakeoutImport(
  current: Map<string, VideoRecord>,
  takeout: Map<string, TakeoutVideo>,
): { writes: Map<string, VideoRecord>; removed: string[] } {
  const writes = new Map<string, VideoRecord>();
  const removed: string[] = [];

  for (const [videoId, video] of takeout) {
    const record = current.get(videoId);
    writes.set(videoId, {
      count: record?.count ?? 0,
      imported: video.views,
      firstViewedAt: Math.min(record?.firstViewedAt ?? Infinity, video.firstViewedAt),
      lastViewedAt: Math.max(record?.lastViewedAt ?? 0, video.lastViewedAt),
      // The player's title and channel are exact; Takeout's are a fallback.
      title: record?.title || video.title,
      channel: record?.channel || video.channel,
    });
  }

  // Videos from an earlier import that are not in this file lose their imported views.
  for (const [videoId, record] of current) {
    if (takeout.has(videoId) || !record.imported) continue;
    if (record.count > 0) {
      const { imported: _, ...rest } = record;
      writes.set(videoId, rest);
    } else {
      removed.push(videoId);
    }
  }
  return { writes, removed };
}

