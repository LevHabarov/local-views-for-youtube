// Text for the counter. chrome.i18n has no plural support, so the plural
// form is picked with Intl.PluralRules and each form is its own message.

const PLURAL_MESSAGE_KEYS: Record<Intl.LDMLPluralRule, string> = {
  zero: 'viewsOther',
  one: 'viewsOne',
  two: 'viewsOther',
  few: 'viewsFew',
  many: 'viewsMany',
  other: 'viewsOther',
};

export function viewsMessageKey(locale: string, count: number): string {
  return PLURAL_MESSAGE_KEYS[new Intl.PluralRules(locale).select(count)];
}

export function formatDateTime(locale: string, timestamp: number): string {
  return new Date(timestamp).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' });
}
