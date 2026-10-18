// The "You: N views" label under the video on the watch page.

import { formatDateTime, viewsMessageKey } from '../core/format';
import type { VideoRecord } from '../core/storage';

// YouTube changes its markup often, so every selector we depend on lives here.
//
// The line "N views  date" in the description box comes in two layouts:
// - the view count and date are separate elements (#view-count, #date-text);
// - those are empty, and the whole line is spans inside #info:
//   [views] [separator] [date] ...
// The badge goes right after the view count in either layout.
const INFO_CONTAINER = 'ytd-watch-flexy ytd-watch-metadata #info-container';
const VIEW_COUNT = ':scope > #view-count';
const INFO_SPANS = ':scope > #info > span';

const BADGE_CLASS = 'local-views-badge';

const BADGE_STYLE = [
  'font-weight: 500',
  'color: var(--yt-spec-text-primary, inherit)',
  'white-space: nowrap',
].join(';');

// Gaps around the badge, matching YouTube's own gap between views and date.
// In the #view-count layout the view count already ends with a gap and the
// date starts right away. In the #info layout the line has a two-space
// separator span after the views, so the badge only needs the gap before it.
const MARGIN_AFTER_VIEW_COUNT = '0 8px';
const MARGIN_IN_VIEWS_SPAN = '0.5em 0';

function setMargin(badge: HTMLElement, margin: string): void {
  if (badge.style.marginInline !== margin) badge.style.marginInline = margin;
}

/** Text the user actually sees in the element, not counting the badge itself. */
function visibleText(element: HTMLElement, badge: HTMLElement): string {
  // innerText skips hidden descendants, but falls back to all text when the
  // element itself is not rendered, so check that first.
  if (element.getClientRects().length === 0) return '';
  const text = element.innerText.trim();
  return badge.parentElement === element ? text.replace(badge.innerText.trim(), '').trim() : text;
}

function placeBadge(badge: HTMLElement): boolean {
  const container = document.querySelector(INFO_CONTAINER);
  if (!container) return false;

  // #view-count may keep hidden content in the other layout, so check what is
  // rendered, not textContent.
  const viewCount = container.querySelector<HTMLElement>(VIEW_COUNT);
  if (viewCount && visibleText(viewCount, badge) !== '') {
    if (viewCount.nextElementSibling !== badge) viewCount.after(badge);
    setMargin(badge, MARGIN_AFTER_VIEW_COUNT);
    return true;
  }

  // YouTube reuses the spans of #info by position when it re-renders the line,
  // so a span inserted between them would get another span's text. Put the
  // badge inside the views span instead, as its last child: a re-render either
  // removes it or adds the new text before it, and the observer fixes both.
  const viewsSpan = [...container.querySelectorAll<HTMLElement>(INFO_SPANS)].find(
    (span) => visibleText(span, badge) !== '',
  );
  if (viewsSpan) {
    if (viewsSpan.lastChild !== badge) viewsSpan.append(badge);
    setMargin(badge, MARGIN_IN_VIEWS_SPAN);
    return true;
  }

  // The line is not filled in yet; try again on the next update.
  return false;
}

function badgeText(record: VideoRecord | null): string {
  const count = record?.count ?? 0;
  if (count === 0) return chrome.i18n.getMessage('viewsNone');
  const key = viewsMessageKey(chrome.i18n.getUILanguage(), count);
  return chrome.i18n.getMessage(key, String(count));
}

function badgeTooltip(record: VideoRecord | null): string {
  if (!record) return chrome.i18n.getMessage('tooltipNone');
  const locale = chrome.i18n.getUILanguage();
  return chrome.i18n.getMessage('tooltipDates', [
    formatDateTime(locale, record.firstViewedAt),
    formatDateTime(locale, record.lastViewedAt),
  ]);
}

let badge: HTMLElement | null = null;
let shownRecord: VideoRecord | null = null;

// YouTube re-renders the info line (for example when the view count or the
// layout changes), which can drop the badge or leave it in the wrong place.
// Watch the line and put the badge back. Writes below happen only when
// something actually changed, so our own DOM changes do not loop.
const RESTORE_DELAY_MS = 100;
let restoreTimer: number | undefined;
const observer = new MutationObserver(() => {
  window.clearTimeout(restoreTimer);
  restoreTimer = window.setTimeout(() => {
    if (badge) showBadge(shownRecord);
  }, RESTORE_DELAY_MS);
});
let observedContainer: Element | null = null;

function observe(container: Element | null): void {
  if (container === observedContainer) return;
  observer.disconnect();
  observedContainer = container;
  if (container) observer.observe(container, { childList: true, subtree: true, characterData: true });
}

/**
 * Shows the badge for the given record and keeps it in place while YouTube
 * re-renders the page. Returns false when the info line is not in the DOM yet.
 */
export function showBadge(record: VideoRecord | null): boolean {
  shownRecord = record;
  if (!badge) {
    badge = document.createElement('span');
    badge.className = BADGE_CLASS;
    badge.style.cssText = BADGE_STYLE;
  }
  observe(document.querySelector(INFO_CONTAINER));
  if (!placeBadge(badge)) return false;

  const text = '(' + badgeText(record) + ')';
  if (badge.textContent !== text) badge.textContent = text;
  const tooltip = badgeTooltip(record);
  if (badge.title !== tooltip) badge.title = tooltip;
  return true;
}

export function isBadgeShown(): boolean {
  return badge?.isConnected ?? false;
}

export function hideBadge(): void {
  observe(null);
  window.clearTimeout(restoreTimer);
  badge?.remove();
}
