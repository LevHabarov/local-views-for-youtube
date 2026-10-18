// Messages sent from the page-world bridge to the isolated content script.
// The detail is a JSON string: object details do not cross the world boundary.
//
// Any script on youtube.com can dispatch this event too, so the content script
// treats it as untrusted input: parseMediaMessage accepts only well-formed
// messages and caps the strings that end up in storage.

export const MEDIA_EVENT = 'local-views:media';

const MEDIA_EVENT_TYPES = ['timeupdate', 'seeking', 'ended', 'pause'] as const;
export type MediaEventType = (typeof MEDIA_EVENT_TYPES)[number];

export interface MediaMessage {
  type: MediaEventType;
  videoId: string;
  /** Client playback nonce: changes every time the player loads a video anew. */
  playbackId: string;
  title: string;
  channel: string;
  currentTime: number;
  duration: number;
  isAd: boolean;
}

/** YouTube video IDs are 11 characters of URL-safe base64. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const MAX_PLAYBACK_ID_LENGTH = 64;
export const MAX_TEXT_LENGTH = 300;

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isVideoId(value: unknown): value is string {
  return typeof value === 'string' && VIDEO_ID.test(value);
}

function text(value: unknown, maxLength: number): string | null {
  return typeof value === 'string' ? value.slice(0, maxLength) : null;
}

export function parseMediaMessage(detail: unknown): MediaMessage | null {
  if (typeof detail !== 'string') return null;
  let raw: unknown;
  try {
    raw = JSON.parse(detail);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const m = raw as Record<string, unknown>;

  const type = MEDIA_EVENT_TYPES.find((t) => t === m.type);
  const playbackId = text(m.playbackId, MAX_PLAYBACK_ID_LENGTH);
  const title = text(m.title, MAX_TEXT_LENGTH);
  const channel = text(m.channel, MAX_TEXT_LENGTH);
  if (
    !type ||
    !isVideoId(m.videoId) ||
    playbackId === null ||
    title === null ||
    channel === null ||
    !isNonNegativeNumber(m.currentTime) ||
    !isNonNegativeNumber(m.duration) ||
    typeof m.isAd !== 'boolean'
  ) {
    return null;
  }

  return {
    type,
    videoId: m.videoId,
    playbackId,
    title,
    channel,
    currentTime: m.currentTime,
    duration: m.duration,
    isAd: m.isAd,
  };
}
