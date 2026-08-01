# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.1] - 2026-08-01

### Changed
- Engine updated to cdp-wasm 0.3.2 (documentation only upstream; `src/` and
  `wasm/` are unchanged since 0.3.0).

### Fixed
- The in-app release notes (Help ▸ Release notes) showed stale text:
  `manual.json` embeds both changelogs and is a committed derived artifact, so
  it went out of date whenever a changelog was edited without regenerating it.
  `npm test` now fails when it drifts.

## [0.3.0] - 2026-08-01

**This release makes the app usable on a phone.** It installs to the home screen
on iOS and Android; the patcher's double-click and right-click vocabulary now
has touch equivalents; the transport sits in a fixed bottom bar that clears the
home indicator instead of scrolling off with the Output window; the sampler bar
folds into a menu on narrow screens; and the waveform editor works under
fingers. Sharing a patch is one press rather than three taps through a menu, and
a share link can be opened by pasting it — the only way into an app added to an
iOS home screen.

It also carries everything from the unreleased 0.2.0: **bank cables** 
for the CDP programs that produce multiple files from one input, 
the **Pick** and **Gather** nodes that consume them, implicit
mixing, and multichannel playback. The app is relicensed to
**AGPL-3.0-or-later** and the engine now comes from the public `cdp-wasm` 
npm package. Details below.

### Added
- **Double-click gestures that save cabling by hand.** Double-click any output
  to cable it onward to the neighbouring window that will take it (nearest
  candidate to the right, ties broken by vertical overlap); **shift**-double-click
  sends it straight to the main Output, added to whatever is already there.
  Double-clicking an empty breakpoint socket spawns a Breakpoint node already
  wired to that parameter. Double-clicking a spectral **◇** socket bridges the
  domains — an empty ◇ input pulls the nearest spectral output to its left, or
  conjures a **PVOC Analyse** ahead of the node; a ◇ output with nothing
  spectral to its right gets a **PVOC Resynthesise** whose audio then travels on
  like any other. Dropping a spectral process into an audio patch is two
  double-clicks rather than four windows and four cables.
- **Installable as an app** (a web app manifest, icons and a favicon — the app
  had none): *Add to Home Screen* on iOS, *Install app* on Android/Chrome, or
  the address-bar install button on desktop, and it opens in its own window with
  no browser chrome. The icon is built from the same patcher artwork as the
  cdp-plugin App Store icon, in two framings — full-bleed, and a maskable one
  whose contents survive a launcher's circular crop — by the dev-only
  `scripts/make-icons.mjs` (needs ImageMagick; the outputs are committed).
  Nothing about how the app runs changes: it was already fully local.
- **Opening a share link by paste**, two ways: **File ▸ Open shared link…**
  takes a pasted link (it finds the link inside whatever text came with it), and
  pasting a link onto the desk opens it too — a link is a whole patch, not a
  fragment to add to the current one, so ⌘V asks and then replaces the desk
  rather than pasting. This is the only route into an app added to an **iOS home
  screen**: iOS opens links in the browser and won't hand them to an installed
  web app, where Android's WebAPK captures its own links and opens directly.
- **Bottom transport bar**: a slim always-on bar along the bottom edge with a
  centred ▶ Play. It does exactly what
  the spacebar does — stop if playing, otherwise play the Output, running it
  first when it's out of date — so the transport is in one fixed place instead
  of wherever the Output window happens to be, which on a phone is usually
  off-screen. The bar reserves `env(safe-area-inset-bottom)`, so its button
  clears an iPhone's home indicator and rounded corners rather than sitting
  under them. It also supersedes the sampler's paper footer strip, which existed
  to keep macOS's rounded window corners off the SAMPLER bar; the docks now
  stack on top of the transport bar and that strip is gone. The waveform editor
  stops short of the bar rather than covering it, and while it's up the bar
  plays and stops *its* audio — the same rule the spacebar already followed by
  yielding to the editor.
- **Sampler bar ⋯ menu**: the bar's controls need about 670px laid out side by
  side, and below that they were squeezed until their labels wrapped onto two
  lines. Narrower than 700px they now fold into a single ⋯ menu (ADSR, chromatic
  repitch, octave, all-notes-off), leaving the bar as SAMPLER · ⋯ · volume. The
  menu is also the only way to shift the octave by touch — until now that was
  the z / x keys and nothing else.
- **Unlock ranges**: right-click an effect or generator's title bar for
  **Unlock ranges**, which leaves the catalog's curated parameter spans behind.
  Those spans are the musically useful part of what a program accepts — usually
  a good deal narrower than CDP's own limits, so a slider has travel worth
  having. Unlocked, a parameter widens to the engine limit the catalog records,
  or where it records none simply stops clamping: typed values pass straight
  through and anything the program refuses fails with CDP's own message. The
  title bar dithers while a node is unlocked, and the flag travels with the
  patch. Constraints between parameters (a maximum that must sit above its
  minimum) stay enforced either way — those are the engine's rules, not taste.
  Re-locking pulls any strayed value back inside the curated span.
- **Share links**: File ▸ Share patch… packs the whole patch into a URL
  (compressed, in the `#` fragment — nothing is uploaded; the link *is* the
  patch). Opening a link loads the patch, asking first when a previous session
  would be replaced; corrupt links fall back gracefully.
- **URL sources**: a Source window's new **URL…** button loads audio from a web
  address. Only the address is stored, so URL sources survive save/load and
  share links with sound intact (the share dialog warns about disk-loaded
  sources, which can't travel in a URL). Non-WAV/AIFF formats decode via the
  browser; the server must allow cross-origin (CORS) fetches. The dialog offers
  the bundled CDP demo sounds (marimba, horn, speech, frog — the ones the
  sound-file recipes use) as one-click examples.
- **Named patches & Save as…**: File ▸ Save patch as… names the patch (kept in
  the patch's metadata, so the name travels with files, sessions and share
  links); Save patch… prompts on first save, then saves silently under the
  current name.
- **`.cdp` patch files**: patches save as `<name>.cdp` (JSON inside). Open
  patch… and desk drag-drop accept `.cdp` and legacy `.cdpweb.json`.
- **Save to a chosen location** (Chrome/Edge, File System Access API): patch
  saves open an OS save dialog and then overwrite that file in place; Open
  patch… keeps the file handle so Save updates the opened file. Rendered WAVs
  (Output ↓ Save, Save result…, waveform-editor export) get an OS save dialog
  per save. Other browsers keep the download flow.
- **Drop files onto the desk**: audio files become loaded Source windows
  (cascading when several are dropped), Faust **`.dsp`** files become compiled
  Faust devices (generator vs effect picked from the code's audio inputs), and
  `.cdp` files open as the new patch. Unrecognised files log a hint instead of
  navigating the page away.
- **Code editor**: Faust nodes' inline code textarea is replaced by an
  "Edit code…" button opening a full-screen Monaco editor (lazy-loaded, with a
  plain-textarea fallback) — Faust syntax highlighting, colors derived from the
  active theme, and compile errors as inline markers plus an error strip.
- Editor bar menus: **Edit** (undo/redo, cut/copy/paste, select all,
  find/replace), **Presets** (the node's preset library) and **Compile**;
  ⌘/Ctrl+Enter compiles *and auditions* the result.
- **Audio preview strip** in the editor: the node's rendered sound as a mini
  waveform with play/loop and a moving playhead; edits grey it until
  recompiled. Faust **effects** preview too — the editor renders the cabled
  input chain through the effect, re-running on compile.
- The node's **parameter sliders are adopted into the editor** while it is
  open (same live controls, returned on close), so the values the render
  actually uses are visible and tweakable; slider changes re-render the
  preview automatically.
- ✎ **edit buttons on text widgets** — breakpoint tables, partials lists,
  generator data boxes and the raw-process $DATA box open in the same editor
  (numeric highlighting); the breakpoint table draws a **live envelope
  preview** while you type.
- The editor keeps its own persistent text-size zoom: ⌘/Ctrl +/−/0 while it
  is open, independent of the canvas zoom.

- **Bank cables** (▣): a whole set of sounds travelling one cable. Multi-output
  effects (partition, isolate, cantor, Split channels…) emit a bank; multi-input
  effects (rejoin, multimix, panorama) accept one.
- **Pick node** — take one sound out of a bank (with audition), and **Gather
  node** — collect sounds into a bank on growable inputs.
- The Output window renders bank results as a list with per-sound play/save and
  Save all.
- **Implicit mixing**: audio inputs accept any number of cables, summed at
  unity when the graph runs — layering chains into one Output (or any effect
  input) needs no Mix node.
- **Multichannel playback** through a pluggable output renderer: the device is
  asked for the file's channel count, with an odd→left/even→right fold-down
  when it can't take them all. Saved WAVs always keep full channel width; the
  mini waveform scope composites all channels.
- Bank machinery is tagged in the Process menu (▣ suffix) and quick-add palette
  (▣ bank in / ▣ bank out chips, searchable via "bank").
- Recipes: Partition & rejoin, Gather to channels, Crumble ring (8ch), Stereo
  split-process; Layered fifths now demonstrates implicit mixing.
- Manual: banks & multichannel guide page; the about box shows the engine
  version alongside the app's.
### Changed
- **Relicensed to AGPL-3.0-or-later**, with a new
  [`EXCEPTIONS.md`](EXCEPTIONS.md) recording additional grants that run
  alongside it. cdp-wasm is MIT/LGPL2.
- **The engine now comes from npm** — the public `cdp-wasm` package (`^0.3.1`),
  replacing the `@olilarkin/cdp-wasm` `file:` link to a sibling checkout. It
  ships its `.wasm` prebuilt, so building this app no longer needs a cdp-wasm
  checkout or the Emscripten SDK; `npm install` is enough. Version numbering
  now tracks cdp-wasm.
- **Share button in the menu bar**, in place of the sample-rate readout: one
  press to share the patch, on a phone as well as a desktop (where the menu bar
  collapses to a single icon and the File-menu command is three taps away). The
  session rate is still set — and shown, checked — under Options ▸ Sample rate.
  The button is absent where share links don't apply: in a plugin/embedded host,
  or a browser without CompressionStream.
- **Sharing now explains itself, and can use the OS share sheet.** File ▸ Copy
  share link… is now **File ▸ Share patch…**, and it always opens a dialog
  saying what a link is (the whole patch, packed into the URL — nothing
  uploaded) and what it can't carry: audio picked from disk stays on your disk,
  so those Sources open empty, while a Source loaded with **URL…** stores its
  address and travels with sound. Sources that will arrive empty are named, as
  before. The dialog also **names the patch** on the way out — the same name
  Save patch uses, pre-filled and travelling with the link — so a patch needn't
  arrive as "untitled". It offers **Copy link** and, where the platform has one
  (phones, macOS Safari), **Share…** — the native share sheet, so a link can go
  straight into a message rather than via the clipboard.
- The Generate and Process menus put the Faust devices below a plain rule
  instead of under a FAUST heading — they're one entry each, not a category.
- **Version out of the menu bar**: the title cell reads just the app name; the
  version moves to its tooltip, and stays in the About box and the pre-filled
  bug report. On a phone that cell is the whole title, and a version number is
  not what you want the app called.
- **Parameter rows**: a node's rows now share one grid, so every slider in a
  window is the same length instead of each row sizing itself — a row with a
  long label used to get a 39px slider next to a short label's 63px one. The
  label column is as wide as that node's widest label and no wider, and the ♪
  and ∿ columns are dropped entirely on nodes where nothing uses them (an effect
  like Rotor, which accepts no breakpoint envelope on any parameter, was paying
  a column of permanently disabled buttons on every row). The value column is
  sized from the widest reading a row could ever show rather than the one on
  screen, so dragging a slider through 7 → 0.35 → 12.50 no longer resizes the
  column and every slider with it. Rotor's sliders go from 39–63px to a uniform
  110px in the same window. Rows are also a consistent height now — a ♪ button
  used to push its row further apart than the rest.
- **All audio computation moved off the main thread.** The CDP engine runs in a
  worker (renders no longer freeze the UI; results are byte-identical), and
  Faust code both compiles *and* renders in a worker — a big DSP no longer
  locks the desk while it compiles or generates. Both fall back to inline
  execution where workers are unavailable.
- Cancelling a save dialog no longer triggers a fallback download.

- Output duration is measured from the produced WAV, so effects that set their
  own length (tangent, crumble…) report correctly.
### Fixed
- **Touch gestures**: the patcher's double-click and right-click vocabulary was
  mouse-only — a touchscreen fires no reliable `dblclick` (and any handler that
  takes over pointerdown, like a cable drag, kills the one it might have got),
  and with `user-select: none` iOS raises no long-press `contextmenu` at all. A
  document-level recogniser now turns a double-tap into `dblclick` and a long
  press into `contextmenu`, so **double-tap** works on ports (auto-cable), the
  empty desk (quick add), title bars (roll up), the minimap (zoom-to-fit) and
  breakpoint editors, and **long press** opens the node / canvas menus. Both fire
  on release, or the menu they open is light-dismissed by the finger lifting.
- **Stale cable + button**: deleting a cable by clicking it left the "insert a
  process here" **+** hovering over nothing — removing the path fires no
  mouseleave, so it never hid. Clicking that + then spliced a node into a
  deleted edge, resurrecting the cable it was attached to.
- **Waveform editor toolbar on narrow screens**: it was a single clipped row, so
  on a phone the region tools — and the **×** close button, leaving Esc as the
  only way out — were cut off the right edge. It now wraps, and packs tighter
  below 700px so it costs one extra row rather than two.
- **Touch drag-out**: an Output's **⤓ Drag me** did nothing on a phone or tablet
  — it relied on HTML5 drag-and-drop, which touch never starts. Dragging it with
  a finger now carries a ghost across the canvas and drops a new Source where
  you let go; a plain tap drops one in the middle of the view. (Dragging out to
  the OS still isn't possible on touch — ↓ Save is that path.)
- **Touch zoom**: two-finger pinch on the canvas now zooms the patch (it was
  suppressed to stop the whole page scaling, but never wired to the canvas
  zoom); double-tapping the minimap runs "see everything" (zoom-to-fit) as
  double-click does on desktop — the tap-to-pan handler was swallowing the
  synthesized double-click. A pinch that starts on a window's title bar zooms
  instead of dragging the window.
- Menu-bar dropdowns (and selects / context menus) no longer flash for a frame
  at the wrong position when opened — they are now placed before the browser's
  first paint, closing a Popover-API timing window that showed most on Windows.
- Picking a local file (or cropping) over a URL source now correctly demotes it
  to a file source, so a saved patch no longer re-fetches the stale URL over
  the replaced audio.
- The no-popover WebView fallback now understands invoker-nested popovers, so
  menus opened from inside a modal no longer dismiss it.
- Mini-scope playheads no longer throw on hidden (zero-sized) waveform canvases.

- The pitch pipeline effects (`pitch.octmove`, `pitch.octmovedn`,
  `pitch.altharms`) never worked: they were given spectral ports but analyse
  internally and take ordinary audio. They now spawn with audio ports and list
  under Process.
- The headless recipe validator crashed on import in Node (popover fallback ran
  before the DOM stub).
## [0.1.0] - 2026-07-10

Initial release: GEM-desktop modular patcher for CDP in the browser — sources,
generators, effect and PVOC nodes, breakpoint envelopes, Faust devices, the
sampler keyboard, recipes, and the browsable manual. Also serves as the shared
UI for the VST plugin and Ableton Live extension.

[0.3.1]: https://github.com/cdp-wasm-suite/cdp-web/releases/tag/v0.3.1
[0.3.0]: https://github.com/cdp-wasm-suite/cdp-web/releases/tag/v0.3.0
[0.1.0]: https://github.com/cdp-wasm-suite/cdp-web/releases/tag/v0.1.0
