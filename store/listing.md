# Chrome Web Store listing

Everything to paste into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole) when publishing. Replace `<github-user>` with the GitHub account that hosts the repository.

## Package

`npm run package` → `local-views-for-youtube-<version>.zip`. Upload it on the **Package** tab. Bump `version` in `package.json` before every new upload: the store rejects a version it has already seen.

## Store listing tab

**Name** (from the manifest): Local Views for YouTube

**Summary** (from the manifest, max 132 characters):
- EN: Shows how many times you have watched each video. Your history stays on your device.
- RU: Показывает, сколько раз вы смотрели каждое видео. История хранится только на вашем устройстве.

**Category:** Tools

**Language:** English (add Russian as a second listing language with the texts below).

### Description — English

```
Ever wondered how many times you've rewatched that one video? Local Views for YouTube shows your personal view count right next to the total number of views:

    1,234,567 views (You: 3 views) 2 years ago

Hover over it to see when you first and last watched the video.

HOW VIEWS ARE COUNTED
• A view counts after 5 seconds of real playback. Seeking, pauses and ads don't add time.
• Watching again after the video ends, and every round in loop mode, is a new view.
• Views in background tabs and in the miniplayer count too.
• Shorts are not counted.

PRIVATE BY DESIGN
• Your history is stored only in your browser, on your device.
• No accounts, no servers, no analytics. The extension makes no network requests.
• Uninstalling the extension deletes all its data.

The extension starts counting from the moment you install it.

Open source: https://github.com/<github-user>/local-views-for-youtube

This extension is not affiliated with or endorsed by YouTube or Google.
```

### Description — Russian

```
Интересно, сколько раз вы пересматривали любимое видео? Local Views for YouTube показывает ваш личный счётчик просмотров сразу после общего числа просмотров:

    1 234 567 просмотров (Вы: 3 просмотра) 2 года назад

Наведите на счётчик, чтобы увидеть даты первого и последнего просмотра.

КАК СЧИТАЮТСЯ ПРОСМОТРЫ
• Просмотр засчитывается после 5 секунд реального воспроизведения. Перемотка, пауза и реклама время не добавляют.
• Повтор после окончания и каждый круг в режиме loop — новый просмотр.
• Просмотры в фоновых вкладках и в мини-плеере тоже учитываются.
• Shorts не учитываются.

ПРИВАТНОСТЬ
• История хранится только в вашем браузере, на вашем устройстве.
• Никаких аккаунтов, серверов и аналитики. Расширение не делает сетевых запросов.
• При удалении расширения все его данные удаляются.

Счётчик начинает считать с момента установки расширения.

Открытый исходный код: https://github.com/<github-user>/local-views-for-youtube

Расширение не связано с YouTube и Google и не одобрено ими.
```

### Graphics

All files are in `store/assets/` (regenerate with `npm run store-assets`).

| Field | File | Size |
|---|---|---|
| Store icon | `public/icons/icon128.png` | 128×128 |
| Screenshots (EN listing) | `screenshot-badge-en.png`, `screenshot-rules-en.png` | 1280×800 |
| Screenshots (RU listing) | `screenshot-badge-ru.png`, `screenshot-rules-ru.png` | 1280×800 |
| Small promo tile | `promo-small-en.png` | 440×280 |
| Marquee promo tile (optional) | `promo-marquee-en.png` | 1400×560 |

The screenshots are mockups of the info line under a video, without YouTube branding or other people's videos. Consider adding one real screenshot of the extension on a video page that you have the rights to show.

**Homepage URL:** `https://github.com/<github-user>/local-views-for-youtube`
**Support URL:** `https://github.com/<github-user>/local-views-for-youtube/issues`

## Privacy practices tab

**Single purpose:**
Shows the user how many times they have personally watched each YouTube video, next to the video's total view count.

**Permission justification — `storage`:**
Stores the user's own view count, first and last view time, title and channel of each watched video locally, so the count can be shown when the video is opened again.

**Host permission justification — `https://www.youtube.com/*`:**
The content scripts run on YouTube watch pages to detect playback of the main video player and to display the personal view count under the video. No other sites are accessed.

**Remote code:** No, I am not using remote code. All code is included in the package.

**Data usage.** The extension stores a list of watched videos, which is close to the "Web history" category, but only on the user's device: nothing is transmitted to the developer or anyone else. Check the dashboard's current definition of "collect" before answering. If in doubt, tick "Web history" and certify:
- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** `https://github.com/<github-user>/local-views-for-youtube/blob/main/PRIVACY.md`

## Before the first submission

1. Register a developer account (one-time fee) and turn on 2-Step Verification for the Google account.
2. Push the repository to GitHub so the privacy policy URL works.
3. Fill in the publisher contact email and verify it.
4. Upload the zip, fill in the tabs above, choose visibility (Public or Unlisted) and submit for review.
