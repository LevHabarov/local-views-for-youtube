// Isolated-world content script: counts views from the bridge's playback
// events, stores them, and keeps the badges on the watch page and on video
// cards up to date.

import {
  getRecord,
  getTrackingSince,
  recordKey,
  recordView,
  type VideoRecord,
} from '../core/storage';
import { ViewTracker, type PlaybackState } from '../core/view-tracker';
import { isVideoId, MEDIA_EVENT, parseMediaMessage, type MediaMessage } from '../shared/protocol';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  onSettingsChanged,
  type Settings,
} from '../shared/settings';
import { hideBadge, isBadgeShown, showBadge } from './badge';
import { setCardSettings, startCardBadges } from './cards';
import { badgeContent } from './text';

// ---- Settings -------------------------------------------------------------

let settings: Settings = DEFAULT_SETTINGS;

/** A custom badge color overrides the theme-aware default in styles.css. */
function applyColor(): void {
  const style = document.documentElement.style;
  if (settings.color) style.setProperty('--local-views-color', settings.color);
  else style.removeProperty('--local-views-color');
}

function applySettings(newSettings: Settings): void {
  settings = newSettings;
  applyColor();
  setCardSettings(settings);
  if (shownVideoId) renderBadge();
}

// ---- Counting -------------------------------------------------------------

let lastMessage: MediaMessage | null = null;

const tracker = new ViewTracker(
  () => {
    const message = lastMessage;
    if (!message) return;
    recordView(message.videoId, { title: message.title, channel: message.channel }).catch(
      // The extension was reloaded or updated: this orphaned script can no longer write.
      () => undefined,
    );
  },
  () => ({
    mode: settings.thresholdMode,
    seconds: settings.thresholdSeconds,
    percent: settings.thresholdPercent,
  }),
);

function playbackState(message: MediaMessage): PlaybackState {
  return {
    sessionKey: `${message.videoId}:${message.playbackId}`,
    currentTime: message.currentTime,
    duration: message.duration,
  };
}

window.addEventListener(MEDIA_EVENT, (event) => {
  const message = parseMediaMessage((event as CustomEvent<unknown>).detail);
  if (!message) return;

  if (message.isAd) {
    tracker.interrupt();
    return;
  }
  lastMessage = message;

  switch (message.type) {
    case 'timeupdate':
      tracker.timeUpdate(playbackState(message));
      if (shownVideoId && !isBadgeShown()) renderBadge();
      break;
    case 'seeking':
      tracker.seeking(playbackState(message));
      break;
    case 'ended':
      tracker.ended(playbackState(message));
      break;
    case 'pause':
      tracker.interrupt();
      break;
  }
});

// ---- Badge ----------------------------------------------------------------

const ANCHOR_WAIT_MS = 20_000;
const ANCHOR_POLL_MS = 500;

let shownVideoId: string | null = null;
let shownRecord: VideoRecord | null = null;
let pollTimer: number | undefined;

function watchPageVideoId(): string | null {
  if (location.pathname !== '/watch') return null;
  const videoId = new URLSearchParams(location.search).get('v');
  return isVideoId(videoId) ? videoId : null;
}

function renderBadge(): boolean {
  const content = settings.showOn.watch ? badgeContent(settings, shownRecord, 'watch') : null;
  return showBadge(content);
}

/** YouTube renders the page lazily, so retry until the anchor appears. */
function renderWhenReady(): void {
  window.clearInterval(pollTimer);
  if (renderBadge()) return;

  const deadline = Date.now() + ANCHOR_WAIT_MS;
  pollTimer = window.setInterval(() => {
    if (renderBadge() || Date.now() > deadline) window.clearInterval(pollTimer);
  }, ANCHOR_POLL_MS);
}

async function onPageChange(): Promise<void> {
  const videoId = watchPageVideoId();
  if (videoId === shownVideoId) return;

  shownVideoId = videoId;
  shownRecord = null;
  if (!videoId) {
    window.clearInterval(pollTimer);
    hideBadge();
    return;
  }

  const record = await getRecord(videoId);
  if (videoId !== shownVideoId) return; // Navigated away meanwhile.
  shownRecord = record;
  renderWhenReady();
}

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !shownVideoId) return;
  const change = changes[recordKey(shownVideoId)];
  if (!change) return;
  shownRecord = (change.newValue as VideoRecord | undefined) ?? null;
  renderBadge();
});

// YouTube is a single-page app: it fires these events around each in-app
// navigation. Hide the badge as soon as navigation starts so it never shows
// the previous video's count while the next page loads.
document.addEventListener('yt-navigate-start', () => {
  shownVideoId = null;
  shownRecord = null;
  window.clearInterval(pollTimer);
  hideBadge();
});
document.addEventListener('yt-navigate-finish', () => void onPageChange());
document.addEventListener('DOMContentLoaded', () => void onPageChange());

// ---- Start ----------------------------------------------------------------

startCardBadges();
onSettingsChanged(applySettings);
loadSettings()
  .then(applySettings)
  .catch(() => undefined);
// Pins the moment counting started, which Takeout imports rely on.
getTrackingSince().catch(() => undefined);
