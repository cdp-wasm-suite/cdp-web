// The verbs a scene script calls. Every one of them advances the clock and
// captures frames as a side effect, so a scene reads as a sequence of intents
// and the frame bookkeeping stays here.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { wavInfo } from './manifest.mjs';

const EASINGS = {
  linear: (t) => t,
  easeInOut: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOut: (t) => 1 - Math.pow(1 - t, 3),
  easeIn: (t) => t * t * t,
};

/**
 * Cursor pacing. Distance-based by default, so a short hop between two ports and
 * a long sweep across the desktop move at the same apparent speed -- a fixed
 * duration per move would make long travels look frantic and short ones sluggish.
 *
 * All in CSS px (the coordinate space page.mouse uses), per second of video time.
 */
export const CURSOR_DEFAULTS = {
  speed: 1400,        // px/sec of travel
  minSeconds: 0.18,   // don't let a tiny hop finish inside one or two frames
  maxSeconds: 1.2,    // don't let a corner-to-corner sweep drag
  dragSpeed: 700,     // cable drags read better slower -- it's the signature move
  easing: 'easeInOut',
};

export function createActions(ctx) {
  const { page, clock, capture, manifest, outDir, fps, scale } = ctx;
  const audioDir = join(outDir, 'audio');
  mkdirSync(audioDir, { recursive: true });

  // Scene-level overrides: createActions({..., cursor: {speed: 600}}) or
  // a.cursor.speed = 600 mid-scene.
  const cursorCfg = { ...CURSOR_DEFAULTS, ...(ctx.cursor ?? {}) };

  const easeOf = (name) => EASINGS[name] ?? EASINGS.easeInOut;
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);

  /** Seconds a move should take: explicit `seconds` wins, else distance / speed. */
  const travelSeconds = (from, to, { seconds, speed } = {}) => {
    if (seconds != null) return seconds;
    const v = speed ?? cursorCfg.speed;
    const raw = dist(from, to) / v;
    return Math.min(cursorCfg.maxSeconds, Math.max(cursorCfg.minSeconds, raw));
  };

  let cursor = { x: 40, y: 40 };
  let audioSeq = 0;

  /** Bounding box in captured-frame pixels. Playwright reports CSS px. */
  const framePx = (box) => ({
    x: box.x * scale, y: box.y * scale, w: box.width * scale, h: box.height * scale,
  });

  async function boxOf(selector) {
    const el = page.locator(selector).first();
    await el.waitFor({ state: 'visible', timeout: 10_000 });
    // A row scrolled out of a long menu's clipped area still reports a bounding
    // box, so pressing that point would land outside the menu entirely. Playwright's
    // own click() auto-scrolls; a manual mouse.move does not. No-op when visible.
    await el.scrollIntoViewIfNeeded();
    const box = await el.boundingBox();
    if (!box) throw new Error(`no bounding box for ${selector}`);
    return box;
  }

  const centre = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });

  /** Ports carry data-node / data-port (patcher.js:709). */
  const portSel = (node, port) => `[data-node="${node}"][data-port="${port}"]`;

  /**
   * Output node ids are not stable: recipes ship n2..n7, and loadPatch re-mints
   * every id through its idMap. Ask the live patch rather than guessing.
   */
  async function outputNodeId() {
    const id = await page.evaluate(() =>
      window.__patch.serialize().nodes.find((n) => n.type === 'output')?.id ?? null);
    if (!id) throw new Error('no output node in the current patch');
    return id;
  }

  /** Advance one frame: step virtual time, then screenshot. */
  async function frame() {
    await clock.step();
    return capture.snap();
  }

  const api = {
    get frame() { return capture.frame; },
    /** Live cursor pacing. Mutate mid-scene: `a.cursor.speed = 500` to slow a beat down. */
    cursor: cursorCfg,
    /** Where the pointer currently is, in CSS px. */
    get cursorAt() { return { ...cursor }; },
    framePx, boxOf, centre, portSel, outputNodeId,

    /** Hold the current state for `seconds`, capturing every frame. */
    async hold(seconds) {
      const n = Math.round(seconds * fps);
      for (let i = 0; i < n; i++) await frame();
    },

    /**
     * Glide the real mouse to a point over `seconds`, capturing each frame.
     * Deliberately NOT page.mouse.move(x, y, {steps}) -- that fires all its
     * intermediate events inside a single virtual instant, so the app's drag
     * logic runs but no frames exist between start and end.
     */
    async moveTo(target, { seconds, speed, easing } = {}) {
      const to = typeof target === 'string' ? centre(await boxOf(target)) : target;
      const from = { ...cursor };
      const ease = easeOf(easing ?? cursorCfg.easing);
      const n = Math.max(1, Math.round(travelSeconds(from, to, { seconds, speed }) * fps));
      for (let i = 1; i <= n; i++) {
        const t = ease(i / n);
        await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
        await frame();
      }
      cursor = to;
      return to;
    },

    async click(target, { settle = 0.25 } = {}) {
      if (target) await api.moveTo(target);
      await page.mouse.down();
      await frame();
      await page.mouse.up();
      await api.hold(settle);
    },

    /**
     * Drag a cable port -> port. The app rubber-bands the cable on pointermove,
     * so the frames have to be interleaved with the movement.
     */
    async dragCable(from, to, { seconds, speed, easing, approach } = {}) {
      const a = centre(await boxOf(portSel(from.node, from.port)));
      const b = centre(await boxOf(portSel(to.node, to.port)));

      await api.moveTo(a, approach ?? {});
      await page.mouse.down();
      await frame();

      const ease = easeOf(easing ?? cursorCfg.easing);
      const n = Math.max(1, Math.round(
        travelSeconds(a, b, { seconds, speed: speed ?? cursorCfg.dragSpeed }) * fps));
      for (let i = 1; i <= n; i++) {
        const t = ease(i / n);
        // A slight arc reads better than a straight line and matches how the
        // cable hangs once it's connected.
        const sag = Math.sin(Math.PI * t) * 18;
        await page.mouse.move(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t + sag);
        await frame();
      }
      await page.mouse.up();
      cursor = b;
      await api.hold(0.3);
    },

    /** Load a recipe by name via the patch round-trip -- never the file picker. */
    async loadRecipe(recipe, { settle = 0.5 } = {}) {
      await page.evaluate((r) => window.__patch.loadPatch(r, { arrange: true }), recipe);
      // loadPatch redraws cables on the next animation frame; give it one.
      await frame();
      await clock.settleReal(80);
      await api.hold(settle);
    },

    /**
     * Render the Output node, capturing the "Running…" frames while the WASM
     * render is in flight. The render progresses on real time and microtasks, so
     * stepping the clock keeps frames flowing without stalling it.
     *
     * `click: true` (the default) drives the actual Run button, which is the
     * path a viewer should see. It is NOT combined with __cdpHost.render() --
     * that would fire a second, concurrent doRun for the same node.
     *
     * Nothing is played back. player.playhead() reads audioCtx.currentTime
     * (player.js:103), the real hardware clock, which under a paused virtual
     * clock races ahead of the frames. The sweep is drawn in the compositor.
     */
    async run({ maxSeconds = 60, click = true, node, approach } = {}) {
      const nodeId = node ?? await outputNodeId();
      // #run is duplicated per Output node (patcher.js:1775), so scope it.
      const runSel = `.gwin:has([data-node="${nodeId}"][data-port="in"]) button#run`;
      const limit = maxSeconds * fps;
      let i = 0;

      if (click) {
        await api.moveTo(runSel, approach ?? {});
        await page.mouse.down();
        await frame();
        await page.mouse.up();
        // doRun ran synchronously from onclick and has already set disabled=true.
        // It clears it in a finally, so "enabled again" means "finished".
        // A render fast enough to finish before the first poll just exits here.
        while (await page.evaluate((s) => !!document.querySelector(s)?.disabled, runSel)) {
          await frame();
          if (++i > limit) throw new Error(`render did not finish within ${maxSeconds}s of frames`);
        }
      } else {
        await page.evaluate(() => {
          window.__demoRenderDone = false;
          window.__demoRenderErr = null;
          window.__cdpHost.render()
            .catch((e) => { window.__demoRenderErr = String((e && e.message) || e); })
            .finally(() => { window.__demoRenderDone = true; });
        });
        while (!(await page.evaluate(() => window.__demoRenderDone))) {
          await frame();
          if (++i > limit) throw new Error(`render did not finish within ${maxSeconds}s of frames`);
        }
        const err = await page.evaluate(() => window.__demoRenderErr);
        if (err) throw new Error(`__cdpHost.render() failed: ${err}`);
      }

      // The Output node's mini-waveform is drawn on the main thread by drawWave,
      // so it lands with the frames. (The full-screen editor's worker does not --
      // that needs clock.settleReal.)
      await frame();

      const b64 = await page.evaluate(() => {
        // doRun assigns both n.result and the module-level lastResult, which is
        // what getResult() returns.
        const wav = window.__cdpHost.getResult();
        if (!wav) return null;
        let s = '';
        for (let i = 0; i < wav.length; i += 0x8000) {
          s += String.fromCharCode.apply(null, wav.subarray(i, i + 0x8000));
        }
        return btoa(s);
      });
      if (!b64) throw new Error('render produced no result (check the page log for a CDP error)');

      const id = `render-${String(++audioSeq).padStart(2, '0')}`;
      const file = `audio/${id}.wav`;
      const buf = Buffer.from(b64, 'base64');
      writeFileSync(join(outDir, file), buf);
      const info = wavInfo(buf);

      ctx.lastAudio = { id, file, buf, info };
      return ctx.lastAudio;
    },

    /**
     * Place the last render's audio at the current frame and hold for its
     * duration (or `seconds`), recording a playhead descriptor so the compositor
     * can sweep a line across the Output node's waveform in exact sync.
     */
    async listen({ seconds, outputNode } = {}) {
      const a = ctx.lastAudio;
      if (!a) throw new Error('listen() before run()');

      const startFrame = capture.frame;
      const dur = seconds ?? a.info.seconds;
      const nodeId = outputNode ?? await outputNodeId();

      // The waveform canvas inside the Output window.
      const canvasBox = await page.evaluate((sel) => {
        const port = document.querySelector(sel);
        const win = port && port.closest('.gwin');
        const cv = win && win.querySelector('canvas');
        if (!cv) return null;
        const r = cv.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      }, portSel(nodeId, 'in'));

      manifest.addAudio({
        id: a.id, file: a.file, startFrame,
        sampleRate: a.info.sampleRate, seconds: a.info.seconds,
      });

      await api.hold(dur);

      return {
        audioRef: a.id,
        playhead: canvasBox && {
          canvasRect: framePx(canvasBox),
          sampleRate: a.info.sampleRate,
          startFrame,
          endFrame: capture.frame,
        },
      };
    },

    // ---- Building a patch by hand ----------------------------------------
    //
    // None of the spawn* functions are on window; the only exposed builder is
    // __patch.loadPatch, which drops a finished graph in at once. To construct a
    // patch on camera we drive the same UI a person would: menus, the quick-add
    // palette, title-bar drags, sliders, and port-to-port cable drags.

    /** Escape hatch for scenes that need the raw page (e.g. __cdpHost.setSource). */
    page,

    /** Live node ids, in patch order. */
    async nodeIds() {
      return page.evaluate(() => window.__patch.serialize().nodes.map((n) => n.id));
    },

    /** Live node id -> type. */
    async nodeTypes() {
      return page.evaluate(() => Object.fromEntries(
        window.__patch.serialize().nodes.map((n) => [n.id, n.type])));
    },

    /**
     * Assert the patch we just built by hand really is the recipe's graph.
     * Without this a scene can look convincing on camera while having wired the
     * wrong port or skipped a node -- and the rendered audio would quietly be
     * something other than the recipe.
     */
    async assertTopology(recipe, idMap) {
      const built = await page.evaluate(() => window.__patch.serialize());
      const problems = [];

      // Every spec node must map to a live node of the same type.
      const liveById = Object.fromEntries(built.nodes.map((n) => [n.id, n]));
      for (const s of recipe.nodes) {
        const id = idMap.get(s.id);
        const n = id && liveById[id];
        if (!n) { problems.push(`node ${s.id} (${s.type}) was never built`); continue; }
        if (n.type !== s.type) problems.push(`node ${s.id}: expected ${s.type}, built ${n.type}`);
        if (s.type === 'transform' && n.effectId !== s.effectId) {
          problems.push(`node ${s.id}: expected effect ${s.effectId}, built ${n.effectId}`);
        }
        if (s.type === 'generator' && n.gen?.id !== s.gen?.id) {
          problems.push(`node ${s.id}: expected generator ${s.gen?.id}, built ${n.gen?.id}`);
        }

        // Params and data, not just shape. A patch with the right nodes and
        // cables but a default parameter renders the wrong sound while every
        // structural check passes.
        const want = (s.type === 'generator' ? s.gen?.values : s.state?.values) ?? {};
        const got = (n.type === 'generator' ? n.gen?.values : n.state?.values) ?? {};
        for (const [k, v] of Object.entries(want)) {
          // Sliders round-trip through strings; compare numerically where we can.
          const same = (typeof v === 'number' && got[k] != null)
            ? Math.abs(Number(got[k]) - v) < 1e-6
            : String(got[k]) === String(v);
          if (!same) problems.push(`node ${s.id}: param ${k} = ${JSON.stringify(got[k])}, expected ${JSON.stringify(v)}`);
        }
        if (s.type === 'generator' && s.gen?.data != null && n.gen?.data !== s.gen.data) {
          problems.push(`node ${s.id}: generator data differs (did you forget setData?)`);
        }
      }
      if (built.nodes.length !== recipe.nodes.length) {
        problems.push(`node count: expected ${recipe.nodes.length}, built ${built.nodes.length}`);
      }

      // Every recipe edge must exist, mapped through the live ids.
      const key = (e) => `${e.from.node}:${e.from.port}->${e.to.node}:${e.to.port}`;
      const builtEdges = new Set(built.edges.map(key));
      for (const e of recipe.edges) {
        const mapped = key({
          from: { node: idMap.get(e.from.node), port: e.from.port },
          to: { node: idMap.get(e.to.node), port: e.to.port },
        });
        if (!builtEdges.has(mapped)) problems.push(`missing cable ${key(e)}`);
      }
      if (built.edges.length !== recipe.edges.length) {
        problems.push(`cable count: expected ${recipe.edges.length}, built ${built.edges.length}`);
      }

      if (problems.length) {
        throw new Error(`built patch does not match "${recipe.metadata.name}":\n  ` + problems.join('\n  '));
      }
      return built;
    },

    /**
     * Run an interaction that spawns exactly one node, and return its id.
     * Node ids are minted by the patcher, so the only way to learn the new one
     * is to diff the patch before and after.
     */
    async spawning(fn, what = 'action') {
      const before = new Set(await api.nodeIds());
      await fn();
      for (let i = 0; i < 60; i++) {
        const after = await api.nodeIds();
        const fresh = after.filter((id) => !before.has(id));
        if (fresh.length === 1) return fresh[0];
        if (fresh.length > 1) throw new Error(`${what}: expected 1 new node, got ${fresh.length}: ${fresh}`);
        await frame();
      }
      throw new Error(`${what}: no node appeared`);
    },

    /** Open a menubar menu (`file`, `generate`, `process`, `pvoc`, `view`, …). */
    async openMenu(name) {
      await api.click(`#m-${name}`, { settle: 0.12 });
    },

    /**
     * Pick a row from the open menu by its exact visible text. Menu rows carry
     * no data attribute, so text is the only handle. `.gem-menu` popovers are
     * rebuilt on each open and also used by gemSelect, hence `:visible`.
     */
    async menuPick(label, { settle = 0.2 } = {}) {
      await api.click(`.gem-menu:visible .opt:text-is(${JSON.stringify(label)})`, { settle });
    },

    /** Menu ▸ label, returning the id of the node it spawned. */
    async addFromMenu(menu, label) {
      return api.spawning(async () => {
        await api.openMenu(menu);
        await api.menuPick(label);
      }, `${menu} ▸ ${label}`);
    },

    /**
     * Quick-add palette (Cmd/Ctrl+K). Keyboard-driven, so the cursor stays put.
     * Rows respond to mousedown, but typing and pressing Enter picks the top hit.
     */
    async addFromPalette(query, { typeDelay = 0.05 } = {}) {
      return api.spawning(async () => {
        await page.keyboard.press(process.platform === 'darwin' ? 'Meta+k' : 'Control+k');
        await api.hold(0.25);
        for (const ch of query) {
          await page.keyboard.type(ch);
          await api.hold(typeDelay);
        }
        await api.hold(0.35);            // let the fuzzy list settle on camera
        await page.keyboard.press('Enter');
        await api.hold(0.15);
      });
    },

    /**
     * A point on this node's title bar that is actually on top -- not covered by
     * a sibling window, and not on one of the bar's buttons.
     *
     * Pressing the bar's geometric centre is wrong: windows overlap freely, and
     * a recently-moved sibling sits above. The press would silently grab the
     * wrong window and drag that instead.
     */
    async barGrabPoint(id) {
      const pt = await page.evaluate((nid) => {
        const win = document.querySelector(`.gwin[data-node="${nid}"]`);
        const bar = win?.querySelector('.gwin-bar');
        if (!bar) return null;
        const b = bar.getBoundingClientRect();
        const y = Math.round(b.top + b.height / 2);
        for (let x = Math.round(b.left + 6); x < b.right - 6; x += 6) {
          const el = document.elementFromPoint(x, y);
          if (!el) continue;
          if (el.closest('.gwin')?.dataset.node !== nid) continue;   // covered by a sibling
          if (el.closest('.gwin-close, .gwin-shade, .gwin-help')) continue;
          return { x, y };
        }
        return null;
      }, id);
      if (!pt) throw new Error(`node ${id}: no grabbable point on its title bar (fully covered?)`);
      return pt;
    },

    /**
     * Double-click the empty desktop at patch coords (x, y) and pick `label` from
     * the quick-add palette. The node is created exactly there (spawnAt,
     * patcher.js:2359), so no title-bar drag is needed -- nothing ever appears at
     * the cascade position and jumps.
     *
     * The point must be empty desktop: a dblclick landing on a window rolls it up
     * instead (patcher.js:2482).
     */
    async addAtPoint(x, y, label) {
      const pt = await page.evaluate(({ px, py }) => {
        const canvas = document.getElementById('canvas');
        const content = document.getElementById('canvasContent');
        const r = canvas.getBoundingClientRect();
        const z = content.getBoundingClientRect().width / content.offsetWidth;
        // Invert spawnAt: x = (clientX - r.left) / zoom - 24
        return { x: r.left + (px + 24) * z, y: r.top + (py + 14) * z };
      }, { px: x, py: y });

      const hit = await page.evaluate((p) => document.elementFromPoint(p.x, p.y)?.closest('.gwin') != null, pt);
      if (hit) throw new Error(`addAtPoint(${x},${y}): a window is already there; the dblclick would roll it up`);

      const id = await api.spawning(async () => {
        await api.moveTo(pt);
        await page.mouse.dblclick(pt.x, pt.y);
        await api.hold(0.3);
        await page.keyboard.type(label, { delay: 12 });
        await api.hold(0.35);            // let the fuzzy list settle on camera

        // Pick the row whose label matches EXACTLY. Enter would take the top fuzzy
        // hit, which is often something else ("Waveform" also matches "Waveset
        // reform"). Resolve the index in-page, then click that row -- rows respond
        // to mousedown (patcher.js:2396), which api.click delivers.
        const idx = await page.evaluate((want) => [...document.querySelectorAll('.qopen-item')]
          .findIndex((r) => r.querySelector('.qopen-label')?.textContent === want), label);
        if (idx < 0) {
          const seen = await page.evaluate(() => [...document.querySelectorAll('.qopen-label')].map((l) => l.textContent));
          throw new Error(`palette has no exact match for ${JSON.stringify(label)}; saw ${JSON.stringify(seen.slice(0, 6))}`);
        }
        await api.click(`.qopen-item >> nth=${idx}`, { settle: 0.15 });
      }, `palette ▸ ${label}`);

      const at = await page.evaluate((nid) => {
        const n = window.__patch.serialize().nodes.find((v) => v.id === nid);
        return { x: n.x, y: n.y };
      }, id);
      if (Math.max(Math.abs(at.x - x), Math.abs(at.y - y)) > 2) {
        throw new Error(`addAtPoint: node landed at ${at.x},${at.y}, wanted ${x},${y}`);
      }
      return id;
    },

    /** Drag a node window by its title bar to patch coordinates (x, y). */
    async moveNode(id, x, y, { seconds, speed } = {}) {
      const cur = await page.evaluate((nid) => {
        const n = window.__patch.serialize().nodes.find((v) => v.id === nid);
        return n ? { x: n.x, y: n.y } : null;
      }, id);
      if (!cur) throw new Error(`no node ${id}`);
      if (cur.x === x && cur.y === y) return;

      // The canvas can be zoomed; patch coords are pre-zoom.
      const zoom = await api.zoom();

      const from = await api.barGrabPoint(id);
      const to = { x: from.x + (x - cur.x) * zoom, y: from.y + (y - cur.y) * zoom };

      await api.moveTo(from, { speed });
      await page.mouse.down();
      await frame();
      const ease = easeOf(cursorCfg.easing);
      const n = Math.max(1, Math.round(
        travelSeconds(from, to, { seconds, speed: speed ?? cursorCfg.dragSpeed }) * fps));
      for (let i = 1; i <= n; i++) {
        const t = ease(i / n);
        await page.mouse.move(from.x + (to.x - from.x) * t, from.y + (to.y - from.y) * t);
        await frame();
      }
      await page.mouse.up();
      cursor = to;
      await api.hold(0.15);

      // Verify we moved the node we meant to. Without this, a press that lands on
      // an overlapping sibling drags that window instead and the scene carries on
      // looking plausible while the graph is wrong.
      const now = await page.evaluate((nid) => {
        const n = window.__patch.serialize().nodes.find((v) => v.id === nid);
        return n ? { x: n.x, y: n.y } : null;
      }, id);
      const off = Math.max(Math.abs(now.x - x), Math.abs(now.y - y));
      if (off > 2) throw new Error(`moveNode(${id}) landed at ${now.x},${now.y}, wanted ${x},${y}`);
    },

    /** Click a button in the open gemAlert dialog by its visible label (ui.js:113). */
    async confirmDialog(label, { settle = 0.3 } = {}) {
      await api.click(`.gem-dialog .gem-dialog-btns button:text-is(${JSON.stringify(label)})`, { settle });
    },

    /**
     * Closing a node window opens a confirm dialog (requestRemove, patcher.js:916),
     * so a bare close-click removes nothing. The last Output is undeletable and
     * gets an OK-only alert instead.
     */
    async deleteNode(id, { confirm = 'Delete' } = {}) {
      await api.click(`.gwin[data-node="${id}"] .gwin-close`, { settle: 0.25 });
      await api.confirmDialog(confirm);
      await page.locator(`.gwin[data-node="${id}"]`).waitFor({ state: 'detached', timeout: 5000 });
      await api.hold(0.15);
    },

    async newPatch() {
      await api.openMenu('file');
      await api.menuPick('New patch', { settle: 0.4 });
    },

    /** Canvas zoom factor (patch px -> screen px). */
    async zoom() {
      return page.evaluate(() => {
        const c = document.getElementById('canvasContent');
        return c.getBoundingClientRect().width / c.offsetWidth;
      });
    },

    /** ⌘− / ⌘= / ⌘0 (patcher.js:2174-2176). Each step is a factor of 1.2. */
    async zoomOut(times = 1) { for (let i = 0; i < times; i++) { await page.keyboard.press('Meta+Minus'); await api.hold(0.12); } },
    async zoomIn(times = 1) { for (let i = 0; i < times; i++) { await page.keyboard.press('Meta+Equal'); await api.hold(0.12); } },
    async zoomReset() { await page.keyboard.press('Meta+Digit0'); await api.hold(0.2); },

    /** A node window's size in patch (pre-zoom) pixels. */
    async nodeSize(id) {
      const box = await boxOf(`.gwin[data-node="${id}"]`);
      const z = await api.zoom();
      return { w: box.width / z, h: box.height / z };
    },

    /**
     * Zoom out until every node window fits on screen with a margin.
     *
     * Necessary because a recipe's stored x/y are laid out far tighter than the
     * real window widths -- recipes are loaded with `arrange: true`, which throws
     * those coordinates away. Build a chain at true width and it overflows 1920px
     * fast, and an off-screen port cannot be dragged.
     */
    /**
     * Zoom out until patch x-coordinate `patchRight` is on screen.
     *
     * Call this BEFORE dragging a window out to `patchRight`: the mouse cannot
     * travel past the viewport, so a drag whose target lands off-screen silently
     * stops short (moveNode's own assertion then fires).
     */
    async ensureRoom(patchRight, { patchBottom = 0, margin = 0.94, maxSteps = 8 } = {}) {
      for (let i = 0; i < maxSteps; i++) {
        const fits = await page.evaluate(({ pr, pb, m }) => {
          const c = document.getElementById('canvasContent');
          const r = c.getBoundingClientRect();
          const z = r.width / c.offsetWidth;
          return r.left + pr * z < innerWidth * m
              && (!pb || r.top + pb * z < innerHeight * m);
        }, { pr: patchRight, pb: patchBottom, m: margin });
        if (fits) return i;
        await api.zoomOut();
      }
      throw new Error(`cannot fit patch ${patchRight}x${patchBottom} on screen even at minimum zoom`);
    },

    async fitContent({ margin = 0.94, maxSteps = 6 } = {}) {
      for (let i = 0; i < maxSteps; i++) {
        const fits = await page.evaluate((m) => {
          const wins = [...document.querySelectorAll('.gwin')];
          if (!wins.length) return true;
          const r = wins.map((w) => w.getBoundingClientRect());
          const right = Math.max(...r.map((b) => b.right));
          const bottom = Math.max(...r.map((b) => b.bottom));
          return right < innerWidth * m && bottom < innerHeight * m;
        }, margin);
        if (fits) return i;
        await api.zoomOut();
      }
      return maxSteps;
    },

    /**
     * Set a slider param by its visible label. Params carry no data attribute.
     * Dispatching `input` runs range.oninput (ui.js:717), which writes
     * state.values, updates the readout, and marks the graph stale -- the same
     * path a real drag takes. Dragging the thumb itself is unreliable.
     */
    async setParam(id, label, value, { settle = 0.15 } = {}) {
      const sel = `.gwin[data-node="${id}"] .prow-head:has(.prow-label:text-is(${JSON.stringify(label)})) input[type=range]`;
      const el = page.locator(sel).first();
      await el.waitFor({ state: 'attached', timeout: 5000 });
      await el.evaluate((r, v) => {
        r.value = String(v);
        r.dispatchEvent(new Event('input', { bubbles: true }));
      }, value);
      await api.hold(settle);
    },

    /**
     * Set a generator's free-text data (chord notes, click times, …), which lives
     * in a <textarea> whose oninput writes n.data (patcher.js:1360-1362).
     *
     * This is easy to forget: `data` is not a param, so setting every slider still
     * leaves e.g. the Chord generator on its default notes -- the graph looks
     * right and renders the wrong sound. Partials generators use a multislider
     * editor instead of a textarea and are not supported here.
     */
    async setData(id, text, { settle = 0.25 } = {}) {
      const ta = page.locator(`.gwin[data-node="${id}"] textarea`).first();
      // Partials generators (additive/inharmonic re-synthesis) render a multislider
      // editor instead of a textarea, so there is nothing to type into. Say so
      // rather than letting fill() hang for 30s.
      const usable = await ta.isVisible().catch(() => false)
        && await ta.isEditable().catch(() => false);
      if (!usable) {
        throw new Error(`node ${id}: no editable data textarea -- a partials generator ` +
          `(multislider editor) cannot be built on camera yet; use --scene recipe-preview`);
      }
      await ta.fill(text);   // fill() fires `input`, which writes n.data
      await api.hold(settle);
    },

    /** Set a discrete (gemSelect) param. Its rows carry data-value (ui.js:306). */
    async setChoice(id, label, value, { settle = 0.2 } = {}) {
      const row = `.gwin[data-node="${id}"] .prow-head:has(.prow-label:text-is(${JSON.stringify(label)}))`;
      await api.click(`${row} .gem-trigger`, { settle: 0.1 });
      await api.click(`.gem-menu:visible .opt[data-value=${JSON.stringify(String(value))}]`, { settle });
    },

    /** Record a beat for the compositor: caption text, zoom focus, audio link. */
    beat(id, { startFrame, caption, focus, audioRef, playhead, label } = {}) {
      return manifest.addBeat({
        id, label: label ?? id,
        startFrame: startFrame ?? 0,
        endFrame: capture.frame,
        caption: caption ?? null,
        focus: focus ?? null,
        audioRef: audioRef ?? null,
        playhead: playhead ?? null,
      });
    },
  };

  return api;
}
