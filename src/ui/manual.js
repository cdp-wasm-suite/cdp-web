// Browsable CDP manual, opened from Help ▸ Manual.
//
// Content is ./manual.json (built by scripts/build-manual.mjs from the cdp-wasm
// docs archive): a nav tree plus one pre-rendered HTML page per topic. Internal
// links were resolved to data-page / data-anchor attributes at build time, so
// navigation here is just reading those — no markdown parser, no path juggling.
// The overlay markup + styles live in index.html (#manualBox / .manual-*).
//
// The sidebar has two tabs over the one document: **Manual** (overview, guides,
// recipes, release notes) and **Reference** (every effect and generator, with a
// search over them). They stay in one window because the two halves cross-link
// constantly — a guide points at an effect page, an effect page points back at
// the guide — and a second popover would break those links and split the back
// stack.
//
// The reference pages are organised by CDP program, but the app's menus name the
// same things differently ("Transpose (speed)", not `modify`). manual.json
// therefore also carries `index` — the catalog's own labels and categories, each
// with the page + anchor it lives at — so Reference can list them under either
// vocabulary, and the filter (which searches both tabs) matches both.

import { fuzzyMatch } from '../data/fuzzy.js';

let data = null;          // parsed manual.json (loaded once)
let wired = false;        // page/back/close listeners installed once
let current = null;       // { slug, anchor } currently shown
let history = [];         // back stack of { slug, anchor }

// Which tab a page belongs to. Derived from the slug rather than remembered, so
// following a link into the other half moves the sidebar with you.
const REFERENCE_KEYS = new Set(['effects', 'generators']);
const tabOf = (slug) => (/^(effects|generators)\//.test(slug) ? 'reference' : 'manual');
let tab = 'manual';

const NAV_MODE_KEY = 'cdp-web-manual-nav';
// 'catalog' = the catalog's labels (what the Process / Generate menus show),
// 'program' = the CDP program pages. Catalog first: that's the vocabulary a
// reader arrives with, and the program pages stay one click away under each entry.
let navMode = 'catalog';
try { if (localStorage.getItem(NAV_MODE_KEY) === 'program') navMode = 'program'; } catch { /* storage disabled */ }

const $ = (id) => document.getElementById(id);
const box = () => $('manualBox');

// "effects/modify#modify.shudder" → the catalog entry sitting at that heading.
// Lets the title bar name what you are actually reading (rather than the CDP
// program the page is filed under), and puts an Add button on each entry.
let entryAt = {};

// How the Reference reaches the patcher: the host registers a spawner here, and
// every entry with one gets an "Add to patch" button. Left null (no buttons) in
// any context that only reads the docs.
let insertNode = null;
export function setManualInsert(fn) { insertNode = fn; }

async function ensureLoaded() {
  if (data) return;
  const res = await fetch('./manual.json');
  if (!res.ok) throw new Error('manual.json ' + res.status);
  data = await res.json();
  entryAt = Object.fromEntries(Object.entries(data.index || {}).flatMap(([key, list]) =>
    list.map((it) => [`${it.page}#${it.anchor}`, { ...it, kind: key === 'generators' ? 'generator' : 'effect' }])));
  buildNav();
  wire();
}

function navHeading(cls, text) {
  const h = document.createElement('div');
  h.className = cls;
  h.textContent = text;
  return h;
}

// One sidebar row. `hint` is the dim trailing text (a CDP id next to a curated
// label, or the section a search hit came from) — shown, and repeated in the
// tooltip, since the row itself is ellipsised in a 232px column.
function navLink(label, slug, anchor, hint) {
  const a = document.createElement('a');
  a.textContent = label;
  a.dataset.slug = slug;
  if (anchor) a.dataset.anchor = anchor;
  if (hint) {
    a.title = `${label} — ${hint}`;
    const dim = document.createElement('span');
    dim.className = 'dim';
    dim.textContent = hint;
    a.appendChild(dim);
  }
  a.addEventListener('click', (e) => { e.preventDefault(); navigate(slug, anchor || null); });
  return a;
}

// The sidebar's switches: which tab is lit, and whether the catalog/CDP row —
// which only governs the Reference listing — is showing at all.
function syncChrome() {
  for (const b of $('manualTabs').querySelectorAll('button')) b.classList.toggle('on', b.dataset.tab === tab);
  for (const b of $('manualMode').querySelectorAll('button')) b.classList.toggle('on', b.dataset.mode === navMode);
  $('manualRefBar').hidden = tab !== 'reference';
}

function buildNav() {
  const nav = $('manualNav');
  nav.textContent = '';
  syncChrome();
  const query = ($('manualFilter').value || '').trim();
  if (query) { buildResults(nav, query); return; }
  // Sections split between the tabs: the catalog-indexed ones are the Reference,
  // everything else is the Manual.
  for (const sec of data.nav.filter((s) => (REFERENCE_KEYS.has(s.key) ? 'reference' : 'manual') === tab)) {
    if (sec.title) nav.appendChild(navHeading('sec', sec.title));
    // A section the catalog also indexes (Effects, Generators) is rebuilt from
    // that index in "catalog" mode: curated labels under the categories the menus
    // group them by, each jumping to its entry on the CDP program page. The
    // section's own index page ("All effects") stays at the top either way.
    const entries = navMode === 'catalog' && sec.key ? data.index?.[sec.key] : null;
    if (entries?.length) {
      const readme = sec.pages.find((p) => p.slug.endsWith('/README'));
      if (readme) nav.appendChild(navLink(readme.label, readme.slug, null, null));
      let cat = null;
      for (const it of entries) {
        if (it.category !== cat) { cat = it.category; nav.appendChild(navHeading('cat', cat)); }
        const a = navLink(it.label, it.page, it.anchor, it.id);
        a.classList.add('entry');
        nav.appendChild(a);
      }
    } else {
      for (const p of sec.pages) nav.appendChild(navLink(p.label, p.slug, null, null));
    }
  }
}

// Search hits, best first — over the Reference only, which is where the box
// lives and where 248 entries make one necessary. Effects and generators are
// matched on both names — the curated label and the CDP id — so "shudder" and
// "modify" both land, with the category and the blurb as fallbacks, so typing
// what something *is* ("granular", "reverb") finds it when its name gives
// nothing away. Program pages match too, so "blur" reaches the page as well as
// its entries.
function searchResults(query) {
  const hits = [];
  const q = query.toLowerCase();
  for (const sec of data.nav) {
    if (!REFERENCE_KEYS.has(sec.key)) continue;
    for (const p of sec.pages) {
      const m = fuzzyMatch(query, p.label);
      if (m) hits.push({ score: m.score, label: p.label, hint: sec.title || '', slug: p.slug, anchor: null });
    }
  }
  for (const entries of Object.values(data.index || {})) {
    for (const it of entries) {
      const byLabel = fuzzyMatch(query, it.label);
      const byId = fuzzyMatch(query, it.id);
      // A label match outranks the same score on the id: the label is what the
      // reader typed from, and every id also contains its program name.
      let score = Math.max(byLabel ? byLabel.score : -Infinity, byId ? byId.score - 2 : -Infinity);
      if (score === -Infinity) {
        // Not a name match: fall back to the category, then the blurb — both rank
        // below anything found by name, and the category above the blurb because
        // it's the grouping the menus show.
        if (it.category.toLowerCase().includes(q)) score = -40;
        else if (it.blurb.toLowerCase().includes(q)) score = -50;
        else continue;
      }
      hits.push({ score, label: it.label, hint: it.id, slug: it.page, anchor: it.anchor });
    }
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, 60);
}

function buildResults(nav, query) {
  const hits = searchResults(query);
  if (!hits.length) { nav.appendChild(navHeading('none', 'No matches.')); return; }
  nav.appendChild(navHeading('sec', `${hits.length}${hits.length === 60 ? '+' : ''} match${hits.length === 1 ? '' : 'es'}`));
  for (const h of hits) nav.appendChild(navLink(h.label, h.slug, h.anchor, h.hint));
}

// Rebuild the sidebar (filter or mode changed) and keep the page you're on marked.
function refreshNav() {
  buildNav();
  if (current) markCurrent(current.slug, current.anchor);
}

function setNavMode(mode) {
  if (mode === navMode) return;
  navMode = mode;
  try { localStorage.setItem(NAV_MODE_KEY, mode); } catch { /* storage disabled */ }
  refreshNav();
}

// Move to a tab, reporting whether anything changed. The search box belongs to
// the Reference tab, so leaving it empties the box — otherwise the Manual list
// would be left showing stale reference results behind chrome you can't see.
function applyTab(next) {
  if (next === tab) return false;
  tab = next;
  if (tab !== 'reference') $('manualFilter').value = '';
  return true;
}

// Switching tab changes what the sidebar lists, not what you are reading — the
// page you were on stays up, and following a link back into it flips the tab
// again by itself.
function setTab(next) {
  if (applyTab(next)) refreshNav();
}

function wire() {
  if (wired) return;
  wired = true;
  $('manualClose').addEventListener('click', () => box().hidePopover());
  $('manualBack').addEventListener('click', back);
  $('manualTabs').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) setTab(b.dataset.tab);
  });
  $('manualMode').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) setNavMode(b.dataset.mode);
  });
  const filter = $('manualFilter');
  filter.addEventListener('input', refreshNav);
  filter.addEventListener('keydown', (e) => {
    // Escape clears the filter rather than closing the manual (the popover would
    // otherwise swallow it), and Enter opens the top hit without a trip to the mouse.
    if (e.key === 'Escape' && filter.value) { e.stopPropagation(); filter.value = ''; refreshNav(); }
    else if (e.key === 'Enter') { e.preventDefault(); $('manualNav').querySelector('a')?.click(); }
  });
  // Delegate in-manual link clicks. Build-time links carry data-page (jump to
  // another topic) and/or data-anchor (a heading on the target page); external
  // links keep a real href + target=_blank and fall through to the browser.
  $('manualPage').addEventListener('click', (e) => {
    const a = e.target.closest('a');
    if (!a || !$('manualPage').contains(a)) return;
    if (a.dataset.page) { e.preventDefault(); navigate(a.dataset.page, a.dataset.anchor || null); }
    else if (a.dataset.anchor) { e.preventDefault(); scrollToAnchor(a.dataset.anchor); }
  });
}

// Headings carry their slug as data-id, not id — the manual's HTML lives in the
// app's document, and a real id would collide with the app's own (e.g. the
// patcher's #cables overlay), so anchors are looked up by attribute.
function scrollToAnchor(anchor) {
  const page = $('manualPage');
  const el = page.querySelector('[data-id="' + CSS.escape(anchor) + '"]');
  if (el) el.scrollIntoView({ block: 'start' });
  else page.scrollTop = 0;
}

// Highlight the row for what's on screen, and bring it into view — in "catalog"
// mode the sidebar is 248 entries long, so a deep link from a node would
// otherwise land with its row far off-screen. A row that names an anchor only
// matches when that anchor is showing; a plain page row matches the page.
function markCurrent(slug, anchor) {
  const nav = $('manualNav');
  const rows = [...nav.querySelectorAll('a')];
  // Exact (page + anchor) first; failing that, any row for the page — so a link
  // into a program page still highlights something while browsing by name.
  const hit = rows.find((a) => a.dataset.slug === slug && (a.dataset.anchor || null) === (anchor || null))
    || rows.find((a) => a.dataset.slug === slug);
  for (const a of rows) a.classList.toggle('current', a === hit);
  hit?.scrollIntoView({ block: 'nearest' });
}

// Put an "Add to patch" button on every catalog entry the page shows. The
// entries are marked by the explicit `<a data-id="modify.shudder">` anchors the
// build emits, each immediately followed by that entry's heading — so the button
// lands on the heading line, and nothing else on the page (guide prose, the
// index lists, a program's own title) picks one up.
function addInsertButtons(slug) {
  if (!insertNode) return;
  for (const a of $('manualPage').querySelectorAll('a[data-id]')) {
    const entry = entryAt[`${slug}#${a.dataset.id}`];
    const heading = a.nextElementSibling;
    if (!entry || !heading || !/^H[1-6]$/.test(heading.tagName)) continue;
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'manual-add';
    b.textContent = '+ Add to patch';
    b.title = `Add ${entry.label} to the patch`;
    b.addEventListener('click', () => {
      insertNode(entry.kind, entry.id);
      box().hidePopover();   // close, so you see the window that just appeared
    });
    heading.appendChild(b);
  }
}

function render(slug, anchor) {
  const p = data.pages[slug];
  if (!p) return;
  current = { slug, anchor: anchor || null };
  $('manualPage').innerHTML = p.html;
  addInsertButtons(slug);
  const entry = anchor ? entryAt[`${slug}#${anchor}`] : null;
  $('manualHeading').textContent = entry ? `${entry.label} — ${p.title}` : (p.title || 'Manual');
  // A link across the two halves (a guide → an effect page, or back) brings the
  // sidebar with it. Staying put keeps whatever is listed — so clicking through
  // search results doesn't rebuild the list under you.
  if (applyTab(tabOf(slug))) buildNav();
  markCurrent(slug, anchor);
  if (anchor) scrollToAnchor(anchor); else $('manualPage').scrollTop = 0;
  $('manualBack').disabled = history.length === 0;
}

function navigate(slug, anchor) {
  if (!data || !data.pages[slug]) return;
  if (current) history.push(current);
  render(slug, anchor);
}

function back() {
  const prev = history.pop();
  if (prev) render(prev.slug, prev.anchor);
}

// Does the manual carry this page? Lets a caller choose a different affordance
// rather than opening on a fallback — a node's ? falls back to CDP's own usage
// text when its program isn't documented. Loads the JSON if it isn't yet (the
// same fetch openManual would do), and answers false if that fails.
export async function manualHasPage(slug) {
  try { await ensureLoaded(); } catch { return false; }
  return !!data?.pages[slug];
}

// Open the manual, optionally at a given page slug and heading anchor (defaults
// to the home page). A slug the manual doesn't have — a node whose CDP program
// isn't documented, say — falls back to the home page rather than a blank frame.
//
// `mode` ('catalog' | 'program') lets the caller ask for the listing that matches
// what it linked to: a catalog effect or generator arrives beside the other
// catalog names, a Raw process beside the other CDP programs. It applies to this
// visit only — the reader's own choice of default, set by the toggle, is left
// alone. Safe to call repeatedly; the JSON is fetched only once.
export async function openManual(slug, anchor, mode) {
  try {
    await ensureLoaded();
  } catch (e) {
    $('manualHeading').textContent = 'Manual';
    $('manualPage').innerHTML = '<p>Could not load the manual (' + e.message + ').</p>'
      + '<p>Run <code>npm run docs:manual</code> to generate <code>manual.json</code>.</p>';
  }
  history = [];
  current = null;
  // Show before rendering: a hidden popover has no layout, so scrolling to a
  // heading (and to its row in the sidebar) would silently do nothing — which is
  // exactly what a deep link from a node's Manual… asks for.
  if (!box().matches(':popover-open')) box().showPopover();
  if (data) {
    const target = slug && data.pages[slug] ? slug : data.home;
    // A link arrives fresh: a search left over from a previous visit would leave
    // the sidebar showing results instead of where this link landed.
    $('manualFilter').value = '';
    const relist = mode && mode !== navMode;
    if (relist) navMode = mode;
    render(target, target === slug ? anchor || null : null);
    if (relist) refreshNav();   // render only rebuilds when the *tab* changed
  }
}
