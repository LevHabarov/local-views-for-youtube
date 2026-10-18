// Runs in the page's main world so it can call the YouTube player API
// (getVideoData), which the isolated content script cannot reach. It only
// reads playback state and forwards it; all logic lives in the content script.

import { MEDIA_EVENT, type MediaEventType, type MediaMessage } from '../shared/protocol';

// The main player. It is the same element on the watch page and in the
// miniplayer; Shorts use a separate player and are not tracked yet.
const PLAYER_SELECTOR = '#movie_player';

interface VideoData {
  video_id?: string;
  cpn?: string;
  title?: string;
  author?: string;
}

type PlayerElement = HTMLElement & { getVideoData?: () => VideoData };

const TRACKED_EVENTS: MediaEventType[] = ['timeupdate', 'seeking', 'ended', 'pause'];

function onMediaEvent(event: Event): void {
  const video = event.target;
  if (!(video instanceof HTMLVideoElement)) return;
  if (location.pathname.startsWith('/shorts/')) return;

  const player = video.closest<PlayerElement>(PLAYER_SELECTOR);
  const data = player?.getVideoData?.();
  if (!player || !data?.video_id) return;

  const message: MediaMessage = {
    type: event.type as MediaEventType,
    videoId: data.video_id,
    playbackId: data.cpn ?? '',
    title: data.title ?? '',
    channel: data.author ?? '',
    currentTime: video.currentTime,
    duration: Number.isFinite(video.duration) ? video.duration : 0,
    isAd: player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting'),
  };
  window.dispatchEvent(new CustomEvent(MEDIA_EVENT, { detail: JSON.stringify(message) }));
}

// Media events do not bubble, so listen in the capture phase.
for (const type of TRACKED_EVENTS) {
  document.addEventListener(type, onMediaEvent, true);
}
