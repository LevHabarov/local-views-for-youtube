// The "You: N views" label under the video on the watch page.

import { formatDateTime, viewsMessageKey } from '../core/format';
import type { VideoRecord } from '../core/storage';

// YouTube changes its markup often, so every selector we depend on lives here.
// Candidates are tried in order; the badge is appended to the first match.
const ANCHOR_SELECTORS = [
  // Line with the total view count and upload date in the description box.
  'ytd-watch-flexy ytd-watch-metadata #description-inner #info-container',
  'ytd-watch-flexy ytd-watch-metadata #info-container',
  // Older layout without the description box.
  'ytd-watch-flexy #info-contents #info',
];

const BADGE_CLASS = 'local-views-badge';

const BADGE_STYLE = [
  'margin-inline-start: 8px',
  'font-weight: 500',
  'color: var(--yt-spec-text-primary, inherit)',
  'white-space: nowrap',
].join(';');

function findAnchor(): Element | null {
  for (const selector of ANCHOR_SELECTORS) {
    const element = document.querySelector(selector);
    if (element) return element;
  }
  return null;
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

/**
 * Shows the badge for the given record, re-inserting it if YouTube re-rendered
 * the page. Returns false when the anchor is not in the DOM yet.
 */
export function showBadge(record: VideoRecord | null): boolean {
  const anchor = findAnchor();
  if (!anchor) return false;

  if (!badge) {
    badge = document.createElement('span');
    badge.className = BADGE_CLASS;
    badge.style.cssText = BADGE_STYLE;
  }
  if (badge.parentElement !== anchor) anchor.append(badge);

  badge.textContent = '· ' + badgeText(record);
  badge.title = badgeTooltip(record);
  return true;
}

export function isBadgeShown(): boolean {
  return badge?.isConnected ?? false;
}

export function hideBadge(): void {
  badge?.remove();
}
