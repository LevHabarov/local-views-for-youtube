// The "You: N views" label under the video on the watch page.

import { formatDateTime, viewsMessageKey } from '../core/format';
import type { VideoRecord } from '../core/storage';

// YouTube changes its markup often, so every selector we depend on lives here.
// Candidates are tried in order. The badge goes right after the total view
// count, or at the end of the info line if the view count is not found.
const ANCHOR_SELECTORS: { selector: string; position: 'after' | 'append' }[] = [
  // Total view count in the line "N views · date" of the description box.
  { selector: 'ytd-watch-flexy ytd-watch-metadata #info-container > #view-count', position: 'after' },
  { selector: 'ytd-watch-flexy ytd-watch-metadata #info-container', position: 'append' },
  // Older layout without the description box.
  { selector: 'ytd-watch-flexy #info-contents #info', position: 'append' },
];

const BADGE_CLASS = 'local-views-badge';

const BADGE_STYLE = [
  // The view count ends with a space; the date after the badge does not start with one.
  'margin-inline-end: 8px',
  'font-weight: 500',
  'color: var(--yt-spec-text-primary, inherit)',
  'white-space: nowrap',
].join(';');

function placeBadge(badge: HTMLElement): boolean {
  for (const { selector, position } of ANCHOR_SELECTORS) {
    const anchor = document.querySelector(selector);
    if (!anchor) continue;
    if (position === 'after') {
      if (anchor.nextElementSibling !== badge) anchor.after(badge);
    } else if (badge.parentElement !== anchor) {
      anchor.append(badge);
    }
    return true;
  }
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

/**
 * Shows the badge for the given record, re-inserting it if YouTube re-rendered
 * the page. Returns false when the anchor is not in the DOM yet.
 */
export function showBadge(record: VideoRecord | null): boolean {
  if (!badge) {
    badge = document.createElement('span');
    badge.className = BADGE_CLASS;
    badge.style.cssText = BADGE_STYLE;
  }
  if (!placeBadge(badge)) return false;

  badge.textContent = '(' + badgeText(record) + ')';
  badge.title = badgeTooltip(record);
  return true;
}

export function isBadgeShown(): boolean {
  return badge?.isConnected ?? false;
}

export function hideBadge(): void {
  badge?.remove();
}
