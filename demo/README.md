# demo — programmatic capture rig

Drives the real app in a real browser and captures reproducible frames + the exact
rendered audio. Nothing here is a screen recording, and nothing in `src/` was changed
to support it.

```
Stage A   rig/ + scenes/   (Playwright)
            out/<scene>/frames/frame-%06d.png
            out/<scene>/audio/render-NN.wav     exact bytes from __cdpHost.render()
            out/<scene>/manifest.json           the Stage A -> Stage B contract

Stage B   remotion/        titles, zooms, captions, synthetic playhead  -> video.mp4
          rig/encode.mjs   or plain ffmpeg, same manifest, no compositing
```

## Why Playwright drives and Remotion does not

Remotion renders video as a pure function of frame number: it opens several headless
Chrome tabs and renders frames in parallel, out of order. cdp-web is an ordered,
side-effectful session — async WASM load, build a graph, drag a cable, press Run, await
an offline render. Frame 400 only makes sense because the Run at frame 380 happened, and
Remotion's tabs share no state. Remotion is an excellent *compositor* (Stage B genuinely
is a pure function of frame); it is the wrong *driver*.

## Why no app changes were needed

The app already exposes everything a driver needs:

| Hook | Source | Used for |
|---|---|---|
| `window.__cdpReady` | `patcher.js:2596` | wait for the WASM modules |
| `window.__patch.loadPatch()` | `patcher.js:2603` | reach any state without the file picker |
| `window.__cdpHost.getResult()` | `patcher.js:2635` | pull the rendered WAV out of the page |
| `data-node` / `data-port` on ports | `patcher.js:709` | address ports for cable drags |

## Usage

```bash
npm install                                    # in demo/
npx playwright install chromium

npm run capture -- --scene recipe-preview --recipe "Spectral freeze-stretch"
npm run encode  -- --scene recipe-preview      # ffmpeg -> out/<scene>/video.mp4

npm run previews                               # a clip for every recipe in the catalogue
npm run previews -- --only Spectral --encode

npm run verify                                 # rAF probe, audio integrity, determinism
```

## Building a patch, not loading one

`recipe-preview` drops a finished graph in with `loadPatch` — fast, but it shows nothing of
how the app works. `build-recipe` assembles the same patch the way a person would: add each
node from the menus, drag it into place, set its parameters, then patch the cables.

```bash
npm run capture -- --scene build-recipe --recipe "Vocoder"                 # via the menus
npm run capture -- --scene build-recipe --recipe "Vocoder" --via palette   # via Cmd+K quick-add
```

Two ways to add a node, and they look different on camera:

- **`--via menu`** (default) opens Generate / Process / PVOC and clicks the item. The node
  appears at the app's cascade position and is then dragged to its planned slot. Shows off the
  menus; every node visibly travels.
- **`--via palette`** double-clicks the empty desktop and picks from quick-add. `spawnAt`
  (`patcher.js:2359`) creates the node *exactly there*, so nothing ever overlaps or jumps.
  Note the palette's Enter key takes the top fuzzy hit, which is often the wrong one
  ("Waveform" also matches "Waveset reform"), so the rig resolves the exact label's row index
  and clicks that.

Both produce a patch whose render is bit-identical to the recipe's.

It ends by asserting that the patch it built **is** the recipe — same nodes, same effect ids,
same cables, same parameter values — and the audio-integrity check confirms the render is
bit-identical to the recipe's:

```bash
node spike/audio-integrity.mjs --scene build-recipe --recipe "Vocoder"
```

Verbs available to a scene:

| Verb | Notes |
|---|---|
| `addFromMenu(menu, label)` | `generate` / `process` / `pvoc`; returns the new node id |
| `addFromPalette(query)` | Cmd+K quick-add, keyboard-driven |
| `moveNode(id, x, y)` | drags the title bar; asserts the right window moved |
| `setParam(id, label, v)` | slider, by its visible label |
| `setChoice(id, label, v)` | gemSelect dropdown |
| `setData(id, text)` | a generator's free-text data (chord notes, click times) |
| `dragCable(from, to)` | port to port, real pointer events |
| `deleteNode(id)` | confirms the delete dialog |
| `ensureRoom(x, {patchBottom})` / `fitContent()` | zoom out so a drag target stays on screen |
| `assertTopology(recipe, idMap)` | the built graph must equal the recipe |
| `measureNodes()` / `planLayout()` | `rig/layout.mjs` — DAG positions from the app's `layoutGraph()` |

### Layout: making the graph readable

A left-to-right row is only right for a straight chain. Cross-synthesis (Vocoder) is *two
branches merging* — forced into one row the branches overlap and the picture explains nothing.

The app already solves this: `layoutGraph()` in `src/core/graph.js` does longest-path layering
plus a barycentre sweep, and it's importable in Node. `rig/layout.mjs` reuses it rather than
inventing a second layout, with wider gaps (90/60 vs the app's 56/26) so cables read on video.

`layoutGraph` needs each window's measured `w`/`h`, and a node's size depends on its own
contents — a Chord generator grows once its notes textarea is filled. So `measureNodes()` does a
hidden pass: `loadPatch` the finished recipe, read every window's real size, restore a clean
desktop. It captures nothing, because no verb runs and so no frame is snapped. Each node is then
created directly at its final slot and never overlaps anything.

Measuring the *finished* recipe is the subtle part. Sizing a node before its params are set
reads too small, and the next node lands on top of it — which is exactly what the first version
of this scene did to the Chord generator.

### Other things that bite when driving this UI

- **Node ids are minted by the patcher**, so `spawning()` learns the new id by diffing
  `serialize()` before and after.
- **Recipe x/y are useless for building.** They pack nodes ~200px apart while a real transform
  window is ~380px wide. Recipes get away with it because `loadPatch(…, {arrange:true})` discards
  those coordinates and auto-layouts.
- **Pressing a window's title-bar centre grabs whatever is on top.** Windows overlap, and a
  recently-moved sibling sits above — the press silently drags the wrong window. `barGrabPoint()`
  scans the bar for an uncovered point, and `moveNode` asserts the intended node actually moved.
- **`data` is not a param.** Set every slider on a Chord generator and it still keeps its default
  notes: the graph is right and the sound is wrong. `assertTopology` now checks values and data,
  not just shape — a structural-only check passed while Vocoder rendered the wrong audio.
- **The Output boots at x=560,** in the middle of the area you're about to build, and it cannot be
  deleted (it's the only one). The scene sends it straight to its planned slot, where it is both
  out of the way and already correct.
- **Closing a window opens a confirm dialog** (`requestRemove`, `patcher.js:916`), so a bare
  close-click removes nothing.

**Coverage: 33 of the 36 recipes build.** The three that don't fail loudly rather than quietly
building something else:

- `Harmonic series` — drives a generator param from an envelope (needs the `∿` toggle plus a
  breakpoint editor drag)
- `Additive re-synthesis`, `Inharmonic re-synthesis` — partials generators, which render a
  multislider rather than a data textarea

Faust and raw nodes are likewise unsupported. Multi-source recipes (`Talking horn`,
`Morph marimba → horn`) do work: `__cdpHost.setSource` fills the first Source with no audio yet,
so the scene injects one, adds a fresh empty Source from **File ▸ Add audio file source**, and
injects the next.

## Cursor speed

Pacing is **distance-based**, not fixed-duration: a short hop between two ports and a long
sweep across the desktop travel at the same apparent speed. A fixed duration per move would
make long travels look frantic and short ones sluggish.

| Knob | Default | Meaning |
|---|---|---|
| `speed` | `1400` | px/sec for ordinary moves |
| `dragSpeed` | `700` | px/sec while dragging a cable — slower, it's the signature move |
| `minSeconds` | `0.18` | floor, so a tiny hop doesn't finish inside two frames |
| `maxSeconds` | `1.2` | ceiling, so a corner-to-corner sweep doesn't drag |
| `easing` | `easeInOut` | also `linear`, `easeIn`, `easeOut` |

From the CLI:

```bash
npm run capture -- --scene recipe-preview --recipe "Gritty saw" --speed 600 --easing easeOut
```

In a scene, per-move or globally:

```js
await a.moveTo('#run', { speed: 400 });        // this move only
await a.moveTo('#run', { seconds: 1.5 });      // explicit duration overrides speed
await a.dragCable(from, to, { speed: 300 });   // a slow, legible cable drag

a.cursor.speed = 500;                          // everything after this point
```

Speeds are CSS px per second of *video* time, so they mean the same thing regardless of how
long the capture takes in wall-clock. Frame counts scale as you'd expect — at 30fps, a
600px move is 30 frames at `speed: 600`, 13 at `1400`.

## How it works

**Virtual time.** After `__cdpReady`, `page.clock.install()` freezes time; each captured
frame is `clock.runFor(1000/fps)` followed by a screenshot. A 20-second WASM render
therefore costs *zero* video frames. Verified: `page.clock` does fake `requestAnimationFrame`
(`spike/raf-probe.mjs`), not only `Date`/timers.

**Cable drags** interleave `page.mouse.move()` with clock steps. `mouse.move(x, y, {steps: n})`
would fire every intermediate event inside one virtual instant, so the app's drag logic runs
but no frames exist between start and end.

**The cursor** is a cosmetic DOM overlay injected via `addInitScript`, because Playwright's
real mouse never appears in a screenshot. The real mouse still drives the app — the overlay
is `pointer-events: none` and merely follows it.

**Audio is never recorded.** `run()` presses the real Run button and reads back
`__cdpHost.getResult()`. The manifest places each WAV at the frame the button was pressed,
so `t = startFrame / fps`.

**Playback never happens during capture.** `player.playhead()` derives from
`audioCtx.currentTime` (`player.js:103`) — the real hardware clock — which under a paused
virtual clock races ahead of the frames, and `onended` would fire early and kill the sweep.
Instead the manifest carries a `playhead` descriptor and the compositor draws the sweep from
the same frame numbers that place the audio, so the two cannot drift.

## Gotchas worth knowing

- **A fresh browser context per capture is mandatory.** The app restores
  `localStorage['cdp-web-patch']` on load (`patcher.js:2600`); a reused profile silently
  resurrects the previous graph. A fresh context also means CRT stays off, since it
  defaults to `false` (`patcher.js:356`).
- **Never compare two renders byte-for-byte.** CDP writes a `PEAK` chunk carrying a
  timestamp and a `LIST`/`adtl` note carrying a `DATE` string. Compare the `data` chunk
  (`wavData()` in `rig/manifest.mjs`).
- **`GraphRunner.sampleRate` defaults to 44100** (`graph.js:168`) but the app assigns it the
  session rate, default 48000 (`patcher.js:373`). Match it before comparing renders.
- **Never settle a frame with in-page `requestAnimationFrame`** once the clock is installed —
  it will not fire until the next `runFor()` and you will deadlock. Use `clock.settleReal()`.
- **`page.clock` does not reach Web Workers.** The full-screen waveform editor draws in one
  (`waveform-worker.js:55`), so gate on the canvas updating, not on elapsed virtual time. The
  Output node's mini-waveform is main-thread and unaffected.
- **`ffmpeg -shortest` is wrong here.** Audio that ends before the last frame would truncate
  the video. `manifest.durationFrames` is authoritative; `encode.mjs` uses `-frames:v`.

## Status

Verified in this repo:

- `page.clock` fakes rAF — 63 callbacks per 1000 ms of virtual time.
- Captured WAV PCM is **bit-identical** to what the headless `GraphRunner` produces.
- Capturing the same scene twice gives **byte-identical frames** (86/86).
- ffmpeg encode: audio onset lands at 1.967187 s against a manifest frame 59 = 1.966667 s
  (AAC priming), and duration matches `durationFrames / fps` exactly.

Not yet verified: the **Remotion render**. `remotion/` is written and its `calculateMetadata`
correctly reads the manifest (it resolves the right frame count and fps), but Remotion could
not download its Chrome Headless Shell in this environment. On a machine with access to
`remotion.dev`, run `npx remotion browser ensure` once, then `npm run render`. Until then
`rig/encode.mjs` produces the video without captions/zooms.

Unrelated pre-existing bug: `npm test` at the repo root throws — `scripts/validate-recipes.mjs`
stubs `document` but not `HTMLElement`, which `src/ui/popover-fallback.js` reads at module
scope, and the assignment is hoisted below the imports anyway. See `spike/dom-stub.mjs` for
the shape of the fix.
