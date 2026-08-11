// WebMCP: register the patcher's agent tools on document.modelContext so a
// browser-side AI agent can co-author the patch with the user — inspect it,
// add/cable/edit nodes, load audio and render, all through the same live canvas
// the user is looking at. Tool definitions (names/schemas/budgets) live in
// webmcp-tools.js; the executes here close over the window.__patch /
// window.__cdpHost surfaces the patcher exposes.
//
// Availability: Chrome behind chrome://flags/#enable-webmcp-testing (146+), the
// origin trial from 149 (see index.html), shipping ~157. Standalone browser/PWA
// only — the plugin and extension WebViews host their own integration and must
// never grow browser-agent tools.
import { log, inEmbeddedHost } from '../ui/ui.js';
import { byId, genById, GENERATORS } from './graph.js';
import { EFFECTS } from 'cdp-wasm';
import { listWavs, getWav } from './audio-store.js';
import { DEMO_SOUNDS } from './patcher.js';
import { TOOL_DEFS, text, OUTPUT_SOFT_MAX } from './webmcp-tools.js';

const P = () => window.__patch;
const H = () => window.__cdpHost;

// ---- text helpers -----------------------------------------------------------

const fmt = (v) => typeof v === 'number' && !Number.isInteger(v) ? +v.toFixed(4) : v;
const vals = (state) => Object.entries(state?.values || {}).map(([k, v]) => `${k}=${fmt(v)}`).join(', ');

// What a node is, on one line: id, kind, what fills the kind in (effect id,
// generator id, loaded file…), then its current parameter values.
function nodeLine(n) {
  let what = n.type;
  if (n.type === 'transform') what = `transform ${n.effectId}`;
  else if (n.type === 'generator') what = `generator ${n.genId}`;
  else if (n.type === 'faust') what = `faust ${n.faustKind || ''}`.trim();
  else if (n.type === 'source') what = `source${n.source?.name ? ` "${n.source.name}"` : ' (empty)'}`;
  const label = n.name ? ` "${n.name}"` : '';
  const v = vals(n.state);
  return `${n.id} ${what}${label}${v ? ` — ${v}` : ''}`;
}

function patchSummary() {
  const nodes = P().nodes();
  const edges = P().edges();
  const lines = [`patch: ${nodes.length} nodes, ${edges.length} cables · ${P().bpm()} BPM`];
  const MAX = 20;
  for (const n of nodes.slice(0, MAX)) lines.push('  ' + nodeLine(n));
  if (nodes.length > MAX) lines.push(`  …and ${nodes.length - MAX} more nodes (describe_node for any id)`);
  if (edges.length) lines.push('cables: ' + edges.map((e) => `${e.from.node}:${e.from.port} → ${e.to.node}:${e.to.port}`).join('; '));
  return lines.join('\n');
}

// Minimal WAV header read — duration/channels/rate for tool replies (tools
// never return audio bytes; the sound itself lives in the app).
function wavInfo(bytes) {
  if (!bytes || bytes.length < 44) return 'empty result';
  const ascii = (o, l) => String.fromCharCode(...bytes.subarray(o, o + l));
  if (ascii(0, 4) !== 'RIFF' || ascii(8, 4) !== 'WAVE') return `${bytes.length} bytes (not WAV)`;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12, rate = 0, chans = 0, bits = 0, dataBytes = 0;
  while (offset + 8 <= bytes.length) {
    const id = ascii(offset, 4), size = view.getUint32(offset + 4, true);
    if (id === 'fmt ' && size >= 16) {
      chans = view.getUint16(offset + 10, true);
      rate = view.getUint32(offset + 12, true);
      bits = view.getUint16(offset + 22, true);
    } else if (id === 'data') dataBytes = size;
    offset += 8 + size + (size & 1);
  }
  const dur = rate && chans && bits ? dataBytes / (chans * bits / 8) / rate : 0;
  return `${dur.toFixed(2)}s · ${chans}ch · ${rate} Hz · ${bits}-bit`;
}

// The engine loads in the background at boot; graph edits work before it's
// ready, but rendering and audio decode need it. Same poll the MCP app uses.
async function waitForCdp(timeoutMs = 30000) {
  const start = performance.now();
  while (performance.now() - start < timeoutMs) {
    if (H()?.ready?.()) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('the CDP engine did not become ready in 30s — try again shortly');
}

const getNode = (id) => {
  const n = P().node(id);
  if (!n) throw new Error(`no node '${id}' — nodes are: ${P().nodes().map((x) => x.id).join(', ') || '(none)'}`);
  return n;
};

// ---- catalog (effects + generators share search/describe ids) ---------------

const CATALOG = [
  ...EFFECTS.map((e) => ({ kind: 'effect', spec: e })),
  ...GENERATORS.map((g) => ({ kind: 'generator', spec: g })),
];

function catalogLine({ kind, spec }) {
  const gen = kind === 'generator' ? ' [generator]' : '';
  return `${spec.id} — ${spec.label} (${spec.category})${gen}: ${spec.blurb || ''}`.trim();
}

// One parameter as a sheet line; `cur` (when given) prepends the current value.
function paramSheet(p, cur) {
  const now = cur !== undefined ? ` = ${fmt(cur)}` : '';
  if (p.choices) return `  ${p.name} (${p.label})${now}: one of ${p.choices.map(([l, v]) => `${v}=${l}`).join(', ')} · default ${p.default}`;
  const range = p.min != null ? `${p.min}–${p.max} · ` : '';
  const env = p.env ? ' · accepts envelope' : '';
  const help = p.help ? ` — ${p.help}` : '';
  return `  ${p.name} (${p.label})${now}: ${range}default ${p.default ?? '?'}${p.step ? ` · step ${p.step}` : ''}${env}${help}`;
}

// ---- executes ---------------------------------------------------------------

const EXEC = {
  async get_patch({ detail = 'summary' } = {}) {
    if (detail === 'full') return text(JSON.stringify(P().serialize()));
    return text(patchSummary());
  },

  async describe_node({ id }) {
    const n = getNode(id);
    const defs = P().paramDefs(id);
    const edges = P().edges();
    const lines = [nodeLine(n)];
    if (defs.length) {
      lines.push('params:');
      for (const p of defs) {
        const cur = n.state?.values?.[p.name];
        const driven = n.state?.envs?.[p.name] != null ? ' · ENV-DRIVEN (set_params refused)'
          : edges.some((e) => e.to.node === id && e.to.port === 'param:' + p.name) ? ' · CABLE-DRIVEN (disconnect first)' : '';
        lines.push(paramSheet(p, cur) + driven);
      }
    }
    const ports = [
      ...(n.inPorts || []).map((p) => `in ${p.name} (${p.kind})`),
      ...(n.outPort ? [`out ${n.outPort.name} (${n.outPort.kind})`] : []),
      ...(n.paramPorts || []).map((p) => `in ${p.name} (${p.kind})`),
    ];
    if (ports.length) lines.push('ports: ' + ports.join('; '));
    const conns = edges.filter((e) => e.from.node === id || e.to.node === id)
      .map((e) => `${e.from.node}:${e.from.port} → ${e.to.node}:${e.to.port}`);
    lines.push(conns.length ? 'cables: ' + conns.join('; ') : 'cables: none');
    return text(lines.join('\n'));
  },

  async search_effects({ query = '', category, limit = 10 } = {}) {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    const cat = category?.toLowerCase();
    const hits = CATALOG.filter(({ spec }) => {
      if (cat && spec.category.toLowerCase() !== cat) return false;
      const hay = `${spec.id} ${spec.label} ${spec.category} ${spec.blurb || ''}`.toLowerCase();
      return terms.every((t) => hay.includes(t));
    });
    if (!hits.length) {
      const cats = [...new Set(CATALOG.map(({ spec }) => spec.category))].join(', ');
      return text(`no matches for '${query}'${category ? ` in category '${category}'` : ''} — try fewer/other words, or browse a category: ${cats}`);
    }
    const shown = hits.slice(0, Math.max(1, Math.min(limit, 25)));
    const head = hits.length > shown.length ? `${hits.length} matches, first ${shown.length}:` : `${hits.length} match(es):`;
    return text([head, ...shown.map(catalogLine)].join('\n'));
  },

  async describe_effect({ id }) {
    const entry = CATALOG.find(({ spec }) => spec.id === id);
    if (!entry) {
      const near = CATALOG.filter(({ spec }) => spec.id.includes(id) || spec.label.toLowerCase().includes(id.toLowerCase()))
        .slice(0, 5).map(({ spec }) => spec.id);
      throw new Error(`no effect or generator '${id}'${near.length ? ` — did you mean: ${near.join(', ')}` : ' — use search_effects to find ids'}`);
    }
    const { kind, spec } = entry;
    const lines = [
      `${spec.id} — ${spec.label} (${spec.category}, ${kind})`,
      spec.blurb || '',
      ...(spec.params || []).length ? ['params:', ...spec.params.map((p) => paramSheet(p))] : ['params: none'],
    ];
    // Effects also carry a `data` field, but there it is an internal function
    // that derives the program's $DATA file from the params — nothing editable.
    // The two partials generators keep an object descriptor yet edit through an
    // on-node multislider, so set_params' data path can't reach them either.
    if (kind === 'generator' && spec.data && typeof spec.data === 'object') {
      lines.push(['addsynth', 'addsynth_packets'].includes(spec.id)
        ? 'partials data: edited on the node itself (multislider) — not settable via set_params'
        : `free-text data: ${spec.data.label || 'yes'}${spec.data.placeholder ? ` (${spec.data.placeholder})` : ''} — set with set_params' data field`);
    }
    lines.push(kind === 'effect'
      ? `add with: add_node {type:'transform', effectId:'${spec.id}'}`
      : `add with: add_node {type:'generator', genId:'${spec.id}'}`);
    return text(lines.filter(Boolean).join('\n'));
  },

  async list_sounds() {
    const lines = ['demo sounds (use the name with set_source):'];
    for (const d of DEMO_SOUNDS) lines.push(`  ${d.label} — ${d.title}`);
    const stored = await listWavs();
    if (stored.length) {
      lines.push('stored WAVs (use the key with set_source):');
      for (const w of stored.slice(0, 20)) lines.push(`  ${w.key} — ${w.name || '(unnamed)'}`);
      if (stored.length > 20) lines.push(`  …and ${stored.length - 20} more`);
    } else lines.push('stored WAVs: none');
    return text(lines.join('\n'));
  },

  async load_patch({ patch } = {}) {
    if (patch == null) { P().newPatch(); return text('reset to the default patch\n' + patchSummary()); }
    let doc;
    try { doc = typeof patch === 'string' ? JSON.parse(patch) : patch; }
    catch (e) { throw new Error('patch is not valid JSON: ' + e.message); }
    if (doc?.app !== 'cdp-web-patch' || !Array.isArray(doc.nodes)) {
      throw new Error("not a cdp-web patch — expected the JSON document get_patch detail:'full' returns (app:'cdp-web-patch')");
    }
    P().loadPatch(doc, { resetSample: true, arrange: true, fit: true });
    return text('patch loaded\n' + patchSummary());
  },

  async add_node({ type, effectId, genId } = {}) {
    let spec;
    if (type === 'transform') {
      if (!byId[effectId]) throw new Error(`no effect '${effectId}' — find ids with search_effects`);
      spec = { type, effectId };
    } else if (type === 'generator') {
      if (!genById[genId]) throw new Error(`no generator '${genId}' — generators are: ${GENERATORS.map((g) => g.id).join(', ')}`);
      spec = { type, gen: { id: genId } };
    } else spec = { type };
    const n = P().addNode(spec);
    const defs = P().paramDefs(n.id);
    const ports = [...(n.inPorts || []).map((p) => `${p.name}(${p.kind})`), ...(n.outPort ? [`${n.outPort.name}(${n.outPort.kind}) out`] : [])];
    return text(`added ${nodeLine(n)}\nports: ${ports.join(', ') || 'none'}${defs.length ? `\nparams: ${defs.map((d) => d.name).join(', ')}` : ''}`);
  },

  async connect({ from_node, from_port, to_node, to_port } = {}) {
    const { from, to } = P().connect(
      from_port ? { node: from_node, port: from_port } : from_node,
      to_port ? { node: to_node, port: to_port } : to_node,
    );
    return text(`connected ${from.node}:${from.port} → ${to.node}:${to.port}`);
  },

  async disconnect({ from_node, from_port, to_node, to_port } = {}) {
    P().disconnect(
      from_port ? { node: from_node, port: from_port } : from_node,
      to_port ? { node: to_node, port: to_port } : to_node,
    );
    return text(`disconnected ${from_node} → ${to_node}`);
  },

  async delete_node({ id } = {}) {
    getNode(id);
    P().removeNodeById(id);
    return text(`deleted ${id} — ${P().nodes().length} nodes remain`);
  },

  async set_params({ id, params = {}, data } = {}) {
    const n = getNode(id);
    const lines = [];
    for (const [name, value] of Object.entries(params)) {
      const applied = P().setParam(id, name, value);
      const clamped = String(applied) !== String(value);
      lines.push(`${name} = ${fmt(applied)}${clamped ? ` (requested ${value}, clamped to the allowed range)` : ''}`);
    }
    if (data != null) { P().setData(id, data); lines.push(`data set (${data.length} chars)`); }
    if (!lines.length) throw new Error(`nothing to set — pass params and/or data; ${id}'s params are: ${P().paramDefs(id).map((d) => d.name).join(', ') || '(none)'}`);
    return text(`${n.id}:\n` + lines.map((l) => '  ' + l).join('\n'));
  },

  async set_source({ sound, node } = {}) {
    await waitForCdp();   // decoding the fetched audio needs the engine's helpers
    let bytes, name;
    const demo = DEMO_SOUNDS.find((d) => d.label === sound || d.value === sound);
    const stored = demo ? null : (await listWavs()).find((w) => w.key === sound);
    if (demo) { name = demo.label + '.wav'; }
    else if (stored) {
      const rec = await getWav(stored.key);
      if (!rec) throw new Error(`stored WAV '${sound}' could not be read — list_sounds for what is available`);
      bytes = rec.bytes; name = rec.name || sound;
    } else if (/^(https?:|audio\/|\.?\/)/.test(sound)) { name = sound.split('/').pop(); }
    else {
      throw new Error(`'${sound}' is not a demo sound (${DEMO_SOUNDS.map((d) => d.label).join(', ')}), a stored WAV key, or a URL — use list_sounds`);
    }
    if (!bytes) {
      const url = demo ? demo.value : sound;
      const resp = await fetch(new URL(url, location.href));
      if (!resp.ok) throw new Error(`fetch ${url}: HTTP ${resp.status}`);
      bytes = new Uint8Array(await resp.arrayBuffer());
    }
    let target;
    if (node) {
      target = getNode(node);
      if (typeof target.setWav !== 'function') throw new Error(`node '${node}' is not a Source — add one with add_node {type:'source'}`);
      target.setWav(bytes, name);
    } else {
      target = H().setSource(bytes, name);
      if (!target) throw new Error("no Source node to load into — add one with add_node {type:'source'}");
    }
    return text(`loaded "${name}" into ${target.id} — ${wavInfo(bytes)}`);
  },

  async render({ play = false } = {}) {
    await waitForCdp();
    const started = performance.now();
    const wav = await H().render();
    if (!wav) throw new Error('render produced no audio — check a Source/generator is cabled through to the Output node (get_patch shows the cables) and see the app log for the failing node');
    let playing = '';
    if (play) {
      // Press the Output node's own Play button — the user sees the transport
      // engage, and both parties hear the same playback path.
      const out = P().nodes().find((n) => n.type === 'output');
      const btn = out?.el?.querySelector('.transport-play');
      if (btn && !btn.classList.contains('playing')) { btn.click(); playing = ' · playing'; }
    }
    return text(`rendered ${wavInfo(wav)} in ${Math.round(performance.now() - started)}ms${playing}`);
  },

  async undo({ redo = false } = {}) {
    if (redo) P().redo(); else P().undo();
    const h = P().hist();
    return text(`${redo ? 'redo' : 'undo'} — history ${h.i + 1}/${h.len}\n` + patchSummary());
  },
};

// ---- registration -----------------------------------------------------------

// A saved session or share link is restored asynchronously at boot (after the
// engine loads) and REPLACES the graph — so until that's settled, anything an
// agent reads is about to be superseded and anything it builds is about to be
// discarded. Hold every tool until the patcher signals the startup document is
// chosen; the timeout is a deadlock guard only (proceeding is then best-effort).
async function waitForRestore(timeoutMs = 20000) {
  const start = performance.now();
  while (!window.__patchRestored && performance.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 100));
  }
}

// Every execute reports failures as an in-band MCP error result: agents
// self-correct from a corrective message, while a thrown exception surfaces
// differently (or not at all) across native WebMCP vs the bridge.
const wrap = (fn) => async (input) => {
  try {
    await waitForRestore();
    const res = await fn(input || {});
    const t = res?.content?.[0]?.text;
    if (typeof t === 'string' && t.length > OUTPUT_SOFT_MAX * 8) {
      res.content[0].text = t.slice(0, OUTPUT_SOFT_MAX * 8) + '\n…output truncated';
    }
    return res;
  } catch (e) {
    return { content: [{ type: 'text', text: 'error: ' + (e?.message || e) }], isError: true };
  }
};

export function initWebmcp() {
  if (typeof IPlugSendMsg === 'function') return;   // inside the native plugin
  if (inEmbeddedHost()) return;                     // inside a DAW extension WebView
  // Registration must never break boot: everything async + caught.
  setup().catch((e) => log('webmcp: init failed — ' + (e?.message || e)));
}

// Optional MCP-B bridge (@mcp-b/global): polyfills document.modelContext and
// serves this tab's tools to external MCP clients through the MCP-B browser
// extension — WebMCP in any browser, today. Opt-in only (?webmcp=bridge once,
// or localStorage 'cdp-webmcp'='bridge' to keep it on): it is 390 KB the native
// path never needs, and it announces the tab to the extension. The self-
// contained IIFE build is loaded (the ESM entry imports a tree of bare
// specifiers the import map would have to chase); it honours
// __webModelContextOptions.autoInitialize, which MUST be set before the script
// evaluates or it wires a default transport on its own.
async function initBridgeIfOptedIn() {
  let mode = null;
  try { mode = new URLSearchParams(location.search).get('webmcp') || localStorage.getItem('cdp-webmcp'); } catch { /* storage disabled */ }
  if (mode !== 'bridge') return;
  window.__webModelContextOptions = { autoInitialize: false };
  // node_modules/ serves dev and the deployed site (build-site copies vendor/
  // in under that name); vendor/ serves the published npm bundle.
  let err;
  for (const src of ['./node_modules/@mcp-b/global/dist/index.iife.js', './vendor/@mcp-b/global/dist/index.iife.js']) {
    try {
      await new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = () => { s.remove(); reject(new Error(`could not load ${src}`)); };
        document.head.appendChild(s);
      });
      err = null; break;
    } catch (e) { err = e; }
  }
  if (err) throw err;
  window.WebMCP.initializeWebModelContext({ transport: { tabServer: { allowedOrigins: ['*'] } } });
  log('webmcp: MCP-B bridge active — this tab is an MCP server for the MCP-B extension.');
}

async function setup() {
  // Debug/test surface: the same wrapped executes the tools register, callable
  // from any browser console or test rig regardless of WebMCP availability —
  // window.__webmcp.call('get_patch', {}).
  window.__webmcp = { defs: TOOL_DEFS, call: (name, input) => wrap(EXEC[name] || (() => { throw new Error(`no tool '${name}'`); }))(input) };
  // The bridge (when opted in) must be up before the feature-detect below —
  // it is what provides document.modelContext in browsers without native WebMCP.
  try { await initBridgeIfOptedIn(); }
  catch (e) { log('webmcp: bridge unavailable — ' + (e?.message || e)); }
  if (!('modelContext' in document)) return;   // browser has no WebMCP (yet)
  const ac = new AbortController();
  let ok = 0;
  for (const def of TOOL_DEFS) {
    try {
      await document.modelContext.registerTool({ ...def, execute: wrap(EXEC[def.name]) }, { signal: ac.signal });
      ok++;
    } catch (e) { log(`webmcp: could not register ${def.name} — ${e?.message || e}`); }
  }
  if (ok) log(`AI tools ready — ${ok} WebMCP tools registered.`);
}
