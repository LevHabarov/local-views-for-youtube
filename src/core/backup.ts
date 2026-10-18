// Backup files: the whole history as JSON, for safekeeping or moving to
// another browser.

import { isVideoId, mergeRecords, sanitizeRecord } from './records';
import type { VideoRecord } from './storage';

export const BACKUP_FORMAT = 'local-views-for-youtube';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  trackingSince: number;
  videos: Record<string, VideoRecord>;
}

export function createBackup(
  records: Map<string, VideoRecord>,
  trackingSince: number,
  now = Date.now(),
): Backup {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now,
    trackingSince,
    videos: Object.fromEntries(records),
  };
}

export class BackupError extends Error {}

export interface ParsedBackup {
  records: Map<string, VideoRecord>;
  /** When counting started in the backed-up history, if the file says. */
  trackingSince: number | null;
  skipped: number;
}

/**
 * Reads a backup file's text. Invalid entries are skipped and counted; a file
 * that is not a backup at all throws BackupError.
 */
export function parseBackup(text: string, now = Date.now()): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError('not-json');
  }
  const backup = raw as Partial<Backup> | null;
  if (typeof backup !== 'object' || backup === null || backup.format !== BACKUP_FORMAT) {
    throw new BackupError('not-backup');
  }
  if (typeof backup.version !== 'number' || backup.version > BACKUP_VERSION) {
    throw new BackupError('newer-version');
  }
  if (typeof backup.videos !== 'object' || backup.videos === null) {
    throw new BackupError('not-backup');
  }

  const records = new Map<string, VideoRecord>();
  let skipped = 0;
  for (const [videoId, value] of Object.entries(backup.videos)) {
    const record = isVideoId(videoId) ? sanitizeRecord(value, now) : null;
    if (record) records.set(videoId, record);
    else skipped++;
  }
  const trackingSince =
    typeof backup.trackingSince === 'number' && Number.isFinite(backup.trackingSince)
      ? backup.trackingSince
      : null;
  return { records, trackingSince, skipped };
}

/** Records to write so that the current history includes the backup. */
export function mergeBackup(
  current: Map<string, VideoRecord>,
  backup: Map<string, VideoRecord>,
): Map<string, VideoRecord> {
  const changes = new Map<string, VideoRecord>();
  for (const [videoId, record] of backup) {
    changes.set(videoId, mergeRecords(current.get(videoId) ?? null, record));
  }
  return changes;
}
