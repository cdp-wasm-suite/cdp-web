// Code editor modal (Monaco). One shared popover (#codeEditorBox in
// index.html) and one Monaco instance serve two kinds of session:
//   - openCodeEditor: a Faust node's DSP source (compile, presets, audio
//     preview strip), opened from the node's "Edit code…" button
//   - openTextEditor: any plain-text widget (breakpoint tables, partials
//     lists, generator data) — same editor, no compile/preview chrome;
//     textEditButton() wires the little ✎ opener the widgets share
// Opening swaps in the caller's content and callbacks. Edits sync live on
// every keystroke, so Esc / light-dismiss never loses work.
//
// Monaco ships as its AMD build (min/vs) because the app has no bundler: the
// loader script tag + require.config is the distribution designed for plain
// static serving, and its editor workers resolve relative to the vs path on
// their own. Loaded lazily on first open, like the Faust compiler itself.
// bundle.mjs rewrites the node_modules/ path below to vendor/ for the package.

import { themeColors, THEMES, currentTheme } from './themes.js';
import { el, drawWave, dropdown } from './ui.js';

const VS_PATH = './node_modules/monaco-editor/min/vs';

const $ = (id) => document.getElementById(id);
const box = () => $('codeEditorBox');

let monacoP = null;      // memoized loader promise (reset on failure so a retry can work)
let editor = null;       // the single Monaco instance, created on first open
let fallbackTA = null;   // plain-textarea stand-in when Monaco can't load
let session = null;      // { id, onChange, onCompile } for the node being edited
let muteChange = false;  // suppress onChange during programmatic setValue
let lastWav = null;      // current preview audio (redrawn on theme change)
let wired = false;

// Plain-data files are often tables whose fields happen to be separated by a
// single space. Monaco uses a monospaced font, but a value such as "0.275" is
// still wider than "0", so later fields drift across the page. Pad only runs
// of numeric rows with the same shape; prose, Faust, blank lines and comment-
// only lines are deliberately left byte-for-byte alone.
const NUMERIC_FIELD = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

function numericRow(line) {
  const semicolon = line.indexOf(';');
  const data = semicolon < 0 ? line : line.slice(0, semicolon);
  const trimmed = data.trim();
  if (!trimmed) return null;
  const fields = trimmed.split(/\s+/);
  if (fields.length < 2 || !fields.every((field) => NUMERIC_FIELD.test(field))) return null;
  return {
    indent: data.match(/^\s*/)[0],
    fields,
    comment: semicolon < 0 ? '' : line.slice(semicolon),
  };
}

function alignNumericColumns(text) {
  const eol = text.includes('\r\n') ? '\r\n' : text.includes('\r') ? '\r' : '\n';
  const lines = text.split(/\r\n|\r|\n/);

  const alignRun = (start, end) => {
    if (end - start < 2) return;
    const rows = lines.slice(start, end).map(numericRow);
    const widths = rows[0].fields.map((_, column) =>
      Math.max(...rows.map((row) => row.fields[column].length)));
    rows.forEach((row, offset) => {
      const fields = row.fields.map((field, column) =>
        column < row.fields.length - 1 || row.comment
          ? field.padEnd(widths[column])
          : field);
      lines[start + offset] = row.indent + fields.join('  ')
        + (row.comment ? '  ' + row.comment : '');
    });
  };

  let start = 0;
  let first = numericRow(lines[0]);
  for (let i = 1; i <= lines.length; i++) {
    const row = i < lines.length ? numericRow(lines[i]) : null;
    const sameShape = first && row
      && row.fields.length === first.fields.length
      && row.indent === first.indent;
    if (sameShape) continue;
    if (first) alignRun(start, i);
    start = i;
    first = row;
  }
  return lines.join(eol);
}

// The editor keeps its own text-size "zoom", separate from the node graph's
// canvas zoom: while the modal is open, ⌘/Ctrl +/−/0 land here (capture phase,
// so the patcher's graph-zoom binding and the browser's page zoom never see
// them). Persisted like the graph zoom is.
const FONT_KEY = 'cdp-web-code-font';
const FONT_DEFAULT = 13, FONT_MIN = 8, FONT_MAX = 32;
let fontSize = FONT_DEFAULT;
try { const s = +localStorage.getItem(FONT_KEY); if (s >= FONT_MIN && s <= FONT_MAX) fontSize = s; } catch { /* storage disabled */ }

function setFontSize(px) {
  fontSize = Math.max(FONT_MIN, Math.min(FONT_MAX, px));
  editor?.updateOptions({ fontSize });
  if (fallbackTA) fallbackTA.style.fontSize = fontSize + 'px';
  try { localStorage.setItem(FONT_KEY, String(fontSize)); } catch { /* storage disabled */ }
}

function loadMonaco() {
  return (monacoP ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = VS_PATH + '/loader.js';
    s.onload = () => {
      window.require.config({ paths: { vs: VS_PATH } });
      window.require(['vs/editor/editor.main'],
        () => resolve(window.monaco),
        (e) => reject(new Error('Monaco failed to load: ' + (e?.message || e))));
    };
    s.onerror = () => reject(new Error('Monaco loader failed to load'));
    document.head.appendChild(s);
  }).catch((e) => { monacoP = null; throw e; }));
}

// ---- Faust language ---------------------------------------------------------

function registerLanguages(monaco) {
  if (monaco.languages.getLanguages().some((l) => l.id === 'faust')) return;
  // Plain numeric data (breakpoint tables, partials lists, generator $DATA):
  // just numbers + ';' comments picked out, everything else default ink.
  monaco.languages.register({ id: 'cdp-data' });
  monaco.languages.setMonarchTokensProvider('cdp-data', {
    tokenizer: {
      root: [
        [/;.*$/, 'comment'],
        [/-?\d+(\.\d*)?([eE][-+]?\d+)?/, 'number'],
      ],
    },
  });
  monaco.languages.register({ id: 'faust' });
  monaco.languages.setLanguageConfiguration('faust', {
    comments: { lineComment: '//', blockComment: ['/*', '*/'] },
    brackets: [['(', ')'], ['{', '}'], ['[', ']']],
    autoClosingPairs: [
      { open: '(', close: ')' }, { open: '{', close: '}' },
      { open: '[', close: ']' }, { open: '"', close: '"' },
    ],
  });
  monaco.languages.setMonarchTokensProvider('faust', {
    keywords: [
      'process', 'import', 'declare', 'with', 'letrec', 'where', 'environment',
      'library', 'component', 'ffunction', 'fconstant', 'fvariable', 'case',
      'seq', 'par', 'sum', 'prod', 'inputs', 'outputs', 'waveform', 'soundfile',
      'route', 'enable', 'control', 'attach', 'letter', 'digit',
    ],
    builtins: [
      'mem', 'prefix', 'rdtable', 'rwtable', 'select2', 'select3', 'int', 'float',
      'button', 'checkbox', 'hslider', 'vslider', 'nentry',
      'hgroup', 'vgroup', 'tgroup', 'hbargraph', 'vbargraph',
      'min', 'max', 'abs', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'atan2',
      'exp', 'log', 'log10', 'pow', 'sqrt', 'fmod', 'remainder',
      'floor', 'ceil', 'rint', 'ma', 'ba', 'os', 'no', 'fi', 'en', 'ef', 're',
      'de', 'co', 'dm', 'pf', 'sp', 'sy', 've', 'an', 'si', 'wa', 'ho', 'it', 'qu',
    ],
    tokenizer: {
      root: [
        [/\/\/.*$/, 'comment'],
        [/\/\*/, 'comment', '@block'],
        [/"[^"]*"/, 'string'],
        [/\d+(\.\d*)?([eE][-+]?\d+)?/, 'number'],
        [/[a-zA-Z_]\w*/, { cases: { '@keywords': 'keyword', '@builtins': 'type', '@default': 'identifier' } }],
        [/[~:,<>'!^&|*/+\-@%?]+/, 'operator'],
        [/[;=(){}\[\].]/, 'delimiter'],
      ],
      block: [
        [/\*\//, 'comment', '@pop'],
        [/./, 'comment'],
      ],
    },
  });
}

// ---- theme ------------------------------------------------------------------

// Blend --ink toward --paper (t = 1 → pure ink) so the editor keeps each
// theme's two-colour GEM look instead of Monaco's stock palette.
function mix(ink, paper, t) {
  const px = (h) => {
    h = h.replace('#', '');
    if (h.length === 3) h = h.replace(/./g, (c) => c + c);
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) || 0);
  };
  const a = px(ink), b = px(paper);
  return a.map((v, i) => Math.round(v * t + b[i] * (1 - t)).toString(16).padStart(2, '0')).join('');
}

function applyMonacoTheme(monaco) {
  const { ink, paper } = themeColors();
  const dark = !!THEMES[currentTheme()]?.dark;
  const bg = mix(paper, paper, 1);
  monaco.editor.defineTheme('gem', {
    base: dark ? 'vs-dark' : 'vs',
    inherit: false,
    rules: [
      { token: '', foreground: mix(ink, paper, 1) },
      { token: 'keyword', foreground: mix(ink, paper, 1), fontStyle: 'bold' },
      { token: 'type', foreground: mix(ink, paper, 0.85) },
      { token: 'identifier', foreground: mix(ink, paper, 1) },
      { token: 'comment', foreground: mix(ink, paper, 0.55), fontStyle: 'italic' },
      { token: 'string', foreground: mix(ink, paper, 0.75) },
      { token: 'number', foreground: mix(ink, paper, 0.8) },
      { token: 'operator', foreground: mix(ink, paper, 0.9) },
      { token: 'delimiter', foreground: mix(ink, paper, 0.7) },
    ],
    colors: {
      'editor.background': '#' + bg,
      'editor.foreground': '#' + mix(ink, paper, 1),
      'editorLineNumber.foreground': '#' + mix(ink, paper, 0.4),
      'editorLineNumber.activeForeground': '#' + mix(ink, paper, 0.8),
      'editorCursor.foreground': '#' + mix(ink, paper, 1),
      'editor.selectionBackground': '#' + mix(ink, paper, 0.25),
      'editor.lineHighlightBackground': '#' + mix(ink, paper, 0.06),
      'editorWidget.background': '#' + bg,
      'editorWidget.border': '#' + mix(ink, paper, 0.6),
      'scrollbarSlider.background': '#' + mix(ink, paper, 0.2),
      'scrollbarSlider.hoverBackground': '#' + mix(ink, paper, 0.35),
      'scrollbarSlider.activeBackground': '#' + mix(ink, paper, 0.45),
      // Bracket-pair colorization is on by default; without these it falls
      // back to the stock blue/purple set, breaking the 2-colour look.
      'editorBracketHighlight.foreground1': '#' + mix(ink, paper, 1),
      'editorBracketHighlight.foreground2': '#' + mix(ink, paper, 0.7),
      'editorBracketHighlight.foreground3': '#' + mix(ink, paper, 0.5),
      'editorBracketHighlight.foreground4': '#' + mix(ink, paper, 1),
      'editorBracketHighlight.foreground5': '#' + mix(ink, paper, 0.7),
      'editorBracketHighlight.foreground6': '#' + mix(ink, paper, 0.5),
      'editorBracketHighlight.unexpectedBracket.foreground': '#' + mix(ink, paper, 1),
    },
  });
  monaco.editor.setTheme('gem');
}

// ---- modal wiring -----------------------------------------------------------

function wire() {
  if (wired) return;
  wired = true;
  $('codeEditorClose').addEventListener('click', () => box().hidePopover());
  $('codeEditorCompile').addEventListener('click', () => session?.onCompile?.());
  box().addEventListener('toggle', (e) => { if (e.newState === 'closed') session?.onClose?.(); });
  window.addEventListener('themechange', () => { if (box().matches(':popover-open')) renderPreview(); });
  // Same preset list as the node window; the builder reads the live session so
  // one menu serves whichever node is being edited.
  dropdown($('codeEditorPresets'), () =>
    (session?.presets || []).map((p) => ({ label: p.label, action: () => session.onPreset(p) })));
  // The usual Edit menu, backed by Monaco's own commands. Paste goes through
  // the async clipboard API (Monaco's paste action can't reach the system
  // clipboard from a synthetic menu click); permission prompts are the
  // browser's business.
  const mod = /mac/i.test(navigator.platform) ? '⌘' : 'Ctrl+';
  // Focus the editor BEFORE each command — Monaco's clipboard actions bottom
  // out in execCommand/navigator.clipboard, which act on the focused element.
  const run = (fn) => () => { if (!editor) return; editor.focus(); fn(); };
  const trig = (cmd) => run(() => editor.trigger('menu', cmd));
  const act = (id) => run(() => editor.getAction(id)?.run());
  const paste = run(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) editor.trigger('menu', 'type', { text });
    } catch { /* clipboard read denied */ }
  });
  // Cut/copy by hand too: Monaco's clipboard actions go async internally and
  // drop the click's user activation. Empty selection takes the current line,
  // as in VS Code.
  const cutCopy = (cut) => run(async () => {
    const monaco = window.monaco;
    const model = editor.getModel();
    let sels = editor.getSelections();
    if (sels.every((s) => s.isEmpty())) {
      const ln = sels[0].startLineNumber, last = model.getLineCount();
      sels = [ln < last
        ? new monaco.Selection(ln, 1, ln + 1, 1)                    // line + its newline
        : new monaco.Selection(Math.max(1, ln - 1), ln > 1 ? model.getLineMaxColumn(ln - 1) : 1, ln, model.getLineMaxColumn(ln))];  // last line: take the preceding newline too
    }
    try { await navigator.clipboard.writeText(sels.map((s) => model.getValueInRange(s)).join('\n')); }
    catch { return; /* clipboard write denied — don't destroy the selection */ }
    if (cut) editor.executeEdits('cut', sels.map((s) => ({ range: s, text: '' })));
  });
  const alignColumns = run(() => {
    const model = editor.getModel();
    const before = model.getValue();
    const after = alignNumericColumns(before);
    if (after === before) return;
    const position = editor.getPosition();
    editor.pushUndoStop();
    editor.executeEdits('align-columns', [{ range: model.getFullModelRange(), text: after }]);
    editor.pushUndoStop();
    if (position) editor.setPosition(model.validatePosition(position));
  });
  dropdown($('codeEditorEdit'), () => [
    { label: `Undo  (${mod}Z)`, action: trig('undo') },
    { label: `Redo  (⇧${mod}Z)`, action: trig('redo') },
    { sep: true },
    { label: `Cut  (${mod}X)`, action: cutCopy(true) },
    { label: `Copy  (${mod}C)`, action: cutCopy(false) },
    { label: `Paste  (${mod}V)`, action: paste },
    // (selectAll is a core command, not an editor action — do it directly)
    { label: `Select all  (${mod}A)`, action: run(() => editor.setSelection(editor.getModel().getFullModelRange())) },
    { sep: true },
    { label: `Find…  (${mod}F)`, action: act('actions.find') },
    { label: 'Replace…', action: act('editor.action.startFindReplaceAction') },
    ...(session?.language === 'cdp-data'
      ? [{ sep: true }, { label: 'Align columns', action: alignColumns }]
      : []),
  ]);
  window.addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
    if (!box().matches(':popover-open')) return;
    const k = e.key;
    if (k === '=' || k === '+') setFontSize(fontSize + 1);
    else if (k === '-' || k === '_') setFontSize(fontSize - 1);
    else if (k === '0') setFontSize(FONT_DEFAULT);
    else return;
    e.preventDefault();
    e.stopPropagation();
  }, true);
}

// ---- generated-audio preview ------------------------------------------------

// What the preview strip currently shows — null while the modal is closed or
// the strip hidden, so the patcher's scope pool (playhead animation, theme +
// tempo redraws) never touches the zero-sized hidden canvas.
export function codeEditorPreviewWav() {
  return !$('codeEditorPreview').hidden && box().matches(':popover-open') ? lastWav : null;
}

function setWav(wav) {
  lastWav = wav;
  $('codeEditorPreview').hidden = !wav;
  if (!wav) return;
  const cvs = $('codeEditorWave');
  cvs.classList.remove('stale');
  drawWave(cvs, wav);
}

// An unbuilt edit greys the preview, like the node's own mini scope.
function markWaveStale() {
  if (lastWav) $('codeEditorWave').classList.add('stale');
}

// Text sessions can bring their own live visualization (e.g. the breakpoint
// editor's envelope) — a `preview(canvas, text)` renderer redrawn on every
// keystroke and on theme change. It borrows the audio strip's canvas; the two
// uses never overlap (a session has either a wav or a preview renderer).
function renderPreview() {
  if (session?.preview) session.preview($('codeEditorWave'), currentValue());
}

function currentValue() {
  return editor ? editor.getValue() : fallbackTA ? fallbackTA.value : '';
}

function setValueQuiet(code) {
  muteChange = true;
  try {
    if (editor) editor.setValue(code);
    else if (fallbackTA) fallbackTA.value = code;
  } finally { muteChange = false; }
}

function ensureEditor(monaco) {
  if (editor) return;
  registerLanguages(monaco);
  applyMonacoTheme(monaco);
  window.addEventListener('themechange', () => applyMonacoTheme(monaco));
  editor = monaco.editor.create($('codeEditorHost'), {
    language: 'faust',
    theme: 'gem',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize,
    fontFamily: "ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, Consolas, 'Liberation Mono', monospace",
    scrollBeyondLastLine: false,
    tabSize: 4,
    wordWrap: 'off',
    renderLineHighlight: 'line',
    fixedOverflowWidgets: true,
  });
  editor.onDidChangeModelContent(() => {
    if (!muteChange && session) { session.onChange(editor.getValue()); markWaveStale(); renderPreview(); }
  });
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => session?.onCompile?.({ play: true }));
  // Monaco consumes Escape before the popover's light-dismiss sees it; close
  // the modal ourselves, but let open editor widgets claim the key first.
  editor.addCommand(monaco.KeyCode.Escape, () => box().hidePopover(),
    '!suggestWidgetVisible && !findWidgetVisible && !renameInputVisible');
}

// Monaco couldn't load (offline dev server, ancient WebView): degrade to a
// plain textarea inside the same modal so code editing still works.
function ensureFallback() {
  if (fallbackTA) return;
  fallbackTA = document.createElement('textarea');
  fallbackTA.spellcheck = false;
  fallbackTA.style.cssText = 'width:100%;height:100%;resize:none;border:0;outline:none;'
    + 'background:var(--paper);color:var(--ink);font:13px/1.5 monospace;padding:8px;box-sizing:border-box';
  fallbackTA.style.fontSize = fontSize + 'px';
  fallbackTA.addEventListener('input', () => {
    if (!muteChange && session) { session.onChange(fallbackTA.value); markWaveStale(); renderPreview(); }
  });
  $('codeEditorHost').appendChild(fallbackTA);
}

// ---- public API -------------------------------------------------------------

async function openSession({ id, title, code, language, wav = null, stale = false, transportWrap = null, params = [], presets = [], onPreset = null, preview = null, onChange, onCompile = null, onClose = null }) {
  wire();
  session = null;   // no callbacks while we swap content in
  try {
    ensureEditor(await loadMonaco());
  } catch (e) {
    console.warn(e);
    ensureFallback();
  }
  if (editor) {
    window.monaco.editor.setModelLanguage(editor.getModel(), language);
    // Repeated numeric values are the substance of BPF/partials/$DATA text, not
    // symbol references. Do not light up every matching 0 (or other selected
    // value) in plain-data sessions; keep the useful code behaviour for Faust.
    const isCode = language === 'faust';
    editor.updateOptions({
      occurrencesHighlight: isCode ? 'singleFile' : 'off',
      selectionHighlight: isCode,
    });
  }
  // Make numeric tables legible immediately without notifying the owner just
  // because the modal opened. If the user subsequently edits the display text,
  // its extra spaces are harmless to the whitespace-based data parsers.
  const displayCode = language === 'cdp-data' ? alignNumericColumns(code) : code;
  setValueQuiet(displayCode);
  setErrors(null);
  session = { id, language, onChange, onCompile, presets, onPreset, onClose, preview };
  $('codeEditorTitle').textContent = title;
  $('codeEditorPresets').hidden = !presets.length || !onPreset;
  $('codeEditorCompile').hidden = !onCompile;
  $('codeEditorEdit').hidden = !editor;   // Monaco commands only — hidden in textarea-fallback mode
  const slot = $('codeEditorTransport');
  slot.textContent = '';
  if (transportWrap) slot.appendChild(transportWrap);
  // Adopted live DOM (the node's own param rows) — the caller's onClose puts
  // it back home, so never clear this slot destructively.
  const pslot = $('codeEditorParams');
  for (const p of params) pslot.appendChild(p);
  pslot.hidden = !params.length;
  if (!box().matches(':popover-open')) box().showPopover();
  setWav(wav);   // draw after showPopover — a hidden canvas has no size
  if (stale) markWaveStale();
  if (preview) { $('codeEditorPreview').hidden = false; $('codeEditorWave').classList.remove('stale'); renderPreview(); }
  if (editor) { editor.layout(); editor.focus(); }
  else fallbackTA?.focus();
}

// Open the editor for a Faust node. `onChange(code)` fires on every keystroke;
// `onCompile(opts)` is the node's recompile — the Compile button calls it
// bare, Cmd/Ctrl+Enter with { play: true } to audition the result.
// `wav`/`stale` seed the preview strip with the node's current audio;
// `transportWrap` is the node-owned play/loop control adopted into the strip.
// `presets` + `onPreset(p)` back the bar's Presets menu.
export function openCodeEditor(opts) {
  return openSession({ language: 'faust', ...opts });
}

// Open the editor over any plain-text widget: no compile or presets — just
// the editor. `onChange(text)` streams every keystroke back; `onClose` fires
// when the modal closes (for one-shot reparses/redraws); `preview(canvas,
// text)` renders a live visualization in the bottom strip after every edit.
let textSeq = 0;
export function openTextEditor({ title, text, language = 'cdp-data', preview = null, onChange, onClose = null }) {
  return openSession({ id: 'text:' + ++textSeq, title, code: text, language, preview, onChange, onClose });
}

// The ✎ button the text widgets share: opens `get()`'s text in the modal,
// streaming edits back through `apply(text)`.
export function textEditButton({ title, language, get, apply, preview = null, onClose = null, className = 'secondary', tip = 'Edit in the code editor' }) {
  const btn = el('button', { type: 'button', class: className, textContent: '✎', title: tip });
  btn.onclick = () => openTextEditor({ title, language, text: get(), preview, onChange: apply, onClose });
  return btn;
}

// Preset picked in the node while the modal shows that node → refresh content.
export function refreshCodeEditor(id, code) {
  if (session?.id !== id) return;
  setValueQuiet(code);
}

// Node (re)generated audio while the modal shows it → refresh the preview.
// null hides the strip (effects have no generated wav).
export function setCodeEditorWav(id, wav) {
  if (session?.id !== id) return;
  setWav(wav);
}

// Show/clear compile errors for a node. `msg` null/undefined clears. Faust
// errors look like "dsp : 12 : ERROR : …" — the line number becomes a marker.
export function setCodeEditorErrors(id, msg) {
  if (session?.id !== id) return;
  setErrors(msg);
}

function setErrors(msg) {
  const pre = $('codeEditorErr');
  pre.hidden = !msg;
  pre.textContent = msg || '';
  if (!editor) return;
  const monaco = window.monaco;
  const model = editor.getModel();
  if (!msg) { monaco.editor.setModelMarkers(model, 'faust', []); return; }
  // Only compiler messages carry a "dsp : <line> :" position; render/runtime
  // errors (no input connected, empty source…) show in the strip alone rather
  // than pinning a misleading marker to line 1.
  const m = msg.match(/:\s*(\d+)\s*:/);
  if (!m) { monaco.editor.setModelMarkers(model, 'faust', []); return; }
  const line = Math.min(parseInt(m[1], 10), model.getLineCount());
  monaco.editor.setModelMarkers(model, 'faust', [{
    startLineNumber: line, startColumn: 1,
    endLineNumber: line, endColumn: model.getLineMaxColumn(line),
    severity: monaco.MarkerSeverity.Error,
    message: msg,
  }]);
}

// Is the modal currently showing this node's session? (Used to gate work that
// only matters while the editor is up, e.g. rendering an effect preview.)
export function isCodeEditorOpen(id) {
  return session?.id === id && box().matches(':popover-open');
}

// Node deleted while its code is up → close the modal.
export function closeCodeEditor(id) {
  if (session?.id !== id) return;
  session = null;
  if (box().matches(':popover-open')) box().hidePopover();
}
