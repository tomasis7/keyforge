/**
 * Renders the Open Graph card to public/og.png.
 *
 * A browser does the rasterising because the type is self-hosted but still
 * webfont-based; an SVG rasteriser would silently substitute a fallback face.
 * puppeteer-core drives whatever Chrome is already installed rather than
 * downloading one.
 *
 * Run with `npm run og`. The PNG is committed, so neither CI nor a deploy needs
 * a browser — regenerate when the design or the palette changes, which
 * og-fingerprint.test.ts will tell you about.
 */
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import puppeteer from 'puppeteer-core';
import { HEIGHT, ogFingerprint, page, WIDTH } from './og-card';

// Relative to the package root, not to import.meta.url: this file is bundled to
// node_modules/.cache before running, so a path relative to the module would
// resolve inside node_modules.
const OUT = resolve(process.cwd(), 'public/og.png');
const FINGERPRINT = resolve(process.cwd(), 'src/test/og-fingerprint.json');

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];

function findChrome(): string {
  const found = CHROME_CANDIDATES.find((p): p is string => !!p && existsSync(p));
  if (!found) {
    throw new Error('No Chrome/Chromium found. Set CHROME_PATH to a browser executable.');
  }
  return found;
}

const browser = await puppeteer.launch({
  executablePath: findChrome(),
  headless: true,
  args: ['--no-sandbox', '--hide-scrollbars'],
});

try {
  const tab = await browser.newPage();
  // 1200x630 is already oversampled for the ~600px platforms actually render
  // these at; 2x quadrupled the committed file for no visible gain.
  await tab.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
  await tab.setContent(page(), { waitUntil: 'load' });
  // Without this the first paint can land before the webfonts swap in.
  await tab.evaluate(() => document.fonts.ready);

  await mkdir(dirname(OUT), { recursive: true });
  const png = await tab.screenshot({ type: 'png' });
  await writeFile(OUT, png);

  await mkdir(dirname(FINGERPRINT), { recursive: true });
  const fingerprint = ogFingerprint();
  await writeFile(FINGERPRINT, JSON.stringify({ fingerprint }, null, 2) + '\n');

  console.log(`Wrote ${OUT} (${WIDTH}x${HEIGHT}, ${(png.length / 1024).toFixed(0)} kB)`);
  console.log(`Fingerprint ${fingerprint}`);
} finally {
  await browser.close();
}
