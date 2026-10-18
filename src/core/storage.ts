// Per-video view records in chrome.storage.local. Nothing leaves the device.

export interface VideoRecord {
  count: number;
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

const KEY_PREFIX = 'video:';

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

export function applyView(
  previous: VideoRecord | null,
  meta: VideoMeta,
  now: number,
): VideoRecord {
  return {
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
