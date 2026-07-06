// Vendor the WebAssembly engine into ./vendor so GitHub Pages CI can deploy
// without the sibling repos or a wasm toolchain.
//
// The runtime dependencies (@olilarkin/cdp-wasm, @olilarkin/cdp-sampler) are
// `file:` links to sibling repos whose .wasm is built locally (Emscripten) and
// never committed; @grame/faustwasm is a 29 MB npm package we only need a slice
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
  ['@olilarkin/cdp-wasm', ['src', 'wasm', 'package.json']],
  // Only the standalone worklet .wasm; the processor itself is the app's sampler-processor.js.
  ['@olilarkin/cdp-sampler', ['wasm', 'package.json']],
  // faust.js loads instantiateFaustModule() from the esm-bundle, which inlines
  // libfaust's wasm+data — so no external libfaust-wasm/ assets are needed.
  ['@grame/faustwasm', ['dist/esm-bundle', 'package.json']],
];

// Skip source maps — dead weight in the deployed bundle and git.
const skipMap = (src) => !src.endsWith('.map');

rmSync(vendor, { recursive: true, force: true });

for (const [pkg, subs] of SPECS) {
  const from = join(nodeModules, pkg);
  if (!existsSync(from)) {
    console.error(`✗ ${pkg} not found in node_modules — run \`npm install\` first (with the sibling repos present and their wasm built).`);
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
