// Assemble the deployable static site into ./dist/pages for GitHub Pages.
//
// The site is the app served as-is (it uses only relative paths and native ESM,
// no bundler), plus the vendored engine dropped into node_modules/ so the import
// map resolves. Pure Node fs copies — no dependencies — so CI can run it after a
// bare checkout, using the committed ./vendor snapshot (see vendor-engine.mjs).

import { cpSync, rmSync, mkdirSync, existsSync, writeFileSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, dirname, extname, relative, sep } from 'node:path';
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

// 4) custom domain. The Actions deploy uploads this tree as the whole site, so
// the CNAME has to ship inside it — otherwise the domain lives only in the
// repo's Pages settings and is lost if those are ever reset.
writeFileSync(join(out, 'CNAME'), 'cdp-web.app\n');

// 5) offline support. sw.js seeds its cache from sw-precache.json at install —
// the full set of runtime files, walked from the output tree, because a page
// load alone only fetches what it touches (the 240-odd per-program .wasm
// binaries, the Faust compiler and the manual all load on demand). Left out:
// the Monaco editor (4 MB of many small files for one advanced feature — it is
// runtime-cached the first time the code editor opens) and the demo rig.
// The release version is stamped into sw.js so each deploy's worker differs
// byte-wise from the last: the browser then re-runs its install and seeds any
// files the release added. (See sw.js for why the cache *name* stays fixed.)
const PRECACHE_ROOTS = ['src', 'img', 'fonts', 'audio', 'manual', 'recipes', 'node_modules'];
const PRECACHE_FILES = ['index.html', 'manifest.webmanifest', 'package.json', 'manual.json', 'sw.js'];
const RUNTIME_EXT = new Set(['.js', '.mjs', '.wasm', '.json', '.html', '.css',
  '.woff2', '.ttf', '.png', '.svg', '.ico', '.wav', '.webmanifest']);
const precache = ['./'];   // the shell as navigations request it
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!RUNTIME_EXT.has(extname(name))) continue;   // drops .d.ts, .md, .map
    precache.push('./' + relative(out, p).split(sep).join('/'));
  }
};
for (const name of PRECACHE_FILES) if (existsSync(join(out, name))) precache.push('./' + name);
for (const name of PRECACHE_ROOTS) {
  if (name === 'node_modules') {
    // Vendored engine packages only — everything but monaco-editor.
    for (const pkg of ['cdp-wasm', '@grame/faustwasm', '@cdp-wasm-suite/cdp-sampler']) {
      const p = join(out, 'node_modules', pkg);
      if (existsSync(p)) walk(p);
    }
  } else if (existsSync(join(out, name))) walk(join(out, name));
}
writeFileSync(join(out, 'sw-precache.json'), JSON.stringify(precache, null, 1) + '\n');

const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version || 'dev';
const swPath = join(out, 'sw.js');
writeFileSync(swPath, readFileSync(swPath, 'utf8').replace("const VERSION = 'dev'", `const VERSION = '${version}'`));

console.log(`✓ built static site → dist/pages/  (sw precache: ${precache.length} files, v${version})`);
