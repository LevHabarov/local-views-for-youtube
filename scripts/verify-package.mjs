// Checks dist/ against the Chrome Web Store's rules before it is zipped.
// Throws with a list of problems; `npm run package` runs it automatically.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const MAX_NAME = 75;
const MAX_SHORT_NAME = 12;
const MAX_DESCRIPTION = 132;
const ALLOWED_EXTENSIONS = /\.(js|css|html|json|png)$/;

function listFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    return statSync(path).isDirectory() ? listFiles(path) : [relative('dist', path).split(sep).join('/')];
  });
}

function pngSize(path) {
  const png = readFileSync(path);
  return [png.readUInt32BE(16), png.readUInt32BE(20)];
}

export function verifyPackage() {
  const problems = [];
  const check = (ok, problem) => {
    if (!ok) problems.push(problem);
  };

  const manifest = JSON.parse(readFileSync('dist/manifest.json', 'utf8'));
  const { version } = JSON.parse(readFileSync('package.json', 'utf8'));
  const files = listFiles('dist');

  check(manifest.manifest_version === 3, 'manifest_version must be 3');
  check(manifest.version === version, `manifest version ${manifest.version} ≠ package.json ${version}`);
  check(/^\d+(\.\d+){0,3}$/.test(manifest.version), `invalid version "${manifest.version}"`);
  check((manifest.short_name ?? '').length <= MAX_SHORT_NAME, `short_name longer than ${MAX_SHORT_NAME}`);

  // Files the manifest points to.
  const referenced = [
    ...Object.values(manifest.icons ?? {}),
    ...Object.values(manifest.action?.default_icon ?? {}),
    manifest.action?.default_popup,
    ...(manifest.content_scripts ?? []).flatMap((script) => [...(script.js ?? []), ...(script.css ?? [])]),
  ].filter(Boolean);
  for (const file of referenced) check(files.includes(file), `manifest refers to missing ${file}`);

  // Icons must have the size their key says.
  for (const [size, file] of Object.entries(manifest.icons ?? {})) {
    if (!files.includes(file)) continue;
    const [width, height] = pngSize(join('dist', file));
    check(width === Number(size) && height === Number(size), `${file} is ${width}×${height}, not ${size}×${size}`);
  }
  check(manifest.icons?.['128'], 'a 128×128 icon is required');

  // Locales: same keys everywhere, store limits on name and description.
  const locales = readdirSync('dist/_locales');
  check(locales.includes(manifest.default_locale), `default_locale "${manifest.default_locale}" is missing`);
  const messages = Object.fromEntries(
    locales.map((locale) => [locale, JSON.parse(readFileSync(`dist/_locales/${locale}/messages.json`, 'utf8'))]),
  );
  const defaultKeys = Object.keys(messages[manifest.default_locale] ?? {});
  for (const [locale, localeMessages] of Object.entries(messages)) {
    for (const key of defaultKeys) check(localeMessages[key], `${locale}: missing message "${key}"`);
    const name = localeMessages.extName?.message ?? '';
    const description = localeMessages.extDescription?.message ?? '';
    check(name.length > 0 && name.length <= MAX_NAME, `${locale}: name must be 1–${MAX_NAME} characters`);
    check(
      description.length > 0 && description.length <= MAX_DESCRIPTION,
      `${locale}: description is ${description.length} characters, the limit is ${MAX_DESCRIPTION}`,
    );
  }

  // Nothing that does not belong in the package.
  for (const file of files) {
    check(ALLOWED_EXTENSIONS.test(file), `unexpected file in package: ${file}`);
  }
  // Remote code is not allowed: no script may be loaded from the network.
  for (const file of files.filter((f) => f.endsWith('.html'))) {
    const html = readFileSync(join('dist', file), 'utf8');
    check(!/<script[^>]+src=["']https?:/i.test(html), `${file} loads a remote script`);
  }
  for (const file of files.filter((f) => f.endsWith('.js'))) {
    const js = readFileSync(join('dist', file), 'utf8');
    check(!/\beval\s*\(|new Function\s*\(/.test(js), `${file} uses eval or new Function`);
  }

  if (problems.length > 0) {
    throw new Error('The package is not ready for the Chrome Web Store:\n- ' + problems.join('\n- '));
  }
  return { files: files.length, version };
}

if (import.meta.url === `file:///${process.argv[1].replaceAll('\\', '/')}` || process.argv[1]?.endsWith('verify-package.mjs')) {
  if (!existsSync('dist/manifest.json')) {
    console.error('Run `npm run build` first.');
    process.exit(1);
  }
  const { files, version } = verifyPackage();
  console.log(`Package ${version} looks good: ${files} files.`);
}
