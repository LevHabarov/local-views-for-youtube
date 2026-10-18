// Renders the Chrome Web Store images from store/templates/assets.html with
// headless Google Chrome. Set CHROME_PATH if Chrome is installed elsewhere.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
];

// Sizes required by the Chrome Web Store.
const ASSETS = [
  { id: 'screenshot-badge', lang: 'en', width: 1280, height: 800 },
  { id: 'screenshot-cards', lang: 'en', width: 1280, height: 800 },
  { id: 'screenshot-popup', lang: 'en', width: 1280, height: 800 },
  { id: 'screenshot-rules', lang: 'en', width: 1280, height: 800 },
  { id: 'screenshot-badge', lang: 'ru', width: 1280, height: 800 },
  { id: 'screenshot-cards', lang: 'ru', width: 1280, height: 800 },
  { id: 'screenshot-popup', lang: 'ru', width: 1280, height: 800 },
  { id: 'screenshot-rules', lang: 'ru', width: 1280, height: 800 },
  { id: 'promo-small', lang: 'en', width: 440, height: 280 },
  { id: 'promo-marquee', lang: 'en', width: 1400, height: 560 },
];

const chrome = CHROME_CANDIDATES.find((path) => path && existsSync(path));
if (!chrome) {
  console.error('Google Chrome not found. Set CHROME_PATH to its executable.');
  process.exit(1);
}

const template = pathToFileURL(resolve('store/templates/assets.html')).href;
mkdirSync('store/assets', { recursive: true });

for (const { id, lang, width, height } of ASSETS) {
  const output = resolve(`store/assets/${id}-${lang}.png`);
  execFileSync(chrome, [
    '--headless',
    '--disable-gpu',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--allow-file-access-from-files',
    `--window-size=${width},${height}`,
    `--screenshot=${output}`,
    `${template}#${id}/${lang}`,
  ], { stdio: 'ignore' });

  const png = readFileSync(output);
  const size = `${png.readUInt32BE(16)}x${png.readUInt32BE(20)}`;
  if (size !== `${width}x${height}`) {
    throw new Error(`${output}: expected ${width}x${height}, got ${size}`);
  }
  console.log(`Rendered ${id}-${lang}.png (${size})`);
}
