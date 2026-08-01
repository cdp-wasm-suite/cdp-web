// Boots serve.mjs and a Chromium tuned for deterministic paint, then waits for
// the app to be genuinely ready (WASM modules + fonts) before anyone captures.

import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';
import { installCursor } from './cursor.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');

// Deterministic paint. The first two make the compositor finish every stage
// before a frame is handed back, so a screenshot can't catch a half-drawn frame.
// --disable-threaded-animation pulls animations onto the main thread, where the
// faked clock can reach them.
const FLAGS = [
  '--run-all-compositor-stages-before-draw',
  '--disable-new-content-rendering-timeout',
  '--disable-threaded-animation',
  '--disable-checker-imaging',
  '--force-color-profile=srgb',
  '--font-render-hinting=none',
  '--hide-scrollbars',
  '--mute-audio',
];

export async function startServer(port = 8123) {
  const proc = spawn('node', ['serve.mjs', String(port)], {
    cwd: REPO,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // serve.mjs prints its URL once listening; wait for that rather than sleeping.
  await new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error('serve.mjs did not start in 10s')), 10_000);
    proc.stdout.on('data', (d) => {
      if (String(d).includes(String(port))) { clearTimeout(t); ok(); }
    });
    proc.on('exit', (c) => { clearTimeout(t); fail(new Error(`serve.mjs exited ${c}`)); });
  });
  return {
    url: `http://localhost:${port}/`,
    stop: () => proc.kill(),
  };
}

/**
 * A fresh context every run. This is the single most important determinism
 * guarantee: the app restores localStorage['cdp-web-patch'] on load
 * (patcher.js:2600), so a reused profile would silently resurrect the previous
 * capture's graph. A fresh context starts with empty storage, which also means
 * CRT stays off (patcher.js:355 defaults it to false).
 */
export async function launch({ url, width = 1920, height = 1080, scale = 2, headless = true }) {
  const browser = await chromium.launch({ headless, args: FLAGS });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: scale,
    reducedMotion: 'no-preference',
  });
  await installCursor(context);

  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: 'load' });

  // __cdpReady only flips after cdp.load('synth') resolves (patcher.js:2596).
  // Nothing before this point is worth capturing, and the clock must not be
  // installed until after it -- the readiness poll at patcher.js:2615 runs on a
  // real setInterval and would freeze.
  await page.waitForFunction(() => window.__cdpReady === true, null, { timeout: 60_000 });
  await page.evaluate(() => document.fonts.ready);

  if (errors.length) console.warn('[rig] page errors during boot:', errors);

  return {
    browser, context, page, errors,
    close: () => browser.close(),
  };
}
