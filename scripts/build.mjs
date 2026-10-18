// Builds each script as a standalone IIFE bundle: Chrome loads content
// scripts as classic scripts, so they cannot share ES module chunks. The
// popup's HTML and CSS are static files in public/.
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { build } from 'vite';

const entries = [
  { name: 'bridge', entry: 'src/bridge/index.ts' },
  { name: 'content', entry: 'src/content/index.ts' },
  { name: 'popup', entry: 'src/popup/index.ts' },
];

rmSync('dist', { recursive: true, force: true });

for (const [index, { name, entry }] of entries.entries()) {
  await build({
    configFile: false,
    publicDir: 'public',
    logLevel: 'warn',
    build: {
      outDir: 'dist',
      emptyOutDir: false,
      copyPublicDir: index === 0,
      target: 'chrome111',
      // Keep the output readable for Chrome Web Store review.
      minify: false,
      lib: {
        entry,
        formats: ['iife'],
        name: `localViews_${name}`,
        fileName: () => `${name}.js`,
      },
    },
  });
}

// package.json is the single source of the version number.
const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8'));
manifest.version = version;
writeFileSync('dist/manifest.json', JSON.stringify(manifest, null, 2) + '\n');

console.log(`Built extension ${version} into dist/`);
