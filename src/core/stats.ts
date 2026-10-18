// Statistics and search over the view history, for the popup.

import { totalViews, type VideoRecord } from './storage';

export interface VideoEntry {
  videoId: string;
  record: VideoRecord;
  views: number;
}

export interface ChannelEntry {
  channel: string;
  views: number;
  videos: number;
}

export interface Stats {
  /** All views, counted and imported. */
  views: number;
  /** Views counted by the extension. */
  counted: number;
  /** Views imported from Google Takeout. */
  imported: number;
  videos: number;
  mostWatched: VideoEntry[];
  recent: VideoEntry[];
  channels: ChannelEntry[];
}

function entries(records: Map<string, VideoRecord>): VideoEntry[] {
  return [...records]
    .map(([videoId, record]) => ({ videoId, record, views: totalViews(record) }))
    .filter((entry) => entry.views > 0);
}

export function computeStats(records: Map<string, VideoRecord>, limit = 10): Stats {
  const all = entries(records);
  const channels = new Map<string, ChannelEntry>();
  let counted = 0;
  let imported = 0;
  for (const { record, views } of all) {
    counted += record.count;
    imported += record.imported ?? 0;
    if (!record.channel) continue;
    const channel = channels.get(record.channel) ?? { channel: record.channel, views: 0, videos: 0 };
    channel.views += views;
    channel.videos++;
    channels.set(record.channel, channel);
  }

  return {
    views: counted + imported,
    counted,
    imported,
    videos: all.length,
    mostWatched: [...all]
      .sort((a, b) => b.views - a.views || b.record.lastViewedAt - a.record.lastViewedAt)
      .slice(0, limit),
    recent: [...all].sort((a, b) => b.record.lastViewedAt - a.record.lastViewedAt).slice(0, limit),
    channels: [...channels.values()]
      .sort((a, b) => b.views - a.views || b.videos - a.videos)
      .slice(0, limit),
  };
}

/**
 * Videos whose title or channel contains every word of the query, newest
 * first. An empty query lists the whole history.
 */
export function searchVideos(
  records: Map<string, VideoRecord>,
  query: string,
  limit = 100,
): { results: VideoEntry[]; total: number } {
  const words = query.toLocaleLowerCase().split(/\s+/).filter(Boolean);
  const matches = entries(records)
    .filter(({ videoId, record }) => {
      const haystack = `${record.title} ${record.channel} ${videoId}`.toLocaleLowerCase();
      return words.every((word) => haystack.includes(word));
    })
    .sort((a, b) => b.record.lastViewedAt - a.record.lastViewedAt);
  return { results: matches.slice(0, limit), total: matches.length };
}
