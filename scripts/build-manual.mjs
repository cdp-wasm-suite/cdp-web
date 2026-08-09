// Build ./manual.json — the browsable manual shown from Help ▸ Manual.
//
// Source: the generated markdown archive in the cdp-wasm repo
// (docs/effects/*.md, docs/generators.md, docs/guide/*.md, plus the index
// READMEs). Those pages are themselves generated from the catalog + CDP
// reference, so this manual can never drift from the effects the app exposes.
//
// Those docs are NOT in the published npm package (they'd carry CDP's own
// reference prose into every install, and they're 640 KB), so regenerating the
// manual needs a checkout of cdp-wasm beside this repo. That makes this a
// maintainer-only step — manual.json is committed, so a plain `npm install`
// clone builds and runs the app without it.
//
// We pre-render markdown → HTML here (Node), not in the browser: the doc set is
// a controlled, generated subset of markdown, so a compact converter covers it
// and the app ships no markdown parser. Internal links (`effects/blur.md#anchor`,
// `#anchor`, `../README.md`) are resolved at build time to data-page/data-anchor
// attributes, so the viewer only has to read those — no path juggling at runtime.
//
// manual.json is a committed, derived artifact (like ./vendor): re-run
// `npm run docs:manual` and commit it whenever the cdp-wasm docs change. The site
// build copies repo-root files into dist/, so no extra wiring is needed to ship it.

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RECIPES } from '../src/data/recipes.js';
import { EFFECTS, GENERATORS, effectsByCategory } from 'cdp-wasm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// The sibling checkout is the only place these live now; the node_modules and
// vendor paths are kept as fallbacks in case the package ever ships docs again.
const DOCS = [
  join(root, '../cdp-wasm/docs'),
  join(root, 'node_modules/cdp-wasm/docs'),
  join(root, 'vendor/cdp-wasm/docs'),
].find((p) => existsSync(p));

if (!DOCS) {
  console.error('✗ cdp-wasm docs not found — they are not part of the npm package.');
  console.error('  Clone the repo beside this one to regenerate the manual:');
  console.error('    git clone https://github.com/cdp-wasm-suite/cdp-wasm ../cdp-wasm');
  console.error('  (manual.json is committed, so this is only needed when the docs change.)');
  process.exit(1);
}

// ---- collect the curated markdown (everything except the tools/ pipeline) -----
function walk(dir, rel = '') {
  const out = [];
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const r = rel ? posix.join(rel, name) : name;
    if (statSync(abs).isDirectory()) {
      if (name === 'tools') continue; // harvest intermediates + build scripts — not for readers
      if (name === 'internal') continue; // engine-internal notes — never user-facing
      out.push(...walk(abs, r));
    } else if (name.endsWith('.md')) {
      out.push(r);
    }
  }
  return out;
}

// Repo-local, user-authored overlay. Pages here override the cdp-wasm base by
// slug (e.g. a friendly Overview replaces the package's dev README) and add
// app-only topics the engine docs don't cover (e.g. the Faust nodes).
const LOCAL = join(root, 'manual');

// CDP's own reference prose ends many sections with a bare "SEE ALSO: HILITE
// TRACE, BLUR SUPPRESS" — program names in capitals, never markdown links, so in
// the manual they read as cross-references you can't follow. Turn the ones this
// app actually exposes into links: a "PROGRAM MODE" pair becomes that effect's
// entry, a lone "PROGRAM" its page. Everything else — CDP programs cdp-wasm
// doesn't ship, mode numbers, ordinary prose — is left as plain text, which is
// why the match is deliberately narrow (runs of capitals only, longest first).
const EXPOSED_PROGRAMS = new Set(EFFECTS.map((e) => e.program));
const EXPOSED_IDS = new Set(EFFECTS.map((e) => e.id));
function linkifySeeAlso(md, fileRel) {
  const prefix = fileRel.startsWith('effects/') ? '' : 'effects/';
  return md.replace(/^(.*\bSEE ALSO:?\s*)(.*)$/gim, (whole, head, tail) =>
    /\]\(/.test(tail) ? whole : // already-linked prose (the index pages) — leave alone
    head + tail.replace(/\b[A-Z][A-Z0-9]+(?:\s+[A-Z][A-Z0-9]+)?\b/g, (words) => {
      const [a, b] = words.split(/\s+/).map((w) => w.toLowerCase());
      if (b && EXPOSED_IDS.has(`${a}.${b}`)) return `[${words}](${prefix}${a}.md#${a}.${b})`;
      const [first] = words.split(/\s+/);
      // A bare program name on its own page would link the reader back to where
      // they already are ("SEE ALSO: PULSER MULTI" on the pulser page) — leave it.
      const target = posix.join(posix.dirname(fileRel), `${prefix}${first.toLowerCase()}.md`);
      if (EXPOSED_PROGRAMS.has(first.toLowerCase()) && target !== fileRel)
        return `[${first}](${prefix}${first.toLowerCase()}.md)` + words.slice(first.length);
      return words;
    }));
}

// Strip generator/package boilerplate from the cdp-wasm base pages so the manual
// reads for musicians, not maintainers: the "do not edit" stamp on every page,
// the per-effect ".htm / exposed cdp-wasm surface" note, and the generators
// intro's package internals. Best-effort — if upstream rewording stops a pattern
// matching, the page still builds, just with the original line.
function clean(md, fileRel) {
  md = linkifySeeAlso(md, fileRel);
  md = md
    // dev "do not edit" stamp on every generated page
    .replace(/\n+(?:---\n+)?_Generated by[^\n]*_\s*$/i, '')
    // per-effect ".htm" provenance note (a maintainer's citation, not a reader's)
    .replace(/^Reference distilled from CDP[^\n]*\n\n?/im, '')
    // The work-in-progress banner the cdp-wasm docs carry (docs/tools/wip-banner.mjs)
    // is deliberately kept, not stripped: while the reference is still being checked
    // against CDP's manual, a reader in the app has the same reason to know as a
    // reader on GitHub. It renders as a blockquote at the top of each page.
    // generator-page package internals → plain, app-facing wording ("each arg
    // template" was the old single-page generators.md; the split per-program
    // pages say "the arg template")
    .replace(/ \(`GENERATORS` in the package, run by `applyGenerator`\)/, '')
    .replace(/ The output sample rate follows `applyGenerator`[’'`]s `extra\.sampleRate`[\s\S]*?token in (?:each|the) arg template\./,
      ' Output is rendered at the session sample rate (set in Options ▸ Sample rate).')
    // data-file generators: "…staged as the generator’s data file (`applyGenerator`’s
    // `extra.data`)" — drop the API parenthetical, keep the sentence
    .replace(/\s*\(`applyGenerator`[’'`]s `extra\.data`\)/g, '');

  // Everything below rewrites *hand-written* prose that mixes concepts with npm
  // package API. Effect and generator pages are generated from the catalog and
  // carry no dev material — but they do now carry fenced CDP command lines
  // (the "How this maps to CDP" block), and the package-example stripper below
  // matches any block mentioning `cdp-wasm`. Running it over them would delete
  // exactly the thing a CDP user opens the page for.
  if (/^(effects|generators)\//.test(fileRel)) return md;

  // Conceptual guides carry developer material (npm package API) alongside the
  // concepts. Keep the concepts, drop the dev bits: remove the pure-API section
  // (redundant with the in-app one), reframe the "what the library does" heading,
  // strip package code examples + dev-file links, and trim known dev asides.
  md = md.split(/(?=^## )/m)
    .filter((s) => !/^## Using an envelope from the package/i.test(s))
    .join('');
  md = md
    .replace(/^## What cdp-wasm does for you/im, '## What happens automatically')
    // package code examples
    .replace(/```[a-z]*\n[\s\S]*?```\n?/g, (b) =>
      /\bcdp-wasm\b|applyEffect|applyGenerator|cdp\.|EFFECTS\.find/.test(b) ? '' : b)
    // dev-file links → plain text, then remove the now-bare dev parentheticals
    .replace(/\[([^\]]+)\]\((?:\.\.\/)*npm\/[^)]*\)/g, '$1')
    .replace(/\s*\(see `npm\/[^`]*`\)/g, '')
    .replace(/\s*\(auto-generated by `[^`]*`\)/g, '')
    // implementation asides (whole sentences), removed once their links are gone
    .replace(/\s*The set is\s+probed per effect into[\s\S]*?probe-breakpoints\.mjs`\)\./, '')
    .replace(/,?\s*but if you are building long spectral chains by hand[\s\S]*?wrapping is done\./, '.')
    .replace(/\s*The\s+primitive\s+behind\s+this\s+is\s+`cdp\.[^`]*`\s*\./, '')
    // reframe library-API actors for app users (whitespace-flexible: the source
    // prose wraps mid-sentence, so match \s+ between words rather than literal spaces)
    .replace(/When\s+you\s+call\s+`applyEffect\(\)`\s+\(or\s+load\s+the\s+effect\s+in\s+a\s+consuming\s+app\)\s+the\s+package\s+runs/g, 'The app runs')
    .replace(/Every\s+catalog\s+effect\s+marked\s+`domain: 'spectral'`\s+is/g, 'Every spectral effect is')
    .replace(/`applyEffect\(\)`/g, 'the app')
    .replace(/`applyGenerator\(\)`/g, 'the app')
    .replace(/`mono: true` effect/g, 'mono-only effect')
    .replace(/the\s+package\s+conforms\s+the\s+second\s+source[’']s[\s\S]*?need\s+them\s+directly\./,
      "the app conforms the second source’s sample rate and channel count to the first, so the two sounds are compatible.");
  return md;
}

// ---- markdown → HTML (the subset these generated docs actually use) ----------
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// GitHub-style heading slug, so links the docs write as `interface.md#the-log`
// have something to land on: lowercase, inline markup dropped, punctuation and
// symbols removed (em dashes, quotes, ⠿), spaces → hyphens. `seen` is per page,
// and repeats get a numeric suffix the way GitHub does (every effect page has
// several "Parameters" headings).
//
// Headings carry the slug as data-id, NOT id: the manual is injected into the
// running app's document, where a plain id would join the app's own id namespace
// and pick up its #id styling — `## Cables` in interface.md landed on
// `#cables { position: absolute; inset: 0 }`, the patcher's cable overlay, and
// the heading flew out of the manual window. data-id keeps the anchor space
// private; manual.js looks anchors up with the matching attribute selector.
function slugify(text, seen) {
  const base = text
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]*)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, '')
    .replace(/\s/g, '-');
  let slug = base;
  for (let n = 1; seen.has(slug); n++) slug = `${base}-${n}`;
  seen.add(slug);
  return slug;
}

// Resolve a link target found in `fileRel` to { external | page | anchor }.
function resolveTarget(fileRel, target) {
  if (/^https?:/i.test(target)) return { external: true, url: target };
  if (target.startsWith('#')) return { anchor: target.slice(1) }; // same-page anchor
  const [pathPart, anchor] = target.split('#');
  let abs = posix.normalize(posix.join(posix.dirname(fileRel), pathPart));
  if (abs.endsWith('/')) abs += 'README'; // directory link → its index page
  return { page: abs.replace(/\.md$/, ''), anchor: anchor || null };
}

// Inline spans. Code spans are pulled out to a side list and replaced with a
// sentinel (U+FFFC — can't occur in the docs and carries no markdown-significant
// characters), so the link/bold/italic passes run over the whole line — bold that
// wraps a code span (`**\`yes\`**`) still works — then the code is restored last.
// Everything outside code is trusted generated prose, left as-is so its literal
// HTML entities survive.
const SENTINEL = String.fromCharCode(0xFFFC); // U+FFFC
function inline(text, fileRel) {
  const codes = [];
  text = text.replace(/`([^`]+)`/g, (_, c) => {
    codes.push('<code>' + escapeHtml(c) + '</code>');
    return SENTINEL + (codes.length - 1) + SENTINEL;
  });
  text = text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, target) => {
      const r = resolveTarget(fileRel, target.trim());
      if (r.external) return `<a href="${r.url}" target="_blank" rel="noopener">${label}</a>`;
      const attrs = ['href="#"'];
      if (r.page) attrs.push(`data-page="${r.page}"`);
      if (r.anchor) attrs.push(`data-anchor="${r.anchor}"`);
      return `<a ${attrs.join(' ')}>${label}</a>`;
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // underscore italics, only when the underscores sit on word boundaries (so
    // identifiers like convert_to_midi are left alone)
    .replace(/(^|[^\w])_([^_]+)_(?=$|[^\w])/g, '$1<em>$2</em>');
  return text.replace(new RegExp(SENTINEL + '(\\d+)' + SENTINEL, 'g'), (_, n) => codes[+n]);
}

function renderTable(rows, fileRel) {
  const cells = (r) => r.trim().replace(/^\|/, '').replace(/\|\s*$/, '').split('|').map((c) => c.trim());
  const head = cells(rows[0]).map((c) => `<th>${inline(c, fileRel)}</th>`).join('');
  const body = rows.slice(2).map((r) => '<tr>' + cells(r).map((c) => `<td>${inline(c, fileRel)}</td>`).join('') + '</tr>').join('');
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function convert(md, fileRel) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  const seen = new Set(); // ids already used on this page (explicit anchors + headings)
  let para = [];
  const flush = () => { if (para.length) { out.push('<p>' + inline(para.join(' '), fileRel) + '</p>'); para = []; } };
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('```')) {
      flush(); i++;
      const code = [];
      while (i < lines.length && !lines[i].startsWith('```')) { code.push(lines[i]); i++; }
      i++; // closing fence
      out.push('<pre><code>' + escapeHtml(code.join('\n')) + '</code></pre>');
    } else if (line.trimStart().startsWith('|')) {
      flush();
      const rows = [];
      while (i < lines.length && lines[i].trimStart().startsWith('|')) { rows.push(lines[i]); i++; }
      out.push(renderTable(rows, fileRel));
    } else if (/^(#{1,6})\s+(.*)$/.test(line)) {
      flush();
      const [, hashes, rest] = /^(#{1,6})\s+(.*)$/.exec(line);
      const id = slugify(rest, seen);
      out.push(`<h${hashes.length} data-id="${id}">${inline(rest, fileRel)}</h${hashes.length}>`);
      i++;
    } else if (/^---+\s*$/.test(line)) {
      flush(); out.push('<hr>'); i++;
    } else if (/^<a\b/.test(line.trim())) {
      flush(); // pass through <a id="…"></a> anchors, reserving their id
      const explicit = /\bid="([^"]+)"/.exec(line.trim());
      if (explicit) seen.add(explicit[1]);
      out.push(line.trim().replace(/\bid="/, 'data-id="')); i++;
    } else if (line.startsWith('>')) {
      flush();
      const bq = [];
      while (i < lines.length && lines[i].startsWith('>')) { bq.push(lines[i].replace(/^>\s?/, '')); i++; }
      out.push('<blockquote>' + inline(bq.join(' '), fileRel) + '</blockquote>');
    } else if (/^-\s+/.test(line)) {
      flush();
      // An item may wrap onto indented continuation lines (the hand-written pages
      // wrap at ~80 columns); those belong to the item above, not to a paragraph
      // after the list. An indented line that is itself a bullet would be a nested
      // list — not used in these docs, so it ends the list rather than being
      // silently folded into the previous item.
      const items = [];
      while (i < lines.length) {
        if (/^-\s+/.test(lines[i])) items.push(lines[i].replace(/^-\s+/, ''));
        else if (items.length && /^\s+\S/.test(lines[i]) && !/^\s+[-*]\s+/.test(lines[i])) items[items.length - 1] += ' ' + lines[i].trim();
        else break;
        i++;
      }
      out.push('<ul>' + items.map((it) => '<li>' + inline(it, fileRel) + '</li>').join('') + '</ul>');
    } else if (line.trim() === '') {
      flush(); i++;
    } else {
      para.push(line.trim()); i++;
    }
  }
  flush();
  return out.join('\n');
}

// Plain-text H1, for nav labels and the page heading.
function h1Title(md) {
  const m = /^#\s+(.*)$/m.exec(md);
  if (!m) return '';
  return m[1].replace(/`/g, '').replace(/\*\*/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').trim();
}

// ---- Recipes page (generated from recipes.js, kept in sync with the app) ------
// The 36 File ▸ Recipes patches, grouped by category, each with a readable signal
// flow and links to the effects it uses. Generated (not authored) so it can't drift
// from recipes.js. Effect links are flat (effects/<program>#<id>) so they resolve
// in the manual's slug space.
const byProgram = Object.fromEntries(EFFECTS.map((e) => [e.id, e]));
const GEN_LABEL = { wave: 'Waveform', noise: 'White noise', impulse: 'Impulse train', multiosc: 'Nested osc', chord: 'Chord', clicks: 'Clicks', synspline: 'Spline synth', chirikov: 'Chirikov' };
function recipeFlow(r) {
  const node = (id) => r.nodes.find((n) => n.id === id);
  const back = (id) => r.edges.find((e) => e.to.node === id && e.to.port === 'in')
    || r.edges.find((e) => e.to.node === id && (e.to.port === 'bank' || e.to.port === 'in1'));
  const chain = [];
  let cur = r.nodes.find((n) => n.type === 'output');
  while (cur) { chain.unshift(cur); const e = back(cur.id); cur = e ? node(e.from.node) : null; }
  const label = (n) =>
    n.type === 'generator' ? (GEN_LABEL[n.gen.id] || n.gen.id)
      : n.type === 'transform' ? `\`${n.effectId}\``
      : n.type === 'pvocAnalyse' ? 'pvoc anal'
      : n.type === 'pvocResynth' ? 'pvoc synth'
      : n.type === 'output' ? 'Output'
      : n.type === 'source' ? (n.source?.name ? `${n.source.name}.wav` : 'Source (file)')
      : n.type === 'faust' ? `Faust ${n.faust?.kind || ''}`.trim()
      : n.type === 'pick' ? 'Pick'
      : n.type === 'gather' ? 'Gather'
      : n.type;
  const two = r.edges.some((e) => e.to.port === 'in2');
  return chain.map(label).join(' → ') + (two ? '  _(+ 2nd source)_' : '');
}
function recipesMarkdown() {
  const md = ['# Recipes', '',
    `${RECIPES.length} ready-made patches, loadable from **File ▸ Recipes**. Each is `
    + `self-contained — a synth generator (or a bundled sound) feeds the chain — so `
    + `pressing **▶** on the Output renders audio right away. Open one to hear it, then `
    + `tweak any node, or swap in your own sound with **File ▸ Add source**.`, ''];
  let cat = null;
  for (const r of RECIPES) {
    const c = r.metadata?.category || 'Other';
    if (c !== cat) { md.push(`## ${c}`, ''); cat = c; }
    const uses = [...new Set(r.nodes.filter((n) => n.type === 'transform').map((n) => n.effectId))];
    const links = uses.map((id) => `[\`${id}\`](effects/${byProgram[id]?.program}.md#${id})`).join(', ') || '—';
    md.push(`### ${r.metadata?.name || 'Recipe'}`, '', r.metadata?.description || '', '',
      `**Signal flow:** ${recipeFlow(r)}`, '', `**Uses:** ${links}`, '');
  }
  return md.join('\n');
}

// ---- render every page -------------------------------------------------------
// Base (cdp-wasm, cleaned) first, then the repo-local overlay so its pages win.
const sources = [
  // data-programs.md is a maintainer survey of not-yet-wrapped CDP programs
  // (what could be exposed, spot-check status) — roadmap material, not reader
  // material, so it stays out of the manual.
  ...walk(DOCS).filter((rel) => rel !== 'data-programs.md').map((rel) => ({ rel, dir: DOCS, base: true })),
  ...(existsSync(LOCAL) ? walk(LOCAL).map((rel) => ({ rel, dir: LOCAL, base: false })) : []),
];

const pages = {};
let overrides = 0;
for (const { rel, dir, base } of sources) {
  const slug = rel.replace(/\.md$/, '');
  if (!base && pages[slug]) overrides++;
  let md = readFileSync(join(dir, rel), 'utf8');
  if (base) md = clean(md, rel);
  pages[slug] = { title: h1Title(md) || slug, html: convert(md, rel) };
}

// Generated Recipes page (data-driven, so it lives here rather than in manual/).
pages.recipes = { title: 'Recipes', html: convert(recipesMarkdown(), 'recipes.md') };

// Release notes: the app's CHANGELOG plus the engine's (shipped in its npm
// files), each as a manual page. Titles set explicitly — both files' h1 is
// just "Changelog".
//
// A changelog written for a repo links to files beside it there — EXCEPTIONS.md,
// the two LICENSEs — which the manual does not ship and never should. Point them
// at the public repo instead of leaving relative paths the audit below would
// flatten into dead plain text: the licensing note is exactly the sentence a
// reader wants to follow.
const REPO_FILES = {
  'cdp-web': 'https://github.com/cdp-wasm-suite/cdp-web/blob/main/',
  'cdp-wasm': 'https://github.com/cdp-wasm-suite/cdp-wasm/blob/main/',
};
const linkRepoFiles = (md, base) => md.replace(/\]\((?!https?:|#)\.?\/?([^)]+)\)/g, `](${base}$1)`);

const appLog = join(root, 'CHANGELOG.md');
if (existsSync(appLog))
  pages['release-notes'] = { title: 'cdp-web release notes', html: convert(linkRepoFiles(readFileSync(appLog, 'utf8'), REPO_FILES['cdp-web']), 'CHANGELOG.md') };
const engineLog = [
  join(root, 'node_modules/cdp-wasm/CHANGELOG.md'),
  join(root, 'vendor/cdp-wasm/CHANGELOG.md'),
].find((p) => existsSync(p));
if (engineLog)
  pages['release-notes-engine'] = { title: 'cdp-wasm engine release notes', html: convert(linkRepoFiles(readFileSync(engineLog, 'utf8'), REPO_FILES['cdp-wasm']), 'CHANGELOG.md') };

// ---- internal link audit -----------------------------------------------------
// Links are resolved while each page is converted, when the finished page set is
// not yet known. Anything that turns out to point nowhere — a page the manual
// doesn't ship (the changelogs link to LICENSE / EXCEPTIONS in their repos) or a
// heading that doesn't exist — would render as underlined text that silently does
// nothing when clicked, so it is flattened back to plain text and reported here.
function auditLinks(pages) {
  const idsOf = Object.fromEntries(Object.entries(pages).map(([slug, p]) =>
    [slug, new Set([...p.html.matchAll(/\bdata-id="([^"]+)"/g)].map((m) => m[1]))]));
  const broken = [];
  for (const [slug, p] of Object.entries(pages)) {
    p.html = p.html.replace(/<a ([^>]*)>([\s\S]*?)<\/a>/g, (whole, attrs, label) => {
      const page = (attrs.match(/data-page="([^"]*)"/) || [])[1];
      const anchor = (attrs.match(/data-anchor="([^"]*)"/) || [])[1];
      if (!page && !anchor) return whole; // external link, or an <a id="…"> anchor
      if (page && !pages[page]) {
        broken.push(`${slug} → ${page}${anchor ? '#' + anchor : ''} (no such page)`);
        return label;
      }
      if (anchor && !idsOf[page || slug].has(anchor)) {
        broken.push(`${slug} → ${page || slug}#${anchor} (no such heading)`);
        // Keep the cross-page jump if the page itself is real; drop the anchor.
        return page ? `<a href="#" data-page="${page}">${label}</a>` : label;
      }
      return whole;
    });
  }
  return broken;
}

const broken = auditLinks(pages);
if (broken.length) {
  console.warn(`⚠ ${broken.length} internal link(s) pointed nowhere and were flattened:`);
  for (const b of [...new Set(broken)]) console.warn('    ' + b);
}

// ---- catalog index (the app's own names) -------------------------------------
// The manual's pages are named after CDP programs (`modify`, `blur`) because
// that is how CDP's own reference is organised — but the Process / Generate
// menus show the catalog's curated labels ("Transpose (speed)") in curated
// categories, so a reader who saw a name in a menu has nothing to look it up
// under. Emit the catalog's view of the same entries — label, category, id, and
// the page + anchor they already live at — so the viewer can list them either
// way and its filter can match either vocabulary. No new prose is generated:
// every entry points at a heading that exists on a program page, and the ones
// that don't resolve are dropped and reported rather than shipped as dead links.
const headingIds = Object.fromEntries(Object.entries(pages).map(([slug, p]) =>
  [slug, new Set([...p.html.matchAll(/\bdata-id="([^"]+)"/g)].map((m) => m[1]))]));

function catalogIndex(entries, dir) {
  const out = [], orphans = [];
  for (const e of entries) {
    const page = `${dir}/${e.program}`;
    if (!headingIds[page]?.has(e.id)) { orphans.push(`${e.id} → ${page}#${e.id}`); continue; }
    out.push({ label: e.label, id: e.id, category: e.category, blurb: e.blurb || '', page, anchor: e.id });
  }
  if (orphans.length) {
    console.warn(`⚠ ${orphans.length} catalog entr(ies) have no manual heading and were left out of the index:`);
    for (const o of orphans) console.warn('    ' + o);
  }
  return out;
}

// Effects follow the Process/PVOC menus' category order, generators the Generate
// menu's — so browsing by name matches the order the menus present.
const index = {
  effects: catalogIndex([...effectsByCategory().values()].flat(), 'effects'),
  generators: catalogIndex(GENERATORS, 'generators'),
};

// ---- nav sidebar -------------------------------------------------------------
const has = (slug) => Object.prototype.hasOwnProperty.call(pages, slug);
const entry = (slug, label) => ({ slug, label: label || pages[slug].title });

// The Guide's reading order is the one its own index page sets out, read back
// off that page's links — a hand-kept list here drifts silently the moment a
// guide is added (which is how "The catalog and CDP" came to open the index page
// while sitting last in the sidebar). Anything the index doesn't mention is
// appended alphabetically rather than dropped.
const guideOrder = ['guide/README', ...new Set([...(pages['guide/README']?.html || '')
  .matchAll(/data-page="(guide\/[^"#]+)"/g)].map((m) => m[1]))];
const guideSlugs = Object.keys(pages).filter((s) => s.startsWith('guide/'));
guideSlugs.sort((a, b) => {
  const ia = guideOrder.indexOf(a), ib = guideOrder.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b);
});
const unlisted = guideSlugs.filter((s) => !guideOrder.includes(s));
if (unlisted.length) console.warn(`⚠ guide page(s) not linked from guide/README — listed last: ${unlisted.join(', ')}`);

const effectSlugs = Object.keys(pages)
  .filter((s) => s.startsWith('effects/') && s !== 'effects/README')
  .sort();

const generatorSlugs = Object.keys(pages)
  .filter((s) => s.startsWith('generators/') && s !== 'generators/README')
  .sort();

const nav = [];
if (has('README')) nav.push({ title: null, pages: [entry('README', 'Overview')] });
if (has('interface')) nav.push({ title: null, pages: [entry('interface', 'The patcher')] });
// Next to the patcher: patches come and go by file, link and QR code, and until
// now that page was reachable only from prose links inside Overview / The patcher.
if (has('sharing')) nav.push({ title: null, pages: [entry('sharing', 'Saving & sharing')] });
if (guideSlugs.length) nav.push({ title: 'Guide', pages: guideSlugs.map((s) => entry(s)) });
if (has('recipes')) nav.push({ title: 'Recipes', pages: [entry('recipes', 'Recipes')] });
if (has('faust')) nav.push({ title: 'Faust', pages: [entry('faust')] });
if (has('pwa')) nav.push({ title: 'Web App', pages: [entry('pwa')] });
const hostPages = [];
if (has('extension')) hostPages.push(entry('extension', 'Extension'));
if (has('plugin')) hostPages.push(entry('plugin', 'Plugin'));
if (hostPages.length) nav.push({ title: 'In a DAW', pages: hostPages });
const relPages = [];
if (has('release-notes')) relPages.push(entry('release-notes', 'cdp-web'));
if (has('release-notes-engine')) relPages.push(entry('release-notes-engine', 'cdp-wasm engine'));
if (relPages.length) nav.push({ title: 'Release notes', pages: relPages });
// Last, and in this order: `key` marks the two catalog sections, which the
// viewer shows under its Reference tab (effects first — it's what most readers
// come for) and can relist by catalog name from index.effects / index.generators.
if (effectSlugs.length) {
  const effectPages = [];
  if (has('effects/README')) effectPages.push(entry('effects/README', 'All effects'));
  effectPages.push(...effectSlugs.map((s) => entry(s)));
  nav.push({ title: 'Effects', key: 'effects', pages: effectPages });
}
if (generatorSlugs.length) {
  const generatorPages = [];
  if (has('generators/README')) generatorPages.push(entry('generators/README', 'All generators'));
  generatorPages.push(...generatorSlugs.map((s) => entry(s)));
  nav.push({ title: 'Generators', key: 'generators', pages: generatorPages });
}

const manual = {
  generated: 'run `npm run docs:manual` to regenerate — do not edit by hand',
  home: has('README') ? 'README' : Object.keys(pages)[0],
  nav,
  index,
  pages,
};

const OUT = join(root, 'manual.json');
const json = JSON.stringify(manual);
const suffix = existsSync(LOCAL) ? ` (+${overrides} local override(s) from manual/)` : '';

// --check: verify the committed manual.json matches what we'd generate, and
// change nothing. manual.json is a derived artifact that is committed (the app
// fetches it at runtime), so it goes stale silently whenever a CHANGELOG or a
// manual/ page is edited without re-running this. `npm test` runs this mode.
if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;
  if (current === json) {
    console.log(`✓ manual.json is up to date — ${Object.keys(pages).length} pages${suffix}`);
    process.exit(0);
  }
  console.error('✗ manual.json is out of date — regenerate and commit it:');
  console.error('    npm run docs:manual');
  if (current === null) {
    console.error('  (no manual.json on disk)');
  } else {
    // Name the pages that differ, so the failure says what actually drifted.
    let before = {};
    try { before = JSON.parse(current).pages ?? {}; } catch { /* unparseable — treat as all-changed */ }
    const keys = [...new Set([...Object.keys(before), ...Object.keys(pages)])];
    const drifted = keys.filter((k) => JSON.stringify(before[k]) !== JSON.stringify(pages[k]));
    if (drifted.length) console.error(`  pages differing: ${drifted.join(', ')}`);
  }
  process.exit(1);
}

writeFileSync(OUT, json);
console.log(`✓ manual.json — ${Object.keys(pages).length} pages${suffix}`);
