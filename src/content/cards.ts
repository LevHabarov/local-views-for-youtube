// "(You: N)" on video cards on the home page and in the recommendations next
// to a video, between the card's view count and upload date. Shown only for
// videos the user has watched.

import { getRecords, videoIdFromKey, type VideoRecord } from '../core/storage';
import { badgeTooltip, cardBadgeText } from './text';

// YouTube changes its markup often, so every selector we depend on lives here.
// A card's metadata line is "[icon] 547K • 3 years ago": the view count is the
// text right after the leading (eye) icon.
const CARD_SELECTORS = [
  'ytd-browse[page-subtype="home"] ytd-rich-item-renderer yt-lockup-view-model',
  'ytd-watch-next-secondary-results-renderer yt-lockup-view-model',
].join(',');
const VIEWS_TEXT =
  '.ytContentMetadataViewModelLeadingIcon + .ytContentMetadataViewModelMetadataText';
const VIDEO_LINK = 'a[href*="/watch?v="]';

// Styled in public/styles.css.
const BADGE_CLASS = 'local-views-card-badge';

/** Records loaded so far; null means the video has no views. */
const records = new Map<string, VideoRecord | null>();
const toLoad = new Set<string>();
let loading = false;

function cardVideoId(card: Element): string | null {
  const link = card.querySelector<HTMLAnchorElement>(VIDEO_LINK);
  if (!link) return null;
  try {
    return new URL(link.href).searchParams.get('v');
  } catch {
    return null;
  }
}

function updateCard(card: Element): void {
  const videoId = cardVideoId(card);
  let badge = card.querySelector<HTMLElement>('.' + BADGE_CLASS);

  if (videoId && !records.has(videoId)) toLoad.add(videoId);
  const record = videoId ? records.get(videoId) : null;
  const viewsText = card.querySelector<HTMLElement>(VIEWS_TEXT);
  if (!record || !viewsText) {
    badge?.remove();
    return;
  }

  if (!badge) {
    badge = document.createElement('span');
    badge.className = BADGE_CLASS;
  }
  // YouTube recycles cards for other videos and rewrites their text. Keeping
  // the badge inside the view count text, as its last child, means a rewrite
  // either removes it or leaves it after the new text; the next scan fixes it.
  if (viewsText.lastChild !== badge) viewsText.append(badge);

  const text = cardBadgeText(record);
  if (badge.textContent !== text) badge.textContent = text;
  const tooltip = badgeTooltip(record);
  if (badge.title !== tooltip) badge.title = tooltip;
}

async function loadRecords(): Promise<void> {
  if (loading || toLoad.size === 0) return;
  loading = true;
  const ids = [...toLoad];
  toLoad.clear();
  try {
    for (const [id, record] of await getRecords(ids)) records.set(id, record);
  } catch {
    // The extension was reloaded or updated: this orphaned script can no longer read.
    return;
  } finally {
    loading = false;
  }
  scan();
}

function scan(): void {
  for (const card of document.querySelectorAll(CARD_SELECTORS)) updateCard(card);
  void loadRecords();
}

// Cards appear and change all the time (scrolling, navigation, recycling), so
// rescan after DOM changes, at most once per interval. Our own changes cause
// one more scan that finds nothing to do.
const SCAN_INTERVAL_MS = 250;
let scanTimer: number | undefined;

function scheduleScan(): void {
  if (scanTimer !== undefined) return;
  scanTimer = window.setTimeout(() => {
    scanTimer = undefined;
    scan();
  }, SCAN_INTERVAL_MS);
}

export function startCardBadges(): void {
  new MutationObserver(scheduleScan).observe(document.documentElement, {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['href'],
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    for (const [key, change] of Object.entries(changes)) {
      const videoId = videoIdFromKey(key);
      if (videoId) records.set(videoId, (change.newValue as VideoRecord | undefined) ?? null);
    }
    scheduleScan();
  });

  scheduleScan();
}
