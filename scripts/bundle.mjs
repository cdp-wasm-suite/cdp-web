#!/usr/bin/env node
// Assemble a self-contained static build of cdp-web into `dist/bundle/`, suitable
// for embedding in a native WebView host (the Ableton Live extension, the VST
// plugin), for hosting on any static file server — and for publishing as the
// @cdp-wasm-suite/cdp-web npm package (GitHub Packages), which is how the
// native hosts consume it.
//
// Because `npm pack` unconditionally strips any directory named node_modules,
// the engine subset is written to `vendor/` inside the bundle and the
// `./node_modules/…` references (index.html import map, sampler WASM_URL) are
// rewritten to `./vendor/…`. The engine files come from ./node_modules when the
// dependencies are installed (dev machines), falling back to the committed
// ./vendor snapshot (see vendor-engine.mjs) so CI can build after a bare
// checkout — same trick as build-site.mjs.
//
// Usage:  node scripts/bundle.mjs   (or: npm run bundle)

import { rm, mkdir, readdir, cp, stat, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist', 'bundle');
// Engine dir name inside the bundle. NOT "node_modules": npm pack always
// excludes node_modules dirs, which would silently drop the engine from the
// published package.
const ENGINE_DIR = 'vendor';

// Root files to include, by extension. Dev-only files are denied explicitly.
// manual.json is fetched at runtime by manual.js (`fetch('./manual.json')`); the
// package.json files are handled separately (publishable manifest written
// below / dev-only), so deny them here to avoid shipping the dev manifest +
// lockfile. param-ranges-report.json is the `npm run audit:ranges` output — a
// 596 KB dev artifact nothing fetches at runtime, and it would otherwise ride
// into every vendored copy (plugin bundles it per format).
const RUNTIME_EXT = new Set(['.js', '.html', '.svg', '.png', '.css', '.ico', '.woff2', '.ttf', '.json', '.webmanifest']);
const ROOT_DENY = new Set(['serve.mjs', 'package.json', 'package-lock.json', 'param-ranges-report.json']);

// Runtime asset dirs copied wholesale.
//   - audio/ : the bundled CDP demo sounds that the "Sound files" recipes (and
//     the additive/inharmonic synthesis recipes) fetch via `audio/<name>.wav`.
//   - img/   : logo/banner images referenced by index.html (./img/…).
const ASSET_DIRS = ['fonts', 'audio', 'src', 'img'];

// Engine subset — only what the app loads at runtime.
//   - cdp-wasm src/ + wasm/ : the engine loader finds its .wasm assets via
//     `new URL('../wasm/', import.meta.url)`, so src/ and wasm/ must stay siblings.
//   - cdp-sampler wasm/     : the AudioWorklet DSP (sampler.js WASM_URL).
//   - faustwasm esm-bundle  : the in-browser Faust compiler (~7.3 MB, inlines
//     libfaust). It loads lazily via a guarded dynamic import (faust.js), so
//     dropping it from this list just makes Faust features fail gracefully —
//     but for now every consumer ships it.
//   - monaco-editor min/vs  : the Faust code editor (AMD build, loaded lazily
//     by code-editor.js). Editor core + base/worker only; basic-languages and
//     the language services are never loaded.
// Keep in sync with SPECS in vendor-engine.mjs — ./vendor is the CI fallback
// source for exactly these paths.
const PKG_INCLUDE = [
  'cdp-wasm/src',
  'cdp-wasm/wasm',
  'cdp-wasm/package.json',
  '@cdp-wasm-suite/cdp-sampler/wasm',
  '@cdp-wasm-suite/cdp-sampler/package.json',
  '@grame/faustwasm/dist/esm-bundle',
  '@grame/faustwasm/package.json',
  'monaco-editor/min/vs/loader.js',
  'monaco-editor/min/vs/editor',
  'monaco-editor/min/vs/base',
  'monaco-editor/package.json',
];

// App files whose `./node_modules/…` runtime references must point at the
// bundle's engine dir instead (paths relative to DIST).
const REWRITE_EXT = new Set(['.js', '.html', '.css']);

async function dirSize(p) {
  let total = 0;
  const st = await stat(p);
  if (!st.isDirectory()) return st.size;
  for (const name of await readdir(p)) total += await dirSize(join(p, name));
  return total;
}

// Rewrite node_modules/ → ENGINE_DIR/ in every copied text file (the engine
// dir itself is written after this pass, so it is never touched).
async function rewriteEnginePaths(dir) {
  for (const name of await readdir(dir)) {
    const p = join(dir, name);
    if ((await stat(p)).isDirectory()) {
      await rewriteEnginePaths(p);
      continue;
    }
    if (!REWRITE_EXT.has(extname(p))) continue;
    const text = await readFile(p, 'utf8');
    if (!text.includes('node_modules/')) continue;
    await writeFile(p, text.replaceAll('node_modules/', ENGINE_DIR + '/'));
  }
}

async function main() {
  await rm(DIST, { recursive: true, force: true });
  await mkdir(DIST, { recursive: true });

  // Root runtime files.
  for (const name of await readdir(ROOT)) {
    if (ROOT_DENY.has(name)) continue;
    if (!RUNTIME_EXT.has(extname(name))) continue;
    await cp(join(ROOT, name), join(DIST, name), { dereference: true });
  }

  // Licensing paperwork. LICENSE has no extension and EXCEPTIONS.md is .md, so
  // both miss the RUNTIME_EXT sweep above. `npm publish dist/bundle` packs this
  // directory as the package root, and it's what cdp-plugin and cdp-extension
  // consume — their NOTICE files cite EXCEPTIONS.md as the grant letting them
  // embed this under Apache-2.0, so it has to travel with the package.
  await cp(join(ROOT, 'LICENSE'), join(DIST, 'LICENSE'));
  await cp(join(ROOT, 'EXCEPTIONS.md'), join(DIST, 'EXCEPTIONS.md'));

  // README.md likewise misses RUNTIME_EXT, and without it the GitHub Packages
  // page for every published version reads "No README data found". Its only
  // relative links are LICENSE, EXCEPTIONS.md and img/, all of which ship above.
  await cp(join(ROOT, 'README.md'), join(DIST, 'README.md'));

  // Asset dirs.
  for (const d of ASSET_DIRS) {
    if (existsSync(join(ROOT, d)))
      await cp(join(ROOT, d), join(DIST, d), { recursive: true, dereference: true });
  }

  await rewriteEnginePaths(DIST);

  // Publishable manifest. Doubles as the runtime version readout: main.js
  // fetches ./package.json for the menu-bar version. `npm publish dist/bundle`
  // packs this directory as the package root, so the bundle IS the package.
  const { name, version, description, license } = JSON.parse(
    await readFile(join(ROOT, 'package.json'), 'utf8'),
  );
  await writeFile(
    join(DIST, 'package.json'),
    JSON.stringify(
      {
        name,
        version,
        description,
        license,
        repository: { type: 'git', url: 'git+https://github.com/cdp-wasm-suite/cdp-web.git' },
        publishConfig: { registry: 'https://npm.pkg.github.com' },
      },
      null,
      2,
    ) + '\n',
  );

  // Engine subset (dereferencing the file: symlinks); ./vendor snapshot when
  // the siblings aren't installed (CI).
  let missing = 0;
  for (const rel of PKG_INCLUDE) {
    const fromNM = join(ROOT, 'node_modules', rel);
    const fromVendor = join(ROOT, 'vendor', rel);
    const src = existsSync(fromNM) ? fromNM : fromVendor;
    if (!existsSync(src)) {
      console.warn('  (skip, missing) ' + rel + '  — run `npm install` or `npm run vendor`');
      missing++;
      continue;
    }
    const dest = join(DIST, ENGINE_DIR, rel);
    await mkdir(dirname(dest), { recursive: true });
    const s = await stat(src);
    await cp(src, dest, {
      recursive: s.isDirectory(),
      dereference: true,
      // Dev-only artifacts (source maps, typings) — same policy as vendor-engine.mjs.
      filter: (p) => !p.endsWith('.map') && !p.endsWith('.d.ts'),
    });
  }
  if (missing) {
    console.error(`✗ ${missing} engine path(s) missing — refusing to build an engine-less bundle`);
    process.exit(1);
  }

  const mb = ((await dirSize(DIST)) / 1024 / 1024).toFixed(1);
  console.log(`✓ bundled cdp-web → dist/bundle/  (${mb} MB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
