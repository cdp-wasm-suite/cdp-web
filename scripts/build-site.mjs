// Assemble the deployable static site into ./dist/pages for GitHub Pages.
//
// The site is the app served as-is (it uses only relative paths and native ESM,
// no bundler), plus the vendored engine dropped into node_modules/ so the import
// map resolves. Pure Node fs copies — no dependencies — so CI can run it after a
// bare checkout, using the committed ./vendor snapshot (see vendor-engine.mjs).

import { cpSync, rmSync, mkdirSync, existsSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist', 'pages');
const vendor = join(root, 'vendor');

// Repo-root entries that are dev-only and never shipped. Everything else at the
// root is app content (index.html, the *.js modules, img/, audio/, fonts/).
// package.json IS shipped — main.js fetches it for the version.
const EXCLUDE = new Set([
  'node_modules', 'dist', 'vendor', 'scripts', 'design', 'docs',
  '.git', '.github', '.gitignore', '.DS_Store',
  'serve.mjs', 'README.md', 'package-lock.json',
]);

if (!existsSync(vendor)) {
  console.error('✗ ./vendor is missing — run `npm run vendor` and commit it first.');
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

// 1) app files
for (const name of readdirSync(root)) {
  if (EXCLUDE.has(name)) continue;
  cpSync(join(root, name), join(out, name), { recursive: true, dereference: true });
}

// 2) vendored engine → dist/pages/node_modules (matches the import map's ./node_modules/… paths)
cpSync(vendor, join(out, 'node_modules'), { recursive: true });

// 3) tell Pages to serve the tree verbatim (no Jekyll, which would drop node_modules/ and dotfiles)
writeFileSync(join(out, '.nojekyll'), '');

console.log('✓ built static site → dist/pages/');
