// The extension popup: statistics, search, settings and data management.
// Everything stays in the browser; files are only read from and saved to disk.

import { BackupError, createBackup, mergeBackup, parseBackup } from '../core/backup';
import { formatDateTime } from '../core/format';
import { computeStats, searchVideos, type VideoEntry } from '../core/stats';
import {
  clearHistory,
  deleteVideo,
  extendTrackingSince,
  getAllRecords,
  getTrackingSince,
  writeRecords,
  type VideoRecord,
} from '../core/storage';
import { parseTakeout, planTakeoutImport, TakeoutError } from '../core/takeout';
import {
  loadSettings,
  saveSettings,
  SURFACES,
  type BadgeFormat,
  type Settings,
  type ThresholdMode,
} from '../shared/settings';

const msg = (key: string, substitutions?: string | string[]) =>
  chrome.i18n.getMessage(key, substitutions);
const locale = chrome.i18n.getUILanguage();
const number = new Intl.NumberFormat(locale);

function $<T extends HTMLElement = HTMLElement>(id: string): T {
  return document.getElementById(id) as T;
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<HTMLElementTagNameMap[K]> = {},
  children: (Node | string)[] = [],
): HTMLElementTagNameMap[K] {
  const element = Object.assign(document.createElement(tag), props);
  element.append(...children);
  return element;
}

function localize(): void {
  for (const element of document.querySelectorAll<HTMLElement>('[data-i18n]')) {
    element.textContent = msg(element.dataset.i18n!);
  }
  for (const element of document.querySelectorAll<HTMLInputElement>('[data-i18n-placeholder]')) {
    element.placeholder = msg(element.dataset.i18nPlaceholder!);
  }
  document.documentElement.lang = locale;
}

// ---- Status line ----------------------------------------------------------

let statusTimer: number | undefined;

function showStatus(text: string, isError = false): void {
  const status = $('status');
  status.textContent = text;
  status.classList.toggle('error', isError);
  status.hidden = false;
  window.clearTimeout(statusTimer);
  statusTimer = window.setTimeout(() => (status.hidden = true), 8000);
}

// ---- History --------------------------------------------------------------

let records = new Map<string, VideoRecord>();
let trackingSince = Date.now();

async function reloadHistory(): Promise<void> {
  [records, trackingSince] = await Promise.all([getAllRecords(), getTrackingSince()]);
  renderStats();
  renderSearch();
  $('takeout-note').textContent = msg('takeoutNote', formatDateTime(locale, trackingSince));
}

function videoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function videoItem(entry: VideoEntry, detail: string, extra: Node[] = []): HTMLLIElement {
  const title = entry.record.title || entry.videoId;
  return el('li', {}, [
    el('span', { className: 'item-main' }, [
      el('a', { className: 'item-title', href: videoUrl(entry.videoId), target: '_blank', title }, [title]),
      el('span', { className: 'item-sub' }, [detail]),
    ]),
    el('span', { className: 'count', title: msg('viewsTooltip') }, [number.format(entry.views)]),
    ...extra,
  ]);
}

function shortDate(time: number): string {
  return new Date(time).toLocaleDateString(locale, { dateStyle: 'medium' });
}

// ---- Statistics tab -------------------------------------------------------

function renderStats(): void {
  const stats = computeStats(records);
  $('stat-views').textContent = number.format(stats.views);
  $('stat-videos').textContent = number.format(stats.videos);
  $('stat-imported').textContent = number.format(stats.imported);
  $('stat-since').textContent = msg('countingSince', shortDate(trackingSince));

  $('stats-empty').hidden = stats.videos > 0;
  $('stats-lists').hidden = stats.videos === 0;

  $('list-most').replaceChildren(
    ...stats.mostWatched.map((entry) => videoItem(entry, entry.record.channel)),
  );
  $('list-recent').replaceChildren(
    ...stats.recent.map((entry) =>
      videoItem(entry, [entry.record.channel, shortDate(entry.record.lastViewedAt)].filter(Boolean).join(' · ')),
    ),
  );
  $('list-channels').replaceChildren(
    ...stats.channels.map((channel) =>
      el('li', {}, [
        el('span', { className: 'item-main' }, [
          el('span', { className: 'item-title' }, [channel.channel]),
          el('span', { className: 'item-sub' }, [msg('channelVideos', number.format(channel.videos))]),
        ]),
        el('span', { className: 'count' }, [number.format(channel.views)]),
      ]),
    ),
  );
}

// ---- Search tab -----------------------------------------------------------

/** A delete button that asks for a second click before deleting. */
function confirmButton(
  label: string,
  confirmLabel: string,
  className: string,
  onConfirm: () => Promise<void>,
): HTMLButtonElement {
  const button = el('button', { className, textContent: label, title: label });
  let armed = false;
  let timer: number | undefined;
  button.addEventListener('click', async () => {
    if (!armed) {
      armed = true;
      button.textContent = confirmLabel;
      button.classList.add('confirm');
      timer = window.setTimeout(() => {
        armed = false;
        button.textContent = label;
        button.classList.remove('confirm');
      }, 4000);
      return;
    }
    window.clearTimeout(timer);
    button.disabled = true;
    await onConfirm();
  });
  return button;
}

function renderSearch(): void {
  const query = $<HTMLInputElement>('search-input').value;
  const { results, total } = searchVideos(records, query);
  $('search-summary').textContent =
    total === 0
      ? msg('searchNothing')
      : total > results.length
        ? msg('searchShownOf', [number.format(results.length), number.format(total)])
        : msg('searchFound', number.format(total));
  $('search-results').replaceChildren(
    ...results.map((entry) =>
      videoItem(
        entry,
        [entry.record.channel, shortDate(entry.record.lastViewedAt)].filter(Boolean).join(' · '),
        [
          confirmButton('✕', msg('deleteConfirm'), 'icon-button', async () => {
            await deleteVideo(entry.videoId);
            records.delete(entry.videoId);
            renderStats();
            renderSearch();
          }),
        ],
      ),
    ),
  );
}

// ---- Settings tab ---------------------------------------------------------

const COLOR_PRESETS = ['#60a5fa', '#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#a78bfa'];

let settings: Settings;

function renderSettings(): void {
  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="thresholdMode"]')) {
    input.checked = input.value === settings.thresholdMode;
  }
  $<HTMLInputElement>('thresholdSeconds').value = String(settings.thresholdSeconds);
  $<HTMLInputElement>('thresholdPercent').value = String(settings.thresholdPercent);
  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="format"]')) {
    input.checked = input.value === settings.format;
  }
  $<HTMLInputElement>('showZero').checked = settings.showZero;
  for (const input of document.querySelectorAll<HTMLInputElement>('input[data-surface]')) {
    input.checked = settings.showOn[input.dataset.surface as (typeof SURFACES)[number]];
  }
  renderSwatches();
}

function renderSwatches(): void {
  const swatch = (color: string, label: string) => {
    const button = el('button', {
      className: color ? 'swatch' : 'swatch auto',
      title: label,
    });
    button.setAttribute('aria-label', label);
    button.setAttribute('aria-pressed', String(settings.color === color));
    if (color) button.style.background = color;
    button.addEventListener('click', () => update({ color }));
    return button;
  };

  const custom = el('label', { className: 'swatch swatch-custom', title: msg('colorCustom') }, [
    el('input', { type: 'color', value: settings.color || '#60a5fa' }),
  ]);
  const isCustom = settings.color !== '' && !COLOR_PRESETS.includes(settings.color);
  custom.setAttribute('aria-pressed', String(isCustom));
  if (isCustom) custom.style.background = settings.color;
  custom.querySelector('input')!.addEventListener('change', (event) => {
    update({ color: (event.target as HTMLInputElement).value });
  });

  $('swatches').replaceChildren(
    swatch('', msg('colorAuto')),
    ...COLOR_PRESETS.map((color) => swatch(color, color)),
    custom,
  );
}

async function update(changes: Partial<Settings>): Promise<void> {
  settings = { ...settings, ...changes };
  await saveSettings(settings);
  settings = await loadSettings(); // Normalized: clamped numbers and so on.
  renderSettings();
}

function bindSettings(): void {
  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="thresholdMode"]')) {
    input.addEventListener('change', () => update({ thresholdMode: input.value as ThresholdMode }));
  }
  for (const [id, key] of [
    ['thresholdSeconds', 'thresholdSeconds'],
    ['thresholdPercent', 'thresholdPercent'],
  ] as const) {
    $<HTMLInputElement>(id).addEventListener('change', (event) => {
      const value = Number((event.target as HTMLInputElement).value);
      const mode: ThresholdMode = key === 'thresholdSeconds' ? 'seconds' : 'percent';
      update({ [key]: value, thresholdMode: mode });
    });
  }
  for (const input of document.querySelectorAll<HTMLInputElement>('input[name="format"]')) {
    input.addEventListener('change', () => update({ format: input.value as BadgeFormat }));
  }
  $<HTMLInputElement>('showZero').addEventListener('change', (event) => {
    update({ showZero: (event.target as HTMLInputElement).checked });
  });
  for (const input of document.querySelectorAll<HTMLInputElement>('input[data-surface]')) {
    input.addEventListener('change', () => {
      const surface = input.dataset.surface as (typeof SURFACES)[number];
      update({ showOn: { ...settings.showOn, [surface]: input.checked } });
    });
  }
  $('sample-you').textContent = '(' + msg('cardViews', '3') + ')';
}

// ---- Data tab -------------------------------------------------------------

function download(fileName: string, text: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = el('a', { href: url, download: fileName });
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

async function exportBackup(): Promise<void> {
  const backup = createBackup(await getAllRecords(), await getTrackingSince());
  const date = new Date().toISOString().slice(0, 10);
  download(`local-views-backup-${date}.json`, JSON.stringify(backup));
  showStatus(msg('exportDone', number.format(Object.keys(backup.videos).length)));
}

/** Runs `task` for the file chosen in `input`, then resets the input. */
function onFile(input: HTMLInputElement, task: (text: string) => Promise<void>): void {
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const label = input.closest('label');
    label?.setAttribute('aria-disabled', 'true');
    showStatus(msg('working'));
    try {
      await task(await file.text());
    } catch (error) {
      showStatus(errorMessage(error), true);
    } finally {
      label?.removeAttribute('aria-disabled');
    }
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof BackupError || error instanceof TakeoutError) {
    const key = {
      'not-json': 'errorNotJson',
      'not-backup': 'errorNotBackup',
      'newer-version': 'errorNewerVersion',
      'not-takeout': 'errorNotTakeout',
    }[error.message];
    if (key) return msg(key);
  }
  return msg('errorGeneric', String(error));
}

async function importBackup(text: string): Promise<void> {
  const backup = parseBackup(text);
  const changes = mergeBackup(await getAllRecords(), backup.records);
  await writeRecords(changes);
  if (backup.trackingSince !== null) await extendTrackingSince(backup.trackingSince);
  await reloadHistory();
  showStatus(
    msg('importBackupDone', [number.format(changes.size), number.format(backup.skipped)]),
  );
}

async function importTakeout(text: string): Promise<void> {
  const since = await getTrackingSince();
  const summary = parseTakeout(text, since);
  const plan = planTakeoutImport(await getAllRecords(), summary.videos);
  await writeRecords(plan.writes, plan.removed);
  await reloadHistory();
  showStatus(
    msg('importTakeoutDone', [
      number.format(summary.views),
      number.format(summary.videos.size),
      number.format(summary.afterTracking),
    ]),
  );
}

function bindData(): void {
  $('export').addEventListener('click', () => {
    exportBackup().catch((error) => showStatus(errorMessage(error), true));
  });
  onFile($<HTMLInputElement>('import-backup'), importBackup);
  onFile($<HTMLInputElement>('import-takeout'), importTakeout);

  $('clear').replaceWith(clearButton());
}

function clearButton(): HTMLButtonElement {
  const button = confirmButton(msg('clearButton'), msg('clearConfirm'), 'danger-button', async () => {
    await clearHistory();
    await reloadHistory();
    button.replaceWith(clearButton());
    showStatus(msg('clearDone'));
  });
  return button;
}

// ---- Tabs -----------------------------------------------------------------

const TAB_KEY = 'popupTab';

function selectTab(name: string): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
    const selected = button.dataset.tab === name;
    button.setAttribute('aria-selected', String(selected));
    $(`tab-${button.dataset.tab}`).hidden = !selected;
  }
  if (name === 'search') $('search-input').focus();
  try {
    localStorage.setItem(TAB_KEY, name);
  } catch {
    // Remembering the tab is a convenience; ignore storage errors.
  }
}

function bindTabs(): void {
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tab]')) {
    button.addEventListener('click', () => selectTab(button.dataset.tab!));
  }
  let saved: string | null = null;
  try {
    saved = localStorage.getItem(TAB_KEY);
  } catch {
    // Fall back to the first tab.
  }
  selectTab(saved && $(`tab-${saved}`) ? saved : 'stats');
}

// ---- Start ----------------------------------------------------------------

async function start(): Promise<void> {
  // Opened as a regular tab (the "Open in a tab" link) rather than the popup.
  if (window.innerWidth > 500) document.body.classList.add('in-tab');
  localize();
  bindTabs();
  bindSettings();
  bindData();
  $('search-input').addEventListener('input', renderSearch);

  settings = await loadSettings();
  renderSettings();
  await reloadHistory();

  // Keep the numbers fresh while a video plays in another tab.
  chrome.storage.onChanged.addListener((_changes, area) => {
    if (area === 'local') void reloadHistory();
  });
}

start().catch((error) => showStatus(errorMessage(error), true));
