// Localized texts for the badges.

import { formatDateTime, viewsMessageKey } from '../core/format';
import type { VideoRecord } from '../core/storage';

/** "(You: 3 views)" under the video on the watch page; "(You: 0)" if never watched. */
export function watchBadgeText(record: VideoRecord | null): string {
  const count = record?.count ?? 0;
  if (count === 0) return cardBadgeText(null);
  const key = viewsMessageKey(chrome.i18n.getUILanguage(), count);
  return '(' + chrome.i18n.getMessage(key, String(count)) + ')';
}

/** "(You: 3)" on video cards, where space is short; "(You: 0)" if never watched. */
export function cardBadgeText(record: VideoRecord | null): string {
  return '(' + chrome.i18n.getMessage('cardViews', String(record?.count ?? 0)) + ')';
}

export function badgeTooltip(record: VideoRecord | null): string {
  if (!record) return chrome.i18n.getMessage('tooltipNone');
  const locale = chrome.i18n.getUILanguage();
  return chrome.i18n.getMessage('tooltipDates', [
    formatDateTime(locale, record.firstViewedAt),
    formatDateTime(locale, record.lastViewedAt),
  ]);
}
