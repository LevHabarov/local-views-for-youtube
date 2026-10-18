// Localized texts for the badges.

import { formatDateTime, viewsMessageKey } from '../core/format';
import { totalViews, type VideoRecord } from '../core/storage';
import type { Settings } from '../shared/settings';

export interface BadgeContent {
  text: string;
  tooltip: string;
}

/**
 * What a badge shows for the video, or null if it should not be shown (no
 * views and "(You: 0)" turned off). Under the video the default format spells
 * out "views": "(You: 3 views)"; on cards it is short: "(You: 3)".
 */
export function badgeContent(
  settings: Settings,
  record: VideoRecord | null,
  place: 'watch' | 'card',
): BadgeContent | null {
  const count = totalViews(record);
  if (count === 0 && !settings.showZero) return null;
  return { text: badgeText(settings, count, place), tooltip: badgeTooltip(record) };
}

function badgeText(settings: Settings, count: number, place: 'watch' | 'card'): string {
  switch (settings.format) {
    case 'times':
      return `×${count}`;
    case 'parens':
      return `(${count})`;
    case 'eye':
      return `👁 ${count}`;
    case 'you':
      if (place === 'watch' && count > 0) {
        const key = viewsMessageKey(chrome.i18n.getUILanguage(), count);
        return '(' + chrome.i18n.getMessage(key, String(count)) + ')';
      }
      return '(' + chrome.i18n.getMessage('cardViews', String(count)) + ')';
  }
}

function badgeTooltip(record: VideoRecord | null): string {
  if (totalViews(record) === 0 || !record) return chrome.i18n.getMessage('tooltipNone');
  const locale = chrome.i18n.getUILanguage();
  const dates = chrome.i18n.getMessage('tooltipDates', [
    formatDateTime(locale, record.firstViewedAt),
    formatDateTime(locale, record.lastViewedAt),
  ]);
  if (!record.imported) return dates;
  return (
    dates +
    '\n' +
    chrome.i18n.getMessage('tooltipImported', [String(record.count), String(record.imported)])
  );
}
