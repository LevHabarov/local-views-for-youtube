// Per-video view records in chrome.storage.local. Nothing leaves the device.

export interface VideoRecord {
  /** Views counted by the extension. */
  count: number;
  /**
   * Views imported from Google Takeout: only those before the extension
   * started counting (see trackingSince), so they never overlap `count`.
   * A new Takeout import replaces this number.
   */
  imported?: number;
  /** Unix time in milliseconds. */
  firstViewedAt: number;
  lastViewedAt: number;
  title: string;
  channel: string;
}

export interface VideoMeta {
  title: string;
  channel: string;
}

/** All of the user's views of the video. */
export function totalViews(record: VideoRecord | null | undefined): number {
  return (record?.count ?? 0) + (record?.imported ?? 0);
}

const KEY_PREFIX = 'video:';
const META_KEY = 'meta';

export function recordKey(videoId: string): string {
  return KEY_PREFIX + videoId;
}

export function videoIdFromKey(key: string): string | null {
  return key.startsWith(KEY_PREFIX) ? key.slice(KEY_PREFIX.length) : null;
}

export async function getRecord(videoId: string): Promise<VideoRecord | null> {
  const key = recordKey(videoId);
  const items = await chrome.storage.local.get(key);
  return (items[key] as VideoRecord | undefined) ?? null;
}

/** Records for several videos in one read; missing videos map to null. */
export async function getRecords(videoIds: string[]): Promise<Map<string, VideoRecord | null>> {
  const items = await chrome.storage.local.get(videoIds.map(recordKey));
  return new Map(
    videoIds.map((id) => [id, (items[recordKey(id)] as VideoRecord | undefined) ?? null]),
  );
}

/** The whole history, keyed by video ID. */
export async function getAllRecords(): Promise<Map<string, VideoRecord>> {
  const items = await chrome.storage.local.get(null);
  const records = new Map<string, VideoRecord>();
  for (const [key, value] of Object.entries(items)) {
    const videoId = videoIdFromKey(key);
    if (videoId) records.set(videoId, value as VideoRecord);
  }
  return records;
}

/** Writes `records` and deletes `removed`; used by imports. */
export async function writeRecords(
  records: Map<string, VideoRecord>,
  removed: string[] = [],
): Promise<void> {
  if (removed.length > 0) await chrome.storage.local.remove(removed.map(recordKey));
  if (records.size > 0) {
    await chrome.storage.local.set(
      Object.fromEntries([...records].map(([id, record]) => [recordKey(id), record])),
    );
  }
}

export async function deleteVideo(videoId: string): Promise<void> {
  await chrome.storage.local.remove(recordKey(videoId));
}

/** Deletes the whole history; counting starts over from now. */
export async function clearHistory(): Promise<void> {
  const items = await chrome.storage.local.get(null);
  await chrome.storage.local.remove(Object.keys(items).filter((key) => videoIdFromKey(key)));
  await chrome.storage.local.set({ [META_KEY]: { trackingSince: Date.now() } });
}

/**
 * When the extension started counting. Takeout imports only take views from
 * before this moment. Set on first use; for histories from before this field
 * existed, it is the earliest view the extension counted.
 */
export async function getTrackingSince(): Promise<number> {
  const items = await chrome.storage.local.get(META_KEY);
  const meta = items[META_KEY] as { trackingSince?: unknown } | undefined;
  if (typeof meta?.trackingSince === 'number') return meta.trackingSince;

  let trackingSince = Date.now();
  for (const record of (await getAllRecords()).values()) {
    if (record.count > 0) trackingSince = Math.min(trackingSince, record.firstViewedAt);
  }
  await chrome.storage.local.set({ [META_KEY]: { trackingSince } });
  return trackingSince;
}

/** Moves the start of counting back to `time` if it is earlier (used when restoring a backup). */
export async function extendTrackingSince(time: number): Promise<void> {
  if (time < (await getTrackingSince())) {
    await chrome.storage.local.set({ [META_KEY]: { trackingSince: time } });
  }
}

export function applyView(
  previous: VideoRecord | null,
  meta: VideoMeta,
  now: number,
): VideoRecord {
  return {
    ...previous,
    count: (previous?.count ?? 0) + 1,
    firstViewedAt: previous?.firstViewedAt ?? now,
    lastViewedAt: now,
    // Keep the last known title and channel if the player did not report them.
    title: meta.title || previous?.title || '',
    channel: meta.channel || previous?.channel || '',
  };
}

// Writes from this tab are applied one after another so that quick
// consecutive views do not overwrite each other.
let writeQueue: Promise<unknown> = Promise.resolve();

export function recordView(videoId: string, meta: VideoMeta): Promise<VideoRecord> {
  const write = writeQueue.then(async () => {
    const record = applyView(await getRecord(videoId), meta, Date.now());
    await chrome.storage.local.set({ [recordKey(videoId)]: record });
    return record;
  });
  writeQueue = write.catch(() => undefined);
  return write;
}
