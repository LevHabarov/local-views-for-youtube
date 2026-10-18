// Builds each content script as a standalone IIFE bundle: Chrome loads
// content scripts as classic scripts, so they cannot share ES module chunks.
import { rmSync } from 'node:fs';
import { build } from 'vite';

const entries = [
  { name: 'bridge', entry: 'src/bridge/index.ts' },
  { name: 'content', entry: 'src/content/index.ts' },
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

console.log('Built extension into dist/');
