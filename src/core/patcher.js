// The modular patcher UI: draggable GEM windows (nodes) on the desktop, wired with
// cables, run on demand from an Output window. Built on the shared GEM helpers
// (ui.js), the execution engine (graph.js) and the cdp-wasm package.
import {
  $, el, dropdown, openMenuAt, gemSelect, gemAlert, gemPrompt, initTooltips, initTouchGestures, numField, paramRow, paramGrid, fitParamGrid, makeEnvelopeEditor, parseBrk,
  drawWave, wavDuration, log, setLogSink, ENVELOPE_PARAMS, axisFlags, makePartialsEditor, saveWavFile,
  canSaveFile, inEmbeddedHost, wavFileName,
} from '../ui/ui.js';
import { GraphRunner, validateConnection, byId, inEdge, inEdges, portKind, portAccepts, GENERATORS, genById, applyGenerator, envToBrk, envToPoints, layoutGraph } from './graph.js';
import { FAUST_PRESETS, DEFAULT_CODE, compileFaust, renderFaust } from '../dsp/faust.js';
import { EFFECTS, effectsByCategory, wavToAudioBuffer, encodeWav, decodeAudio } from 'cdp-wasm';
import { RECIPES } from '../data/recipes.js';
import { openWaveformEditor, activeWaveformEditor } from '../viz/waveform-editor.js';
import { createPlayer } from '../dsp/player.js';
import { createKeyboard } from '../ui/keyboard.js';
import { THEMES, applyTheme, currentTheme, themeColors, FONTS, applyFont, currentFont } from '../ui/themes.js';
import { initTempo, getBpm, setBpm } from '../data/tempo.js';
import { fuzzyMatch } from '../data/fuzzy.js';
import { openManual } from '../ui/manual.js';
import { openCodeEditor, refreshCodeEditor, setCodeEditorErrors, setCodeEditorWav, closeCodeEditor, codeEditorPreviewWav, isCodeEditorOpen, textEditButton } from '../ui/code-editor.js';
import { hostSupportsDragOut, beginNativeDragOut } from './host-bridge.js';
import { shareSupported, encodeShare, decodeShare, getShareParam, shareParamFromText, stripShareParam } from './share.js';

const SVGNS = 'http://www.w3.org/2000/svg';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// The bundled CDP demo sounds (audio/, shipped with the app and the dist bundle),
// offered as one-click examples in the Source node's URL… dialog. Same relative
// addresses the sound-file recipes use, so they resolve wherever the app is served.
const DEMO_SOUNDS = [
  { label: 'marimba', value: 'audio/marimba.wav', title: 'short pitched percussion — audio/marimba.wav' },
  { label: 'horn', value: 'audio/horn.wav', title: 'sustained instrument tone — audio/horn.wav' },
  { label: 'speech', value: 'audio/speech.wav', title: 'spoken counting voice — audio/speech.wav' },
  { label: 'frog', value: 'audio/frog.wav', title: 'textural / animal sound — audio/frog.wav' },
];

export function startPatcher(cdp, audioCtx, sampler = null) {
  const player = createPlayer(audioCtx);  // one shared voice across all nodes + the waveform editor

  // ---- sampler keyboard ------------------------------------------------------
  // A retro on-screen MIDI keyboard docked at the bottom. It drives `sampler`,
  // whose DSP runs either in the native plugin host (notes forwarded as MIDI) or in
  // the browser via Web Audio — auto-detected. Hidden by default; the View menu
  // toggles it and the choice travels with the patch (serialize()/loadPatch),
  // so New patch / Open restore the sampler's shown state along with the graph.
  let keyboard = null;
  function ensureKeyboard() {
    if (!keyboard && sampler) keyboard = createKeyboard(sampler);
    return keyboard;
  }
  // Show/hide the whole sampler dock; when showing, adopt whatever's rendered.
  function setKeyboardVisible(on) {
    const kb = ensureKeyboard();
    if (!kb) return;
    on ? kb.show() : kb.hide();
    if (on && lastResult) sampler.setSampleFromWav(lastResult);
  }
  function toggleKeyboard() {
    const kb = ensureKeyboard();
    if (!kb) return;
    setKeyboardVisible(!kb.visible);
    persist();   // remember the choice with the patch
  }
  const keyboardVisible = () => !!keyboard && keyboard.visible;
  const desktop = $('desktop');           // the scroll viewport
  const canvas = $('canvas');             // the scroll sizer (sized to the zoomed extent)
  const content = $('canvasContent');     // the zoomable layer nodes + cables live on
  // ---- canvas zoom ----------------------------------------------------------
  // Node coordinates (n.x/n.y) and cable paths are in unscaled "canvas units";
  // `content` carries a CSS transform: scale(zoom) so they render bigger/smaller.
  // Every screen↔canvas-units conversion therefore divides/multiplies by `zoom`.
  const modKey = /Mac|iP(hone|ad|od)/.test(navigator.platform) ? '⌘' : 'Ctrl';   // for menu shortcut hints
  const ZOOM_KEY = 'cdp-web-zoom', ZMIN = 0.25, ZMAX = 3;
  let zoom = 1;
  try { const z = +localStorage.getItem(ZOOM_KEY); if (Number.isFinite(z) && z > 0) zoom = clamp(z, ZMIN, ZMAX); } catch {}
  // Debounced: a pinch calls setZoom on every touchmove, and localStorage writes
  // are synchronous — persisting each frame stutters the gesture on mobile.
  let zoomSaveTimer = 0;
  const saveZoom = () => {
    clearTimeout(zoomSaveTimer);
    zoomSaveTimer = setTimeout(() => { try { localStorage.setItem(ZOOM_KEY, String(zoom)); } catch {} }, 250);
  };
  if (zoom !== 1) content.style.transform = `scale(${zoom})`;
  // Grow the canvas so it contains every window (+ margin), but never shrink below
  // the viewport. A wide auto-laid-out chain therefore makes the desktop scroll
  // rather than getting clamped off-screen. The inner `content` layer holds the
  // unscaled bounds; the `canvas` sizer is that times `zoom` so the desktop's
  // scrollbars match the visible (zoomed) extent.
  function growCanvas() {
    let maxX = 0, maxY = 0;
    for (const n of patch.nodes.values()) {
      if (!n.el) continue;
      maxX = Math.max(maxX, n.x + n.el.offsetWidth + 80);
      maxY = Math.max(maxY, n.y + n.el.offsetHeight + 80);
    }
    // Fill at least the viewport (measured in canvas units, i.e. screen px / zoom).
    const cw = Math.ceil(Math.max(maxX, desktop.clientWidth / zoom));
    const ch = Math.ceil(Math.max(maxY, desktop.clientHeight / zoom));
    content.style.width = cw + 'px';
    content.style.height = ch + 'px';
    canvas.style.width = Math.ceil(cw * zoom) + 'px';
    canvas.style.height = Math.ceil(ch * zoom) + 'px';
    updateMinimap();
  }
  // Set the zoom factor, keeping a screen point fixed under the cursor (or the
  // viewport centre when no anchor is given, e.g. for the keyboard shortcuts).
  function setZoom(z, anchor) {
    z = clamp(z, ZMIN, ZMAX);
    const r = desktop.getBoundingClientRect();
    const px = anchor ? anchor.x - r.left : desktop.clientWidth / 2;    // anchor offset within the viewport
    const py = anchor ? anchor.y - r.top : desktop.clientHeight / 2;
    const cx = (desktop.scrollLeft + px) / zoom;   // canvas-unit point under the anchor, pre-zoom
    const cy = (desktop.scrollTop + py) / zoom;
    zoom = z;
    content.style.transform = z === 1 ? '' : `scale(${z})`;
    growCanvas();   // resize the sizer + minimap for the new scale
    desktop.scrollLeft = cx * z - px;   // keep that point under the anchor
    desktop.scrollTop = cy * z - py;
    saveZoom();
  }
  const zoomBy = (f, anchor) => setZoom(zoom * f, anchor);
  // Fit the whole graph in the viewport: pick the zoom that makes the bounding box
  // of every window (plus a little padding) fit, then centre it. Drives the
  // minimap double-click "see everything" gesture.
  function zoomToFit() {
    const nodes = [...patch.nodes.values()].filter((n) => n.el && n.type !== 'log');
    if (!nodes.length) return;
    let minX = Infinity, minY = Infinity, maxX = 0, maxY = 0;
    for (const n of nodes) {
      minX = Math.min(minX, n.x); minY = Math.min(minY, n.y);
      maxX = Math.max(maxX, n.x + n.el.offsetWidth); maxY = Math.max(maxY, n.y + n.el.offsetHeight);
    }
    const pad = 40;   // canvas-unit breathing room around the graph
    minX -= pad; minY -= pad; maxX += pad; maxY += pad;
    const boxW = Math.max(1, maxX - minX), boxH = Math.max(1, maxY - minY);
    const vw = desktop.clientWidth, vh = desktop.clientHeight;
    zoom = clamp(Math.min(vw / boxW, vh / boxH), ZMIN, ZMAX);
    content.style.transform = zoom === 1 ? '' : `scale(${zoom})`;
    growCanvas();   // resize the sizer for the new scale (also refreshes the minimap)
    saveZoom();
    desktop.scrollLeft = (minX + boxW / 2) * zoom - vw / 2;   // centre the box
    desktop.scrollTop = (minY + boxH / 2) * zoom - vh / 2;
  }
  // Trackpad pinch (and ⌃+wheel) arrive as wheel events with ctrlKey set; zoom
  // toward the cursor. Plain two-finger scroll (no ctrlKey) keeps native scroll.
  desktop.addEventListener('wheel', (e) => {
    if (!e.ctrlKey) return;
    e.preventDefault();
    zoomBy(Math.exp(-e.deltaY * 0.0025), { x: e.clientX, y: e.clientY });
  }, { passive: false });
  // iOS Safari exposes page pinch as non-standard gesture events. The patcher
  // zooms the canvas itself (below); suppressing these over the desktop avoids
  // scaling the entire app while leaving one-finger canvas panning live.
  desktop.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  desktop.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  // Two-finger pinch on a touchscreen zooms the canvas, anchored on the midpoint
  // between the fingers (so it also drags the view along as the pinch moves).
  // Touch events, not pointer events: #desktop is a native scroll container, and
  // only preventDefault() on a non-passive touchmove takes the gesture off the
  // scroller — with pointer events the browser pans and sends us pointercancel.
  let pinch = null;          // { dist, zoom } captured at touchstart
  let pinching = false;      // set while a pinch owns the gesture: suspends node drags
  const tDist = (a, b) => Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
  const tMid = (a, b) => ({ x: (a.clientX + b.clientX) / 2, y: (a.clientY + b.clientY) / 2 });
  desktop.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 2) { pinch = null; pinching = false; return; }
    pinch = { dist: Math.max(1, tDist(e.touches[0], e.touches[1])), zoom };
  }, { passive: true });
  desktop.addEventListener('touchmove', (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();      // stop the desktop scrolling under the pinch
    pinching = true;
    const [a, b] = e.touches;
    setZoom(pinch.zoom * (tDist(a, b) / pinch.dist), tMid(a, b));
  }, { passive: false });
  const endPinch = (e) => { if (e.touches.length < 2) { pinch = null; pinching = false; } };
  desktop.addEventListener('touchend', endPinch);
  desktop.addEventListener('touchcancel', endPinch);

  // ---- overview minimap -----------------------------------------------------
  // A small HUD that appears only when the patch is bigger than the visible
  // desktop: it draws every window scaled down, plus a rectangle for the current
  // viewport. Drag it to pan. Node/viewport colours track the active theme.
  const minimap = $('minimap');
  const mmCtx = minimap.getContext('2d');
  let mmScale = 1;
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#000';
  function updateMinimap() {
    // Draw in unscaled canvas units; the viewport rect converts scaled scroll px
    // back to canvas units via /zoom.
    const cw = content.offsetWidth, ch = content.offsetHeight;            // canvas units
    const vw = desktop.clientWidth, vh = desktop.clientHeight;            // screen px
    if (canvas.offsetWidth <= vw + 1 && canvas.offsetHeight <= vh + 1) { minimap.style.display = 'none'; return; }  // fits — hide
    minimap.style.display = 'block';   // (not '' — the stylesheet default is display:none)
    mmScale = Math.min(200 / cw, 140 / ch);
    const W = Math.max(1, Math.round(cw * mmScale)), H = Math.max(1, Math.round(ch * mmScale));
    const dpr = window.devicePixelRatio || 1;
    minimap.width = W * dpr; minimap.height = H * dpr;
    minimap.style.width = W + 'px'; minimap.style.height = H + 'px';
    const ink = cssVar('--ink'), desk = cssVar('--desk');
    mmCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    mmCtx.clearRect(0, 0, W, H);
    for (const n of patch.nodes.values()) {
      if (!n.el || n.type === 'log') continue;
      mmCtx.fillStyle = ink;
      mmCtx.globalAlpha = 0.55;
      mmCtx.fillRect(n.x * mmScale, n.y * mmScale, Math.max(2, n.el.offsetWidth * mmScale), Math.max(2, n.el.offsetHeight * mmScale));
    }
    mmCtx.globalAlpha = 1;
    mmCtx.strokeStyle = desk; mmCtx.lineWidth = 1.5;
    mmCtx.strokeRect(desktop.scrollLeft / zoom * mmScale + 0.75, desktop.scrollTop / zoom * mmScale + 0.75,
      Math.max(2, vw / zoom * mmScale - 1.5), Math.max(2, vh / zoom * mmScale - 1.5));
  }
  // Drag/click on the minimap pans the desktop so the pointed-at spot is centred.
  function mmPanTo(e) {
    const r = minimap.getBoundingClientRect();
    // (click / mmScale) is a canvas-unit point; *zoom → scaled scroll px.
    desktop.scrollTo({
      left: (e.clientX - r.left) / mmScale * zoom - desktop.clientWidth / 2,
      top: (e.clientY - r.top) / mmScale * zoom - desktop.clientHeight / 2,
    });
  }
  minimap.addEventListener('pointerdown', (e) => {
    e.preventDefault(); minimap.setPointerCapture(e.pointerId); mmPanTo(e);
    const mv = (ev) => mmPanTo(ev);
    const up = () => { minimap.removeEventListener('pointermove', mv); minimap.removeEventListener('pointerup', up); };
    minimap.addEventListener('pointermove', mv); minimap.addEventListener('pointerup', up);
  });
  minimap.addEventListener('dblclick', (e) => { e.preventDefault(); zoomToFit(); });   // "see everything"
  desktop.addEventListener('scroll', () => { if (minimap.style.display !== 'none') updateMinimap(); });
  // growCanvas, not just updateMinimap: the canvas sizer only fills the viewport
  // as measured when it last ran, so a viewport that grows *after* load (e.g. a
  // plugin host restoring its saved editor size, or a live drag-resize) would
  // leave the desktop background showing around a stale, smaller canvas.
  // growCanvas ends by calling updateMinimap, so the minimap stays covered.
  addEventListener('resize', growCanvas);
  const cablesSvg = $('cables');
  // As a Run resolves each node, push its computed audio into that node's preview
  // (currently generators) so upstream sounds appear even if never manually built.
  const runner = new GraphRunner(cdp, (id, res) => {
    if (!res) return;
    if (res.kind === 'bank') {
      // Tell downstream nodes (e.g. a Pick's "item i of N" readout) what the
      // bank cabled into them holds.
      for (const e of patch.edges) if (e.from.node === id) patch.nodes.get(e.to.node)?.setBankInfo?.(res);
      return;
    }
    if (res.kind !== 'audio') return;   // skip spectral/breakpoint results
    patch.nodes.get(id)?.setPreviewWav?.(res.bytes);
  });
  const patch = { nodes: new Map(), edges: [], seq: 0, nextId() { return 'n' + (++this.seq); } };
  let zTop = 100, cascade = 0;
  let focusedId = null;         // the window the user last clicked — primary / rename / transport target
  const selection = new Set();  // node ids in the multi-selection — drives move / copy / delete
  let lastResult = null;        // most recent rendered WAV (for File ▸ Save result…)
  let lastResultStale = false;  // …and whether the graph changed since it rendered
  let lastResultLabel = '';     // …and the label of the Output window that rendered it
  let programList = [], spectralSet = new Set();
  let history = [], histIndex = -1;  // serialized-state snapshots for undo / redo
  let clipboard = null, pasteCascade = 0;   // copied subgraph (in-memory; also mirrored to the system clipboard)
  const waveScopes = [];             // {cvs,getWav,live,snap} mini-scopes to recolour on theme change + animate
  // The code-editor modal's preview strip joins the pool too, so it gets the
  // moving playhead and theme/tempo redraws; its getter returns null whenever
  // the modal is closed, which parks the scope.
  waveScopes.push({ cvs: document.getElementById('codeEditorWave'), getWav: codeEditorPreviewWav });
  const redrawScopes = () => { for (const s of waveScopes) if (s.cvs.isConnected) drawWave(s.cvs, s.getWav()); };
  addEventListener('themechange', redrawScopes);
  addEventListener('themechange', () => updateMinimap());   // re-read --ink for the new theme
  addEventListener('tempochange', redrawScopes);   // refresh beat gridlines

  // ---- mini-waveform playheads ----------------------------------------------
  // While the shared player runs, draw a moving playhead on whichever mini scope
  // shows the playing audio. Each scope snapshots its static waveform once at
  // playback start (cheap blit + line per frame, no per-frame re-decode) and
  // restores it when its audio stops. One rAF loop covers every node.
  let phRaf = 0;
  function restoreScope(s) { if (s.cvs.isConnected) drawWave(s.cvs, s.getWav()); s.live = false; s.snap = null; }
  function tickPlayheads() {
    phRaf = 0;
    const frac = player.progress();
    const { ink } = themeColors();
    const lw = Math.max(1, Math.round(devicePixelRatio || 1));
    for (const s of waveScopes) {
      if (!s.cvs.isConnected) { s.live = false; s.snap = null; continue; }
      // Skip zero-sized scopes (hidden — e.g. a Faust effect's genBox wave):
      // snapshotting a 0×0 canvas makes drawImage throw.
      if (frac != null && player.isPlaying(s.getWav()) && s.cvs.width > 0 && s.cvs.height > 0) {
        if (!s.live) {   // snapshot the static waveform once, before overlaying
          const o = document.createElement('canvas'); o.width = s.cvs.width; o.height = s.cvs.height;
          o.getContext('2d').drawImage(s.cvs, 0, 0);
          s.snap = o; s.live = true;
        }
        const ctx = s.cvs.getContext('2d');
        ctx.drawImage(s.snap, 0, 0);
        ctx.fillStyle = ink;
        ctx.fillRect(Math.round(frac * s.cvs.width) - (lw >> 1), 0, lw, s.cvs.height);
      } else if (s.live) {
        restoreScope(s);
      }
    }
    if (player.isPlaying()) phRaf = requestAnimationFrame(tickPlayheads);
  }
  // Wake the loop on any play/stop; it self-schedules while a voice is live, and
  // the wake on stop runs one final pass that restores the static waveforms.
  player.on(() => { if (!phRaf) phRaf = requestAnimationFrame(tickPlayheads); });

  const STORE_KEY = 'cdp-web-patch';
  // Inside the plugin the graph is per-instance document state owned by the host,
  // not shared browser localStorage (all plugin instances share one origin). We
  // route it to C++ instead — see persist()/readSaved() and the graph handler.
  const inPlugin = () => typeof IPlugSendMsg === 'function';
  // Embedded in a native WebView host (DAW extension) — signalled by the #cdpHost
  // session hash (see host-bridge.js). Together with inPlugin this covers every
  // native WebView we run inside, vs. a plain browser tab.
  const isEmbedded = inEmbeddedHost;
  const inNativeHost = () => inPlugin() || isEmbedded();
  // Plugin-only native OS drag of the rendered WAV out to the host DAW timeline.
  // Disabled for now: it fires on pointerdown and preempts the HTML5 drag, which
  // blocks the in-canvas "drop → new Source" gesture inside the plugin. Re-enable
  // once the native side only begins the OS drag when the pointer leaves the
  // plugin window (so an in-window drop still reaches the canvas).
  const NATIVE_DRAG_OUT_TO_DAW = false;
  // The Output node whose "Drag me" button is mid-drag, so the canvas drop handler
  // can clone its rendered WAV into a new Source (set on dragstart, cleared on end).
  let draggingOutput = null;
  // Drop an Output's "Drag me" onto the canvas → a new Source node holding that
  // rendered WAV, placed where it was dropped. Works in every context (browser,
  // extension, plugin); dropping outside the window is the desktop path handled by
  // the button's own DownloadURL drag (plain browser only). This is a same-page
  // drag, so `draggingOutput` (set on dragstart) is the signal — don't gate on
  // dataTransfer.types, which WebKit doesn't reliably expose for custom MIME types
  // during dragover.
  desktop.addEventListener('dragover', (e) => {
    // An OS file drag (a .cdp patch from Finder/Explorer) carries the Files type;
    // in-app drags never do, so this can't shadow the Output-clone gesture below.
    if (!draggingOutput && [...(e.dataTransfer?.types || [])].includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      return;
    }
    if (!draggingOutput) return;
    e.preventDefault();               // allow the drop
    e.dataTransfer.dropEffect = 'copy';
  });
  desktop.addEventListener('drop', async (e) => {
    // OS file drops onto the canvas: a .cdp/.json patch replaces the document
    // (same as File ▸ Open patch…); audio files land as Source nodes and .dsp
    // files as Faust devices, placed at the drop point (cascaded when several).
    // Anything else is swallowed with a hint — letting it through would
    // navigate the browser away from the app.
    if (!draggingOutput) {
      const files = [...(e.dataTransfer?.files || [])];
      if (!files.length) return;   // an in-app drag (e.g. a waveform-editor region)
      e.preventDefault();
      const r = desktop.getBoundingClientRect();
      const x = (desktop.scrollLeft + e.clientX - r.left) / zoom;
      const y = (desktop.scrollTop + e.clientY - r.top) / zoom;
      const patchFile = files.find((f) => /\.(cdp|json)$/i.test(f.name));
      if (patchFile) {
        if (files.length > 1) log(`opening ${patchFile.name} — the other dropped files were ignored`);
        try { loadPatch(JSON.parse(await patchFile.text()), { resetSample: true }); }
        catch (err) { logError('open failed: ' + err.message); }
        return;
      }
      const isAudio = (f) => f.type.startsWith('audio/') || /\.(wav|aiff?|aifc|flac|mp3|ogg|oga|opus|m4a|caf)$/i.test(f.name);
      let placed = 0;
      const place = (n) => { const o = 30 * placed++; n.x = x + o; n.y = y + o; n.el.style.left = n.x + 'px'; n.el.style.top = n.y + 'px'; };
      for (const f of files) {
        if (isAudio(f)) {
          const src = spawnSource(); place(src);
          try { src.setWav(await fileToWav(f), f.name); }
          catch (err) { logError(`couldn't decode ${f.name}: ${err.message}`); }
        } else if (/\.dsp$/i.test(f.name)) {
          const code = await f.text();
          // Compile once up front to learn the DSP's shape so the window spawns
          // with the right identity; spawnFaust recompiles anyway and surfaces
          // any error in the node itself if the code is broken.
          let kind = 'effect';
          try { kind = (await compileFaust(code)).nSources === 0 ? 'generator' : 'effect'; } catch { /* node shows the error */ }
          place(spawnFaust(kind, { code }));
        } else {
          logError(`can't open "${f.name}" — drop audio, .dsp (Faust) or .cdp patch files`);
        }
      }
      if (placed) recordHistory();
      return;
    }
    e.preventDefault();
    const wav = draggingOutput.result;
    draggingOutput = null;
    if (!wav) return;
    cloneOutputTo(wav, e.clientX, e.clientY);
  });
  // Land a rendered Output WAV in a new Source node at a screen point. Shared by
  // the HTML5 drop above and the touch drag on the Output's "Drag me" button.
  function cloneOutputTo(wav, clientX, clientY) {
    // Screen point → canvas units (undo the viewport scroll + zoom).
    const r = desktop.getBoundingClientRect();
    const x = (desktop.scrollLeft + clientX - r.left) / zoom;
    const y = (desktop.scrollTop + clientY - r.top) / zoom;
    const src = spawnSource();
    src.setWav(wav, 'from output');
    src.x = x; src.y = y; src.el.style.left = x + 'px'; src.el.style.top = y + 'px';
    recordHistory();
    return src;
  }
  // A host can inject its own action button(s) into every Output node's footer
  // (e.g. an "Apply" button) via window.__cdpHost.registerOutputAction.
  // The factory is (outputNode) => Element | Element[]; it replaces whatever the
  // last registration produced. Applied to existing and future Output nodes.
  let outputActionFactory = null;
  const applyOutputAction = (n) => {
    if (!n || !n.actionsEl) return;
    n.actionsEl.replaceChildren();
    if (!outputActionFactory) return;
    const made = outputActionFactory(n);
    (Array.isArray(made) ? made : [made]).filter(Boolean).forEach((e) => n.actionsEl.appendChild(e));
  };
  // Source samples are embedded into the host state copy of the graph so waveforms
  // restore on project reload — but only when small, to bound saved-project size.
  const MAX_EMBED_WAV = 1024 * 1024;   // 1 MB of WAV bytes
  const bytesToB64 = (bytes) => {
    let bin = ''; const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(bin);
  };
  const b64ToBytes = (b64) => {
    const bin = atob(b64); const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  };

  const node = (id) => patch.nodes.get(id);
  const cascadePos = () => { const o = (cascade++ % 9) * 30; return { x: 30 + o, y: 30 + o }; };
  // Any parameter / graph / source change makes rendered outputs out of date.
  const markDirty = () => { if (lastResult) lastResultStale = true; for (const n of patch.nodes.values()) n.markStale && n.markStale(); persist(); };

  // ---- auto-render ----------------------------------------------------------
  // When on, committing a parameter edit re-renders any out-of-date Output. The
  // trigger is the `change` event (fires on mouse-up / commit), NOT the per-tick
  // `input` during a drag — so a slider re-renders once you let go, not 60×/sec.
  // Off by default; the choice persists across sessions.
  const AUTO_RENDER_KEY = 'cdp-web-autorender';
  let autoRender = false;
  try { autoRender = localStorage.getItem(AUTO_RENDER_KEY) === 'true'; } catch { /* storage disabled */ }
  let autoRenderBusy = false, autoRenderPending = false;
  async function runAutoRender() {
    if (autoRenderBusy) { autoRenderPending = true; return; }   // coalesce edits made mid-render
    autoRenderBusy = true;
    try {
      do {
        autoRenderPending = false;
        const outs = [...patch.nodes.values()].filter((n) => n.type === 'output' && n.run && !n.upToDate());
        for (const o of outs) { try { await o.run(); } catch { /* error already logged by doRun */ } }
      } while (autoRenderPending);
    } finally { autoRenderBusy = false; }
  }
  const scheduleAutoRender = () => { if (autoRender) runAutoRender(); };
  function setAutoRender(on) {
    autoRender = !!on;
    try { localStorage.setItem(AUTO_RENDER_KEY, String(autoRender)); } catch { /* storage disabled */ }
    if (autoRender) scheduleAutoRender();   // catch up if something is already out of date
  }
  // A committed edit on any node control (slider release, number/select commit)
  // bubbles a `change` here; editor-overlay controls live on <body>, not desktop.
  desktop.addEventListener('change', scheduleAutoRender);

  // ---- CRT screen effect ----------------------------------------------------
  // Optional scanline/vignette overlay (toggled body class drives the CSS) to
  // give the whole UI an Atari-monitor look. Off by default; persisted.
  const CRT_KEY = 'cdp-web-crt';
  let crt = false;
  try { crt = localStorage.getItem(CRT_KEY) === 'true'; } catch { /* storage disabled */ }
  function setCrt(on) {
    crt = !!on;
    document.body.classList.toggle('crt', crt);
    try { localStorage.setItem(CRT_KEY, String(crt)); } catch { /* storage disabled */ }
  }
  document.body.classList.toggle('crt', crt);   // apply the saved choice on load

  // ---- session sample rate --------------------------------------------------
  // The processing rate for everything synthesised this session: generators emit
  // it (via the cdp-wasm '$SR' token) and Faust generators render at it, so all
  // generator-rooted output + intermediate files carry this rate. Loaded source
  // files keep their own native rate (CDP effects inherit the input rate) — the
  // Source ⓘ button flags any file whose rate differs from this. Persisted.
  const SR_KEY = 'cdp-web-samplerate';
  const SR_CHOICES = [44100, 48000, 96000];
  let sessionRate = 48000;
  try { const v = parseInt(localStorage.getItem(SR_KEY), 10); if (SR_CHOICES.includes(v)) sessionRate = v; } catch { /* storage disabled */ }
  runner.sampleRate = sessionRate;
  function setSampleRate(sr) {
    if (!SR_CHOICES.includes(sr) || sr === sessionRate) return;
    sessionRate = sr;
    runner.sampleRate = sr;
    try { localStorage.setItem(SR_KEY, String(sr)); } catch { /* storage disabled */ }
    refreshSourceInfo();          // re-evaluate every Source's rate-mismatch warning
    markDirty();                  // generators now render at a new rate → mark all stale
    scheduleAutoRender();
  }
  // Source windows register a callback here so their ⓘ readout/warning updates
  // live when the session rate changes (not only when a new file is loaded).
  const sourceInfoHooks = new Set();
  const refreshSourceInfo = () => { for (const fn of sourceInfoHooks) { try { fn(); } catch {} } };

  // ---- audio helpers --------------------------------------------------------
  // A Play/Stop button + Loop toggle, a view over the shared `player`. getWav() is
  // read at press time so the latest rendered/loaded audio is what plays. The
  // button label tracks the shared voice, so it flips to ■ Stop when this node's
  // audio is played from elsewhere (e.g. the waveform editor) and back to ▶ Play
  // when playback stops or moves to another node.
  function makeTransport(getWav) {
    let loop = false;
    // Both labels are stacked in the button so its box is always sized to the
    // wider of the two ('■ Stop' vs '▶ Play' differ in proportional fonts); only
    // the visibility flips on play/stop, so the button — and the node — never
    // reflow when the transport state changes.
    const playBtn = el('button', { class: 'secondary transport-play', type: 'button', disabled: true },
      el('span', { textContent: '▶ Play' }), el('span', { textContent: '■ Stop' }));
    const loopBtn = el('button', { class: 'secondary', type: 'button', textContent: '⟳ Loop', title: 'Loop playback' });
    const mine = () => player.isPlaying(getWav());
    const sync = () => { playBtn.classList.toggle('playing', mine()); };
    const off = player.on(sync);
    const stop = () => { if (mine()) player.stop(); };
    const play = async () => {
      const wav = getWav(); if (!wav) return;
      const buffer = wavToAudioBuffer(wav, audioCtx);
      await player.play({ token: wav, buffer, sampleRate: buffer.sampleRate, length: buffer.length, loop, origin: 'node' });
    };
    playBtn.onclick = () => { if (mine()) player.stop(); else play(); };
    loopBtn.onclick = () => { loop = !loop; loopBtn.classList.toggle('on', loop); if (mine()) player.setLoop(loop); };
    return { wrap: el('span', {}, playBtn, loopBtn), setEnabled: (on) => { playBtn.disabled = !on; if (!on) stop(); }, stop, dispose: off, play };
  }
  // Click a node's mini waveform to pop open the full-screen navigator. getWav()
  // is read at open time so the latest rendered/loaded audio is shown.
  function attachWaveZoom(cvs, getWav, getName, onCrop = null) {
    const nameOf = typeof getName === 'function' ? getName : () => getName;
    waveScopes.push({ cvs, getWav });   // re-rendered on theme change; animated during playback
    cvs.style.cursor = 'zoom-in';
    cvs.addEventListener('click', (e) => {
      e.stopPropagation();   // don't trigger the window roll-up shade
      const wav = getWav();
      if (wav) openWaveformEditor({ wav, audioCtx, name: nameOf(), onPromote: promoteToSource, onCrop, player });
    });
  }
  // Drop a region (selection or whole sound) from the waveform editor into a new
  // Source node, so it stays in the patch instead of round-tripping via a file.
  function promoteToSource(wav, name) {
    const n = spawnSource();
    n.setWav(wav, name || 'region');
  }
  async function saveWav(wav, name = wavFileName()) {
    if (!wav) return;
    const saved = await saveWavFile(wav, name);   // actual name (picker may rename); null = cancelled
    if (saved) log('saved ' + saved + ' (' + wav.length + ' bytes)');
  }
  async function genTone(freq, dur) {
    const r = await cdp.run('synth', ['wave', '1', '/t.wav', String(sessionRate), '1', String(dur), String(freq), '-a0.8'], { outputs: ['/t.wav'] });
    if (r.exitCode !== 0) throw new Error('synth failed: ' + (r.stderr || r.stdout));
    return r.outputs['/t.wav'];
  }
  function genPulses(freq, dur) {
    const sr = sessionRate, N = Math.floor(sr * dur), a = new Float32Array(N);
    const gap = Math.floor(sr * 0.22), glen = Math.floor(sr * 0.12);
    for (let s = 0; s + glen < N; s += gap)
      for (let i = 0; i < glen; i++) a[s + i] = 0.7 * Math.sin((2 * Math.PI * freq * i) / sr) * Math.sin((Math.PI * i) / glen);
    return encodeWav({ sampleRate: sr, channelData: [a] });
  }
  async function fileToWav(f) {
    let bytes = new Uint8Array(await f.arrayBuffer());
    const tag = String.fromCharCode(...bytes.slice(0, 4));
    if (tag !== 'RIFF' && tag !== 'FORM') {
      const { audioBufferToWav } = await import('cdp-wasm/wav');
      bytes = audioBufferToWav(await audioCtx.decodeAudioData(bytes.buffer.slice(0)));
    }
    return bytes;
  }

  // ---- cable layer ----------------------------------------------------------
  const portCenter = (portEl) => {
    const p = portEl.getBoundingClientRect(), d = canvas.getBoundingClientRect();
    // getBoundingClientRect is in screen px (scaled); /zoom → unscaled canvas units.
    return { x: (p.left - d.left + p.width / 2) / zoom, y: (p.top - d.top + p.height / 2) / zoom };
  };
  const cablePathD = (a, b) => {
    const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5);
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y}, ${b.x - dx} ${b.y}, ${b.x} ${b.y}`;
  };
  function drawEdge(e) {
    const fEl = node(e.from.node)?.portEl[e.from.port];
    const tEl = node(e.to.node)?.portEl[e.to.port];
    if (!fEl || !tEl) return;
    e.pathEl.setAttribute('d', cablePathD(portCenter(fEl), portCenter(tEl)));
  }
  const updateCablesFor = (id) => { for (const e of patch.edges) if (e.from.node === id || e.to.node === id) drawEdge(e); };
  const redrawAll = () => { for (const e of patch.edges) drawEdge(e); };
  addEventListener('resize', redrawAll);

  // Auto-arrange: lay the graph out as a left-to-right layered DAG (see
  // layoutGraph) using each window's measured size. A wide chain extends past the
  // viewport, so we grow the (scrollable) canvas to fit and scroll back to the
  // start rather than clamping nodes off-screen. Used when loading a recipe and
  // from Edit ▸ Arrange nodes.
  function applyAutoLayout() {
    const nodes = [...patch.nodes.values()].filter((n) => n.type !== 'log' && n.el);
    if (!nodes.length) return;
    const size = (n) => ({ w: n.el.offsetWidth || 220, h: n.el.offsetHeight || 120 });
    const pos = layoutGraph(nodes.map((n) => ({ id: n.id, ...size(n) })), patch.edges);
    for (const n of nodes) {
      const p = pos.get(n.id); if (!p) continue;
      const x = Math.max(4, Math.round(p.x)), y = Math.max(4, Math.round(p.y));
      n.x = x; n.y = y; n.el.style.left = x + 'px'; n.el.style.top = y + 'px';
    }
    growCanvas(); redrawAll(); persist();
    desktop.scrollTo({ left: 0, top: 0, behavior: 'smooth' });
  }

  function addEdge(from, to) {
    const v = validateConnection(patch, from, to);
    if (!v.ok) {
      log('cannot connect: ' + v.reason);
      if (v.reason.startsWith('type mismatch')) {
        const fk = portKind(node(from.node), from.port), tk = portKind(node(to.node), to.port);
        if (fk === 'audio' && tk === 'spectral') log('hint: double-click the ◇ input for a PVOC Analyse node');
        else if (fk === 'spectral' && tk === 'audio') log('hint: double-click the ◇ output for a PVOC Resynthesise node');
        else if (fk === 'bank' && tk === 'audio') log('hint: insert a Pick node (Process ▸ Control) to take one sound from the bank');
        else if (fk === 'audio' && tk === 'bank') log('hint: insert a Gather node (Process ▸ Control) to collect sounds into a bank');
      }
      return false;
    }
    const kind = portKind(node(from.node), from.port);
    const path = document.createElementNS(SVGNS, 'path');
    path.setAttribute('class', 'cable' + (kind !== 'audio' ? ' ' + kind : '')); // spectral / breakpoint styling
    const e = { id: 'e' + (++patch.seq), from, to, pathEl: path };
    path.addEventListener('click', () => removeEdge(e));
    path.addEventListener('mouseenter', () => showInsertFor(e));
    path.addEventListener('mousemove', () => showInsertFor(e));
    path.addEventListener('mouseleave', hideInsertSoon);
    cablesSvg.appendChild(path);
    patch.edges.push(e);
    node(from.node).portEl[from.port].classList.add('full');
    node(to.node).portEl[to.port].classList.add('full');
    if (to.port.startsWith('param:')) node(to.node).setParamDriven?.(to.port, true);
    drawEdge(e); markDirty();
    return true;
  }
  function removeEdge(e) {
    if (hoverEdge === e) hideInsertNow();
    e.pathEl.remove();
    patch.edges = patch.edges.filter((x) => x !== e);
    if (e.to.port.startsWith('param:')) node(e.to.node)?.setParamDriven?.(e.to.port, false);
    markDirty();
    // clear "full" marks if the ports now have no cables
    for (const end of [e.from, e.to]) {
      const used = patch.edges.some((x) => (x.from.node === end.node && x.from.port === end.port) || (x.to.node === end.node && x.to.port === end.port));
      if (!used) node(end.node)?.portEl[end.port]?.classList.remove('full');
    }
  }

  // The patch's main sink: the primary 'out', else the first Output window.
  const mainOutput = () => node('out') || [...patch.nodes.values()].find((x) => x.type === 'output');

  // Routes an output straight to the main Output, replacing whatever that Output
  // was previously fed — a quick "send this to the speakers". Reached by
  // double-click only when no neighbour will take the cable (see below).
  function connectOutToMain(n, port) {
    const out = mainOutput();
    if (!out) { log('no Output window to connect to'); return; }
    if (n.id === out.id) return;
    const from = { node: n.id, port: port.name };
    const to = { node: out.id, port: out.inPorts?.[0]?.name || 'in' };
    if (!portAccepts(out, to.port, port.kind)) {
      log(`cannot connect: type mismatch (${port.kind} → ${portKind(out, to.port)})`);
      if (port.kind === 'spectral') log('hint: insert a PVOC Resynthesise node (Process ▸ Spectral I/O)');
      return;
    }
    const cur = inEdges(patch, to.node, to.port);
    if (cur.length === 1 && cur[0].from.node === from.node && cur[0].from.port === from.port) return;   // already the sole feed
    for (const e of cur) removeEdge(e);   // replace the Output's current source(s)
    addEdge(from, to);
  }

  // How much a window being off the output's row counts against it, per pixel,
  // relative to horizontal distance. Below 1 ⇒ horizontal leads.
  const VERT_WEIGHT = 0.5;

  // Double-clicking an output port cables it onward to the neighbouring window
  // that will take it — the next step in the chain — rather than jumping to the
  // far end of the patch. Sinks must lie to the right of the socket, the way a
  // patch reads.
  //
  // "Nearest" can't be plain distance: windows differ hugely in height (a Source
  // is a couple of rows, an effect with a dozen params is tall), so the vertical
  // figure that matters is not how far the sockets are apart but how far the
  // *window* misses the output's height — a tall window level with the socket
  // misses by nothing, whichever of its sockets you measure.
  //
  // Patches read left to right, so the horizontal gap leads and that vertical
  // miss is a discount on it, weighted below 1 (VERT_WEIGHT). A window level
  // with the output still beats an equidistant one stacked above or below, but
  // a clearly closer window wins even a little off the row. The *window* is
  // scored first; only then is a socket chosen within it.
  //
  // Falls back to the main Output when nothing adjacent can take the cable, so
  // "double-click to send to the speakers" still works in a one-node patch.
  function connectOutToNeighbour(n, port) {
    const src = portCenter(n.portEl[port.name]);
    const from = { node: n.id, port: port.name };
    const byWin = new Map();
    for (const m of patch.nodes.values()) {
      if (m === n || !m.el) continue;
      const top = m.y, bottom = m.y + m.el.offsetHeight;   // canvas units, like portCenter
      const miss = Math.max(top - src.y, src.y - bottom, 0);   // 0 ⇒ the window spans the socket
      for (const p of [...(m.inPorts || []), ...(m.paramPorts || [])]) {
        const pe = m.portEl?.[p.name];
        if (!pe) continue;
        const c = portCenter(pe);
        if (c.x <= src.x) continue;   // must lie to the right of the output
        if (!validateConnection(patch, from, { node: m.id, port: p.name }).ok) continue;
        const w = byWin.get(m.id) || { miss, gap: Infinity, ports: [] };
        w.gap = Math.min(w.gap, c.x - src.x);
        w.ports.push({ to: { node: m.id, port: p.name }, used: inEdges(patch, m.id, p.name).length ? 1 : 0, dy: Math.abs(c.y - src.y) });
        byWin.set(m.id, w);
      }
    }
    const score = (w) => w.gap + w.miss * VERT_WEIGHT;
    const win = [...byWin.values()].sort((a, b) => score(a) - score(b))[0];
    if (win) {
      // Within the chosen window: a socket nothing feeds yet wins (so a second
      // source lands on a Mix's free input, not stacked on the first), then the
      // one closest to the output's own height.
      const pick = win.ports.sort((a, b) => a.used - b.used || a.dy - b.dy)[0];
      // The main Output keeps its "replace what's playing" reading — otherwise
      // this and shift-double-click would be the same gesture whenever the
      // Output happens to be the neighbour.
      if (pick.to.node === mainOutput()?.id) connectOutToMain(n, port);
      else addEdge(from, pick.to);
      return;
    }
    const out = mainOutput();
    if (out && out.id !== n.id && portAccepts(out, out.inPorts?.[0]?.name || 'in', port.kind)) { connectOutToMain(n, port); return; }
    // A spectral (◇) output has nowhere to go but another spectral socket, and
    // an Output never takes one — so rather than leave the diamond dangling,
    // build the bridge back to the time domain and carry on from there. Only
    // while the socket is empty: otherwise a second double-click, which can't
    // re-use the cable it already laid, would spawn a second Resynthesise.
    if (port.kind === 'spectral' && !patch.edges.some((e) => e.from.node === n.id && e.from.port === port.name)) {
      createPvocResynthFor(n, port); return;
    }
    log(`no free ${port.kind} input to the right`);
    if (port.kind === 'spectral') log('hint: insert a PVOC Resynthesise node (Process ▸ Spectral I/O)');
  }

  // The mirror of connectOutToNeighbour, for a node that has just been dropped
  // *ahead* of something: find the nearest window to the left whose output this
  // input takes and cable it in. Same scoring — the horizontal gap leads, and
  // missing the socket's row is a discount on it at VERT_WEIGHT per pixel.
  // Returns whether a cable was laid.
  function connectInFromNeighbour(n, port) {
    const pe0 = n.portEl?.[port.name];
    if (!pe0) return false;
    const dst = portCenter(pe0);
    const to = { node: n.id, port: port.name };
    let best = null;
    for (const m of patch.nodes.values()) {
      if (m === n || !m.el || !m.outPort) continue;
      const pe = m.portEl?.[m.outPort.name];
      if (!pe) continue;
      const c = portCenter(pe);
      if (c.x >= dst.x) continue;   // must lie to the left of the input
      const from = { node: m.id, port: m.outPort.name };
      if (!validateConnection(patch, from, to).ok) continue;
      const miss = Math.max(m.y - dst.y, dst.y - (m.y + m.el.offsetHeight), 0);
      const s = (dst.x - c.x) + miss * VERT_WEIGHT;
      if (!best || s < best.s) best = { s, from };
    }
    if (best) addEdge(best.from, to);
    return !!best;
  }

  // The window (if any) that a node of n's size would land on at (x, y).
  function clashAt(n, x, y) {
    const w = n.el?.offsetWidth || 200, h = n.el?.offsetHeight || 120;
    return [...patch.nodes.values()].find((m) => m !== n && m.el
      && x < m.x + m.el.offsetWidth + 12 && m.x < x + w + 12
      && y < m.y + m.el.offsetHeight + 12 && m.y < y + h + 12);
  }
  // Drop a freshly spawned node at (x, y) in canvas units, sliding it clear of
  // any window already sitting there so it doesn't land on top of one.
  function placeNode(n, x, y) {
    x = Math.max(4, Math.round(x)); y = Math.max(4, Math.round(y));
    for (let i = 0; i < 8; i++) {
      const clash = clashAt(n, x, y);
      if (!clash) break;
      y = clash.y + clash.el.offsetHeight + 16;   // tuck under whatever is in the way
    }
    n.x = x; n.y = y; n.el.style.left = x + 'px'; n.el.style.top = y + 'px';
    growCanvas();
  }

  // Spectral cables carry PVOC analysis frames, not audio, so a diamond socket
  // only ever meets another diamond — the sound has to cross into (and back out
  // of) the spectral domain through a PVOC node. Double-clicking a diamond with
  // no spectral neighbour to take it therefore spawns that bridge, already
  // cabled, instead of just logging a hint: an Analyse ahead of an empty
  // spectral input, a Resynthesise after a spectral output.

  // Empty ◇ input: cable in the nearest spectral source to the left if there is
  // one, else spawn the PVOC Analyse that makes one — and feed *that* from the
  // nearest sound, so a single double-click finishes the conversion.
  function createPvocAnalyseFor(target) {
    const host = node(target.node);
    if (!host || inEdge(patch, target.node, target.port)) return;
    const port = host.inPorts?.find((p) => p.name === target.port);
    if (!port || connectInFromNeighbour(host, port)) return;   // an adjacent spectral node took it
    const an = spawnPvoc('anal');
    // Ahead of the window it feeds, so the cable reads left to right like the
    // rest of the patch. When that gap is taken — commonly by the very sound we
    // are about to analyse — go beneath the host instead rather than sliding
    // down past it: that keeps the Analyse to the *right* of the sound, which is
    // what lets it pick the sound up below.
    const left = host.x - (an.el?.offsetWidth || 200) - 40;
    if (left >= 4 && !clashAt(an, left, host.y)) placeNode(an, left, host.y);
    else placeNode(an, host.x, host.y + (host.el?.offsetHeight || 120) + 16);
    // ports need a layout pass before the cables can be drawn to them
    requestAnimationFrame(() => {
      if (!patch.nodes.has(an.id)) return;   // closed again before the cables were drawn
      addEdge({ node: an.id, port: 'out' }, target);
      connectInFromNeighbour(an, an.inPorts[0]);   // pick up a sound sitting to its left
      persist();
    });
  }

  // ◇ output with nothing spectral to its right: spawn the PVOC Resynthesise
  // that ends the spectral chain, then let the ordinary double-click gesture
  // carry its audio onward (to a neighbour, or the main Output).
  function createPvocResynthFor(n, port) {
    const re = spawnPvoc('synth');
    placeNode(re, n.x + (n.el?.offsetWidth || 220) + 40, n.y);
    requestAnimationFrame(() => {
      if (!patch.nodes.has(re.id)) return;   // closed again before the cables were drawn
      if (addEdge({ node: n.id, port: port.name }, { node: re.id, port: 'in' })) {
        connectOutToNeighbour(re, re.outPort);
      }
      persist();
    });
  }

  // Shift-double-clicking an output port *mixes* it into the main Output instead
  // of replacing what's there. Audio inputs take any number of cables (the
  // runner sums them implicitly), so this just lays another cable — no Mix node
  // is spliced. Use an explicit Mix node when per-source gains are wanted.
  function mixIntoMain(n, port) {
    const out = mainOutput();
    if (!out) { log('no Output window to connect to'); return; }
    if (n.id === out.id) return;
    const to = { node: out.id, port: out.inPorts?.[0]?.name || 'in' };
    if (port.kind !== 'audio' || !portAccepts(out, to.port, 'audio')) {
      log('Shift-double-click mixes audio outputs only');
      return;
    }
    addEdge({ node: n.id, port: port.name }, to);   // dupes/cycles refused by validateConnection
  }

  // ---- insert-a-process-on-a-cable affordance -------------------------------
  // Hovering a cable shows a + at its midpoint; clicking it opens the palette
  // filtered to processes matching that cable's domain, and the chosen process
  // is spliced in between the two nodes.
  let hoverEdge = null, insertHideT = null;
  const insertBtn = el('button', { class: 'cable-insert', type: 'button', textContent: '+', title: 'Insert a process here' });
  insertBtn.style.display = 'none';
  content.appendChild(insertBtn);   // positioned in canvas units (cable midpoint), scales with zoom
  function showInsertFor(e) {
    const kind = portKind(node(e.from.node), e.from.port);
    if (kind !== 'audio' && kind !== 'spectral') return;   // only signal cables, not control
    clearTimeout(insertHideT);
    hoverEdge = e;
    const mid = e.pathEl.getPointAtLength(e.pathEl.getTotalLength() / 2);
    insertBtn.style.left = mid.x + 'px'; insertBtn.style.top = mid.y + 'px';
    insertBtn.style.display = '';
  }
  function hideInsertSoon() { clearTimeout(insertHideT); insertHideT = setTimeout(hideInsertNow, 180); }
  // No grace period: used when the cable itself goes away, which fires no
  // mouseleave (the path is simply gone), so the + would hover over nothing —
  // and clicking it would splice into a deleted edge.
  function hideInsertNow() { clearTimeout(insertHideT); insertBtn.style.display = 'none'; hoverEdge = null; }
  insertBtn.addEventListener('mouseenter', () => clearTimeout(insertHideT));
  insertBtn.addEventListener('mouseleave', hideInsertSoon);
  insertBtn.addEventListener('click', () => { if (hoverEdge) openInsertPalette(hoverEdge); });

  // Drag a new cable from a port socket.
  function startCableDrag(ev, portEl) {
    if (ev.button !== 0) return;  // only the primary button drags a cable
    ev.preventDefault(); ev.stopPropagation();
    const dir = portEl.dataset.dir, kind = portEl.dataset.kind;
    const from = { node: portEl.dataset.node, port: portEl.dataset.port };
    const start = portCenter(portEl);
    const downXY = { x: ev.clientX, y: ev.clientY };
    let moved = false;
    const rubber = document.createElementNS(SVGNS, 'path');
    rubber.setAttribute('class', 'cable rubber'); cablesSvg.appendChild(rubber);
    let hovered = null;
    const ptIn = (e) => { const d = canvas.getBoundingClientRect(); return { x: (e.clientX - d.left) / zoom, y: (e.clientY - d.top) / zoom }; };
    const onMove = (e) => {
      if (Math.abs(e.clientX - downXY.x) + Math.abs(e.clientY - downXY.y) > 4) moved = true;
      const p = ptIn(e);
      rubber.setAttribute('d', dir === 'out' ? cablePathD(start, p) : cablePathD(p, start));
      if (hovered) { hovered.classList.remove('compatible', 'bad'); hovered = null; }
      const tgt = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.gport');
      if (tgt && tgt !== portEl) {
        hovered = tgt;
        // kind check is accepts-aware: the input end of the prospective cable
        // decides which output kinds it takes (e.g. Output accepts audio or bank)
        const kindOk = dir === 'out'
          ? (tgt.dataset.accepts || tgt.dataset.kind).split(' ').includes(kind)
          : (portEl.dataset.accepts || kind).split(' ').includes(tgt.dataset.kind);
        const ok = tgt.dataset.dir !== dir && kindOk && tgt.dataset.node !== from.node;
        tgt.classList.add(ok ? 'compatible' : 'bad');
      }
    };
    const onUp = (e) => {
      removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp);
      rubber.remove(); if (hovered) hovered.classList.remove('compatible', 'bad');
      const tgt = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.gport');
      let connected = false;
      if (tgt && tgt.dataset.dir !== dir && tgt.dataset.node !== from.node) {
        const other = { node: tgt.dataset.node, port: tgt.dataset.port };
        if (dir === 'out') addEdge(from, other); else addEdge(other, from);
        connected = true;
      }
    };
    addEventListener('pointermove', onMove); addEventListener('pointerup', onUp);
  }

  // Double-clicking an empty breakpoint (circle) input spawns a Breakpoint
  // envelope window already cabled to it, so you don't have to add + wire one by
  // hand.
  function createBreakpointFor(target) {
    if (!patch.nodes.has(target.node) || inEdge(patch, target.node, target.port)) return;
    const bp = spawnBreakpoint();
    // Drop it directly beneath the node it automates (rather than the default
    // top-left cascade, which lands on top of things and gets messy).
    const host = node(target.node);
    if (host?.el && bp.el) {
      const x = Math.max(0, host.x);
      const y = host.y + host.el.offsetHeight + 16;
      bp.x = x; bp.y = y;
      bp.el.style.left = x + 'px'; bp.el.style.top = y + 'px';
      growCanvas();
    }
    // ports need a layout pass before the cable can be drawn to them
    requestAnimationFrame(() => addEdge({ node: bp.id, port: 'out' }, target));
  }

  // Create a port socket element (registers it on n.portEl, wires cable-drag).
  function makePort(n, port, dir) {
    // Most ports are named after their direction ('in' / 'out'), so spelling the
    // direction out again would read "in · in · audio". Keep it only where the
    // name doesn't already say it ('in2', 'analyse').
    const tip = [port.label || port.name, dir, port.kind].filter((p, i, a) => i === 0 || p !== a[0]).join(' · ');
    const g = el('i', { class: 'gport ' + port.kind, title: tip });
    g.dataset.node = n.id; g.dataset.port = port.name; g.dataset.kind = port.kind; g.dataset.dir = dir;
    g.dataset.accepts = (port.accepts || [port.kind]).join(' ');   // in-ports may take several kinds
    g.addEventListener('pointerdown', (e) => startCableDrag(e, g));
    g.addEventListener('dblclick', (e) => {
      e.preventDefault(); e.stopPropagation();
      if (dir === 'out') {
        (e.shiftKey ? mixIntoMain : connectOutToNeighbour)(n, port);   // shift still goes straight to the Output
      } else if (dir === 'in' && port.kind === 'breakpoint') {
        createBreakpointFor({ node: n.id, port: port.name });   // circle mod input → spawn a BPF wired to it
      } else if (dir === 'in' && port.kind === 'spectral') {
        createPvocAnalyseFor({ node: n.id, port: port.name });  // ◇ input → cable (or spawn) a PVOC Analyse
      }
    });
    n.portEl[port.name] = g;
    return g;
  }

  // ---- GEM window component -------------------------------------------------
  // spec: { node, title, body(HTMLElement) }. Reads node.inPorts / node.outPort.
  function makeWindow(n, title, body, opts = {}) {
    const close = el('button', { class: 'gwin-close', type: 'button', title: 'Close', textContent: '□' });
    const shade = el('button', { class: 'gwin-shade', type: 'button', title: 'Roll up / down', textContent: '▾' });
    const titleEl = el('span', { class: 'gwin-title' });
    // Optional ? button (CDP help): toggles a lazily-loaded usage panel in the body.
    const help = opts.help ? el('button', { class: 'gwin-help', type: 'button', title: 'CDP help', textContent: '?' }) : null;
    const bar = el('div', { class: 'gwin-bar' }, close, titleEl, ...(help ? [help] : []), shade);
    n.baseTitle = title; n.titleEl = titleEl; applyTitle(n);
    const toggleShade = () => { const on = win.classList.toggle('shaded'); shade.textContent = on ? '▸' : '▾'; updateCablesFor(n.id); persist(); };
    shade.addEventListener('click', (e) => { e.stopPropagation(); toggleShade(); });
    const portsIn = el('div', { class: 'gwin-ports gwin-ports-in' });
    const portsOut = el('div', { class: 'gwin-ports gwin-ports-out' });
    const bodyDiv = el('div', { class: 'gwin-body' }, body);
    const win = el('div', { class: 'gwin' }, bar, bodyDiv, portsIn, portsOut);
    if (help) {
      // Help slides out as a panel on the window's right edge (not in the body),
      // so opening it never grows the node vertically.
      const text = el('pre', { class: 'help-text' });
      const panel = el('div', { class: 'gwin-help-panel' }, text);
      win.appendChild(panel);
      let open = false;
      const load = async (force) => {
        if (force || !text.textContent) text.textContent = 'loading…';
        const t = await opts.help();
        if (open) text.textContent = t;
      };
      // Re-fetch on each open so nodes whose program can change (Raw process)
      // stay current; opts.help is memoised, so static nodes resolve instantly.
      help.addEventListener('click', (e) => {
        e.stopPropagation();
        open = !open; win.classList.toggle('help-open', open); help.classList.toggle('on', open);
        if (open) load(false);
      });
      // Live-refresh the open panel when the node's program/mode changes.
      n.refreshHelp = () => { if (open) load(true); };
    }
    win.dataset.node = n.id;
    win.style.left = n.x + 'px'; win.style.top = n.y + 'px'; win.style.zIndex = ++zTop;
    n.el = win; n.portEl = {};
    n.portsIn = portsIn; n.portsOut = portsOut;   // kept so nodes with dynamic I/O (Faust) can rebuild ports
    for (const p of n.inPorts || []) portsIn.appendChild(makePort(n, p, 'in'));
    if (n.outPort) portsOut.appendChild(makePort(n, n.outPort, 'out'));
    // A window with resizable content (e.g. the Log) keeps its cables in step.
    new ResizeObserver(() => updateCablesFor(n.id)).observe(win);

    const focus = () => { win.style.zIndex = ++zTop; };
    win.addEventListener('pointerdown', (e) => {
      focus();   // any click raises the window…
      // …but it only becomes the Delete-key target when you click the window
      // chrome (title bar / empty body) — not an inner control — so a stray
      // Delete after pressing a button or tweaking a field can't wipe it.
      if (!e.target.closest('button, input, select, textarea, a, [contenteditable], .gport')) {
        // Touch has no reliable modifier gesture, so it is deliberately
        // single-selection only. Mouse/trackpad keep the full additive model.
        if (e.pointerType === 'touch') setSelection([n.id]);
        else if (e.shiftKey || e.metaKey || e.ctrlKey) toggleSelection(n.id);   // additive: keep the rest
        else if (!selection.has(n.id)) setSelection([n.id]);               // select just this one
        // plain click on an already-selected node keeps the group (so a group drag can start)
        setFocus(n.id);
      }
    }, true);
    bar.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;  // right/middle button: let contextmenu open the menu, don't start a drag
      if (e.target.closest('.gwin-close, .gwin-shade, .gwin-help')) return;  // let the title-bar buttons get their own click
      focus();
      // Dragging a node outside the current selection collapses to just it; dragging
      // a member of a multi-selection moves the whole group by the same delta.
      if (!selection.has(n.id)) { setSelection([n.id]); setFocus(n.id); }
      const movers = (selection.has(n.id) && selection.size > 1) ? [...selection].map(node).filter((m) => m && m.el) : [n];
      const origin = movers.map((m) => { m.el.style.zIndex = ++zTop; return { m, x: m.x, y: m.y }; });
      const sx = e.clientX, sy = e.clientY;
      bar.setPointerCapture(e.pointerId);
      let abandoned = false;   // a second finger landed: the gesture became a pinch
      const mv = (ev) => {
        if (pinching) abandoned = true;   // and stays abandoned — resuming would jump the node
        if (abandoned) return;
        const dx = (ev.clientX - sx) / zoom, dy = (ev.clientY - sy) / zoom;   // screen px → canvas units
        for (const o of origin) {
          const w = o.m.el;
          const x = clamp(o.x + dx, 0, content.clientWidth - w.offsetWidth), y = clamp(o.y + dy, 4, content.clientHeight - 30);
          o.m.x = x; o.m.y = y; w.style.left = x + 'px'; w.style.top = y + 'px';
          updateCablesFor(o.m.id);
        }
        if (minimap.style.display !== 'none') updateMinimap();
      };
      const up = () => { bar.removeEventListener('pointermove', mv); bar.removeEventListener('pointerup', up); growCanvas(); persist(); };
      bar.addEventListener('pointermove', mv); bar.addEventListener('pointerup', up);
    });
    close.addEventListener('click', () => requestRemove(n));
    bar.addEventListener('dblclick', (e) => { if (e.target.closest('.gwin-close, .gwin-shade, .gwin-help')) return; toggleShade(); });
    bar.addEventListener('contextmenu', (e) => { if (e.target.closest('.gwin-close, .gwin-shade, .gwin-help')) return; e.preventDefault(); e.stopPropagation(); openNodeMenu(n, e.clientX, e.clientY); });

    content.appendChild(win);
    patch.nodes.set(n.id, n);
    if (n.type !== 'log') { growCanvas(); persist(); }   // node creation is a graph change worth saving
    // ports get their real positions only after layout — draw any cables next frame
    requestAnimationFrame(() => updateCablesFor(n.id));
    return win;
  }

  function removeNode(n) {
    n.transportDispose?.();   // drop the node's player 'change' listener
    n.pedDispose?.();         // stop the partials-editor preview animation + its listener
    n.infoDispose?.();        // unregister a Source's sample-rate info hook
    for (const e of patch.edges.filter((x) => x.from.node === n.id || x.to.node === n.id)) removeEdge(e);
    n.el?.remove();
    patch.nodes.delete(n.id);
    if (focusedId === n.id) focusedId = null;
    selection.delete(n.id);   // keep the multi-selection consistent
    growCanvas();   // recompute (may shrink) the scroll area after a node leaves
    markDirty();
  }

  // Window title: an optional user label, with the node's real name in brackets
  // after it, e.g. "Filter Sweep (BREAKPOINT)". No label → just the real name.
  function applyTitle(n) {
    if (!n.titleEl) return;
    n.titleEl.textContent = n.name ? `${n.name} (${n.baseTitle.toUpperCase()})` : n.baseTitle;
  }
  // Rename via a modal prompt (right-click the title bar). Empty clears the label.
  async function renameNode(n) {
    const name = await gemPrompt(
      `Rename the <b>${n.baseTitle}</b> window:`, n.name || '',
      { ok: 'Rename', placeholder: n.baseTitle },
    );
    if (name === null) return;                 // cancelled
    n.name = name || '';
    applyTitle(n);
    persist();                                 // a label change is worth saving / undoing
  }

  // Right-click menu for a node's title bar. Selects the node first (unless it's
  // already part of a multi-selection), so commands act on the expected target —
  // mirroring the drag/click selection rules. Single-node-only items (Rename,
  // Roll up, CDP help) are hidden when several windows are selected.
  function openNodeMenu(n, x, y) {
    if (!selection.has(n.id)) { setSelection([n.id]); setFocus(n.id); }
    const many = selection.size > 1 && selection.has(n.id);
    const count = selection.size;
    const win = n.el;
    const shade = win.querySelector('.gwin-shade');
    const help = win.querySelector('.gwin-help');
    openMenuAt(x, y, () => {
      const items = [];
      if (!many) items.push({ label: 'Rename…', action: () => renameNode(n) });
      items.push({ label: many ? `Duplicate ${count} windows` : 'Duplicate', action: () => duplicateSelection() });
      items.push({ label: `Copy${many ? ` ${count} windows` : ''}  (${modKey}C)`, action: () => copySelection() });
      items.push({ sep: true });
      if (!many && shade) items.push({ label: win.classList.contains('shaded') ? 'Roll down' : 'Roll up', action: () => shade.click() });
      items.push({ label: 'Bring to front', action: () => { win.style.zIndex = ++zTop; } });
      if (!many && help) items.push({ label: 'CDP help', checked: win.classList.contains('help-open'), action: () => help.click() });
      // Only on nodes with curated parameter ranges to leave behind.
      if (!many && n.setUnlocked) {
        items.push({ sep: true });
        items.push({ label: 'Unlock ranges', checked: !!n.state.unlocked, action: () => n.setUnlocked(!n.state.unlocked) });
      }
      items.push({ sep: true });
      items.push(many
        ? { label: `Delete ${count} windows  (⌫)`, action: () => deleteSelection() }
        : { label: 'Delete  (⌫)', action: () => requestRemove(n) });
      return items;
    });
  }

  // Mark one window as focused (the Delete-key target) and ring it.
  function setFocus(id) {
    if (focusedId === id) return;
    focusedId = id;
    for (const m of patch.nodes.values()) m.el?.classList.toggle('focused', m.id === id);
  }
  // ---- multi-selection (move / copy / delete target) ------------------------
  const syncSelectionClass = () => { for (const m of patch.nodes.values()) m.el?.classList.toggle('selected', selection.has(m.id)); };
  function setSelection(ids) {
    selection.clear();
    for (const id of ids) if (node(id)) selection.add(id);
    syncSelectionClass();
    const last = [...selection].pop();
    if (last) setFocus(last);
  }
  const toggleSelection = (id) => { if (!node(id)) return; selection.has(id) ? selection.delete(id) : selection.add(id); syncSelectionClass(); };
  const clearSelection = () => { if (selection.size) { selection.clear(); syncSelectionClass(); } };
  // The working set for a command: the multi-selection, else the single focused node.
  const effectiveSelection = () => (selection.size ? [...selection] : (focusedId ? [focusedId] : []));

  // Bring a window to the front, un-shade (maximise) it, and focus it — used by
  // the View menu to surface a window that may be buried or rolled up.
  function revealNode(n) {
    n.el.style.zIndex = ++zTop;
    if (n.el.classList.contains('shaded')) {
      n.el.classList.remove('shaded');
      const sh = n.el.querySelector('.gwin-shade');
      if (sh) sh.textContent = '▾';
      updateCablesFor(n.id);
      persist();
    }
    setFocus(n.id);
  }

  // Delete a window — but always confirm first (it drops the window's cables too),
  // and never remove the last Output, since that's the only place to Run/save.
  let confirmingDelete = false;
  async function requestRemove(n) {
    if (confirmingDelete || !patch.nodes.has(n.id)) return;
    confirmingDelete = true;
    try {
      const outputs = [...patch.nodes.values()].filter((x) => x.type === 'output').length;
      if (n.type === 'output' && outputs <= 1) {
        await gemAlert(
          'The <b>Output</b> window can’t be deleted — it’s the only one, and it’s where you Run and save a result.<br><br>Add another with <b>File ▸ Add audio file output</b> first if you want to remove this one.',
          [{ label: 'OK', value: 'ok', primary: true }],
        );
        return;
      }
      const choice = await gemAlert(
        `Delete the <b>${titleOf(n)}</b> window? Its cables go too.<br>You can bring it back with <b>Edit ▸ Undo</b>.`,
        [{ label: 'Cancel', value: 'cancel' }, { label: 'Delete', value: 'delete', primary: true }],
      );
      if (choice === 'delete') removeNode(n);
    } finally {
      confirmingDelete = false;
    }
  }

  // Delete every selected node in one undoable step, with a single confirm. The
  // last Output is protected (skipped); a single-node selection reuses requestRemove.
  async function deleteSelection() {
    if (confirmingDelete) return;
    let targets = effectiveSelection().map(node).filter((n) => n && n.type !== 'log' && patch.nodes.has(n.id));
    if (!targets.length) return;
    if (targets.length === 1) return requestRemove(targets[0]);
    confirmingDelete = true;
    try {
      const totalOutputs = [...patch.nodes.values()].filter((x) => x.type === 'output').length;
      const selOutputs = targets.filter((x) => x.type === 'output').length;
      if (selOutputs >= totalOutputs && totalOutputs > 0) {
        targets = targets.filter((x) => x.type !== 'output');   // never remove the last Output
        if (!targets.length) {
          await gemAlert('The <b>Output</b> window can’t be deleted — it’s where you Run and save a result.<br><br>Add another with <b>File ▸ Add audio file output</b> first.', [{ label: 'OK', value: 'ok', primary: true }]);
          return;
        }
      }
      const choice = await gemAlert(
        `Delete <b>${targets.length}</b> windows? Their cables go too.<br>You can bring them back with <b>Edit ▸ Undo</b>.`,
        [{ label: 'Cancel', value: 'cancel' }, { label: 'Delete', value: 'delete', primary: true }],
      );
      if (choice !== 'delete') return;
      for (const n of targets) removeNode(n);
      clearSelection();
      recordHistory();   // one deterministic undo entry for the whole multi-delete
    } finally {
      confirmingDelete = false;
    }
  }

  // ---- node factories -------------------------------------------------------
  // A Source is now purely an audio-file loader; synthesis lives in Generator
  // nodes (see spawnGenerator / the Generate menu).
  function spawnSource(init = null) {
    const pos = cascadePos();
    const n = { id: patch.nodes.size ? patch.nextId() : 'src', type: 'source', ...pos,
      source: { kind: 'file', wav: null, name: null }, inPorts: [], outPort: { name: 'out', kind: 'audio' } };
    const wave = el('canvas', { style: 'height:70px' });
    // Only Sources get Crop — it replaces this node's own audio with the region.
    // Cropping detaches a url source: the region no longer matches the remote file.
    attachWaveZoom(wave, () => n.source.wav, () => n.source.name || 'Source', (cropped, label) => { n.source.kind = 'file'; n.source.url = null; setWav(cropped, label); });
    const status = el('div', { class: 'muted', style: 'font-size:14px;margin:4px 0', textContent: 'empty' });
    const transport = makeTransport(() => n.source.wav);
    n.transportDispose = transport.dispose;

    // ⓘ readout: decode the loaded file's header and report its native format.
    // CDP effects inherit the input rate, so a file whose rate differs from the
    // session rate keeps its own rate through the chain — we flag that mismatch.
    const info = el('div', { class: 'muted sr-info', style: 'font-size:13px;margin:2px 0;display:none;white-space:pre-line' });
    // Offered only on a rate mismatch: resample this file to the session rate via
    // CDP's housekeep respec (cubic-spline SRC), so the whole chain runs at it.
    const resampleBtn = el('button', { type: 'button', class: 'secondary', style: 'display:none;margin:2px 0;font-size:13px', textContent: 'Resample' });
    let infoOpen = false;
    const chanName = (c) => (c === 1 ? 'mono' : c === 2 ? 'stereo' : `${c}ch`);
    const fmtDur = (s) => (s >= 1 ? `${s.toFixed(2)}s` : `${Math.round(s * 1000)}ms`);
    const renderInfo = () => {
      const wav = n.source.wav;
      if (!wav) { info.textContent = ''; info.classList.remove('sr-warn'); status.classList.remove('sr-warn'); info.style.display = infoOpen ? '' : 'none'; resampleBtn.style.display = 'none'; return; }
      let d; try { d = decodeAudio(wav); } catch { info.textContent = 'unrecognised audio format'; info.classList.remove('sr-warn'); status.classList.remove('sr-warn'); info.style.display = infoOpen ? '' : 'none'; resampleBtn.style.display = 'none'; return; }
      const mismatch = d.sampleRate !== sessionRate;
      const tag = n.source.resampledFrom ? `  ·  ↻ resampled from ${(n.source.resampledFrom / 1000).toFixed(1)} kHz` : '';
      info.textContent = `${d.sampleRate} Hz · ${d.bitDepth || '?'}-bit · ${chanName(d.numChannels)} · ${fmtDur(d.length / d.sampleRate)}${tag}`
        + (mismatch ? `\n⚠ differs from session rate (${(sessionRate / 1000).toFixed(1)} kHz)` : '');
      info.classList.toggle('sr-warn', mismatch);
      status.classList.toggle('sr-warn', mismatch);
      if (mismatch) infoOpen = true;   // never hide an active warning
      info.style.display = infoOpen ? '' : 'none';
      resampleBtn.textContent = `Resample ${(d.sampleRate / 1000).toFixed(1)} → ${(sessionRate / 1000).toFixed(1)} kHz`;
      resampleBtn.style.display = mismatch ? '' : 'none';
    };
    sourceInfoHooks.add(renderInfo);   // live-refresh when the session rate changes
    n.infoDispose = () => sourceInfoHooks.delete(renderInfo);

    const setWav = (wav, label) => { n.source.wav = wav; n.source.name = label; n.source.resampledFrom = null; drawWave(wave, wav); status.textContent = label; transport.setEnabled(true); renderInfo(); markDirty(); };
    n.setWav = setWav;   // lets the waveform editor promote a region into this Source

    const fileInput = el('input', { type: 'file', accept: 'audio/*,.wav', style: 'display:none' });
    // Picking a file demotes a url source back to kind:'file' — otherwise the
    // saved patch would still carry the url and reload the wrong audio.
    fileInput.onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { const wav = await fileToWav(f); n.source.kind = 'file'; n.source.url = null; setWav(wav, f.name); } catch (err) { logError(err.message); } };
    const choose = el('button', { type: 'button', textContent: 'Choose file…' });
    choose.onclick = () => fileInput.click();
    // Fetch audio from a web address into this Source. URL sources are the one
    // kind that round-trips through save/load and share links: only the address
    // is stored and the audio is re-fetched. Used by recipes (bundled audio/),
    // shared patches, and the URL… button.
    const loadFromUrl = async (url, name) => {
      n.source.kind = 'url'; n.source.url = url; n.source.name = name || url;
      status.textContent = 'loading…';
      try {
        const resp = await fetch(new URL(url, location.href));
        if (!resp.ok) throw new Error(`fetch ${url}: ${resp.status}`);
        setWav(await fileToWav(await resp.blob()), name || url.split('/').pop());
      } catch (e) {
        status.textContent = 'load failed';
        logError(`audio URL failed: ${e.message} — the file's server must allow cross-origin (CORS) fetches`);
      }
    };
    const urlBtn = el('button', { type: 'button', class: 'secondary', textContent: 'URL…', title: 'Load audio from a web address — URL sources travel with saved patches and share links' });
    urlBtn.onclick = async () => {
      const u = await gemPrompt('Audio file URL<br><span class="muted">WAV/AIFF load directly; other formats decode via the browser.<br>The file’s server must allow cross-origin (CORS) fetches.</span>',
        n.source.url || '', { ok: 'Load', placeholder: 'https://example.com/sound.wav', examples: DEMO_SOUNDS });
      if (u) loadFromUrl(u);
    };
    const infoBtn = el('button', { type: 'button', class: 'secondary', textContent: 'ⓘ', title: 'Show audio file format (sample rate, bit depth, channels, duration)' });
    infoBtn.onclick = () => { infoOpen = !infoOpen; renderInfo(); };
    resampleBtn.onclick = async () => {
      const wav = n.source.wav; if (!wav) return;
      let origRate = null; try { origRate = decodeAudio(wav).sampleRate; } catch { /* leave null */ }
      resampleBtn.disabled = true;
      const prev = resampleBtn.textContent; resampleBtn.textContent = 'resampling…';
      try {
        // housekeep respec mode 1 = RESAMPLE to one of CDP's supported rates
        // (our session rates 44100/48000/96000 all qualify); preserves channels.
        const { bytes } = await cdp.process('housekeep', ['respec', '1', '$IN', '$OUT', String(sessionRate)], wav);
        setWav(bytes, n.source.name);          // re-decodes → warning + this button clear
        n.source.resampledFrom = origRate;     // …then mark the audio as converted (ⓘ note persists)
        renderInfo();
        log(`resampled "${n.source.name}" ${origRate ?? '?'} → ${sessionRate} Hz`);
      } catch (err) { logError('resample failed: ' + err.message); resampleBtn.textContent = prev; }
      finally { resampleBtn.disabled = false; }
    };

    const body = el('div', {}, el('div', { style: 'display:flex;gap:6px;align-items:center' }, choose, urlBtn, infoBtn), fileInput, status, info, resampleBtn, wave, transport.wrap);
    makeWindow(n, 'Source', body);
    // A url source fetches and decodes itself on load, so a recipe or shared
    // patch renders without a manual file pick.
    if (init && init.kind === 'url' && init.url) loadFromUrl(init.url, init.name);
    // Restoring a saved patch: file sources reopen empty (the audio isn't stored);
    // legacy tone/pulse sources from older patches regenerate their audio once.
    if (init && (init.kind === 'tone' || init.kind === 'pulses')) {
      n.source.kind = init.kind;
      (async () => {
        try {
          const wav = init.kind === 'pulses' ? genPulses(init.freq, init.dur) : await genTone(init.freq, init.dur);
          setWav(wav, `${init.kind} ${init.freq}Hz ${init.dur}s`);
        } catch (e) { logError(e.message); }
      })();
    }
    // Plugin host state can carry the source's WAV bytes inline (small samples only),
    // so a reloaded file source restores its audio + waveform instead of reopening
    // empty. Takes precedence over any url/tone regeneration above.
    if (init && init.wavB64) {
      try { setWav(b64ToBytes(init.wavB64), init.name || 'Source'); }
      catch (e) { logError('source restore failed: ' + e.message); }
    }
    return n;
  }

  // Audition helper for Generator nodes: run the synth program now (with the node's
  // inline envelopes + data) and return WAV. Cabled breakpoints only apply on a full
  // graph run; here we mirror the runner's inline-envelope/data staging.
  async function genAudio(spec, n) {
    const gdur = Number(n.state?.values?.dur) || 2;
    const brk = {};
    for (const [name, e] of Object.entries(n.state?.envs || {})) {
      if (!e || !e.text || !e.text.trim()) continue;
      const pr = spec.params.find((q) => q.name === name && q.env);
      if (!pr) continue;
      brk[name] = envToBrk(parseBrk(e.text), pr, gdur, e);
    }
    return applyGenerator(cdp, spec, n.state?.values || {}, { brk, data: n.data });
  }

  // Generators whose freeform $DATA is a newsynth SPECTRUM ("time pno level …"):
  // these get the partials multislider instead of a plain textarea.
  const PARTIALS_GENS = new Set(['addsynth', 'addsynth_packets']);

  // Extract a newsynth SPECTRUM (timbre-frame list) from a PVOC .ana by running
  // get_partials at a fixed time interval (one frame every `intervalMs` ms),
  // relative to `fundamental`. get_partials normalises each window to its own
  // loudest partial (level only — no overall amplitude), so we scale each frame
  // by the SOURCE's RMS envelope at that time: the resynthesis then keeps the
  // sound's dynamics (e.g. a gong decaying) instead of a flat, level spectrum.
  // `audioBytes` is the source WAV (for the envelope); without it frames stay
  // window-normalised. Returns a "time pno level …" string (first frame at t=0).
  async function analyseSpectrum(anaBytes, dur, fundamental, intervalMs, audioBytes, maxFrames = 1000) {
    const maxPartial = 32, threshold = 0.02;
    const step = Math.max(0.01, (intervalMs || 500) / 1000);
    const times = [];
    for (let t = 0; t < dur - 1e-3 && times.length < maxFrames; t += step) times.push(+t.toFixed(3));
    if (!times.length) times.push(0);
    // Source amplitude envelope: RMS over a window (~the frame step) at each time.
    let sig = null, sr = 0;
    if (audioBytes) { try { const d = decodeAudio(audioBytes); sig = d.channelData[0]; sr = d.sampleRate; } catch { /* no envelope */ } }
    const rms = (t) => {
      if (!sig) return 1;
      const half = Math.max(1, Math.round(step * sr / 2)), c = Math.round(t * sr);
      let s = 0, k = 0;
      for (let i = Math.max(0, c - half); i < Math.min(sig.length, c + half); i++) { s += sig[i] * sig[i]; k++; }
      return k ? Math.sqrt(s / k) : 0;
    };
    const frames = [];
    for (const t of times) {
      const res = await cdp.run('get_partials',
        ['harmonic', '3', '/in.ana', '/out.txt', String(fundamental), String(threshold), String(t), '-v'],
        { inputs: { '/in.ana': anaBytes }, outputs: ['/out.txt'] });
      const out = res.outputs['/out.txt'] && new TextDecoder().decode(res.outputs['/out.txt']);
      if (!out) continue;                                    // silence / no harmonics here
      const line = out.split('#').pop().split('\n').map((l) => l.trim()).find(Boolean);  // drop pitch-BPF header
      if (!line) continue;
      const tok = line.split(/\s+/).map(Number).slice(1);    // drop the line's own time field
      const pairs = [];
      for (let i = 0; i + 1 < tok.length; i += 2) if (tok[i] >= 1 && tok[i] <= maxPartial) pairs.push([tok[i], tok[i + 1]]);
      if (pairs.length) frames.push({ t, pairs, amp: rms(t) });
      await new Promise((r) => setTimeout(r));   // yield so the per-frame Wasm instance can be GC'd
    }
    if (!frames.length) return null;
    const maxAmp = Math.max(...frames.map((f) => f.amp)) || 1;   // loudest frame → full level
    const t0 = frames[0].t;                                      // newsynth requires the first frame at t=0
    return frames.map((f) => {
      const g = sig ? f.amp / maxAmp : 1;                        // per-frame amplitude (decay/swell)
      const vals = f.pairs.flatMap(([p, l]) => [p, +Math.min(1, l * g).toFixed(3)]);
      return [+(f.t - t0).toFixed(3), ...vals].join(' ');
    }).join('\n');
  }

  // Inharmonic import (gongs, bells, marimbas): find the sound's fixed spectral
  // modes from its strongest window, then track each mode's amplitude over time.
  // newsynth accepts non-integer partial *ratios* (first must be 1), so the modes
  // become partial ratios relative to the lowest, with per-mode time-varying
  // levels — capturing inharmonicity AND each mode's own decay. Returns
  // { data, f0 } (f0 = fundamental Hz, for the device Frequency) or null.
  async function analyseInharmonic(anaBytes, dur, intervalMs, maxFrames = 1000) {
    const maxModes = 32, relThr = 0.02;
    const step = Math.max(0.01, (intervalMs || 500) / 1000);
    const times = [];
    for (let t = 0; t < dur - 1e-3 && times.length < maxFrames; t += step) times.push(+t.toFixed(3));
    if (!times.length) times.push(0);
    // One PVOC window → its analysis channels {frq, amp} (specinfo print as text).
    const windowChannels = async (t) => {
      const r = await cdp.run('specinfo', ['print', '/in.ana', '/w.txt', String(t), '-w1'],
        { inputs: { '/in.ana': anaBytes }, outputs: ['/w.txt'] });
      const txt = r.outputs['/w.txt'] ? new TextDecoder().decode(r.outputs['/w.txt']) : '';
      const ch = []; const re = /amp\[\d+\]\s*=\s*([-\d.]+)\s*frq\[\d+\]\s*=\s*([-\d.]+)/g; let m;
      while ((m = re.exec(txt))) ch.push({ amp: +m[1], frq: +m[2] });
      return ch;
    };
    const windows = [];
    // Yield between windows so each pass's Wasm instance can be GC'd before the next.
    for (const t of times) { windows.push({ t, ch: await windowChannels(t) }); await new Promise((r) => setTimeout(r)); }
    // Modes come from the highest-energy window (the attack), as thresholded peaks.
    const energy = (ch) => ch.reduce((s, c) => s + c.amp * c.amp, 0);
    const rep = windows.slice().sort((a, b) => energy(b.ch) - energy(a.ch))[0];
    if (!rep || !rep.ch.length) return null;
    let peaks = [];
    for (let i = 1; i < rep.ch.length - 1; i++) {
      const c = rep.ch[i];
      if (c.frq > 40 && c.amp > rep.ch[i - 1].amp && c.amp >= rep.ch[i + 1].amp) peaks.push(c);
    }
    const maxPk = Math.max(...peaks.map((p) => p.amp)) || 1;
    peaks = peaks.filter((p) => p.amp > relThr * maxPk).sort((a, b) => b.amp - a.amp).slice(0, maxModes);
    const modes = peaks.sort((a, b) => a.frq - b.frq).map((p) => p.frq);
    if (modes.length < 2) return null;
    const f0 = modes[0], ratios = modes.map((f) => f / f0), band = (f) => Math.max(15, f * 0.03);
    // Each mode's amplitude per window (max channel amp within a ±band of the mode).
    const frames = windows.map((w) => ({ t: w.t, amps: modes.map((f) => {
      let a = 0, b = band(f);
      for (const c of w.ch) if (Math.abs(c.frq - f) < b) a = Math.max(a, c.amp);
      return a;
    }) }));
    const gmax = Math.max(...frames.flatMap((f) => f.amps)) || 1;
    const t0 = frames[0].t;
    const data = frames.map((f) => {
      const vals = [];
      ratios.forEach((r, i) => {
        vals.push(Math.abs(r - 1) < 1e-6 ? '1' : +r.toFixed(4), +Math.min(1, f.amps[i] / gmax).toFixed(3));
      });
      return [+(f.t - t0).toFixed(3), ...vals].join(' ');
    }).join('\n');
    return { data, f0 };
  }

  // Detect a source's fundamental (Hz) from its PVOC .ana via repitch getpitch,
  // taking the median of the voiced pitch points. Null if no clear pitch.
  async function detectFundamental(anaBytes) {
    try {
      const r = await cdp.run('repitch', ['getpitch', '2', '/in.ana', '/out.ana', '/pitch.txt'],
        { inputs: { '/in.ana': anaBytes }, outputs: ['/pitch.txt'] });
      const txt = r.outputs['/pitch.txt'] && new TextDecoder().decode(r.outputs['/pitch.txt']);
      if (!txt) return null;
      const hz = txt.trim().split('\n').map((l) => +l.trim().split(/\s+/)[1]).filter((f) => f > 20 && f < 8000).sort((a, b) => a - b);
      return hz.length ? hz[Math.floor(hz.length / 2)] : null;
    } catch { return null; }
  }

  // A Generator node: parameter controls (with ∿ envelope automation + breakpoint
  // input ports) + an optional data box, driving a CDP synth program. Audio out only.
  function spawnGenerator(genId, init = null) {
    const spec = genById[genId];
    const pos = cascadePos();
    const state = { values: init ? { ...init.values } : {}, envs: init?.envs ? { ...init.envs } : {}, unlocked: !!init?.unlocked };
    const n = { id: patch.nextId(), type: 'generator', genId, ...pos, state, wav: null,
      data: init?.data ?? (spec.data ? spec.data.default : null),
      // Spectrum generators get a ◇ spectral input: cable a PVOC Analyse node in and
      // the ◇ Analyse button extracts its partials. Ignored by the runner (UI-time seed).
      inPorts: PARTIALS_GENS.has(genId) ? [{ name: 'analyse', kind: 'spectral', label: 'analyse (PVOC)' }] : [],
      outPort: { name: 'out', kind: 'audio' }, paramPorts: [] };
    const body = el('div', {});
    if (spec.blurb) body.appendChild(el('div', { class: 'muted', style: 'font-size:14px;margin-bottom:6px', textContent: spec.blurb }));
    const wave = el('canvas', { style: 'height:70px' });
    attachWaveZoom(wave, () => n.wav, () => spec.label || 'Generator');
    const genBtn = el('button', { type: 'button', textContent: 'Generate' });
    let genPlaced = false;   // set when a sub-section places genBtn itself (partials gens share its row with Analyse)
    // Out-of-date indicator (like the Output node): once it has been generated,
    // any of this generator's own param/data/envelope edits shade the window and
    // flag the button until it's regenerated. `touch` also marks downstream stale.
    const markStale = () => { if (!n.wav || n.stale) return; n.stale = true; genBtn.textContent = '⟳ Generate'; n.el?.classList.add('stale'); wave.classList.add('stale'); };
    const clearStale = () => { n.stale = false; genBtn.textContent = 'Generate'; n.el?.classList.remove('stale'); wave.classList.remove('stale'); };
    const touch = () => { markStale(); markDirty(); };
    const driven = {};
    const sockets = [];
    const refreshers = [];   // re-bound every row when the unlock flag flips
    const grid = paramGrid();
    if (spec.params.length) body.appendChild(grid);
    for (const p of spec.params) {
      if (state.values[p.name] == null) state.values[p.name] = p.default;
      if (p.choices) {
        // discrete parameter -> a GEM dropdown (its trigger spans the grid's
        // slider column through to the far edge)
        const sel = el('select', {});
        for (const [lbl, val] of p.choices) sel.appendChild(el('option', { value: val, textContent: lbl }));
        sel.value = String(state.values[p.name]);
        sel.onchange = () => { state.values[p.name] = sel.value; touch(); };
        grid.appendChild(el('div', { class: 'prow-head' },
          el('label', { class: 'prow-label', textContent: p.label }), sel));
        gemSelect(sel);
      } else {
        const canEnv = !!p.env;
        const { row, setDriven, refreshRange } = paramRow(n.state, p, { canEnv, dur: Number(state.values.dur) || 2, onChange: touch, unlocked: () => !!n.state.unlocked });
        if (refreshRange) refreshers.push(refreshRange);
        grid.appendChild(row);
        (n.paramInputs ??= {})[p.name] = row.querySelector('input[type=range]');   // so the analyser can set Frequency
        if (canEnv) {
          n.paramPorts.push({ name: 'param:' + p.name, kind: 'breakpoint', label: p.label });
          driven[p.name] = setDriven;
          sockets.push({ name: 'param:' + p.name, row });
        }
      }
    }
    if (spec.params.length) fitParamGrid(grid);
    // optional data box (e.g. chord notes, click times) — or, for spectrum
    // generators, the partials multislider editing the same $DATA string.
    if (spec.data) {
      if (PARTIALS_GENS.has(genId)) {
        // The bars manage the "first partial must be 1" rule themselves, so drop
        // that note from the label shown in the UI.
        // No label: the format hint lives in the list-mode placeholder instead, to
        // save UI space (the bars are self-explanatory).
        const ped = makePartialsEditor({ get: () => n.data, set: (v) => { n.data = v; }, onChange: touch,
          dur: () => Number(n.state?.values?.dur) || 2,
          // Live preview: animate the bars/playhead while this node's own audio plays.
          playback: { progress: () => (player.isPlaying(n.wav) ? player.progress() : null), subscribe: (fn) => player.on(fn) } });
        body.appendChild(ped.el);
        n.pedDispose = ped.dispose;
        // ◇ Analyse: pull the PVOC source cabled to the spectral input and extract
        // its partials as timbre frames. Harmonic mode reads levels at multiples of
        // the device Frequency; Inharmonic mode finds the sound's own spectral modes
        // (gongs/bells) and sets Frequency to the detected fundamental.
        const anaBtn = el('button', { type: 'button', class: 'secondary', textContent: '◇ Analyse', title: 'Extract partials from the PVOC source cabled to the ◇ input' });
        const modeSel = el('select', { title: 'Harmonic: partials at multiples of Frequency. Inharmonic: the sound’s own modes (gongs, bells).' });
        modeSel.appendChild(el('option', { value: 'harmonic', textContent: 'Harmonic' }));
        modeSel.appendChild(el('option', { value: 'inharmonic', textContent: 'Inharmonic' }));
        const intervalInput = el('input', { type: 'number', value: 500, min: 10, step: 10, style: 'width:4.5rem', title: 'Frame interval: one timbre frame is extracted every N ms of the source' });
        const pitchChk = el('input', { type: 'checkbox', checked: true });
        const pitchLbl = el('label', { style: 'display:inline-flex;align-items:center;gap:3px', title: 'Detect the source pitch and set Frequency so the resynthesis matches the original' },
          pitchChk, el('span', { class: 'muted', textContent: 'match pitch' }));
        // Restore saved analyse settings (mode / interval / match-pitch) from the
        // patch or recipe, and expose them for serialize() so they round-trip.
        const a0 = init?.analyse || {};
        if (a0.mode === 'inharmonic') modeSel.value = 'inharmonic';
        if (a0.intervalMs) intervalInput.value = a0.intervalMs;
        if (a0.matchPitch === false) pitchChk.checked = false;
        n.getAnalyse = () => ({ mode: modeSel.value, intervalMs: Math.max(10, Number(intervalInput.value) || 500), matchPitch: pitchChk.checked });
        // Update the Frequency slider (+ readout + state) to a detected pitch.
        const setFreq = (hz) => { const rng = n.paramInputs && n.paramInputs.frq; if (rng) { rng.value = hz; rng.dispatchEvent(new Event('input', { bubbles: true })); } else { n.state.values.frq = hz; } };
        anaBtn.onclick = async () => {
          const e = inEdge(patch, n.id, 'analyse');
          if (!e) { gemAlert('Cable a PVOC Analyse node into the ◇ input first.\nSource → PVOC Analyse (Process ▸ Spectral I/O) → ◇\nOr double-click the ◇ and one is made for you.'); return; }
          anaBtn.disabled = true; anaBtn.textContent = '◇ Analysing…';
          try {
            const up = await runner._resolve(patch, e.from.node, new Map());
            if (!up || up.kind !== 'spectral') throw new Error('the ◇ input is not a spectral (PVOC) source');
            const intervalMs = Math.max(10, Number(intervalInput.value) || 500);
            // Frame count is derived from duration / interval. Each frame re-runs a
            // CDP program that stages the whole .ana into a fresh WebAssembly
            // instance, so many frames over a long (big-.ana) source exhaust the
            // tab's ~2-4 GB Wasm address space. Cap total work (frames × .ana bytes)
            // to a memory budget — big sources therefore allow fewer frames.
            const dur = up.dur || 2, WARN_AT = 100;
            const anaBytes = up.bytes.length;
            const MEM_BUDGET = 1024 * 1024 * 1024;   // ~1 GB of (frames × .ana) work
            const memCap = Math.max(4, Math.floor(MEM_BUDGET / Math.max(1, anaBytes)));
            const wantFrames = Math.max(1, Math.floor((dur - 1e-3) / Math.max(0.01, intervalMs / 1000)) + 1);
            const cap = Math.min(wantFrames, memCap);
            if (cap < wantFrames) {
              const proceed = await gemAlert(
                `This source is large (${dur.toFixed(0)} s, ${(anaBytes / 1048576).toFixed(0)} MB analysis). Analysing all ${wantFrames} frames would run out of WebAssembly memory, so it’ll be limited to <b>${cap}</b> frames.<br>For finer detail, analyse a shorter source (or a section of it).`,
                [{ label: 'Cancel', value: false }, { label: 'Analyse', value: true, primary: true }]);
              if (!proceed) return;
            } else if (cap > WARN_AT) {
              const proceed = await gemAlert(
                `This will extract <b>${cap}</b> timbre frames — one analysis pass per frame, so it may take a while.<br>Increase the interval for fewer frames.`,
                [{ label: 'Cancel', value: false }, { label: 'Continue', value: true, primary: true }]);
              if (!proceed) return;
            }
            if (modeSel.value === 'inharmonic') {
              const res = await analyseInharmonic(up.bytes, dur, intervalMs, cap);
              if (!res) throw new Error('no clear spectral modes found in the source');
              n.data = res.data; ped.reload();
              const hz = Math.round(res.f0);
              if (pitchChk.checked) setFreq(hz);   // play at the detected fundamental (lowest mode)
              touch();
              log(`analysed ${res.data.split('\n').length} frame(s), inharmonic — fundamental ${hz} Hz, ${intervalMs} ms/frame`);
            } else {
              // Harmonic: optionally detect the source pitch first so the extracted
              // harmonics align and playback matches the original pitch.
              let freq = Number(n.state.values.frq) || 220;
              if (pitchChk.checked) { const f0 = await detectFundamental(up.bytes); if (f0) { freq = Math.round(f0); setFreq(freq); } }
              // Pull the source audio (PVOC Analyse node's input) for the RMS
              // envelope, so the import keeps the sound's dynamics (a decay).
              let audioBytes = null;
              const ai = inEdge(patch, e.from.node, 'in');
              if (ai) { try { const a = await runner._resolve(patch, ai.from.node, new Map()); if (a && a.kind === 'audio') audioBytes = a.bytes; } catch { /* envelope optional */ } }
              const data = await analyseSpectrum(up.bytes, dur, freq, intervalMs, audioBytes, cap);
              if (!data) throw new Error(`no significant partials found at ${freq} Hz — try matching Frequency to the source pitch`);
              n.data = data; ped.reload(); touch();
              log(`analysed ${data.split('\n').length} timbre frame(s) — ${intervalMs} ms/frame at ${freq} Hz`);
            }
          } catch (err) { logError('Analyse: ' + err.message); }
          finally { anaBtn.disabled = false; anaBtn.textContent = '◇ Analyse'; }
        };
        // Read top-to-bottom as set-up → analyse → generate: the analysis settings
        // first, then the ◇ Analyse action, then Generate (appended below).
        body.appendChild(el('div', { style: 'display:flex;align-items:center;gap:6px;margin-top:6px;flex-wrap:wrap' },
          modeSel, intervalInput, el('span', { class: 'muted', textContent: 'ms / frame' }), pitchLbl));
        // Analyse + Generate share a row (and genBtn is claimed here, so the
        // generic append below skips it for partials generators).
        body.appendChild(el('div', { style: 'display:flex;gap:6px;margin-top:4px' }, anaBtn, genBtn));
        genPlaced = true;
        gemSelect(modeSel);
      } else {
        const ta = el('textarea', { rows: 3, spellcheck: false, placeholder: spec.data.placeholder || '', style: 'width:100%;margin-top:4px' });
        ta.value = n.data || '';
        ta.oninput = () => { n.data = ta.value; touch(); };
        const dataEdit = textEditButton({
          title: `${spec.label} — ${spec.data.label}`,
          get: () => ta.value,
          apply: (text) => { ta.value = text; n.data = text; touch(); },
        });
        body.append(el('div', { style: 'display:flex;align-items:center;gap:6px;margin-top:6px' },
          el('div', { class: 'muted', style: 'font-size:13px;flex:1', textContent: spec.data.label }), dataEdit), ta);
      }
    }
    n.setParamDriven = (portName, on) => driven[portName.slice('param:'.length)]?.(on);
    const transport = makeTransport(() => n.wav);
    n.transportDispose = transport.dispose;
    const generate = async () => {
      try {
        n.wav = await genAudio(spec, n); drawWave(wave, n.wav); transport.setEnabled(true);
        markDirty();    // downstream (the Output) is now out of date…
        clearStale();   // …but this generator is freshly current
      } catch (e) { logError(e.message); }
    };
    genBtn.onclick = generate;
    // Called by the runner during a Run with this generator's freshly computed
    // audio, so its preview/play come alive without a manual Generate. No
    // markDirty(): this audio reflects the current params, it isn't a fresh edit.
    n.setPreviewWav = (wav) => { if (!wav) return; n.wav = wav; drawWave(wave, wav); transport.setEnabled(true); clearStale(); };
    body.append(...(genPlaced ? [] : [el('div', { style: 'margin-top:6px' }, genBtn)]), wave, transport.wrap);
    // Changing a range can move a value, which invalidates the rendered audio.
    if (refreshers.length) n.setUnlocked = makeUnlocker(n, () => { for (const fn of refreshers) if (fn()) markStale(); });
    makeWindow(n, spec.label, body, { help: () => describeGenerator(spec) });
    if (n.state.unlocked) n.el.classList.add('unlocked');   // restored from a saved patch
    // inline breakpoint sockets: a visible ○ at the start of each automatable row.
    for (const s of sockets) {
      const g = makePort(n, { name: s.name, kind: 'breakpoint', label: s.name.slice(6) }, 'in');
      g.classList.add('rowport');
      s.row.querySelector('.prow-label').prepend(g);   // the label cell anchors it
    }
    if (!init) generate();   // fresh node: synthesize once so it isn't empty
    return n;
  }

  // Build the modulation map for a Faust generator's own inline envelopes (cabled
  // breakpoints are resolved by the runner at Run time). Mirrors genAudio.
  function genFaustAudio(n) {
    const gdur = Number(n.state?.values?.dur) || 3;
    const mod = {};
    for (const [name, e] of Object.entries(n.state?.envs || {})) {
      if (!e || !e.text || !e.text.trim()) continue;
      const p = (n.params || []).find((q) => q.name === name && q.env);
      mod[name] = envToPoints(parseBrk(e.text), p, gdur, e);
    }
    return renderFaust({ code: n.code, values: n.state?.values || {}, mod, dur: gdur, sampleRate: sessionRate });
  }

  const FAUST_HELP = [
    'FAUST DEVICE',
    '',
    'Write Faust DSP, press Compile, and it runs in the offline graph.',
    'Pick a preset to seed the editor, then edit freely. The code is',
    'saved with the patch.',
    '',
    'I/O is whatever the compiled DSP declares — the node rebuilds to match:',
    '  • 0 audio inputs  → a generator (renders Duration seconds)',
    '  • 1+ audio inputs → an effect (processes the input)',
    'Cables carry multichannel WAVs; a mono (1-in/1-out) effect on a',
    'stereo file processes each channel independently.',
    '',
    'Every UI control (hslider / nentry / button…) becomes an automatable',
    'parameter with a breakpoint input ○, exactly like the CDP nodes.',
    '',
    'A control held at 1 fires once per render (each render is a fresh DSP),',
    'so hslider("gate",1,0,1,1) with en.adsr(…, sustain=0, …) gives a',
    'one-shot decay — no envelope needed.',
  ].join('\n');

  // A Faust device: write Faust, Compile, and run it in the offline graph. The
  // node's I/O is DYNAMIC — it rebuilds to match whatever the compiled DSP declares
  // (0 inputs ⇒ a generator with a Generate button; ≥1 input ⇒ an effect). Every
  // DSP control becomes an automatable parameter with a breakpoint input, like the
  // CDP nodes. `kind` ('generator'|'effect') only seeds the preset list + code.
  function spawnFaust(kind, init = null) {
    const presets = FAUST_PRESETS[kind] || [];
    const pos = cascadePos();
    const state = { values: init ? { ...init.values } : {}, envs: init?.envs ? { ...init.envs } : {} };
    if (state.values.dur == null) state.values.dur = 3;
    // One audio input port per declared source cable (in, in2, in3…); 0 for a generator.
    const audioInPorts = (count) => Array.from({ length: count }, (_, i) => ({ name: i ? 'in' + (i + 1) : 'in', kind: 'audio', label: i ? 'in ' + (i + 1) : 'in' }));
    const n = { id: patch.nextId(), type: 'faust', faustKind: kind,
      code: init?.code ?? (presets[0]?.code || DEFAULT_CODE[kind]), ...pos, state, wav: null,
      params: [], nIn: kind === 'effect' ? 1 : 0, nOut: 1, nSources: kind === 'effect' ? 1 : 0,
      inPorts: audioInPorts(kind === 'effect' ? 1 : 0),
      outPort: { name: 'out', kind: 'audio' }, paramPorts: [] };

    const durDur = () => Number(state.values.dur) || 3;
    const wave = el('canvas', { style: 'height:70px' });
    attachWaveZoom(wave, () => n.wav, () => 'Faust ' + kind);
    const genBtn = el('button', { type: 'button', textContent: 'Generate' });
    const transport = makeTransport(() => n.wav);
    // A second transport living in the code-editor modal's preview strip.
    const modalTransport = makeTransport(() => n.wav);
    n.transportDispose = () => { transport.dispose(); modalTransport.dispose(); closeCodeEditor(n.id); };
    const markStale = () => { if (!n.wav || n.stale) return; n.stale = true; genBtn.textContent = '⟳ Generate'; n.el?.classList.add('stale'); wave.classList.add('stale'); };
    const clearStale = () => { n.stale = false; genBtn.textContent = 'Generate'; n.el?.classList.remove('stale'); wave.classList.remove('stale'); };
    // Param tweaks while the code editor is up re-render the preview after a
    // short settle (sliders fire per pixel). Code edits do NOT come through
    // here — auto-rendering mid-typing would compile half-written DSP.
    let regenTimer = 0;
    const touch = () => {
      markStale(); markDirty();
      if (!isCodeEditorOpen(n.id)) return;
      clearTimeout(regenTimer);
      regenTimer = setTimeout(() => { if (isCodeEditorOpen(n.id)) { if (n.nIn === 0) generate(); else previewEffect(); } }, 400);
    };

    // Header: preset picker + Compile.
    const sel = el('select', {});
    sel.appendChild(el('option', { value: '', textContent: 'Presets…' }));
    for (const p of presets) sel.appendChild(el('option', { value: p.id, textContent: p.label }));
    const compileBtn = el('button', { type: 'button', class: 'secondary', textContent: 'Compile' });
    const head = el('div', { style: 'display:flex;gap:.5rem;align-items:center;margin-bottom:6px' }, sel, compileBtn);

    const editBtn = el('button', { type: 'button', textContent: 'Edit code…', style: 'width:100%;margin:0 0 4px' });
    editBtn.onclick = async () => {
      editBtn.disabled = true; editBtn.textContent = 'Loading…';
      try {
        modalTransport.setEnabled(!!n.wav);
        // Adopt the node's live param rows (and, for generators, the Duration
        // row) into the modal's panel — same DOM, same state, so the sliders
        // show and set the values the render actually uses. Returned on close.
        const adopted = [paramsBox];   // Duration rides along inside it
        const homes = adopted.map((elm) => ({ elm, parent: elm.parentNode, next: elm.nextSibling }));
        await openCodeEditor({
          id: n.id,
          title: kind === 'generator' ? 'Faust generator' : 'Faust effect',
          code: n.code,
          wav: n.wav,
          stale: !!n.stale,
          transportWrap: modalTransport.wrap,
          params: adopted,
          presets,
          onPreset: applyPreset,
          onChange: (code) => { n.code = code; markStale(); markDirty(); },
          onCompile: (opts) => recompile(opts),
          onClose: () => {
            for (const h of homes) h.parent.insertBefore(h.elm, h.next);
            requestAnimationFrame(() => updateCablesFor(n.id));
          },
        });
        if (kind === 'effect' && !n.wav) previewEffect();   // seed the strip with the processed input
      } catch (e) { logError(e.message); }
      finally { editBtn.disabled = false; editBtn.textContent = 'Edit code…'; }
    };
    const errorBox = el('pre', { hidden: true, style: 'color:#e66;white-space:pre-wrap;margin:.3rem 0;font-size:12px' });
    const paramsBox = paramGrid();
    const durRow = paramRow(n.state, { name: 'dur', label: 'Duration (s)', min: 0.1, max: 30, default: 3, step: 0.1 }, { canEnv: false, onChange: touch }).row;
    const genBox = el('div', {}, el('div', { style: 'margin-top:6px' }, genBtn), wave, transport.wrap);
    const body = el('div', {}, head, editBtn, errorBox, paramsBox, genBox);

    // Rebuild the parameter rows + breakpoint sockets and re-create the audio in/out
    // ports from the current compiled spec (n.params / n.inPorts). Run after compile.
    const rebuild = () => {
      paramsBox.innerHTML = '';
      paramsBox.className = 'prows';   // fitParamGrid's column-dropping is per build
      n.portsIn.innerHTML = ''; n.portsOut.innerHTML = '';
      for (const k of Object.keys(n.portEl)) delete n.portEl[k];
      for (const p of n.inPorts) n.portsIn.appendChild(makePort(n, p, 'in'));
      if (n.outPort) n.portsOut.appendChild(makePort(n, n.outPort, 'out'));
      const driven = {};
      for (const p of n.params) {
        if (state.values[p.name] == null) state.values[p.name] = p.default;
        const { row, setDriven } = paramRow(n.state, p, { canEnv: true, dur: durDur(), onChange: touch });
        paramsBox.appendChild(row);
        driven[p.name] = setDriven;
        const g = makePort(n, { name: 'param:' + p.name, kind: 'breakpoint', label: p.label }, 'in');
        g.classList.add('rowport'); row.querySelector('.prow-label').prepend(g);
      }
      // A generator's Duration shares the DSP params' grid rather than sitting in
      // one of its own, so its slider is the same length as theirs. Re-appended
      // on every rebuild because the loop above clears the box.
      if (n.nIn === 0) paramsBox.appendChild(durRow);
      fitParamGrid(paramsBox);
      n.setParamDriven = (portName, on) => driven[portName.slice('param:'.length)]?.(on);
      for (const pp of n.paramPorts) if (inEdge(patch, n.id, pp.name)) n.setParamDriven(pp.name, true);
      genBox.hidden = n.nIn !== 0;
      requestAnimationFrame(() => updateCablesFor(n.id));
    };

    const generate = async () => {
      try { n.wav = await genFaustAudio(n); drawWave(wave, n.wav); transport.setEnabled(true); modalTransport.setEnabled(true); setCodeEditorWav(n.id, n.wav); markDirty(); clearStale(); }
      catch (e) { logError(e.message); }
    };
    n.setPreviewWav = (wav) => { if (!wav) return; n.wav = wav; drawWave(wave, wav); transport.setEnabled(true); modalTransport.setEnabled(true); setCodeEditorWav(n.id, wav); clearStale(); };
    genBtn.onclick = generate;

    // Effect preview while the code editor is up: run the upstream subgraph
    // through this effect (runner.run resolves any node, like the Pick node's
    // preview) — the runner's onNode callback lands the processed audio in
    // n.setPreviewWav, which fills the modal's preview strip.
    let previewing = false;
    const previewEffect = async (opts = {}) => {
      if (previewing || n.nIn === 0) return;
      if (!n.inPorts.some((p) => inEdges(patch, n.id, p.name).length)) return;   // nothing cabled in
      previewing = true;
      try {
        await runner.run(patch, n.id);
        if (opts.play && n.wav) modalTransport.play();
      } catch (e) {
        logError('Faust preview: ' + e.message);
        setCodeEditorErrors(n.id, e.message);
      } finally { previewing = false; }
    };

    let compiling = false;
    // opts.play: audition the freshly generated audio (code editor Cmd/Ctrl+Enter).
    const recompile = async (opts = {}) => {
      if (compiling) return; compiling = true;
      compileBtn.textContent = 'Compiling…'; compileBtn.disabled = true; errorBox.hidden = true;
      try {
        const spec = await compileFaust(n.code);
        const names = new Set(spec.params.map((p) => p.name));
        // drop cables to ports the new DSP no longer has (audio inputs + params)
        const newIns = audioInPorts(spec.nSources);
        const keepIn = new Set(newIns.map((p) => p.name));
        for (const p of n.inPorts) if (!keepIn.has(p.name)) for (const e of inEdges(patch, n.id, p.name)) removeEdge(e);
        for (const pp of n.paramPorts) { const nm = pp.name.slice('param:'.length); if (!names.has(nm)) { const e = inEdge(patch, n.id, pp.name); if (e) removeEdge(e); } }
        n.params = spec.params; n.nIn = spec.nIn; n.nOut = spec.nOut; n.nSources = spec.nSources;
        n.inPorts = newIns;
        n.paramPorts = spec.params.map((p) => ({ name: 'param:' + p.name, kind: 'breakpoint', label: p.label }));
        for (const k of Object.keys(state.values)) if (k !== 'dur' && !names.has(k)) delete state.values[k];
        for (const k of Object.keys(state.envs)) if (!names.has(k)) delete state.envs[k];
        rebuild();
        markDirty();
        setCodeEditorErrors(n.id, null);
        if (n.nIn === 0) {
          const gen = generate();
          // Play only after a successful render (a failed one leaves the node stale).
          if (opts.play) gen.then(() => { if (n.wav && !n.stale) modalTransport.play(); });
        } else {
          n.wav = null; transport.setEnabled(false); modalTransport.setEnabled(false); setCodeEditorWav(n.id, null);
          // With the editor up, re-render the input chain through the new DSP.
          if (isCodeEditorOpen(n.id)) previewEffect(opts);
        }
      } catch (e) {
        errorBox.textContent = e.message; errorBox.hidden = false; logError('Faust: ' + e.message);
        setCodeEditorErrors(n.id, e.message);
      } finally { compileBtn.textContent = 'Compile'; compileBtn.disabled = false; compiling = false; }
    };
    compileBtn.onclick = () => recompile();
    const applyPreset = (p) => { n.code = p.code; refreshCodeEditor(n.id, p.code); recompile(); };
    sel.onchange = () => { const p = presets.find((x) => x.id === sel.value); sel.value = ''; if (p) applyPreset(p); };

    makeWindow(n, kind === 'generator' ? 'Faust generator' : 'Faust effect', body, { help: () => Promise.resolve(FAUST_HELP) });
    gemSelect(sel);
    rebuild();      // initial ports/params from the kind default (before compile)
    recompile();    // compile the starter/loaded code → real I/O + params
    return n;
  }

  // ---- CDP help text --------------------------------------------------------
  // Each program embeds its own per-mode usage docs (parameter meanings, ranges,
  // units, "may vary over time" = breakpoint-able). We surface them by running
  // the program with just its mode tokens — CDP prints that mode's usage and
  // exits — then cache the text. No duplication; always matches the binary.
  const helpCache = new Map();
  function fetchHelp(program, mode) {
    const key = program + ' ' + mode.join(' ');
    if (!helpCache.has(key)) {
      const get = (toks) => cdp.run(program, toks)
        .then((r) => (r.stdout + r.stderr).trim().replace(/^CDP Release[^\n]*\n+/i, ''))
        .catch(() => '');
      const bad = (t) => !t || /insufficient param|^error:|too few param/im.test(t);
      helpCache.set(key, (async () => {
        let txt = await get(mode);
        if (bad(txt) && mode.length) txt = await get([]);   // fall back to the program's top-level usage
        return txt || '(no help text)';
      })());
    }
    return helpCache.get(key);
  }

  // Curated help for a catalog effect, composed from its own metadata — the blurb,
  // each parameter's friendly label / range / default / authored description, and
  // which parameters accept breakpoint envelopes. This keeps the curated nodes'
  // help at the altitude of their controls, rather than the raw CDP mode usage
  // (which the Raw process node still shows, being the low-level escape hatch).
  // Curated help for a generator, composed from its metadata (blurb, params with
  // ranges/choices/defaults, data box), with CDP's own mode usage appended when
  // the program actually prints it. (newsynth hides per-mode usage behind an
  // interactive menu, so for those only the curated part shows.)
  async function describeGenerator(spec) {
    const out = [];
    if (spec.blurb) out.push(spec.blurb, '');
    for (const p of spec.params || []) {
      const auto = p.env ? ', ↺ automatable' : '';
      if (p.choices) out.push(`${p.label}  (${p.choices.map(([l]) => l).join(' / ')}${auto})`);
      else out.push(`${p.label}  (${p.min}…${p.max}, default ${p.default}${auto})`);
    }
    if (!(spec.params || []).length) out.push('No adjustable parameters.');
    if (spec.data) out.push('', `Data — ${spec.data.label}`);
    // Where the catalog pins an argument, CDP's usage below still describes the
    // default we're overriding — so this has to sit between the two.
    if (spec.notes) out.push('', `Note: ${spec.notes}`);
    const usage = await fetchHelp(spec.program, spec.mode || []);
    if (usage && !/\(no help text\)|insufficient param|too few param|^error:/im.test(usage)) {
      out.push('', '— CDP usage —', usage);
    }
    return out.join('\n').trim();
  }
  function describeEffect(eff) {
    const out = [];
    if (eff.blurb) out.push(eff.blurb, '');
    const envs = ENVELOPE_PARAMS[eff.id] || [];
    for (const p of eff.params || []) {
      const auto = envs.includes(p.name) ? ', ↺ automatable' : '';
      out.push(`${p.label}  (${p.min}…${p.max}, default ${p.default}${auto})`);
      if (p.help) out.push('  ' + p.help);
      out.push('');
    }
    if (!(eff.params || []).length) out.push('No adjustable parameters.', '');
    const notes = [];
    if (eff.domain === 'spectral' && !eff.pipeline) notes.push('Spectral: wrapped in pvoc anal → synth.');
    if (eff.pipeline) notes.push('Takes ordinary audio — the spectral/pitch analysis happens internally.');
    if (eff.mono) notes.push('Mono program — stereo is processed per channel.');
    if (eff.inputs >= 2) notes.push('Needs a second sound on the in2 input.');
    if (eff.multiOut) notes.push('Produces a bank of sounds — wire its ▣ output to a Pick node or an Output.');
    if (eff.variadicInputs || eff.mixChain?.multiInput) notes.push('Takes extra sounds on its bank input (from a Gather node or a multi-output effect); with nothing on "in", the bank\'s first sound is the main input.');
    if (eff.setsChannels) notes.push('Sets its own output channel count (may be multichannel), regardless of the input.');
    if (notes.length) out.push(notes.join('\n'));
    return out.join('\n').trim();
  }
  // "Unlock ranges" (right-click the title bar). The catalog's min/max are a
  // curated span — the musically useful part of what the program accepts, sized
  // to give a slider worthwhile travel — and are usually a good deal narrower
  // than CDP's own limits. Unlocked, a row widens to the engine limit the catalog
  // records (hardMin/hardMax) or, where it records none, simply stops clamping:
  // typed values pass through and an argument the program refuses fails at run
  // time with CDP's own message. Re-locking pulls strays back inside.
  // Sibling-derived bounds (minOf/maxOf) are enforced either way — those encode
  // constraints CDP genuinely rejects rather than taste.
  function makeUnlocker(n, refreshAll) {
    return (on) => {
      n.state.unlocked = !!on;
      n.el?.classList.toggle('unlocked', !!on);
      refreshAll();       // re-bound every row; on re-lock this is what clamps
      markDirty();
    };
  }

  function spawnTransform(effectId, init = null) {
    const eff = byId[effectId];
    const pos = cascadePos();
    // Spectral effects carry .ana on their cables (use PVOC Analyse/Resynth nodes
    // to get in/out of the spectral domain); sound effects carry audio. pipeline
    // effects analyse internally — audio in/out despite domain:'spectral'.
    const kind = eff.domain === 'spectral' && !eff.pipeline ? 'spectral' : 'audio';
    const state = init ? { values: { ...init.values }, envs: { ...init.envs }, unlocked: !!init.unlocked } : { values: {}, envs: {} };
    const n = { id: patch.nextId(), type: 'transform', effectId, ...pos, state,
      inPorts: [{ name: 'in', kind }], outPort: { name: 'out', kind: eff.multiOut ? 'bank' : kind }, paramPorts: [] };
    if (eff.inputs >= 2) n.inPorts.push({ name: 'in2', kind });
    // Multi-input effects (rejoin, multimix, panorama…) take their extra sounds
    // as a bank: cable a multi-output effect or a Gather node into it.
    if (eff.variadicInputs || eff.mixChain?.multiInput) n.inPorts.push({ name: 'bank', kind: 'bank', label: 'extra sounds' });
    const body = el('div', {});
    if (eff.blurb) body.appendChild(el('div', { class: 'muted', style: 'font-size:14px;margin-bottom:6px', textContent: eff.blurb }));
    const driven = {};         // paramName -> setDriven(on)
    const sockets = [];        // {name, row} for envelope-capable params
    // A few parameters are bounded by a sibling (a spatialisation centre by the
    // channel count, isolate's minimum segment by its splice). Changing one has
    // to re-bound the others, so every row re-checks its range after any edit.
    const refreshers = [];
    // isolate's thresholds bound each other, so one pass can leave a value still
    // out of range; iterate to a fixed point (bounded — these settle in two).
    const refreshAll = () => {
      for (let pass = 0; pass < 4; pass++) {
        let moved = false;
        for (const fn of refreshers) if (fn()) moved = true;
        if (!moved) return;
      }
    };
    const onParamChange = () => { refreshAll(); markDirty(); };
    const grid = paramGrid();
    if ((eff.params || []).length) body.appendChild(grid);
    for (const p of eff.params || []) {
      const canEnv = (ENVELOPE_PARAMS[effectId] || []).includes(p.name);
      const { row, setDriven, refreshRange } = paramRow(n.state, p, { canEnv, dur: 1.5, onChange: onParamChange, unlocked: () => !!n.state.unlocked });
      if (refreshRange) refreshers.push(refreshRange);
      grid.appendChild(row);
      if (canEnv) {
        n.paramPorts.push({ name: 'param:' + p.name, kind: 'breakpoint', label: p.label });
        driven[p.name] = setDriven;
        sockets.push({ name: 'param:' + p.name, row });
      }
    }
    if (!(eff.params || []).length) body.appendChild(el('div', { class: 'muted', style: 'font-size:14px', textContent: 'No adjustable parameters' }));
    else fitParamGrid(grid);
    n.setParamDriven = (portName, on) => driven[portName.slice('param:'.length)]?.(on);
    if ((eff.params || []).length) n.setUnlocked = makeUnlocker(n, refreshAll);
    makeWindow(n, eff.label, body, { help: () => describeEffect(eff) });
    if (n.state.unlocked) n.el.classList.add('unlocked');   // restored from a saved patch
    // Inline breakpoint sockets: a visible ○ at the start of each automatable row.
    for (const s of sockets) {
      const g = makePort(n, { name: s.name, kind: 'breakpoint', label: s.name.slice(6) }, 'in');
      g.classList.add('rowport');
      s.row.querySelector('.prow-label').prepend(g);   // the label cell anchors it
    }
    return n;
  }

  // Breakpoint window: the shared envelope editor with one breakpoint output port
  // (cable it to a parameter's socket). Default is normalised 0..1, scaled to the
  // target's range + duration at run time; switch to absolute (real) values with
  // the 0–1/real button.
  function spawnBreakpoint(init = null) {
    const pos = cascadePos();
    const n = { id: patch.nextId(), type: 'breakpoint', ...pos,
      bp: init?.text != null ? { ...axisFlags(init), text: init.text } : { vnorm: true, tnorm: true, text: '0 0.15\n0.5 1\n1 0.15' },
      inPorts: [], outPort: { name: 'out', kind: 'breakpoint' } };
    const editor = makeEnvelopeEditor({ range: null, dur: 1, get: () => n.bp, set: (e) => { n.bp = e; }, onChange: markDirty });
    const help = [
      'BREAKPOINT ENVELOPE',
      '',
      'A curve that automates a parameter over time.',
      '',
      'GRAPH view: drag a node · dbl-click empty space to add ·',
      '            dbl-click a node to remove.',
      'TABLE view (▤ / ⊞): one "time value" pair per line.',
      '',
      'The value (y) and time (x) axes are independent:',
      '',
      'y 0–1 / y val  — value axis:',
      '  0–1  = normalised, scaled to each target\'s range',
      '         at run time (reusable on any parameter).',
      '  val  = absolute values, passed through unchanged.',
      '',
      'x 0–1 / x SEC / x BEAT  — time axis:',
      '  0–1  = normalised, scaled to the sound\'s duration.',
      '  SEC  = absolute seconds.',
      '  BEAT = tempo beats (snaps to the grid; set 1/4…1/32).',
      '',
      'Cable the output (○) into a parameter\'s breakpoint input.',
    ].join('\n');
    makeWindow(n, 'Breakpoint', el('div', {}, editor.el), { help: () => Promise.resolve(help) });
    requestAnimationFrame(editor.refresh);
    return n;
  }

  function spawnRaw(init = null) {
    const pos = cascadePos();
    const n = { id: patch.nextId(), type: 'rawTransform', ...pos, raw: { program: 'modify', args: '$IN $OUT', data: '' },
      inPorts: [{ name: 'in', kind: 'audio' }, { name: 'in2', kind: 'audio' }], outPort: { name: 'out', kind: 'audio' } };
    const sel = el('select', {});
    for (const p of programList) { const o = el('option', { value: p, textContent: spectralSet.has(p) ? `${p}  (spectral)` : p }); sel.appendChild(o); }
    if (programList.includes('modify')) sel.value = 'modify';
    const args = el('input', { type: 'text', value: exampleFor(sel.value), style: 'width:100%;margin-top:6px' });
    args.oninput = () => { n.raw.args = args.value; markDirty(); };
    n.raw.args = args.value;
    sel.onchange = () => { n.raw.program = sel.value; args.value = exampleFor(sel.value); n.raw.args = args.value; markDirty(); n.refreshHelp?.(); };
    n.raw.program = sel.value;
    const data = el('textarea', { rows: 3, spellcheck: false, placeholder: '$DATA breakpoints / data', style: 'width:100%;margin-top:6px' });
    data.oninput = () => { n.raw.data = data.value; markDirty(); };
    const dataEdit = textEditButton({
      title: 'Raw CDP — $DATA',
      get: () => data.value,
      apply: (text) => { data.value = text; n.raw.data = text; markDirty(); },
    });
    const hint = el('div', { class: 'muted', style: 'font-size:13px;margin-top:4px;display:flex;align-items:center;gap:6px' },
      el('span', { style: 'flex:1', html: '$IN $OUT audio · $ANA $OUTANA spectral · $DATA the box' }), dataEdit);
    const body = el('div', {}, sel, args, hint, data);
    const gs = gemSelect(sel);   // body gives sel a parent, so gemSelect's `sel.after(trigger)` lands
    if (init) {
      n.raw = { program: init.program, args: init.args, data: init.data || '' };
      if (programList.includes(init.program)) { sel.value = init.program; gs.sync(); }
      args.value = init.args; data.value = n.raw.data;
    }
    // The leading literal tokens of the current args select the program's mode
    // (e.g. 'speed' from 'speed 2 $IN $OUT -7'), so help follows the dropdown.
    const rawMode = () => {
      const out = [];
      for (const t of (n.raw.args || '').trim().split(/\s+/)) {
        if (!t || t.startsWith('$') || /^-?\d/.test(t)) break;
        out.push(t);
      }
      return out;
    };
    makeWindow(n, 'Raw process', body, { help: () => fetchHelp(n.raw.program, rawMode()) });
    return n;
  }

  // PVOC Analyse (audio→spectral) / Resynthesise (spectral→audio) — the bridges
  // in and out of the spectral domain, so spectral effects chain on .ana cables.
  function spawnPvoc(which) {
    const anal = which === 'anal';
    const pos = cascadePos();
    const n = { id: patch.nextId(), type: anal ? 'pvocAnalyse' : 'pvocResynth', ...pos,
      inPorts: [{ name: 'in', kind: anal ? 'audio' : 'spectral' }],
      outPort: { name: 'out', kind: anal ? 'spectral' : 'audio' } };
    const body = el('div', { class: 'muted', style: 'font-size:14px;max-width:190px',
      textContent: anal ? 'Audio → spectral. Feed spectral processes, then Resynthesise.'
                        : 'Spectral → audio. Ends a spectral chain.' });
    makeWindow(n, anal ? 'PVOC Analyse' : 'PVOC Resynthesise', body);
    return n;
  }

  // Pick: take one sound out of a bank (a multi-output effect's set of files) so
  // it can be auditioned and processed like any ordinary audio signal.
  function spawnPick(init = null) {
    const pos = cascadePos();
    const n = { id: patch.nextId(), type: 'pick', ...pos,
      state: { values: { index: Math.max(1, Math.round(Number(init?.values?.index) || 1)) }, envs: {} },
      inPorts: [{ name: 'in', kind: 'bank' }], outPort: { name: 'out', kind: 'audio' } };
    const body = el('div', {});
    body.appendChild(el('div', { class: 'muted', style: 'font-size:14px;margin-bottom:6px;max-width:200px', textContent: 'Take one sound from a bank.' }));
    const { row } = paramRow(n.state, { name: 'index', label: 'Item', min: 1, max: 64, default: 1, step: 1,
      help: 'Which sound of the bank to pass through (1 = first). Out-of-range picks the last.' }, { onChange: markDirty });
    body.appendChild(fitParamGrid(el('div', { class: 'prows' }, row)));
    const info = el('div', { class: 'muted', style: 'font-size:13px;margin:4px 0', textContent: 'not run yet' });
    // Fed by the runner: the upstream bank tells us how many sounds it holds.
    n.setBankInfo = (bank) => {
      const i = Math.min(bank.outputs.length, Math.max(1, Math.round(Number(n.state.values.index) || 1)));
      info.textContent = `item ${i} of ${bank.outputs.length}` + (bank.names?.[i - 1] ? ` — ${bank.names[i - 1]}` : '');
    };
    n.setPreviewWav = (bytes) => { n.previewWav = bytes; transport.setEnabled(true); };
    const transport = makeTransport(() => n.previewWav);
    n.transportDispose = transport.dispose;
    const audBtn = el('button', { class: 'secondary', type: 'button', textContent: '▶ Audition',
      title: 'Render up to this node and play the picked sound' });
    audBtn.onclick = async () => {
      audBtn.disabled = true;
      try {
        const res = await runner.run(patch, n.id);   // fires setPreviewWav via the runner callback
        if (res?.bytes) { n.previewWav = res.bytes; transport.setEnabled(true); transport.play(); }
      } catch (e) { logError('error: ' + e.message); }
      finally { audBtn.disabled = false; }
    };
    body.appendChild(info);
    body.appendChild(el('div', {}, audBtn, transport.wrap));
    makeWindow(n, 'Pick', body);
    return n;
  }

  // Gather: collect several sounds into one bank cable — the way to hand a set of
  // sources to a multi-input effect (multimix, panorama, rejoin) without a cable
  // per input on the effect itself.
  function spawnGather(init = null) {
    const pos = cascadePos();
    const count = Math.min(64, Math.max(2, Math.round(Number(init?.inputs) || 2)));
    const n = { id: patch.nextId(), type: 'gather', ...pos,
      inPorts: Array.from({ length: count }, (_, i) => ({ name: 'in' + (i + 1), kind: 'audio' })),
      outPort: { name: 'out', kind: 'bank' } };
    const body = el('div', {});
    body.appendChild(el('div', { class: 'muted', style: 'font-size:14px;margin-bottom:6px;max-width:200px', textContent: 'Collect sounds into a bank (top socket first).' }));
    const addBtn = el('button', { class: 'secondary', type: 'button', textContent: '+ input' });
    const delBtn = el('button', { class: 'secondary', type: 'button', textContent: '− input', title: 'Remove the last (uncabled) input' });
    addBtn.onclick = () => {
      const p = { name: 'in' + (n.inPorts.length + 1), kind: 'audio' };
      n.inPorts.push(p);
      n.portsIn.appendChild(makePort(n, p, 'in'));
      updateCablesFor(n.id); markDirty();
    };
    delBtn.onclick = () => {
      if (n.inPorts.length <= 2) return;
      const last = n.inPorts[n.inPorts.length - 1];
      if (inEdge(patch, n.id, last.name)) { log('disconnect the last input first'); return; }
      n.inPorts.pop();
      n.portEl[last.name]?.remove(); delete n.portEl[last.name];
      updateCablesFor(n.id); markDirty();
    };
    body.appendChild(el('div', {}, addBtn, delBtn));
    makeWindow(n, 'Gather', body);
    return n;
  }

  function spawnOutput() {
    const pos = cascadePos();
    const n = { id: patch.nodes.size ? patch.nextId() : 'out', type: 'output', ...pos,
      inPorts: [{ name: 'in', kind: 'audio', accepts: ['audio', 'bank'] }], outPort: null, result: null, bankResult: null };
    const wave = el('canvas', { style: 'height:70px' });
    attachWaveZoom(wave, () => n.result, 'Output');
    // Bank results (multi-output effects) render as a file list instead of the
    // single-WAV waveform/transport — each sound plays/saves individually.
    const bankList = el('div', { style: 'display:none;max-height:220px;overflow:auto;margin:4px 0' });
    let bankOff = null;   // player 'change' listener for the item ▶/■ labels
    const renderBankList = (res) => {
      bankList.innerHTML = '';
      const rows = [];
      res.outputs.forEach((bytes, i) => {
        const name = res.names?.[i] || `out${i + 1}.wav`;
        const pb = el('button', { class: 'secondary', type: 'button', textContent: '▶', title: 'Play ' + name });
        pb.onclick = () => {
          if (player.isPlaying(bytes)) { player.stop(); return; }
          const buffer = wavToAudioBuffer(bytes, audioCtx);
          player.play({ token: bytes, buffer, sampleRate: buffer.sampleRate, length: buffer.length, origin: 'node' });
        };
        const row = el('div', { style: 'display:flex;gap:6px;align-items:center;margin:2px 0' }, pb,
          el('span', { style: 'flex:1;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap', textContent: name }));
        if (canSaveFile()) {
          const sb = el('button', { class: 'secondary', type: 'button', textContent: '↓', title: 'Save ' + name });
          sb.onclick = () => saveWav(bytes, name);
          row.appendChild(sb);
        }
        rows.push({ pb, bytes });
        bankList.appendChild(row);
      });
      if (canSaveFile() && res.outputs.length > 1) {
        const all = el('button', { class: 'secondary', type: 'button', textContent: '↓ Save all' });
        // slight stagger — browsers throttle rapid multi-downloads
        all.onclick = async () => {
          for (let i = 0; i < res.outputs.length; i++) {
            await saveWav(res.outputs[i], res.names?.[i] || `out${i + 1}.wav`);
            await new Promise((r) => setTimeout(r, 150));
          }
        };
        bankList.appendChild(el('div', { style: 'margin-top:4px' }, all));
      }
      bankOff?.();
      bankOff = player.on(() => { for (const r of rows) r.pb.textContent = player.isPlaying(r.bytes) ? '■' : '▶'; });
      bankList.style.display = '';
    };
    const transport = makeTransport(() => n.result);
    n.transportDispose = () => { transport.dispose(); bankOff?.(); };
    const saveBtn = el('button', { class: 'secondary', type: 'button', textContent: '↓ Save', disabled: true });
    // A host WebView that can't write a file gets no Save button — the host's own
    // injected action (e.g. "Apply → Live") is how the result leaves the dialog.
    if (!canSaveFile()) saveBtn.style.display = 'none';
    // Drag the rendered WAV straight out to the desktop, Finder or a DAW track.
    // Uses Chromium's DownloadURL drag flavour ("<mime>:<name>:<url>"); the blob
    // URL is minted per drag and revoked when it ends. Disabled until there's a
    // result (disabled buttons don't start drags, so nothing to guard on drop).
    const dragBtn = el('button', { class: 'secondary', type: 'button', textContent: '⤓ Drag me', disabled: true,
      draggable: true, style: 'cursor: grab; touch-action: none',
      title: 'Drag onto the canvas to make a new Source from this output — or out to your desktop / Finder' });
    // Host-injected action buttons land here (empty in a plain browser).
    const actions = el('span', { class: 'output-actions', style: 'display:contents' });
    // Two drag destinations, resolved by where the drop lands:
    //   • onto the canvas → clone this output into a new Source node (all contexts;
    //     handled by the desktop drop listener below via `draggingOutput`).
    //   • out of the window (plain browser only) → the WAV rides the Chromium
    //     DownloadURL flavour to the desktop/Finder.
    // The plugin's native OS drag to the host DAW is disabled for now (see
    // NATIVE_DRAG_OUT_TO_DAW): it starts on pointerdown and preempts the HTML5
    // drag, which would block the in-canvas drop → new Source inside the plugin.
    dragBtn.addEventListener('pointerdown', (e) => {
      if (NATIVE_DRAG_OUT_TO_DAW && n.result && hostSupportsDragOut()) beginNativeDragOut(wavFileName(n.name));
      // Touch never starts an HTML5 drag (iOS fires no dragstart from a finger),
      // so the same gesture runs on pointer events: press, drag onto the canvas,
      // release → a Source lands where you let go, with a ghost following the
      // finger. Releasing without moving drops it into the middle of the view,
      // so a plain tap still does something visible. The button carries
      // touch-action:none, or the desktop would scroll out from under the drag.
      if (e.pointerType !== 'touch' || !n.result) return;
      e.preventDefault();
      dragBtn.setPointerCapture(e.pointerId);
      const sx = e.clientX, sy = e.clientY;
      let ghost = null;
      const at = (ev) => { ghost.style.left = ev.clientX + 'px'; ghost.style.top = ev.clientY + 'px'; };
      const mv = (ev) => {
        if (!ghost) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 10) return;   // not a drag yet
          ghost = el('div', { class: 'drag-ghost', textContent: `⤓ ${n.name || 'output'}` });
          document.body.appendChild(ghost);
        }
        at(ev);
      };
      const up = (ev) => {
        dragBtn.removeEventListener('pointermove', mv);
        dragBtn.removeEventListener('pointerup', up);
        dragBtn.removeEventListener('pointercancel', cancel);
        ghost?.remove();
        const r = desktop.getBoundingClientRect();
        const inside = ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom;
        if (!ghost) cloneOutputTo(n.result, r.left + r.width / 2, r.top + r.height / 2);   // tap: centre of the view
        else if (inside) cloneOutputTo(n.result, ev.clientX, ev.clientY);
      };
      const cancel = () => { ghost?.remove(); dragBtn.removeEventListener('pointermove', mv); dragBtn.removeEventListener('pointerup', up); };
      dragBtn.addEventListener('pointermove', mv);
      dragBtn.addEventListener('pointerup', up);
      dragBtn.addEventListener('pointercancel', cancel);
    });
    dragBtn.addEventListener('dragstart', (e) => {
      if (!n.result) { e.preventDefault(); return; }
      draggingOutput = n;   // for the in-canvas drop → new Source
      e.dataTransfer.setData('application/x-cdp-source', '1');
      e.dataTransfer.effectAllowed = 'copy';
      // Only offer the file to the OS in a plain browser. In a native WebView host
      // (extension/plugin), WebKit escalates a DownloadURL drag into a native file
      // promise — the macOS "+" copy cursor — which takes over the drag session and
      // swallows the in-page drop, so the canvas never sees it. Omitting it keeps
      // the drag a plain in-page HTML5 drag, so `drop` fires on the canvas.
      let url = null;
      if (!inNativeHost()) {
        url = URL.createObjectURL(new Blob([n.result], { type: 'audio/wav' }));
        e.dataTransfer.setData('DownloadURL', `audio/wav:${wavFileName(n.name)}:${url}`);
      }
      dragBtn.addEventListener('dragend', () => {
        draggingOutput = null;
        if (url) setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, { once: true });
    });
    const runBtn = el('button', { id: 'run', type: 'button', textContent: 'Run' });
    saveBtn.onclick = () => saveWav(n.result, wavFileName(n.name));
    // Mark the rendered result out of date (only meaningful once there is one):
    // star the Run button, shade the window and dim the stale waveform until the
    // next Run. The star is a CSS badge rather than part of the label, so the
    // button keeps its width and nothing below it shifts.
    n.markStale = () => { if ((!n.result && !n.bankResult) || n.stale) return; n.stale = true; runBtn.classList.add('stale'); n.el.classList.add('stale'); wave.classList.add('stale'); };
    const doRun = async () => {
      runBtn.disabled = true; runBtn.textContent = 'Running…';
      try {
        const res = await runner.run(patch, n.id);
        n.stale = lastResultStale = false;
        runBtn.classList.remove('stale'); n.el.classList.remove('stale'); wave.classList.remove('stale');
        if (res.kind === 'bank') {
          // A bank has no single WAV: show the file list, park the single-result
          // affordances (waveform, transport, save/drag, sampler, host getResult).
          n.result = null; n.bankResult = res;
          lastResult = null; lastResultLabel = '';
          renderBankList(res); wave.style.display = 'none';
          transport.setEnabled(false); saveBtn.disabled = true; dragBtn.disabled = true;
          log(`done — bank of ${res.outputs.length} sound${res.outputs.length === 1 ? '' : 's'}`);
          return null;
        }
        const wav = res.bytes;
        n.result = lastResult = wav; n.bankResult = null; lastResultLabel = n.name || '';
        bankList.style.display = 'none'; wave.style.display = ''; drawWave(wave, wav);
        if (sampler) sampler.setSampleFromWav(wav);   // keep the playable sample current
        transport.setEnabled(true); saveBtn.disabled = false; dragBtn.disabled = false;
        log('done — ' + wav.length + ' bytes');
        return wav;
      } catch (e) { logError('error: ' + e.message); return null; }
      finally { runBtn.disabled = false; runBtn.textContent = 'Run'; }   // staleness rides on the class, not the label
    };
    runBtn.onclick = doRun;
    n.run = doRun;                 // programmatic Run (spacebar)
    n.play = transport.play;       // programmatic Play of the rendered result
    n.upToDate = () => (!!n.result || !!n.bankResult) && !n.stale;
    const body = el('div', {}, runBtn, wave, bankList, el('div', {}, transport.wrap, saveBtn, dragBtn, actions));
    makeWindow(n, 'Output', body);
    n.actionsEl = actions;
    applyOutputAction(n);   // populate if a host already registered an action
    return n;
  }

  // ---- Log (a fixed bar docked above the sampler) --------------------------
  // A single scrollable #log element lives in a fixed bar pinned above the
  // sampler keyboard. `logShown` toggles its visibility; the dock can also be
  // concertina-collapsed. Both bits are remembered.
  const LOG_COLLAPSE_KEY = 'cdp-web-logdock-collapsed';
  let logEl = null;             // the scrollable text element (#log)
  let logDock = null;           // the docked bar element (lazy)
  let logDockBody = null;       // logEl's home
  let logDockCollapse = null;   // (bool) => set the dock's concertina state
  let logShown = false;

  // Build the docked bar (title + collapse button) and the #log element it
  // hosts, once. Same dbl-click concertina as the sampler.
  function buildLog() {
    if (logDock) return;
    const title = el('span', { class: 'logdock-title', textContent: 'LOG' });
    const collapse = el('button', { class: 'kbd-btn', type: 'button', title: 'Collapse / expand (or double-click the bar)', textContent: '▾' });
    const bar = el('div', { class: 'logdock-bar' }, title, el('span', { class: 'logdock-spacer' }), collapse);
    logDockBody = el('div', { class: 'logdock-body' });
    logEl = el('div', { id: 'log', style: 'white-space:pre-wrap;overflow-wrap:anywhere;font:16px/1.4 var(--ui);overflow:auto' });
    logDockBody.appendChild(logEl);
    logDock = el('div', { class: 'logdock' }, bar, logDockBody);
    document.body.appendChild(logDock);
    logDockCollapse = (c) => {
      logDock.classList.toggle('collapsed', c);
      document.body.classList.toggle('logdock-collapsed', c);
      collapse.textContent = c ? '▸' : '▾';
      try { localStorage.setItem(LOG_COLLAPSE_KEY, c ? '1' : '0'); } catch {}
    };
    const isCollapsed = () => logDock.classList.contains('collapsed');
    collapse.addEventListener('click', (e) => { e.stopPropagation(); logDockCollapse(!isCollapsed()); });
    bar.addEventListener('dblclick', (e) => { if (e.target.closest('button')) return; logDockCollapse(!isCollapsed()); });
    // The collapsed height must equal the bar exactly (else an empty strip shows
    // below it), but the bar grows/shrinks with the chosen UI font — so measure
    // it live rather than guessing. offsetHeight is the bar's border-box; add the
    // dock's own top border to get the dock's collapsed border-box height. Fires
    // on first layout and on every font/theme change; 0 while hidden, so guard it.
    new ResizeObserver(() => {
      const h = bar.offsetHeight;
      if (!h) return;
      const top = parseFloat(getComputedStyle(logDock).borderTopWidth) || 0;
      document.documentElement.style.setProperty('--logdock-bar-h', (h + top) + 'px');
    }).observe(bar);
    setLogSink((line) => { logEl.textContent += (logEl.textContent ? '\n' : '') + line; logEl.scrollTop = 1e9; });
    try { if (localStorage.getItem(LOG_COLLAPSE_KEY) === '1') logDockCollapse(true); } catch {}
  }

  // Reflect logShown into the DOM (dock visibility + desktop fit).
  function renderLog() {
    if (!logDock) return;
    logDock.style.display = logShown ? '' : 'none';
    document.body.classList.toggle('has-logdock', logShown);
  }

  function showLog(on) { buildLog(); logShown = on; renderLog(); }
  const logVisible = () => logShown;

  // ensureLog(show): create on demand, then set visibility (kept for callers).
  function ensureLog(show) { buildLog(); if (show != null) showLog(show); }
  // Log a failure and auto-reveal the log so it can't go unseen; expand the dock
  // if it was concertina'd shut so the message isn't hidden.
  function logError(msg) { log(msg); showLog(true); if (logDockCollapse) logDockCollapse(false); }

  // ---- raw-mode example command (ported from main.js) -----------------------
  const sampleCmd = {};
  for (const e of EFFECTS) {
    if (sampleCmd[e.program]) continue;
    if (!Array.isArray(e.args)) continue; // pipeline effects own their chain; no literal arg template
    const vals = Object.fromEntries((e.params || []).map((p) => [p.name, p.default]));
    // buildArgs isn't imported here; approximate with the catalog args literal swap.
    let a = e.args.map((x) => (x && typeof x === 'object' ? (x.flag ? x.flag + (vals[x.p] ?? '') : String(vals[x.p] ?? '')) : x));
    if (e.domain === 'spectral') a = a.map((x) => (x === '$IN' ? '$ANA' : x === '$IN2' ? '$ANA2' : x === '$OUT' ? '$OUTANA' : x));
    sampleCmd[e.program] = a.join(' ');
  }
  function exampleFor(p) { return sampleCmd[p] || (spectralSet.has(p) ? '$ANA $OUTANA' : '$IN $OUT'); }

  // ---- patch save / load (JSON) ---------------------------------------------
  // The graph topology + each node's settings, but not rendered/loaded audio:
  // tone & pulse sources regenerate on load; file sources reopen empty.
  // patchMeta carries a recipe's { name, description, category } so it survives a
  // round-trip (load recipe → save patch); cleared by New patch.
  let patchMeta = null;
  // One node → its plain spec (the saved/clipboard shape). Shared by serialize + copy.
  function serializeNode(n, embedAudio = false) {
    const b = { id: n.id, type: n.type, x: n.x, y: n.y, shaded: n.el.classList.contains('shaded') };
    if (n.name) b.name = n.name;
    if (n.type === 'source') {
      b.source = { kind: n.source.kind, freq: n.source.freq, dur: n.source.dur, url: n.source.url, name: n.source.name };
      // Host-state copy only: embed the loaded WAV bytes (base64) when small enough,
      // so the source node's audio + waveform restore on reload. Omitted from the
      // undo/localStorage/file-save shape (embedAudio=false) to keep those lean.
      if (embedAudio && n.source.wav && n.source.wav.length <= MAX_EMBED_WAV)
        b.source.wavB64 = bytesToB64(n.source.wav);
    }
    else if (n.type === 'generator') b.gen = { id: n.genId, values: { ...n.state.values }, envs: { ...n.state.envs }, data: n.data, analyse: n.getAnalyse?.(), unlocked: n.state.unlocked || undefined };
    else if (n.type === 'transform') { b.effectId = n.effectId; b.state = { values: { ...n.state.values }, envs: { ...n.state.envs }, unlocked: n.state.unlocked || undefined }; }
    else if (n.type === 'faust') b.faust = { kind: n.faustKind, code: n.code, values: { ...n.state.values }, envs: { ...n.state.envs } };
    else if (n.type === 'rawTransform') b.raw = { ...n.raw };
    else if (n.type === 'breakpoint') b.bp = { ...axisFlags(n.bp), text: n.bp.text };
    else if (n.type === 'pick') b.pick = { values: { ...n.state.values } };
    else if (n.type === 'gather') b.gather = { inputs: n.inPorts.length };
    return b;
  }
  function serialize({ embedAudio = false } = {}) {
    const nodes = [...patch.nodes.values()].filter((n) => n.type !== 'log').map((n) => serializeNode(n, embedAudio));
    const edges = patch.edges.map((e) => ({ from: { ...e.from }, to: { ...e.to } }));
    const out = { app: 'cdp-web-patch', v: 1, tempo: getBpm(), nodes, edges };
    if (keyboardVisible()) out.sampler = true;   // only stored when shown; absent = hidden
    if (patchMeta) out.metadata = patchMeta;
    return out;
  }
  // .cdp is our patch extension (JSON inside); .cdpweb.json is the legacy name
  // and still opens via Open patch… / drag-drop.
  const patchFileName = () => ((patchMeta?.name || 'patch').replace(/[\\/:*?"<>|]+/g, '_').trim() || 'patch') + '.cdp';
  // Real save-to-location (File System Access API, Chrome/Edge): the picked
  // handle is kept so Save overwrites the same file in place, desktop-style.
  // Cleared whenever a different patch becomes the document (New / Open /
  // recipe / share link — see loadPatch's resetSample and newPatch). Other
  // browsers fall back to a plain download into the Downloads folder.
  let patchHandle = null;
  const clearPatchHandle = () => { patchHandle = null; };
  const canPickFiles = () => typeof window.showSaveFilePicker === 'function' && !inNativeHost();
  const PATCH_PICKER_TYPES = [{ description: 'CDP patch', accept: { 'application/json': ['.cdp'] } }];
  // The picked file name becomes the patch name, so the two never diverge.
  const setNameFromFile = (fname) => { patchMeta = { ...(patchMeta || {}), name: fname.replace(/\.(cdpweb\.json|cdp|json)$/i, '') }; };
  async function savePatch({ pickNew = false } = {}) {
    const json = JSON.stringify(serialize(), null, 1);
    if (canPickFiles()) {
      try {
        if (pickNew || !patchHandle) {
          patchHandle = await window.showSaveFilePicker({ suggestedName: patchFileName(), types: PATCH_PICKER_TYPES });
          setNameFromFile(patchHandle.name);
          persist();
        }
        const w = await patchHandle.createWritable();
        await w.write(json); await w.close();
        log(`saved ${patchHandle.name} — ${patch.edges.length} cables`);
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;   // user cancelled the picker
        logError('save failed: ' + e.message);  // e.g. permission lost — fall back to a download
        clearPatchHandle();
      }
    }
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = el('a', { href: url, download: patchFileName() }); a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    log(`saved ${patchFileName()} — ${patch.edges.length} cables`);
  }
  // Save as…: with a save picker the OS dialog names the patch; without one,
  // prompt for a name first (it lives in metadata, the same slot recipes use,
  // so it travels with the file, the session, and share links).
  async function savePatchAs() {
    if (canPickFiles()) return savePatch({ pickNew: true });
    const name = await gemPrompt('Patch name<br><span class="muted">kept with the patch and used as the file name</span>',
      patchMeta?.name || '', { ok: 'Save', placeholder: 'my patch' });
    if (!name) return;
    patchMeta = { ...(patchMeta || {}), name };
    persist();
    savePatch();
  }
  // Encode the whole patch into a shareable link (#patch=…, see share.js), then
  // explain what does and doesn't travel in it — and let it be named — before
  // handing it over. Disk-picked audio can't travel in a URL, so the dialog names
  // the Sources that will arrive empty; url/tone/pulse sources and generators
  // restore themselves.
  async function shareLink() {
    if (!shareSupported()) { await gemAlert('This browser can’t build share links (it lacks CompressionStream).'); return; }
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // The link for a given patch name, built once and kept. The name lives inside
    // the compressed payload, so each one is a fresh encode — but the dialog warms
    // the cache as you type, so pressing Copy / Share hands over a link that is
    // already built. That matters: both the clipboard and navigator.share want to
    // be called from the press itself, and an await on the compression can spend
    // the user activation they check for (Safari especially).
    const links = new Map();
    const linkFor = async (name) => {
      if (!links.has(name)) {
        const payload = serialize();
        const meta = { ...(patchMeta || {}), name: name || undefined };
        if (Object.values(meta).some((v) => v !== undefined)) payload.metadata = meta; else delete payload.metadata;
        links.set(name, location.origin + location.pathname + location.search + '#patch=' + await encodeShare(payload));
      }
      return links.get(name);
    };
    const initial = patchMeta?.name || '';
    const url0 = await linkFor(initial);
    const fileSrcs = [...patch.nodes.values()].filter((n) => n.type === 'source' && n.source.kind === 'file' && n.source.wav);
    let msg = 'A share link carries the <b>whole patch</b> — every window, cable and setting — packed into the link itself. '
      + 'Nothing is uploaded: the link <b>is</b> the patch.<br><br>'
      + 'Audio is the exception. A Source loaded from disk opens <b>empty</b> for whoever follows the link; '
      + 'one loaded with the <b>URL…</b> button stores its address and arrives with its sound.';
    if (fileSrcs.length) {
      const names = fileSrcs.map((n) => `<b>${esc(n.source.name || n.id)}</b>`).join(', ');
      msg += `<br><br>In this patch, ${names} came from disk — `
        + `${fileSrcs.length === 1 ? 'that Source will open' : 'those Sources will open'} empty.`;
    }
    msg += '<br><br>Name the patch — the name rides along, and this copy keeps it too:';
    // The platform share sheet (phones, and macOS Safari) beats the clipboard for
    // getting a link into a message; where there's no sheet, Copy is the whole flow.
    const canSheet = typeof navigator.share === 'function' && (!navigator.canShare || navigator.canShare({ url: url0 }));
    const sheetTitle = (name) => (name ? `${name} — CDP for Web` : 'CDP for Web patch');
    let sheet = null, copied = null, warm = 0;
    const { choice, value: name } = await gemPrompt(msg, initial, {
      icon: '↗',
      placeholder: 'untitled patch',
      // On a phone this dialog is mostly there to be read and pressed; focusing
      // the name field first would put the keyboard over it.
      autofocus: !matchMedia('(pointer: coarse)').matches,
      onInput: (n) => { clearTimeout(warm); warm = setTimeout(() => { linkFor(n).catch(() => { /* pressing will retry */ }); }, 250); },
      buttons: [
        { label: 'Cancel', value: 'cancel' },
        { label: 'Copy link', value: 'copy', primary: !canSheet, press: (n) => { const u = links.get(n); if (u) copied = navigator.clipboard?.writeText(u); } },
        ...(canSheet ? [{ label: 'Share…', value: 'sheet', primary: true, press: (n) => { const u = links.get(n); if (u) sheet = navigator.share({ title: sheetTitle(n), url: u }); } }] : []),
      ],
    });
    clearTimeout(warm);
    if (choice !== 'copy' && choice !== 'sheet') return;
    // What was sent is the patch's name, so this copy takes it too — Save patch
    // and the file name follow it from here.
    if ((patchMeta?.name || '') !== name && (name || patchMeta)) {
      patchMeta = { ...(patchMeta || {}), name: name || undefined };
      persist();
    }
    const url = await linkFor(name);   // resolved already unless they typed and pressed within the warm-up
    if (choice === 'sheet') {
      try {
        await (sheet || navigator.share({ title: sheetTitle(name), url }));
        log(`shared patch link — ${url.length} chars`);
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;             // the sheet was dismissed
        log('share sheet unavailable — copying instead');   // fall through to the clipboard
      }
    }
    try { await (copied || navigator.clipboard.writeText(url)); log(`share link copied — ${url.length} chars`); }
    catch { await gemPrompt('Copy the share link:', url, { ok: 'Done' }); }
  }
  // Open a patch out of a share-link payload that arrived by hand (pasted link or
  // clipboard) rather than in this page's own address. Always asks first: unlike
  // the boot-time path, there is always a desk here for it to replace.
  async function openSharePayload(payload) {
    let data;
    try { data = await decodeShare(payload); }
    catch (e) { logError('could not read that share link: ' + e.message); return false; }
    if (!data || data.app !== 'cdp-web-patch' || !Array.isArray(data.nodes)) { logError('that link isn’t a cdp-web patch'); return false; }
    const name = data.metadata?.name;
    const choice = await gemAlert(
      `Open the shared patch${name ? ` <b>${name.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</b>` : ''} from this link?<br>It replaces the patch on your desk.`,
      [{ label: 'Cancel', value: 'cancel' }, { label: 'Open', value: 'open', primary: true }],
    );
    if (choice !== 'open') return false;
    if (Number(data.v) > 1) log('this shared patch is from a newer cdp-web — loading what it can.');
    loadPatch(data, { resetSample: true });
    persist();
    log('loaded shared patch from link.');
    return true;
  }
  // File ▸ Open shared link… — paste a link in rather than following it. This is
  // the only way into an app added to an iOS home screen: iOS opens links in the
  // browser and won't hand them to an installed web app (Android's WebAPK does,
  // so there a link opens the app directly).
  async function openSharedLink() {
    if (!shareSupported()) { await gemAlert('This browser can’t read share links (it lacks DecompressionStream).'); return; }
    const text = await gemPrompt(
      'Paste a <b>share link</b> to open the patch it carries.'
      + '<br><span class="muted">Long-press the link wherever you received it, choose Copy, then paste it here.</span>',
      '', { ok: 'Open', placeholder: 'https://…#patch=…' },
    );
    if (!text) return;
    const payload = shareParamFromText(text);
    if (!payload) { logError('that doesn’t look like a share link — no patch= in it'); return; }
    await openSharePayload(payload);
  }
  function spawnFromSpec(s) {
    switch (s.type) {
      case 'source': return spawnSource(s.source);
      case 'generator': return genById[s.gen?.id] ? spawnGenerator(s.gen.id, { values: s.gen.values || {}, envs: s.gen.envs || {}, data: s.gen.data, analyse: s.gen.analyse }) : null;
      case 'transform': return byId[s.effectId] ? spawnTransform(s.effectId, s.state) : null;
      case 'faust': return spawnFaust(s.faust?.kind || 'effect', { code: s.faust?.code, values: s.faust?.values || {}, envs: s.faust?.envs || {} });
      // legacy prototype node types (pre-unified Faust device)
      case 'faustGenerator': return spawnFaust('generator', { code: s.faust?.code, values: s.faust?.values || {}, envs: s.faust?.envs || {} });
      case 'faustEffect': return spawnFaust('effect', { code: s.faust?.code, values: s.faust?.values || {}, envs: s.faust?.envs || {} });
      case 'rawTransform': return spawnRaw(s.raw);
      case 'breakpoint': return spawnBreakpoint(s.bp);
      case 'pvocAnalyse': return spawnPvoc('anal');
      case 'pvocResynth': return spawnPvoc('synth');
      case 'pick': return spawnPick(s.pick);
      case 'gather': return spawnGather(s.gather);
      case 'output': return spawnOutput();
      default: return null;
    }
  }
  // resetSample: drop the loaded sampler sample (for loading a *different* patch —
  // Open / recipe); left false for undo/redo and boot restore so those don't
  // needlessly silence the keyboard.
  function loadPatch(data, { arrange = false, resetSample = false } = {}) {
    if (!data || data.app !== 'cdp-web-patch' || !Array.isArray(data.nodes)) { logError('not a CDP patch file'); return; }
    patchMeta = data.metadata || null;
    if (typeof data.tempo === 'number') setBpm(data.tempo);
    for (const n of [...patch.nodes.values()]) if (n.type !== 'log') removeNode(n);
    if (resetSample) { lastResult = null; lastResultStale = false; lastResultLabel = ''; if (sampler) sampler.clearSample(); clearPatchHandle(); }   // resetSample ⇒ a different document, so Save must re-pick its file
    setKeyboardVisible(!!data.sampler);   // sampler dock travels with the patch (hidden unless stored)
    clearSelection();   // ids are re-minted below, so any current selection is stale
    cascade = 0;
    const idMap = new Map();
    for (const s of data.nodes) {
      const n = spawnFromSpec(s);
      if (!n) { log('skipped node ' + s.type + (s.effectId ? ' (' + s.effectId + ')' : '')); continue; }
      if (s.name) { n.name = s.name; applyTitle(n); }
      n.x = s.x; n.y = s.y; n.el.style.left = s.x + 'px'; n.el.style.top = s.y + 'px';
      if (s.shaded) { n.el.classList.add('shaded'); const sh = n.el.querySelector('.gwin-shade'); if (sh) sh.textContent = '▸'; }
      idMap.set(s.id, n.id);
    }
    // ports need a layout pass before cables can be drawn to them
    requestAnimationFrame(() => {
      for (const e of data.edges || []) {
        const from = { node: idMap.get(e.from.node), port: e.from.port };
        const to = { node: idMap.get(e.to.node), port: e.to.port };
        if (from.node && to.node) addEdge(from, to);
      }
      // Windows now have real sizes; auto-arrange when asked (e.g. recipes, whose
      // saved positions don't account for the inserted PVOC nodes / window widths).
      if (arrange) applyAutoLayout(); else growCanvas();
      redrawAll();
      recordHistory();   // seed/refresh the undo baseline (deduped for undo/redo)
      log(`loaded patch — ${idMap.size} windows, ${(data.edges || []).length} cables`);
    });
  }
  // ---- copy / paste a sub-graph --------------------------------------------
  // Copy the selected nodes + the edges fully inside the selection (boundary
  // edges are dropped). Stored in-memory and mirrored to the system clipboard.
  function copySelection() {
    const ids = new Set(effectiveSelection().filter((id) => node(id) && node(id).type !== 'log'));
    if (!ids.size) return;
    const nodes = [...ids].map((id) => serializeNode(node(id)));
    const edges = patch.edges.filter((e) => ids.has(e.from.node) && ids.has(e.to.node)).map((e) => ({ from: { ...e.from }, to: { ...e.to } }));
    clipboard = { app: 'cdp-web-patch', v: 1, kind: 'clip', nodes, edges };
    pasteCascade = 0;
    try { navigator.clipboard?.writeText(JSON.stringify(clipboard)).catch(() => {}); } catch { /* no clipboard API */ }
    log(`copied ${nodes.length} window${nodes.length === 1 ? '' : 's'}`);
  }
  // Paste the clipboard sub-graph (preferring the system clipboard so it survives
  // reload / other tabs, falling back to the in-memory copy). Additive: spawns
  // fresh ids, offsets position, re-wires internal edges, selects the new copy.
  async function paste(anchor = null) {
    let frag = clipboard, link = null;
    try {
      const txt = await navigator.clipboard?.readText();
      if (txt) {
        // A share link on the clipboard is a whole patch, not a fragment to add
        // to this one — so pasting one opens it (after asking) instead.
        link = shareParamFromText(txt);
        if (!link) { const o = JSON.parse(txt); if (o && o.app === 'cdp-web-patch' && Array.isArray(o.nodes)) frag = o; }
      }
    } catch { /* permission denied / not JSON — use in-memory clipboard */ }
    if (link) { await openSharePayload(link); return; }
    pasteFragment(frag, anchor);
  }
  // Duplicate the working set: serialize the selected nodes + their internal
  // edges and drop a cascaded copy, without touching the clipboard.
  function duplicateSelection() {
    const ids = new Set(effectiveSelection().filter((id) => node(id) && node(id).type !== 'log'));
    if (!ids.size) return;
    const nodes = [...ids].map((id) => serializeNode(node(id), true));
    const edges = patch.edges.filter((e) => ids.has(e.from.node) && ids.has(e.to.node)).map((e) => ({ from: { ...e.from }, to: { ...e.to } }));
    pasteFragment({ nodes, edges });
  }
  // Spawn a serialized sub-graph and select the fresh copy. Shared by Paste and
  // Duplicate. With no `anchor`, cascades down-right so it doesn't land exactly on
  // the original; with an `anchor` (canvas-unit point) drops the cluster's
  // top-left there — used by "Paste here" from the canvas menu.
  function pasteFragment(frag, anchor = null) {
    if (!frag || !frag.nodes?.length) return;
    let dx, dy;
    if (anchor) {
      const minX = Math.min(...frag.nodes.map((s) => s.x || 0)), minY = Math.min(...frag.nodes.map((s) => s.y || 0));
      dx = anchor.x - minX; dy = anchor.y - minY; pasteCascade = 0;
    } else {
      const off = 28 * (++pasteCascade); dx = off; dy = off;
    }
    const idMap = new Map(); const newIds = [];
    for (const s of frag.nodes) {
      const n = spawnFromSpec(s);
      if (!n) { log('skipped ' + s.type); continue; }
      if (s.name) { n.name = s.name; applyTitle(n); }
      n.x = Math.max(0, (s.x || 0) + dx); n.y = Math.max(0, (s.y || 0) + dy); n.el.style.left = n.x + 'px'; n.el.style.top = n.y + 'px';
      if (s.shaded) { n.el.classList.add('shaded'); const sh = n.el.querySelector('.gwin-shade'); if (sh) sh.textContent = '▸'; }
      idMap.set(s.id, n.id); newIds.push(n.id);
    }
    requestAnimationFrame(() => {                  // ports need a layout pass before cables draw
      for (const e of frag.edges || []) {
        const from = { node: idMap.get(e.from.node), port: e.from.port }, to = { node: idMap.get(e.to.node), port: e.to.port };
        if (from.node && to.node) addEdge(from, to);
      }
      growCanvas(); redrawAll(); setSelection(newIds);
      recordHistory();                             // one deterministic undo entry
      log(`pasted ${newIds.length} window${newIds.length === 1 ? '' : 's'}`);
    });
  }
  async function openPatch() {
    // With the File System Access API, keep the opened file's handle so a later
    // Save overwrites it in place rather than prompting or downloading.
    if (canPickFiles() && typeof window.showOpenFilePicker === 'function') {
      try {
        const [h] = await window.showOpenFilePicker({ types: [{ description: 'CDP patch', accept: { 'application/json': ['.cdp', '.json'] } }] });
        loadPatch(JSON.parse(await (await h.getFile()).text()), { resetSample: true });
        patchHandle = h;   // after loadPatch, which clears the previous handle
      } catch (err) { if (err?.name !== 'AbortError') logError('load failed: ' + err.message); }
      return;
    }
    const inp = el('input', { type: 'file', accept: '.cdp,.json,application/json', style: 'display:none' });
    inp.onchange = async (e) => { const f = e.target.files[0]; if (!f) return; try { loadPatch(JSON.parse(await f.text()), { resetSample: true }); } catch (err) { logError('load failed: ' + err.message); } };
    document.body.appendChild(inp); inp.click(); setTimeout(() => inp.remove(), 1000);
  }

  // ---- recipes (ready-made example patches) ---------------------------------
  // Each recipe is a self-contained cdp-web-patch (a synth generator feeds the
  // chain), so it renders immediately. Deep-clone so loadPatch can't mutate the
  // shared RECIPES data. See recipes.js.
  function loadRecipe(recipe) {
    loadPatch(JSON.parse(JSON.stringify(recipe)), { arrange: true, resetSample: true });
    log(`recipe: ${recipe.metadata?.name || 'untitled'} — press ▶ on the Output to render`);
  }
  function recipeMenu() {
    const items = []; let cat = null;
    for (const r of RECIPES) {
      const c = r.metadata?.category || '';
      if (c !== cat) { if (items.length) items.push({ sep: true }); cat = c; }
      items.push({ label: r.metadata?.name || 'Recipe', action: () => loadRecipe(r) });
    }
    return items;
  }

  // ---- auto-persist to localStorage + undo/redo history ---------------------
  // Both are driven off the JSON snapshot. persist() is debounced so a knob sweep
  // coalesces into one localStorage write and one undo step.
  let saveTimer = null;
  function persist() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const data = serialize();
      if (inPlugin()) {
        // Shadow the graph into the host's plugin state (saveCustomState reads it).
        // The host copy embeds small source samples (see serialize's embedAudio) so
        // waveforms restore; the undo snapshot below stays lean (no audio bytes).
        try { IPlugSendMsg({ msg: 'SPXFUI', data: JSON.stringify(serialize({ embedAudio: true })) }); } catch { /* bridge unavailable */ }
      } else {
        try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch { /* storage full / disabled */ }
      }
      recordHistory(data);
    }, 400);
  }
  // An id-independent fingerprint: loadPatch re-mints node ids, so compare logical
  // structure (ids stripped, edges keyed by node order) — otherwise every restore
  // would look like a new state and undo/redo would never converge.
  function histKey(data) {
    const order = new Map(data.nodes.map((n, i) => [n.id, i]));
    return JSON.stringify({
      tempo: data.tempo,
      nodes: data.nodes.map(({ id, ...rest }) => rest),
      edges: data.edges.map((e) => ({ f: [order.get(e.from.node), e.from.port], t: [order.get(e.to.node), e.to.port] })),
    });
  }
  // Push a snapshot unless it's logically identical to the current one (so an
  // undo/redo's own loadPatch never creates a spurious entry, preserving redo).
  function recordHistory(data = serialize()) {
    const key = histKey(data);
    if (history[histIndex] && history[histIndex].key === key) return;
    history = history.slice(0, histIndex + 1);
    history.push({ snap: JSON.stringify(data), key });
    if (history.length > 80) history.shift();
    histIndex = history.length - 1;
  }
  const canUndo = () => histIndex > 0;
  const canRedo = () => histIndex < history.length - 1;
  function undo() { if (!canUndo()) return; histIndex--; loadPatch(JSON.parse(history[histIndex].snap)); log('undo'); }
  function redo() { if (!canRedo()) return; histIndex++; loadPatch(JSON.parse(history[histIndex].snap)); log('redo'); }
  function readSaved() {
    // Plugin mode: the host restores the graph by pushing it via CDPLoadGraph (see
    // the graph handler at boot), so never restore from shared localStorage here.
    if (inPlugin()) return null;
    try { const d = JSON.parse(localStorage.getItem(STORE_KEY) || 'null'); return d && d.app === 'cdp-web-patch' && d.nodes?.length ? d : null; }
    catch { return null; }
  }
  function newPatch() {
    patchMeta = null;
    clearPatchHandle();
    for (const n of [...patch.nodes.values()]) if (n.type !== 'log') removeNode(n);
    cascade = 0;
    // Drop the previous patch's rendered result so the sampler doesn't keep
    // replaying it (it's re-pushed whenever the keyboard is shown).
    lastResult = null; lastResultStale = false; lastResultLabel = '';
    if (sampler) sampler.clearSample();
    setKeyboardVisible(false);   // a fresh patch starts with the sampler hidden
    const s = spawnSource(); s.x = 30; s.y = 20; s.el.style.left = '30px'; s.el.style.top = '20px';
    const o = spawnOutput(); o.x = 560; o.y = 20; o.el.style.left = '560px'; o.el.style.top = '20px';
    persist(); recordHistory();
  }
  // Save the last rendered result, warning first if the graph changed since it ran.
  async function saveResult() {
    if (!lastResult) return;
    if (lastResultStale) {
      const choice = await gemAlert(
        'The rendered output is <b>out of date</b>.<br>The graph has changed since it was last run, so this file won’t reflect your latest edits.<br><br>Re-run an Output window for a current result.',
        [{ label: 'Cancel', value: 'cancel' }, { label: 'Save anyway', value: 'save', primary: true }],
      );
      if (choice !== 'save') return;
    }
    saveWav(lastResult, wavFileName(lastResultLabel));
  }

  // ---- menu bar -------------------------------------------------------------
  // Save patch / Save result both write a file, so they are omitted in a host
  // WebView that can't (see canSaveFile) — Open patch still works, its file input
  // is native. The trailing separator goes with them.
  dropdown($('m-file'), () => [
    { label: 'New patch', action: () => newPatch() },
    { sep: true },
    { label: 'Add audio file source', action: () => spawnSource() },
    { label: 'Add audio file output', action: () => spawnOutput() },
    { sep: true },
    { label: 'Open patch…', action: () => openPatch() },
    // Kept even in a native host: a link can't be *made* there, but one that
    // arrives from elsewhere still opens.
    ...(shareSupported() ? [{ label: 'Open shared link…', action: () => openSharedLink() }] : []),
    ...(canSaveFile() ? [
      { label: 'Save patch…', action: () => (patchMeta?.name ? savePatch() : savePatchAs()) },
      { label: 'Save patch as…', action: () => savePatchAs() },
    ] : []),
    // Share links carry the app's own URL, so they're meaningless inside a
    // native host WebView (local origin) — browser only.
    ...(!inNativeHost() ? [{ label: 'Share patch…', action: () => shareLink() }] : []),
    { sep: true },
    { label: 'Recipes', submenu: () => recipeMenu() },
    ...(canSaveFile()
      ? [{ sep: true }, { label: 'Save result…', disabled: !lastResult, action: () => saveResult() }]
      : []),
  ]);
  if ($('m-edit')) dropdown($('m-edit'), () => [
    { label: 'Undo', disabled: !canUndo(), action: () => undo() },
    { label: 'Redo', disabled: !canRedo(), action: () => redo() },
    { sep: true },
    { label: 'Select all', action: () => setSelection([...patch.nodes.values()].filter((n) => n.type !== 'log').map((n) => n.id)) },
    { label: 'Copy', disabled: !effectiveSelection().length, action: () => copySelection() },
    { label: 'Cut', disabled: !effectiveSelection().length, action: () => { copySelection(); deleteSelection(); } },
    { label: 'Paste', disabled: !clipboard, action: () => paste() },
    { label: 'Delete', disabled: !effectiveSelection().length, action: () => deleteSelection() },
    { sep: true },
    { label: 'Arrange nodes', action: () => applyAutoLayout() },
  ]);
  // Cmd/Ctrl+Z = undo, +Shift = redo (Ctrl+Y too) — but let text fields undo their own.
  addEventListener('keydown', (e) => {
    if (!(e.metaKey || e.ctrlKey)) return;
    const k = e.key.toLowerCase();
    const ae = document.activeElement;
    const tag = (ae?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea') return;
    if (k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); }
    else if (k === 'y') { e.preventDefault(); redo(); }
    else if (k === 'l') { e.preventDefault(); applyAutoLayout(); }
    else if (k === '=' || k === '+') { e.preventDefault(); zoomBy(1.2); }   // ⌘/Ctrl +  → zoom in
    else if (k === '-' || k === '_') { e.preventDefault(); zoomBy(1 / 1.2); }   // ⌘/Ctrl −  → zoom out
    else if (k === '0') { e.preventDefault(); setZoom(1); }                  // ⌘/Ctrl 0  → reset
    else if (k === 'c' || k === 'v' || k === 'x' || k === 'a') {
      if (ae?.isContentEditable || ae?.closest?.('[popover]')) return;   // let text fields / dialogs keep native behaviour
      e.preventDefault();
      if (k === 'c') copySelection();
      else if (k === 'v') paste();
      else if (k === 'x') { copySelection(); deleteSelection(); }
      else setSelection([...patch.nodes.values()].filter((n) => n.type !== 'log').map((n) => n.id));
    }
  });
  // The Output to act on for the spacebar transport: the focused Output if one is
  // focused, else the primary ('out'), else the first one in the patch.
  function activeOutput() {
    const f = focusedId && node(focusedId);
    if (f && f.type === 'output') return f;
    return node('out') || [...patch.nodes.values()].find((x) => x.type === 'output') || null;
  }
  // The transport action, shared by the spacebar and the bottom bar's ▶ button.
  // Playing → stop. Otherwise play the Output; if it's out of date (changed since
  // the last Run, or never run) Run it first, then play.
  let transportBusy = false;   // a Run kicked off by the transport is in flight
  async function toggleTransport() {
    // The waveform editor covers the desktop but not the transport bar, so while
    // it's up the bar drives what's on screen — its own audio — not the patch's
    // Output. Same rule the spacebar follows by yielding to the editor.
    const wfx = activeWaveformEditor();
    if (wfx) { wfx.togglePlay(); return; }
    if (player.isPlaying()) { player.stop(); return; }
    if (transportBusy) return;
    const o = activeOutput();
    if (!o) { log('nothing to play — this patch has no Output window'); return; }
    if (o.upToDate()) { o.play(); return; }
    transportBusy = true; syncTransportBar();
    try { const wav = await o.run(); if (wav) o.play(); }
    finally { transportBusy = false; syncTransportBar(); }
  }
  // The bottom bar: the same action in a fixed, thumb-reachable place, for when
  // the Output window is scrolled off-screen (or buried) on a small display.
  const tbarPlay = $('tbarPlay');
  // Rendering can take seconds, so the bar shows it rather than looking dead —
  // the node's own Run button says "Running…" for the same reason.
  function syncTransportBar() {
    if (!tbarPlay) return;
    tbarPlay.classList.toggle('playing', player.isPlaying());
    tbarPlay.disabled = transportBusy;
  }
  if (tbarPlay) {
    tbarPlay.addEventListener('click', () => { document.activeElement?.blur?.(); toggleTransport(); });
    player.on(syncTransportBar);   // follows the shared player, as a node's transport does
  }
  addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.metaKey || e.ctrlKey || e.altKey) return;
    const ae = document.activeElement;
    const tag = (ae?.tagName || '').toLowerCase();
    const type = (ae?.type || '').toLowerCase();
    // Text-entry controls keep the spacebar for typing. A focused slider (or other
    // non-text control) shouldn't swallow it — yield to the transport instead.
    const typing = (tag === 'input' && type !== 'range') || tag === 'textarea' || tag === 'select' || ae?.isContentEditable;
    if (typing) return;
    if (ae?.closest?.('[popover]')) return;        // a dropdown / dialog is open
    if (document.querySelector('.wfx')) return;     // the waveform editor handles its own space
    e.preventDefault();
    if (e.repeat) return;                            // ignore auto-repeat while held
    ae?.blur?.();                                    // return focus to the desktop (e.g. off a slider)
    toggleTransport();
  });
  // Delete / Backspace removes the focused window (with a confirmation dialog) —
  // but not while typing in a field, or while a menu / dialog has focus.
  addEventListener('keydown', (e) => {
    if (e.key !== 'Delete' && e.key !== 'Backspace' && e.key !== 'Escape') return;
    const ae = document.activeElement;
    const tag = (ae?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || ae?.isContentEditable) return;
    if (ae?.closest?.('[popover]')) return;   // a dropdown / dialog is open
    if (e.key === 'Escape') { if (selection.size) { e.preventDefault(); clearSelection(); } return; }
    if (!effectiveSelection().length) return;
    e.preventDefault();
    deleteSelection();
  });
  // Generate menu: CDP synthesis programs as audio-output-only Generator nodes.
  if ($('m-generate')) dropdown($('m-generate'), () => [
    ...GENERATORS.map((g) => ({ label: g.label, action: () => spawnGenerator(g.id) })),
    { sep: true },   // a rule, not a group header — the Faust devices aren't CDP programs
    { label: 'Faust generator', action: () => spawnFaust('generator') },
  ]);
  // Process menu: a breakpoint-envelope generator, the sound-domain effects, + raw CLI.
  dropdown($('m-process'), () => {
    const items = [
      { group: 'Control' },
      { label: 'Breakpoint envelope', action: () => spawnBreakpoint() },
      { label: 'Pick from bank', action: () => spawnPick() },
      { label: 'Gather to bank', action: () => spawnGather() },
    ];
    for (const [cat, list] of effectsByCategory()) {
      const sound = list.filter((e) => e.domain !== 'spectral' || e.pipeline);
      if (!sound.length) continue;
      items.push({ group: cat });
      // ▣ marks bank machinery: the effect produces or consumes a set of sounds
      for (const e of sound) items.push({ label: e.label + (e.multiOut || e.variadicInputs || e.mixChain?.multiInput ? ' ▣' : ''), action: () => spawnTransform(e.id) });
    }
    items.push({ sep: true });   // a rule, not a group header — Faust isn't a CDP category
    items.push({ label: 'Faust effect', action: () => spawnFaust('effect') });
    items.push({ sep: true });
    items.push({ label: 'Raw process (any program)…', action: () => spawnRaw() });
    return items;
  });
  // PVOC menu: the domain I/O bridges at the top, then every spectral process
  // (these all expect a PVOC-analysis input — wire them between Analyse/Resynth).
  if ($('m-pvoc')) dropdown($('m-pvoc'), () => {
    const items = [
      { group: 'Domain I/O' },
      { label: 'PVOC Analyse (audio→spectral)', action: () => spawnPvoc('anal') },
      { label: 'PVOC Resynthesise (spectral→audio)', action: () => spawnPvoc('synth') },
    ];
    for (const [cat, list] of effectsByCategory()) {
      const spec = list.filter((e) => e.domain === 'spectral' && !e.pipeline);
      if (!spec.length) continue;
      items.push({ group: cat });
      for (const e of spec) items.push({ label: e.label, action: () => spawnTransform(e.id) });
    }
    return items;
  });
  async function setTempoDialog() {
    const res = await gemPrompt('Project tempo <span style="opacity:.6">(20–960 BPM)</span>', String(getBpm()), { ok: 'Set' });
    if (res == null || res === '') return;
    const n = Number(res);
    if (!Number.isFinite(n)) return;
    setBpm(n); log(`tempo: ${getBpm()} BPM`); markDirty();
  }
  if ($('m-view')) dropdown($('m-view'), () => {
    const items = [
      { label: 'Show Log', checked: logVisible(), action: () => showLog(!logVisible()) },
      { label: 'Show Sampler', checked: keyboardVisible(), disabled: !sampler, action: () => toggleKeyboard() },
      { label: `Zoom in  (${modKey}+)`, action: () => zoomBy(1.2) },
      { label: `Zoom out  (${modKey}−)`, action: () => zoomBy(1 / 1.2) },
      { label: `Reset zoom  (${modKey}0)`, disabled: zoom === 1, action: () => setZoom(1) },
      { label: 'Theme', submenu: () => Object.entries(THEMES).map(([key, t]) => ({ label: t.label, checked: currentTheme() === key, action: () => applyTheme(key) })) },
      { label: 'CRT screen', checked: crt, action: () => setCrt(!crt) },
      { label: 'Font', submenu: () => Object.entries(FONTS).map(([key, f]) => ({ label: f.label, checked: currentFont() === key, action: () => applyFont(key) })) },
      { sep: true },
    ];
    const windows = [];
    for (const n of patch.nodes.values()) if (n.type !== 'log') {
      windows.push({ label: n.name ? `${n.name} (${titleOf(n)})` : titleOf(n), action: () => revealNode(n) });
    }
    windows.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: 'base', numeric: true }));
    items.push(...windows);
    if (patch.nodes.size === 0) items.push({ label: '(no windows)', disabled: true });
    return items;
  });
  if ($('m-options')) dropdown($('m-options'), () => [
    { label: 'Auto Render', checked: autoRender, action: () => setAutoRender(!autoRender) },
    { label: 'Sample rate', submenu: () => SR_CHOICES.map((sr) => ({ label: `${sr} Hz`, checked: sessionRate === sr, action: () => setSampleRate(sr) })) },
    { label: `Tempo: ${getBpm()} BPM…`, action: () => setTempoDialog() },
  ]);
  // Open the GitHub bug tracker in a new window, pre-filling the app version and
  // which context cdp-web is running in — so the report always captures the two
  // things we most need (version + where it was found) without the user hunting
  // for them. The context matches the dropdown options in the issue form.
  function reportBug() {
    const context = inPlugin() ? 'CDP plugin (VST/AU in a DAW)'
      : isEmbedded() ? 'CDP extension (Ableton Live)'
      : 'CDP for Web (browser)';
    const q = new URLSearchParams({
      template: 'bug_report.yml',
      version: window.CDP_VERSION || '',
      context,
    });
    window.open('https://github.com/cdp-wasm-suite/cdp-web/issues/new?' + q, '_blank', 'noopener');
  }
  if ($('m-help')) dropdown($('m-help'), () => [
    { label: 'Manual…', action: () => openManual() },
    { label: 'Release notes…', action: () => openManual('release-notes') },
    { label: 'Report a bug…', action: () => reportBug() },
    { label: 'About cdp-web…', action: () => $('aboutBox').showPopover() },
  ]);
  // On narrow screens the Atari logo opens a compact desk menu. Reuse the live
  // desktop builders so checked/disabled states and the full catalogue stay in
  // sync without maintaining a second set of commands.
  if ($('m-mobile')) {
    const mobileSections = [
      ['File', 'm-file'], ['Edit', 'm-edit'], ['Generate', 'm-generate'],
      ['Process', 'm-process'], ['PVOC', 'm-pvoc'], ['View', 'm-view'],
      ['Options', 'm-options'], ['Help', 'm-help'],
    ];
    dropdown($('m-mobile'), () => mobileSections.map(([label, id]) => ({
      label,
      submenu: () => $(id)?.gemMenuBuilder?.() || [],
    })));
  }
  $('aboutOk').onclick = () => $('aboutBox').hidePopover();
  // Share button, next to ♥ — the one File-menu command worth a permanent cell,
  // since it's the whole point on a phone (where the menu bar is a single icon).
  // It goes when links are meaningless (native host) or unbuildable (no
  // CompressionStream), matching the File ▸ Share patch item.
  if ($('shareBtn')) {
    if (inNativeHost() || !shareSupported()) $('shareBtn').remove();
    else $('shareBtn').onclick = () => shareLink();
  }
  if ($('supportBtn')) $('supportBtn').onclick = () => $('supportBox').showPopover();
  if ($('supportOk')) $('supportOk').onclick = () => $('supportBox').hidePopover();

  // ---- quick-add palette ----------------------------------------------------
  // Double-click the empty desktop (or Cmd/Ctrl-K) → a search box over the whole
  // catalogue. Fuzzy-filter, ↑/↓ + Enter, and the chosen process spawns at the
  // click point. The ranking lives in fuzzy.js so it can later be swapped for a
  // semantic / RAG ranker without touching this UI.
  function buildQuickItems() {
    const out = [];
    const add = (label, kind, make, extra = '', spectral = false) => {
      const it = { label, kind, make, spectral, search: `${label} ${kind} ${extra}${spectral ? ' spectral fft pvoc' : ''}`.toLowerCase() };
      out.push(it); return it;
    };
    const src = add('Audio file source', 'I/O', () => spawnSource(), 'audio file input load');
    add('Output', 'I/O', () => spawnOutput(), 'render play save result');
    add('Breakpoint envelope', 'Control', () => spawnBreakpoint(), 'automation brk lfo');
    add('Pick from bank', 'Control', () => spawnPick(), 'bank item extract leaf index multi-output partition isolate');
    add('Gather to bank', 'Control', () => spawnGather(), 'bank collect combine inputs multi rejoin multimix panorama');
    const pvA = add('PVOC Analyse', 'PVOC', () => spawnPvoc('anal'), 'spectral fft analysis audio to spectral');
    const pvS = add('PVOC Resynthesise', 'PVOC', () => spawnPvoc('synth'), 'spectral fft resynthesis spectral to audio');
    // Pin the audio-file source + the PVOC I/O to the top of the unfiltered list,
    // in this order, with a divider under the group.
    [src, pvA, pvS].forEach((it, i) => { it.pinned = true; it.pinOrder = i; });
    add('Raw process (any program)…', 'Raw', () => spawnRaw(), 'cli command custom');
    for (const g of GENERATORS) add(g.label, 'Generator', () => spawnGenerator(g.id), `${g.id} ${g.blurb || ''} synth`);
    add('Faust generator', 'Faust', () => spawnFaust('generator'), 'faust dsp synth code program');
    const ffx = add('Faust effect', 'Faust', () => spawnFaust('effect'), 'faust dsp effect code program');
    ffx.insert = true; ffx.insertKind = 'audio';   // splice onto an audio cable like other audio effects
    for (const [cat, list] of effectsByCategory()) {
      for (const e of list) {
        const spectral = e.domain === 'spectral' && !e.pipeline;
        const bankOut = !!e.multiOut, bankIn = !!(e.variadicInputs || e.mixChain?.multiInput);
        const it = add(e.label, cat, () => spawnTransform(e.id),
          `${e.program || ''} ${e.id} ${e.blurb || ''}${bankOut || bankIn ? ' bank multi' : ''}`, spectral);
        it.bankOut = bankOut; it.bankIn = bankIn;
        // Splice-able onto a matching cable — except multiOut effects, whose
        // bank output can't feed the audio input the cable's far end expects.
        if (!e.multiOut) { it.insert = true; it.insertKind = spectral ? 'spectral' : 'audio'; }
      }
    }
    return out;
  }
  function spawnAt(make, clientX, clientY) {
    const n = make();
    if (n && n.el) {
      const r = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.round((clientX - r.left) / zoom - 24));
      const y = Math.max(0, Math.round((clientY - r.top) / zoom - 14));
      n.x = x; n.y = y; n.el.style.left = x + 'px'; n.el.style.top = y + 'px';
      updateCablesFor(n.id); persist();
    }
    return n;
  }

  let qpal = null;
  function quickPalette() {
    if (qpal) return qpal;
    const input = el('input', { class: 'qopen-input', type: 'text', placeholder: 'Search processes…', spellcheck: false });
    const list = el('div', { class: 'qopen-list' });
    const box = el('div', { class: 'qopen' }, input, list);
    box.setAttribute('popover', 'auto');
    document.body.appendChild(box);
    let items = [], filtered = [], sel = 0, atX = 0, atY = 0, curOpts = {};

    const hl = (text, pos) => {
      const span = el('span', { class: 'qopen-label' });
      const set = new Set(pos || []);
      for (let i = 0; i < text.length; i++) span.append(set.has(i) ? el('b', { textContent: text[i] }) : document.createTextNode(text[i]));
      return span;
    };
    const render = () => {
      list.innerHTML = '';
      if (!filtered.length) { list.append(el('div', { class: 'qopen-empty', textContent: 'no matches' })); return; }
      filtered.forEach((it, i) => {
        const right = el('span', { class: 'qopen-right' });
        if (it.spectral) right.append(el('span', { class: 'qopen-spec', title: 'Spectral — wire between PVOC Analyse and Resynthesise', textContent: '◈ spectral' }));
        if (it.bankOut) right.append(el('span', { class: 'qopen-spec', title: 'Produces a bank of sounds — wire its ▣ output to a Pick node or an Output', textContent: '▣ bank out' }));
        if (it.bankIn) right.append(el('span', { class: 'qopen-spec', title: 'Takes extra sounds on a ▣ bank input — from a Gather node or a multi-output effect', textContent: '▣ bank in' }));
        right.append(el('span', { class: 'qopen-kind', textContent: it.kind }));
        const row = el('div', { class: 'qopen-item' + (i === sel ? ' sel' : '') + (it._sep ? ' qopen-pinsep' : '') }, hl(it.label, it._pos), right);
        row.addEventListener('mousedown', (e) => { e.preventDefault(); choose(i); });
        row.addEventListener('mousemove', () => { if (sel !== i) { sel = i; mark(); } });
        list.append(row);
      });
      list.children[sel]?.scrollIntoView({ block: 'nearest' });
    };
    const mark = () => {   // cheap selection move without rebuilding rows
      [...list.children].forEach((r, i) => r.classList.toggle('sel', i === sel));
      list.children[sel]?.scrollIntoView({ block: 'nearest' });
    };
    const filter = () => {
      const pool = curOpts.filter ? items.filter(curOpts.filter) : items;
      const q = input.value.trim();
      if (!q) {
        const pinned = pool.filter((it) => it.pinned).sort((a, b) => a.pinOrder - b.pinOrder);
        const rest = pool.filter((it) => !it.pinned).sort((a, b) => a.label.localeCompare(b.label));
        filtered = [...pinned, ...rest];
        filtered.forEach((it) => { it._pos = []; it._sep = false; });
        if (pinned.length) pinned[pinned.length - 1]._sep = true;   // divider under the pinned group
      } else {
        const scored = [];
        for (const it of pool) {
          const m = fuzzyMatch(q, it.label);
          if (m) { it._score = m.score; it._pos = m.positions; scored.push(it); continue; }
          const km = fuzzyMatch(q, it.search);                 // fall back to keywords
          if (km) { it._score = km.score - 12; it._pos = []; scored.push(it); }
        }
        scored.sort((a, b) => b._score - a._score);
        filtered = scored.slice(0, 100);
        filtered.forEach((it) => { it._sep = false; });   // no pinned divider while searching
      }
      sel = 0; render();
    };
    const choose = (i) => { const it = filtered[i]; close(); if (it) (curOpts.onChoose ? curOpts.onChoose(it) : spawnAt(it.make, atX, atY)); };
    const close = () => { try { box.hidePopover(); } catch {} };
    input.addEventListener('input', filter);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(sel + 1, filtered.length - 1); mark(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(sel - 1, 0); mark(); }
      else if (e.key === 'Enter') { e.preventDefault(); choose(sel); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });

    qpal = {
      open(x, y, opts = {}) {
        curOpts = opts; items = buildQuickItems(); atX = x; atY = y;
        input.value = ''; input.placeholder = opts.placeholder || 'Search processes…';
        filter();
        box.showPopover();
        const bw = box.offsetWidth || 360, bh = box.offsetHeight || 320;
        box.style.left = Math.max(8, Math.min(x, innerWidth - bw - 8)) + 'px';
        box.style.top = Math.max(8, Math.min(y, innerHeight - bh - 8)) + 'px';
        input.focus();
      },
    };
    return qpal;
  }
  const openQuickAdd = (x, y) => quickPalette().open(x, y);
  // Open the palette to splice a process into `edge`, filtered to its domain.
  function openInsertPalette(edge) {
    if (!patch.edges.includes(edge)) { hideInsertNow(); return; }   // the cable went away under the +
    insertBtn.style.display = 'none';
    const kind = portKind(node(edge.from.node), edge.from.port);
    const r = canvas.getBoundingClientRect();
    const mid = edge.pathEl.getPointAtLength(edge.pathEl.getTotalLength() / 2);   // canvas units
    quickPalette().open(r.left + mid.x * zoom, r.top + mid.y * zoom, {
      placeholder: `Insert ${kind} process…`,
      filter: (it) => it.insert && it.insertKind === kind,
      onChoose: (it) => insertOnCable(edge, it, mid),
    });
  }
  // Splice a new node into a cable: A→B becomes A→N→B (ports must match kind).
  function insertOnCable(edge, item, mid) {
    if (!patch.edges.includes(edge)) return;   // the cable was removed meanwhile
    const from = { ...edge.from }, to = { ...edge.to };
    const n = item.make();
    if (!n || !n.el) return;
    const w = n.el.offsetWidth || 200;
    n.x = Math.max(0, Math.round(mid.x - w / 2));
    n.y = Math.max(0, Math.round(mid.y - 18));
    n.el.style.left = n.x + 'px'; n.el.style.top = n.y + 'px';
    removeEdge(edge);
    const inPort = n.inPorts?.[0]?.name || 'in';
    const outPort = n.outPort?.name || 'out';
    addEdge(from, { node: n.id, port: inPort });
    addEdge({ node: n.id, port: outPort }, to);
    updateCablesFor(n.id); persist();
  }
  desktop.addEventListener('dblclick', (e) => {
    if (e.target.closest('.gwin')) return;   // window dbl-clicks (roll-up) keep their behaviour
    openQuickAdd(e.clientX, e.clientY);
  });
  // Right-click on the empty canvas: our own menu (see openNodeMenu for nodes).
  // Editable fields keep their native menu so copy/paste/spellcheck stay
  // available. Over a node's body (its title bar has its own menu and stops
  // propagation) we just suppress the native menu without drawing one.
  desktop.addEventListener('contextmenu', (e) => {
    if (e.target.closest('input, textarea, [contenteditable=""], [contenteditable="true"]')) return;
    e.preventDefault();
    if (e.target.closest('.gwin')) return;
    const cx = e.clientX, cy = e.clientY;
    const r = canvas.getBoundingClientRect();
    const pt = { x: (cx - r.left) / zoom, y: (cy - r.top) / zoom };   // canvas-unit anchor for Paste here
    openMenuAt(cx, cy, () => [
      { label: 'Add node…', action: () => openQuickAdd(cx, cy) },
      { label: 'Paste here', disabled: !clipboard, action: () => paste(pt) },
      { sep: true },
      { label: `Select all  (${modKey}A)`, action: () => setSelection([...patch.nodes.values()].filter((n) => n.type !== 'log').map((n) => n.id)) },
      { label: `Arrange nodes  (${modKey}L)`, action: () => applyAutoLayout() },
      { sep: true },
      { label: 'Zoom to fit', action: () => zoomToFit() },
      { label: `Reset zoom  (${modKey}0)`, disabled: zoom === 1, action: () => setZoom(1) },
    ]);
  });
  // ---- marquee (rubber-band) selection on the empty canvas ------------------
  // Track live pointers over the canvas so a second finger (pinch-zoom /
  // two-finger pan on touch) aborts an in-progress marquee instead of trapping
  // the gesture or spawning one rubber-band per finger.
  const livePointers = new Set();
  let abortMarquee = null;
  addEventListener('pointerup', (e) => livePointers.delete(e.pointerId));
  addEventListener('pointercancel', (e) => livePointers.delete(e.pointerId));
  canvas.addEventListener('pointerdown', (e) => {
    livePointers.add(e.pointerId);
    if (livePointers.size > 1) { abortMarquee?.(); return; }   // multi-touch → let the browser pinch/pan
    if (e.target.closest('.gwin, .gport, .cable, .cable-insert')) return;   // windows / ports / cables own their pointers
    // Finger drags pan the scrollable desktop and never draw a rubber band.
    // Tapping a node still selects that one node in makeWindow() above; tapping
    // empty space simply clears the current selection.
    if (e.pointerType === 'touch') { clearSelection(); return; }
    if (e.button !== 0) return;
    const d = canvas.getBoundingClientRect();
    const x0 = e.clientX - d.left, y0 = e.clientY - d.top;
    const additive = e.shiftKey;
    let box = null;
    canvas.setPointerCapture(e.pointerId);
    const teardown = () => { canvas.removeEventListener('pointermove', mv); canvas.removeEventListener('pointerup', up); abortMarquee = null; };
    // Called when a later pointer turns this into a pinch: drop the rubber-band
    // and release capture so the browser owns the gesture.
    abortMarquee = () => { teardown(); box?.remove(); box = null; try { canvas.releasePointerCapture(e.pointerId); } catch {} };
    const mv = (ev) => {
      const x1 = ev.clientX - d.left, y1 = ev.clientY - d.top;
      if (!box && Math.abs(x1 - x0) < 4 && Math.abs(y1 - y0) < 4) return;   // below the click/drag threshold
      if (!box) { box = el('div', { class: 'marquee' }); canvas.appendChild(box); }
      box.style.left = Math.min(x0, x1) + 'px'; box.style.top = Math.min(y0, y1) + 'px';
      box.style.width = Math.abs(x1 - x0) + 'px'; box.style.height = Math.abs(y1 - y0) + 'px';
    };
    const up = (ev) => {
      teardown();
      if (!box) { if (!additive) clearSelection(); return; }   // a bare click on empty canvas clears
      box.remove();
      const x1 = ev.clientX - d.left, y1 = ev.clientY - d.top;
      // The box is drawn in screen px; /zoom to compare against canvas-unit node coords.
      const l = Math.min(x0, x1) / zoom, t = Math.min(y0, y1) / zoom, R = Math.max(x0, x1) / zoom, B = Math.max(y0, y1) / zoom;
      const hit = [];
      for (const m of patch.nodes.values()) {
        if (!m.el || m.type === 'log') continue;
        if (m.x <= R && m.x + m.el.offsetWidth >= l && m.y <= B && m.y + m.el.offsetHeight >= t) hit.push(m.id);   // AABB overlap
      }
      if (additive) { for (const id of hit) selection.add(id); syncSelectionClass(); if (hit.length) setFocus(hit[hit.length - 1]); }
      else setSelection(hit);
    };
    canvas.addEventListener('pointermove', mv); canvas.addEventListener('pointerup', up);
  });
  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openQuickAdd(Math.round(innerWidth / 2 - 180), 110); }
  });

  const titleOf = (n) => ({
    source: 'Source', output: 'Output', pvocAnalyse: 'PVOC Analyse', pvocResynth: 'PVOC Resynthesise', breakpoint: 'Breakpoint',
    pick: 'Pick', gather: 'Gather',
  }[n.type]) || (n.type === 'transform' ? byId[n.effectId].label
    : n.type === 'generator' ? (genById[n.genId]?.label || 'Generator')
    : n.type === 'faust' ? (n.faustKind === 'generator' ? 'Faust generator' : 'Faust effect')
    : n.type === 'rawTransform' ? 'Raw: ' + n.raw.program : n.type);

  // ---- boot -----------------------------------------------------------------
  // Measure the menu bar live so the desktop's bottom meets the docks exactly
  // (a hard-coded height left a thin gap above the Log when the font/border
  // didn't sum to it). Fires on first layout and on every font/theme change.
  const menubarEl = document.querySelector('.menubar');
  if (menubarEl) new ResizeObserver(() => {
    document.documentElement.style.setProperty('--menubar-h', menubarEl.offsetHeight + 'px');
  }).observe(menubarEl);
  initTempo();                   // restore project tempo from localStorage
  initTooltips();                // custom hover tooltips for any [data-tip] / title:
  initTouchGestures();           // touch double-tap → dblclick, long press → contextmenu
  ensureLog(false);              // dock exists but hidden
  // Mount the sampler keyboard but keep it hidden; a restored patch re-shows it
  // via loadPatch() if it was saved with the sampler open (serialize sets it).
  try { if (sampler) { const kb = ensureKeyboard(); kb.hide(); } } catch {}
  // When embedded in a host (the #cdpHost session hash, see host-bridge.js),
  // ignore the previous session and always boot a clean default graph, so the
  // host's injected audio lands in a single Source node rather than alongside a
  // restored one (and so no async restore clobbers the injection).
  const embedded = isEmbedded();
  // A share link (#patch=…, see share.js) — ignored inside native hosts, whose
  // state comes from #cdpHost / the plugin's own graph push instead.
  const shareParam = embedded || inPlugin() ? null : getShareParam();
  const saved = embedded ? null : readSaved();     // a patch from a previous session, if any
  const spawnDefaultGraph = () => {
    const s = spawnSource(); s.x = 30; s.y = 20; s.el.style.left = '30px'; s.el.style.top = '20px';
    const o = spawnOutput(); o.x = 560; o.y = 20; o.el.style.left = '560px'; o.el.style.top = '20px';
    recordHistory();   // baseline so the first edit is undoable
    log('ready — Process ▸ add a transform, drag cables port→port, then Run.');
  };
  // Nothing to restore or open → show the default Source + Output straight away.
  if (!saved && !shareParam) spawnDefaultGraph();
  (async () => {
    try {
      [programList, spectralSet] = await Promise.all([cdp.programs(), cdp.spectralPrograms().then((s) => new Set(s))]);
    } catch (e) { logError('could not load program manifest: ' + e.message); }
    await cdp.load('synth').then(() => { window.__cdpReady = true; log('CDP modules ready.'); })
      .catch((e) => { logError('load error: ' + e.message); window.showServingHint?.(); });
    // Restore state once modules + program list are ready (tone sources
    // regenerate via synth; raw nodes need the program list). A share link wins
    // over the previous session, but asks first — opening it replaces the
    // autosaved patch on the next edit.
    if (shareParam) {
      let opened = false;
      try {
        const data = await decodeShare(shareParam);
        if (!data || data.app !== 'cdp-web-patch' || !Array.isArray(data.nodes)) throw new Error('not a cdp-web patch');
        const choice = !saved ? 'open' : await gemAlert(
          'Open the <b>shared patch</b> from this link?<br>It replaces the patch from your previous session.',
          [{ label: 'Cancel', value: 'cancel' }, { label: 'Open', value: 'open', primary: true }],
        );
        if (choice === 'open') {
          if (Number(data.v) > 1) log('this shared patch is from a newer cdp-web — loading what it can.');
          loadPatch(data, { resetSample: true });
          persist();   // the link's patch becomes the session, as the dialog promised
          opened = true;
          log('loaded shared patch from link.');
        }
      } catch (e) { logError('could not open the shared link: ' + e.message); }
      stripShareParam();   // the address bar shouldn't imply the link still drives the session
      if (!opened) {
        if (saved) { loadPatch(saved); log('restored patch from last session (File ▸ New patch to start over).'); }
        else spawnDefaultGraph();
      }
    } else if (saved) { loadPatch(saved); log('restored patch from last session (File ▸ New patch to start over).'); }
  })();
  // expose the patch round-trip for the headless tests / power users
  window.__patch = { serialize, loadPatch, undo, redo, hist: () => ({ len: history.length, i: histIndex }) };
  // Plugin mode: accept a graph restored from the host's plugin state. The host may
  // push it before the CDP WASM modules finish loading (tone/raw nodes need them),
  // so defer the load until __cdpReady. registerGraphHandler replays any graph that
  // already arrived (cached in index.html), so ordering vs. the host push is safe.
  if (inPlugin() && typeof window.registerGraphHandler === 'function') {
    window.registerGraphHandler((data) => {
      const apply = () => {
        try { loadPatch(data, { resetSample: true }); log('restored patch from host state.'); }
        catch (e) { logError('host graph load failed: ' + e.message); }
      };
      if (window.__cdpReady) apply();
      else { const iv = setInterval(() => { if (window.__cdpReady) { clearInterval(iv); apply(); } }, 50); }
    });
    // Tell the host we're ready to receive initial state. The host defers its param
    // and graph pushes until this arrives, because the WebView page load races the
    // host's poll timer — pushing before our globals/handlers exist would be lost.
    try { IPlugSendMsg({ msg: 'SUIRDY' }); } catch { /* bridge unavailable */ }
  }
  // Minimal host-integration surface, consumed by host-bridge.js when the app is
  // embedded in a native WebView host (e.g. a DAW extension). Inert in normal use.
  window.__cdpHost = {
    // Load external audio (WAV Uint8Array) into a SINGLE Source node: reuse an
    // existing empty source (e.g. the default one) if present, else the first
    // source, else create one — so embedding never leaves a stray empty source.
    setSource: (wav, name) => {
      const sources = [...patch.nodes.values()].filter((n) => n.type === 'source');
      const target = sources.find((n) => !n.source || !n.source.wav) || sources[0];
      if (target && target.setWav) { target.setWav(wav, name); return target; }
      return promoteToSource(wav, name);
    },
    // The most recently rendered Output result (WAV Uint8Array), or null.
    getResult: () => lastResult,
    // Run the first Output node and return its rendered WAV (or null).
    render: async () => {
      const out = [...patch.nodes.values()].find((n) => n.type === 'output');
      return out ? await out.run() : null;
    },
    // True once the CDP WASM modules have finished loading.
    ready: () => !!window.__cdpReady,
    // Let the host place its own action button(s) in every Output node's footer,
    // in place of the (host-irrelevant) Drag button. `factory` is
    // (outputNode) => Element | Element[]; called per node, now and for future
    // Output nodes. Passing null clears it.
    registerOutputAction: (factory) => {
      outputActionFactory = factory || null;
      for (const n of patch.nodes.values()) if (n.type === 'output') applyOutputAction(n);
    },
  };
}
