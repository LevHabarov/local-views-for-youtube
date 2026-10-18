# Local Views for YouTube

A Chrome extension that shows how many times **you** have watched a YouTube video, right next to its total view count:

> 445 014 707 views **(You: 13 views)** 21 years ago

Your history never leaves your device: it is kept in the browser's local extension storage, and the extension makes no network requests of its own.

[Русская версия](README.ru.md)

## What counts as a view

- The video actually played for 5 seconds. Seeking, pauses and ads do not add time. Videos shorter than 5 seconds count once 90% of them has played.
- Watching again after the video ended, and every round in loop mode, is a new view.
- Views in background tabs and in the miniplayer count.
- Shorts, embedded players on other sites and YouTube Music are not counted yet.

## Install

- **Chrome Web Store:** coming soon.
- **From source:** build it (see below), open `chrome://extensions`, turn on Developer mode, click "Load unpacked" and pick the `dist/` folder.

## Development

Requires Node.js 24 or newer.

```bash
npm install
npm run build         # build the extension into dist/
npm test              # unit tests (vitest)
npm run typecheck
npm run package       # build and pack dist/ into a zip for the Chrome Web Store
npm run icons         # redraw public/icons/*.png
npm run store-assets  # render store screenshots and the promo tile (needs Google Chrome)
```

After rebuilding, click the reload button on the extension's card in `chrome://extensions` and refresh the YouTube tab.

### Layout

- `src/bridge/` runs in the page's main world. It listens to `<video>` events of the main player (`#movie_player`), reads the video ID from the player API and forwards playback state to the content script.
- `src/content/` is the content script (isolated world). It counts views, stores them and draws the badge. All YouTube DOM selectors live in `badge.ts`.
- `src/core/` is pure logic with no browser APIs: view rules (`view-tracker.ts`), records (`storage.ts`), plural forms (`format.ts`).
- `public/` holds the manifest, locales (`_locales/en`, `_locales/ru`) and icons. The version in the built manifest is taken from `package.json`.
- `store/` holds the Chrome Web Store listing texts and images.

## Privacy

See [PRIVACY.md](PRIVACY.md).

## License

[MIT](LICENSE)
