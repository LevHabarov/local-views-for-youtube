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
  'margin-inline: 4px 8px',
  'font-weight: 500',
  'color: var(--yt-spec-text-primary, inherit)',
  'white-space: nowrap',
].join(';');

function hasText(element: Element): boolean {
  return (element.textContent ?? '').trim() !== '';
}

function insertAfter(anchor: Element, badge: HTMLElement): void {
  if (anchor.nextElementSibling !== badge) anchor.after(badge);
}

function placeBadge(badge: HTMLElement): boolean {
  const container = document.querySelector(INFO_CONTAINER);
  if (!container) return false;

  const viewCount = container.querySelector(VIEW_COUNT);
  if (viewCount && hasText(viewCount)) {
    insertAfter(viewCount, badge);
    return true;
  }

  // YouTube reuses the spans of #info by position when it re-renders the line,
  // so a span inserted between them would get another span's text. Put the
  // badge inside the views span instead: a re-render just removes it, and the
  // observer puts it back.
  const viewsSpan = [...container.querySelectorAll(INFO_SPANS)].find(hasText);
  if (viewsSpan) {
    if (badge.parentElement !== viewsSpan) viewsSpan.append(badge);
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
