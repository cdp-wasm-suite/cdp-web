// Vendor the WebAssembly engine into ./vendor so GitHub Pages CI can deploy
// without the sibling repos or a wasm toolchain.
//
// cdp-wasm comes from npmjs with its .wasm prebuilt; @cdp-wasm-suite/cdp-sampler
// comes from GitHub Packages (auth needed, see .npmrc); @grame/faustwasm is a
// 29 MB npm package we only need a slice
// of. CI has none of that, so we snapshot exactly the files the deployed app
// loads into ./vendor (tracked in git). The site build (build-site.mjs) copies
// ./vendor into dist/node_modules so the import map's ./node_modules/… paths
// resolve unchanged.
//
// Re-run `npm run vendor` and commit ./vendor whenever the engine changes
// (rebuilt wasm, bumped faustwasm). Run it after `npm install` so the packages
// are present in ./node_modules.

import { cpSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const nodeModules = join(root, 'node_modules');
const vendor = join(root, 'vendor');

// [package, [runtime subpaths the deployed app actually loads]]
const SPECS = [
  // src/ = ESM loader (finds wasm/ via import.meta.url); wasm/ = the CDP programs.
  ['cdp-wasm', ['src', 'wasm', 'package.json']],
  // Only the standalone worklet .wasm; the processor itself is the app's sampler-processor.js.
  ['@cdp-wasm-suite/cdp-sampler', ['wasm', 'package.json']],
  // faust.js loads instantiateFaustModule() from the esm-bundle, which inlines
  // libfaust's wasm+data — so no external libfaust-wasm/ assets are needed.
  ['@grame/faustwasm', ['dist/esm-bundle', 'package.json']],
  // Monaco's self-contained AMD build (code-editor.js loads min/vs/loader.js).
  // Only the editor core + worker/base assets; basic-languages and the
  // JSON/CSS/TS language services are never loaded (we register our own
  // 'faust' language).
  ['monaco-editor', ['min/vs/loader.js', 'min/vs/editor', 'min/vs/base', 'package.json']],
];

// Skip source maps — dead weight in the deployed bundle and git.
const skipMap = (src) => !src.endsWith('.map');

rmSync(vendor, { recursive: true, force: true });

for (const [pkg, subs] of SPECS) {
  const from = join(nodeModules, pkg);
  if (!existsSync(from)) {
    console.error(`✗ ${pkg} not found in node_modules — run \`npm install\` first.`);
    process.exit(1);
  }
  const to = join(vendor, pkg);
  mkdirSync(to, { recursive: true });
  for (const sub of subs) {
    const s = join(from, sub);
    if (!existsSync(s)) {
      console.error(`✗ ${pkg}/${sub} is missing — has the wasm been built?`);
      process.exit(1);
    }
    cpSync(s, join(to, sub), { recursive: true, dereference: true, filter: skipMap });
  }
  console.log(`✓ vendored ${pkg}`);
}

console.log('Done. Commit ./vendor so CI can deploy the engine.');
