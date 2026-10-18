// When the extension is updated or reloaded, Chrome injects the new content
// script only into pages loaded afterwards. The old script keeps running in
// tabs that were already open, but every chrome.* call now fails. Such an
// orphaned script stops itself: it disconnects its observers, clears its
// timers and removes its counters, so the page looks as if the extension
// were not there until the tab is reloaded.

const shutdownHandlers: (() => void)[] = [];
let stopped = false;

/** Registers cleanup to run once when this script is orphaned. */
export function onShutdown(handler: () => void): void {
  shutdownHandlers.push(handler);
}

/**
 * True while the extension this script belongs to is still loaded. The first
 * time it finds the script orphaned, it runs the shutdown handlers.
 */
export function isAlive(): boolean {
  if (stopped) return false;
  let alive: boolean;
  try {
    alive = Boolean(chrome.runtime?.id);
  } catch {
    alive = false;
  }
  if (!alive) {
    stopped = true;
    for (const handler of shutdownHandlers) {
      try {
        handler();
      } catch {
        // Keep cleaning up the rest.
      }
    }
  }
  return alive;
}
