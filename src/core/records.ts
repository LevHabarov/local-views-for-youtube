// Validation and merging of view records that come from files (backups,
// Google Takeout). Files are untrusted input: everything is checked and capped.

import { isVideoId, MAX_TEXT_LENGTH } from '../shared/protocol';
import { totalViews, type VideoRecord } from './storage';

/** Upper bound for a per-video count, to reject nonsense values. */
const MAX_COUNT = 1_000_000;
/** Timestamps must fall between YouTube's launch and a day from now. */
const MIN_TIME = Date.UTC(2005, 0, 1);

function isCount(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_COUNT;
}

function isTime(value: unknown, now: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_TIME && value <= now + 86_400_000;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.slice(0, MAX_TEXT_LENGTH) : '';
}

/** A valid record built from untrusted data, or null if it cannot be one. */
export function sanitizeRecord(raw: unknown, now = Date.now()): VideoRecord | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const r = raw as Record<string, unknown>;
  const count = r.count ?? 0;
  const imported = r.imported ?? 0;
  if (!isCount(count) || !isCount(imported) || count + imported === 0) return null;
  if (!isTime(r.firstViewedAt, now) || !isTime(r.lastViewedAt, now)) return null;
  if (r.firstViewedAt > r.lastViewedAt) return null;

  const record: VideoRecord = {
    count,
    firstViewedAt: r.firstViewedAt,
    lastViewedAt: r.lastViewedAt,
    title: text(r.title),
    channel: text(r.channel),
  };
  if (imported > 0) record.imported = imported;
  return record;
}

/**
 * Merges two records of the same video, e.g. the current one and one from a
 * backup. Counts take the larger value (restoring a backup twice must not
 * double them), dates the widest range, title and channel the newest known.
 */
export function mergeRecords(a: VideoRecord | null, b: VideoRecord): VideoRecord {
  if (!a) return b;
  const newer = b.lastViewedAt >= a.lastViewedAt ? b : a;
  const older = newer === a ? b : a;
  const merged: VideoRecord = {
    count: Math.max(a.count, b.count),
    firstViewedAt: Math.min(a.firstViewedAt, b.firstViewedAt),
    lastViewedAt: Math.max(a.lastViewedAt, b.lastViewedAt),
    title: newer.title || older.title,
    channel: newer.channel || older.channel,
  };
  const imported = Math.max(a.imported ?? 0, b.imported ?? 0);
  if (imported > 0) merged.imported = imported;
  return merged;
}

export function hasViews(record: VideoRecord): boolean {
  return totalViews(record) > 0;
}

export { isVideoId };
