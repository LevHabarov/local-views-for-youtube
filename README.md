# Local Views for YouTube

A Chrome extension that shows how many times **you** have watched a YouTube video, right next to its total view count:

> 445 014 707 views **(You: 13 views)** 21 years ago

Video cards get a short count too: on the home page and in your watch history right after the view count ("297K **(You: 3)** • 2 years ago"), and in the recommendations next to a video on its own line under the view count. Videos you haven't watched show "(You: 0)". The counts are blue, so they don't get mixed up with YouTube's own numbers.

Click the extension's icon for:

- **Stats:** total views, most watched videos, recently watched, top channels.
- **Search** through your history by title or channel, and delete single videos.
- **Settings:** the view threshold (seconds of playback or a share of the video), the counter format (`(You: 3)`, `×3`, `(3)`, `👁 3`), whether to show "(You: 0)", the color, and where counters appear.
- **Data:** save your history to a file and restore it, import your history from Google Takeout, or delete everything.

Your history never leaves your device: it is kept in the browser's local extension storage, and the extension makes no network requests of its own. Only the settings sync through your browser profile.

[Русская версия](README.ru.md)

## What counts as a view

- The video actually played for 5 seconds (configurable, or a share of the video's length). Seeking, pauses and ads do not add time. Videos shorter than the threshold count once 90% of them has played.
- Watching again after the video ended, and every round in loop mode, is a new view.
- Views in background tabs and in the miniplayer count.
- Shorts, embedded players on other sites and YouTube Music are not counted yet.

## Importing from Google Takeout

1. Open [takeout.google.com](https://takeout.google.com), click "Deselect all" and select "YouTube and YouTube Music".
2. In "Multiple formats" choose **JSON** for history, and in "All YouTube data included" keep only history.
3. Download the archive and pick `watch-history.json` in the popup's Data tab.

Only views from before the extension started counting are imported, so nothing is counted twice. Importing a newer Takeout file replaces the previous import.

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
- `src/content/` is the content script (isolated world). It counts views, stores them and draws the badges: `badge.ts` under the video, `cards.ts` on video cards. The YouTube DOM selectors live at the top of these two files.
- `src/popup/` is the popup (its HTML and CSS are in `public/`).
- `src/core/` is mostly pure logic: view rules (`view-tracker.ts`), records and storage (`storage.ts`, `records.ts`), Takeout import (`takeout.ts`), backups (`backup.ts`), stats and search (`stats.ts`), plural forms (`format.ts`).
- `src/shared/` holds the bridge message protocol and the settings.
- `public/` holds the manifest, the badge styles (`styles.css`), locales (`_locales/en`, `_locales/ru`) and icons. The version in the built manifest is taken from `package.json`.
- `store/` holds the Chrome Web Store listing texts and images.

## Privacy

See [PRIVACY.md](PRIVACY.md).

## License

[MIT](LICENSE)
