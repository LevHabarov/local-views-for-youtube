// User settings, kept in chrome.storage.sync so they follow the user's
// browser profile. The view history itself stays in chrome.storage.local.

export type ThresholdMode = 'seconds' | 'percent';
export type BadgeFormat = 'you' | 'times' | 'parens' | 'eye';
export type Surface = 'watch' | 'home' | 'recommendations' | 'history';

export interface Settings {
  thresholdMode: ThresholdMode;
  /** Seconds of real playback for a view, in 'seconds' mode. */
  thresholdSeconds: number;
  /** Share of the video's length for a view, in 'percent' mode. */
  thresholdPercent: number;
  format: BadgeFormat;
  /** Show the badge for videos with no views ("(You: 0)"). */
  showZero: boolean;
  /** Badge color as #rrggbb, or '' for the default blue that follows YouTube's theme. */
  color: string;
  showOn: Record<Surface, boolean>;
}

export const SURFACES: Surface[] = ['watch', 'home', 'recommendations', 'history'];
export const FORMATS: BadgeFormat[] = ['you', 'times', 'parens', 'eye'];

export const THRESHOLD_SECONDS_RANGE = { min: 1, max: 600 };
export const THRESHOLD_PERCENT_RANGE = { min: 1, max: 100 };

export const DEFAULT_SETTINGS: Settings = {
  thresholdMode: 'seconds',
  thresholdSeconds: 5,
  thresholdPercent: 30,
  format: 'you',
  showZero: true,
  color: '',
  showOn: { watch: true, home: true, recommendations: true, history: true },
};

const SETTINGS_KEY = 'settings';
const COLOR = /^#[0-9a-f]{6}$/i;

function clampInt(value: unknown, range: { min: number; max: number }, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(range.max, Math.max(range.min, Math.round(value)));
}

/** Turns whatever is stored into valid settings; unknown or broken values fall back to defaults. */
export function normalizeSettings(raw: unknown): Settings {
  const s = (typeof raw === 'object' && raw !== null ? raw : {}) as Record<string, unknown>;
  const showOn = (typeof s.showOn === 'object' && s.showOn !== null ? s.showOn : {}) as Record<
    string,
    unknown
  >;
  const d = DEFAULT_SETTINGS;
  return {
    thresholdMode: s.thresholdMode === 'percent' ? 'percent' : 'seconds',
    thresholdSeconds: clampInt(s.thresholdSeconds, THRESHOLD_SECONDS_RANGE, d.thresholdSeconds),
    thresholdPercent: clampInt(s.thresholdPercent, THRESHOLD_PERCENT_RANGE, d.thresholdPercent),
    format: FORMATS.find((f) => f === s.format) ?? d.format,
    showZero: typeof s.showZero === 'boolean' ? s.showZero : d.showZero,
    color: typeof s.color === 'string' && COLOR.test(s.color) ? s.color.toLowerCase() : d.color,
    showOn: Object.fromEntries(
      SURFACES.map((surface) => [
        surface,
        typeof showOn[surface] === 'boolean' ? (showOn[surface] as boolean) : d.showOn[surface],
      ]),
    ) as Record<Surface, boolean>,
  };
}

export async function loadSettings(): Promise<Settings> {
  const items = await chrome.storage.sync.get(SETTINGS_KEY);
  return normalizeSettings(items[SETTINGS_KEY]);
}

export async function saveSettings(settings: Settings): Promise<void> {
  await chrome.storage.sync.set({ [SETTINGS_KEY]: normalizeSettings(settings) });
}

/** Calls `listener` with the new settings whenever they change (in any tab or the popup). */
export function onSettingsChanged(listener: (settings: Settings) => void): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes[SETTINGS_KEY]) {
      listener(normalizeSettings(changes[SETTINGS_KEY].newValue));
    }
  });
}
