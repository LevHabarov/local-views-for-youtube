// "(You: N)" on every video card: on the home page and in the watch history
// right after the card's view count, in the recommendations next to a video
// on its own line right under the view count (that column is too narrow).

import { setBounded } from '../core/cache';
import { getRecords, videoIdFromKey, type VideoRecord } from '../core/storage';
import { isVideoId } from '../shared/protocol';
import { badgeTooltip, cardBadgeText } from './text';

// YouTube changes its markup often, so every selector we depend on lives here.
// A card's metadata line is "[icon] 547K • 3 years ago": the view count is the
// text right after the leading (eye) icon.
type Placement = 'inline' | 'line';

const CARDS: { selector: string; placement: Placement }[] = [
  {
    selector: 'ytd-browse[page-subtype="home"] ytd-rich-item-renderer yt-lockup-view-model',
    placement: 'inline',
  },
  {
    selector: 'ytd-browse[page-subtype="history"] yt-lockup-view-model',
    placement: 'inline',
  },
  {
    selector: 'ytd-watch-next-secondary-results-renderer yt-lockup-view-model',
    placement: 'line',
  },
];
const VIEWS_TEXT =
  '.ytContentMetadataViewModelLeadingIcon + .ytContentMetadataViewModelMetadataText';
const METADATA_ROW = '.ytContentMetadataViewModelMetadataRow';
const VIDEO_LINK = 'a[href*="/watch?v="]';

// Styled in public/styles.css.
const BADGE_CLASS = 'local-views-card-badge';
const LINE_CLASS = 'local-views-card-badge-line';

/**
 * Records loaded so far; null means the video has no views. A YouTube tab can
 * stay open for days, so only the most recently loaded records are kept;
 * evicted ones are loaded again if their card shows up.
 */
const records = new Map<string, VideoRecord | null>();
const MAX_RECORDS = 2000;

function remember(videoId: string, record: VideoRecord | null): void {
  setBounded(records, videoId, record, MAX_RECORDS);
}
const toLoad = new Set<string>();
let loading = false;

function cardVideoId(card: Element): string | null {
  const link = card.querySelector<HTMLAnchorElement>(VIDEO_LINK);
  if (!link) return null;
  try {
    const videoId = new URL(link.href).searchParams.get('v');
    return isVideoId(videoId) ? videoId : null;
  } catch {
    return null;
  }
}

/**
 * Puts the badge in place. Returns false if the card has no view count.
 *
 * YouTube recycles cards for other videos and rewrites their text.
 * - inline: the badge is the last child of the view count text, so a rewrite
 *   either removes it or leaves it after the new text; the next scan fixes it.
 * - line: the badge is a row of its own right after the view count row. When
 *   YouTube rebuilds the card it drops the badge, and the next scan adds it back.
 */
function placeBadge(badge: HTMLElement, viewsText: HTMLElement, placement: Placement): boolean {
  if (placement === 'inline') {
    if (viewsText.lastChild !== badge) viewsText.append(badge);
    return true;
  }
  const row = viewsText.closest(METADATA_ROW);
  if (!row) return false;
  if (row.nextElementSibling !== badge) {
    row.after(badge);
    // YouTube sets the font on the text elements, not on the rows, so copy it.
    // Only on insert: reading computed styles on every scan can force the
    // browser to recalculate styles.
    const { fontSize, lineHeight } = getComputedStyle(viewsText);
    badge.style.fontSize = fontSize;
    badge.style.lineHeight = lineHeight;
  }
  return true;
}

function createBadge(placement: Placement): HTMLElement {
  const badge = document.createElement(placement === 'inline' ? 'span' : 'div');
  badge.className = placement === 'inline' ? BADGE_CLASS : `${BADGE_CLASS} ${LINE_CLASS}`;
  return badge;
}

function updateCard(card: Element, placement: Placement): void {
  const videoId = cardVideoId(card);
  let badge = card.querySelector<HTMLElement>('.' + BADGE_CLASS);

  const viewsText = card.querySelector<HTMLElement>(VIEWS_TEXT);
  // Wait until the record is loaded so the badge never shows a wrong count.
  if (!videoId || !viewsText || !records.has(videoId)) {
    if (videoId && !records.has(videoId)) toLoad.add(videoId);
    badge?.remove();
    return;
  }
  const record = records.get(videoId) ?? null;

  if (badge && badge.classList.contains(LINE_CLASS) !== (placement === 'line')) {
    badge.remove();
    badge = null;
  }
  badge ??= createBadge(placement);
  if (!placeBadge(badge, viewsText, placement)) {
    badge.remove();
    return;
  }

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
    for (const [id, record] of await getRecords(ids)) remember(id, record);
  } catch {
    // The extension was reloaded or updated: this orphaned script can no longer read.
    return;
  } finally {
    loading = false;
  }
  scan();
}

function scan(): void {
  for (const { selector, placement } of CARDS) {
    for (const card of document.querySelectorAll(selector)) updateCard(card, placement);
  }
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
      if (videoId) remember(videoId, (change.newValue as VideoRecord | undefined) ?? null);
    }
    scheduleScan();
  });

  scheduleScan();
}
