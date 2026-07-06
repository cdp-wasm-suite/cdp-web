#!/usr/bin/env node
// Assemble a self-contained static build of cdp-web into `dist/bundle/`, suitable
// for embedding in a native WebView host (the Ableton Live extension, the VST
// plugin) or for hosting on any static file server.
//
// The `node_modules/…` layout is preserved verbatim so the import map in
// index.html and the sampler's WASM_URL resolve without rewriting. Symlinked
// `file:` dependencies (@olilarkin/cdp-wasm, @olilarkin/cdp-sampler) are
// dereferenced into the bundle.
//
// Usage:  node scripts/bundle.mjs   (or: npm run bundle)

import { rm, mkdir, readdir, cp, stat, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist', 'bundle');
const NM = 'node_modules';

// Root files to include, by extension. Dev-only files are denied explicitly.
// manual.json is fetched at runtime by manual.js (`fetch('./manual.json')`); the
// package.json files are handled separately (slim copy written below / dev-only),
// so deny them here to avoid shipping the full manifest + lockfile.
const RUNTIME_EXT = new Set(['.js', '.html', '.svg', '.png', '.css', '.ico', '.woff2', '.ttf', '.json']);
const ROOT_DENY = new Set(['serve.mjs', 'package.json', 'package-lock.json']);

// Runtime asset dirs copied wholesale.
//   - audio/ : the bundled CDP demo sounds that the "Sound files" recipes (and
//     the additive/inharmonic synthesis recipes) fetch via `audio/<name>.wav`.
//   - img/   : logo/banner images referenced by index.html (./img/…).
const ASSET_DIRS = ['fonts', 'audio', 'src', 'img'];

// node_modules subset — only what the app loads at runtime.
//   - cdp-wasm src/ + wasm/ : the engine loader finds its .wasm assets via
//     `new URL('../wasm/', import.meta.url)`, so src/ and wasm/ must stay siblings.
//   - cdp-sampler wasm/     : the AudioWorklet DSP (sampler.js WASM_URL).
//   - faustwasm esm-bundle  : the in-browser Faust compiler (~7.3 MB, inlines
//     libfaust). It loads lazily via a guarded dynamic import (faust.js), so
//     dropping it from this list just makes Faust features fail gracefully —
//     but for now every consumer ships it.
const PKG_INCLUDE = [
  '@olilarkin/cdp-wasm/src',
  '@olilarkin/cdp-wasm/wasm',
  '@olilarkin/cdp-wasm/package.json',
  '@olilarkin/cdp-sampler/wasm',
  '@olilarkin/cdp-sampler/package.json',
  '@grame/faustwasm/dist/esm-bundle',
  '@grame/faustwasm/package.json',
];

async function dirSize(p) {
  let total = 0;
  const st = await stat(p);
  if (!st.isDirectory()) return st.size;
  for (const name of await readdir(p)) total += await dirSize(join(p, name));
  return total;
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

  // Asset dirs.
  for (const d of ASSET_DIRS) {
    if (existsSync(join(ROOT, d)))
      await cp(join(ROOT, d), join(DIST, d), { recursive: true, dereference: true });
  }

  // Slim package.json: main.js fetches ./package.json for the menu-bar version
  // readout; ship only the identity fields, not scripts/deps metadata.
  const { name, version } = JSON.parse(await readFile(join(ROOT, 'package.json'), 'utf8'));
  await writeFile(join(DIST, 'package.json'), JSON.stringify({ name, version }, null, 2) + '\n');

  // node_modules subset (dereferencing the file: symlinks).
  for (const rel of PKG_INCLUDE) {
    const src = join(ROOT, NM, rel);
    if (!existsSync(src)) {
      console.warn('  (skip, missing) ' + rel + '  — did you run `npm install`?');
      continue;
    }
    const dest = join(DIST, NM, rel);
    await mkdir(dirname(dest), { recursive: true });
    const s = await stat(src);
    await cp(src, dest, {
      recursive: s.isDirectory(),
      dereference: true,
      // Dev-only artifacts (source maps, typings) — same policy as vendor-engine.mjs.
      filter: (p) => !p.endsWith('.map') && !p.endsWith('.d.ts'),
    });
  }

  const mb = ((await dirSize(DIST)) / 1024 / 1024).toFixed(1);
  console.log(`✓ bundled cdp-web → dist/bundle/  (${mb} MB)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
