// Messages sent from the page-world bridge to the isolated content script.
// The detail is a JSON string: object details do not cross the world boundary.

export const MEDIA_EVENT = 'local-views:media';

export type MediaEventType = 'timeupdate' | 'seeking' | 'ended' | 'pause';

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

export function parseMediaMessage(detail: unknown): MediaMessage | null {
  if (typeof detail !== 'string') return null;
  try {
    const message = JSON.parse(detail) as MediaMessage;
    return typeof message.videoId === 'string' && message.videoId ? message : null;
  } catch {
    return null;
  }
}
