# Changelog

## 1.0.0 — 2026-10-18

First public release.

- Counts a view after 5 seconds of real playback. Seeking, pauses and ads do not add time.
- Replays and loops count as new views.
- Views in background tabs and the miniplayer count. Shorts are not counted.
- Shows "(You: N views)" right after the total view count on the watch page, with the first and last view dates in a tooltip.
- Shows "(You: N)" on every video card: right after the view count on the home page and in the watch history, and on its own line under the view count in the recommendations next to a video. Unwatched videos show "(You: 0)".
- The counts are blue (a lighter blue on the dark theme) to set them apart from YouTube's own text.
- Popup with stats (total views, most and recently watched, top channels), search with deleting single videos, settings and data management.
- Settings: view threshold in seconds or as a share of the video, four counter formats, showing "(You: 0)" or not, counter color, and where counters appear. Settings sync with the browser profile.
- Backups: save the history to a JSON file and restore it; restoring never doubles counts.
- Import from Google Takeout (watch-history.json): adds views from before the extension started counting; a new import replaces the previous one.
- Delete the whole history.
- After the extension is updated, the old script in already open tabs stops itself and removes its counters until the tab is reloaded.
- English and Russian interface.
