# The patcher window

cdp-web is a retro **audio-desktop**: every process is a small window, and you
wire windows together with patch cables to build a sound. This page explains the
parts of that desktop — the sockets and cables, the play controls, when things
grey out, the minimap, the sampler keyboard and the log — so the signs on screen
read at a glance.

The whole interface is deliberately **two-tone** (an ink colour on paper, over a
coloured desk). Nothing is colour-coded, so signal types are told apart by
**shape** and by the **dash pattern** of a cable, not by hue — which keeps every
theme legible.

## Adding and arranging processes

- **Double-click the empty desk** (or press **⌘K / Ctrl-K**) to open a search
  box over the whole catalogue. Type a few letters, use ↑/↓ and **Enter**, and
  the process drops where you clicked. Spectral processes are tagged **◈
  spectral** in the list.
- You can also add from the **menus** at the top.
- **Drag a window** by its title bar. **Right-click the title bar to rename** a
  node.
- **Pan** the desk by scrolling (trackpad, scrollbars), by dragging the minimap,
  or with one finger on a touchscreen. **Zoom** with a trackpad pinch, a
  **two-finger pinch** on a touchscreen, or **Ctrl + scroll** — the view zooms
  toward the pointer / the middle of the pinch (0.25× – 3×).
- **Select** by dragging a marquee across empty desk; **Shift-drag** adds to the
  selection. A single click on empty desk clears it.
- **Delete** the selected windows with **Delete** or **Backspace**. **Escape**
  clears the selection.
- **Drop files from your computer** straight onto the desk: an **audio file**
  becomes a Source window with the sound loaded, a **Faust `.dsp` file**
  becomes a Faust device (compiled, sliders built), and a **`.cdp` patch file**
  opens as the new patch (see [saving & sharing](sharing.md)).

## Sockets: the shape is the signal

Every input and output is a small socket ○ on the edge of a window. Its **shape
tells you what flows through it**, and only matching shapes connect:

- **■ Square — audio.** Ordinary sound. Most nodes have square in/out sockets.
- **◆ Diamond — spectral.** Phase-vocoder (PVOC) analysis data, *not* audio.
  Spectral effects work in this domain and must sit between a **PVOC Analyse**
  node (audio → spectral) and a **PVOC Resynthesise** node (spectral → audio).
  See the [spectral guide](guide/spectral-pvoc.md).
- **● Circle — breakpoint.** A control input for a parameter that can *change
  over time*. Feed it an envelope from a [Breakpoint node](guide/breakpoints.md).
- **▣ Stacked square — bank.** A whole *set* of sounds travelling one cable.
  Multi-output effects (partition, isolate…) produce a bank; multi-input
  effects (rejoin, multimix, panorama…) and the **Pick**/**Gather** nodes
  consume or build one. See [banks & multichannel](guide/banks-and-multichannel.md).

A **filled (ink) socket** already has a cable attached; a hollow one is free.
Outputs can fan out to many cables. **Audio inputs take any number of cables** —
the sounds are mixed (summed at unity, like a DAW bus) when the graph runs, so
layering two chains into one Output or one effect input needs no extra node.
For per-source level control, put a *Mix two sounds* node (or gain effects) in
the chain instead. Spectral, breakpoint and bank inputs take a **single** cable.

**Shapes must match.** You can't run a square (audio) output into a diamond
(spectral) input — the connection is refused and the [log](#the-log) explains
why, e.g. *"cannot connect: type mismatch (audio → spectral) — hint: insert a
PVOC Analyse node"*. While you drag a cable, valid targets highlight with a ring
and incompatible ones show a dithered, crossed-out fill.

## Cables

Drag from any socket to another to make a cable. Like the sockets, a cable's
**line style names its signal**, in the same ink colour throughout:

- **Audio** — a solid line.
- **Spectral** — a dashed line (`– – –`).
- **Breakpoint / control** — a fine dotted line.
- **Bank** — a thicker long-dashed line (a set of sounds in one cable).

Cables are curves; hover one to thicken it. **Click a cable to delete it.**
Hovering an audio or spectral cable also pops a small **+** button at its
midpoint — click it to splice a new process into that connection.

### Socket shortcuts

A few double-click gestures save cabling by hand (**double-tap** on a
touchscreen; **long press** stands in for a right-click):

- **Double-click any output** → cable it onward to the neighbouring window that
  will take it. Candidates must sit to the *right* of the socket, and the
  nearest one horizontally wins; being level with the socket (a window whose
  height spans it) breaks ties, but only counts for half a pixel per pixel, so a
  clearly closer window wins even off the row. On the chosen window an unused
  input is preferred. With nothing adjacent to take the cable it goes to the
  main **Output** instead.
- **Shift-double-click an audio output** → send it straight to the main
  **Output**, *added* to what's already there (audio inputs mix implicitly).
- **Double-click an empty breakpoint socket** → spawn a Breakpoint node already
  wired to that parameter.
- **Double-click a spectral (◇) socket** → bridge the domains. An empty ◇ input
  takes the nearest spectral output to its left; with none there, a **PVOC
  Analyse** appears ahead of the node, fed by the nearest sound to *its* left. A
  ◇ output with no spectral input to its right gets a **PVOC Resynthesise**,
  whose audio then travels on like any other output (to a neighbour, or the main
  **Output**). So dropping a spectral process into an audio patch takes two
  double-clicks, not four windows and four cables.

## Play and Loop

Nodes that *hold a sound* carry a transport — a **▶ Play** button and a **⟳
Loop** toggle: **Source** nodes, **Generator** and **Faust** nodes, and the
**Output**. Processing nodes (effects, PVOC) have no transport of their own —
to hear an effect, route it to an Output and render.

- **▶ Play** auditions that node's current sound; the button becomes **■ Stop**
  while it plays. Playback is a **single shared voice** — starting one sound
  stops any other, so only one thing is ever heard at a time.
- **⟳ Loop** toggles looping for that node; if it's already playing, the change
  takes effect immediately.
- **Spacebar** is the global transport. If something is playing it stops;
  otherwise it plays the active Output — **rendering it first if it's out of
  date**. (Space is ignored while you're typing in a field or editing a
  waveform.)

A transport button is greyed out until its node actually has audio to play.

## The Output node, rendering, and the "stale" grey-out

An **Output** node is where a chain is rendered to a finished sound. It has:

- **Run** — renders the whole upstream graph into one buffer.
- **▶ Play / ⟳ Loop** — audition the rendered result (enabled only after a
  successful Run).
- **↓ Save** — save the rendered WAV. In Chrome/Edge an OS save dialog lets
  you pick the location; other browsers download to the Downloads folder.
- **⠿** — the drag handle in the title bar (see below).

Whenever you change anything upstream — a cable, a parameter, a source — the
render is now **out of date**, so the Output window **shades itself grey** and a
**✱** appears on the **Run** button to signal "re-render me". Play stays available
(it plays the last render) but the grey is your cue that what you'd hear no
longer matches the patch. Press **Run** (or **Space**) to bring it up to date.
Turn on **Options ▸ Auto Render** to re-render automatically as you work.

## Dragging sounds out — the ⠿ handle

Every window that holds a sound carries a **⠿** handle in its title bar, next to
the **?** and **▾** buttons. Drag it to take that sound somewhere:

- **Onto the desk** → a new **Source** node lands where you let go, holding that
  sound. This is how you freeze a stage of a chain and build on it, or branch a
  patch without re-rendering the same thing twice.
- **Out of the window** → a `.wav` file, dropped on your desktop, Finder or a
  DAW track.

The handle is greyed out until the node actually has a sound. **Source**,
**Generator** and **Faust** nodes have one as soon as they hold audio; effect,
**Raw process**, **PVOC Resynthesise** and **Pick** nodes get theirs after a
**Run** — the runner computes every stage on the way to the Output, and each
node keeps its own result, so *any* point of a chain can be dragged out, not
just the end.

On a touchscreen, drag the handle with your finger — a small tag follows it, and
releasing over the desk drops the new Source there. A plain tap (no movement)
drops it in the middle of the view. Dropping *out* of the page isn't possible on
a touchscreen; use **↓ Save** instead.

Nodes that produce a **bank** — multi-output effects like **Partition** or
**Isolate**, **Split channels**, and **Gather** — have no single sound to hang
off the title bar. They list their files in the window body instead once they've
run, and each row carries its own **▶**, **↓** and **⠿**, so an individual file
can be auditioned, saved or dragged on its own. The **Output** node does the same
when a bank is cabled into it.

## Stored audio — what survives a reload

A **Source** is the one thing in a patch that can't be recomputed: a generator
regenerates from its parameters and an **Output** re-renders from the chain, but
a file you chose — or a sound you dragged out of a node — exists nowhere else.
So in the browser, Source audio is kept in a **local store**, and the patch
records only which sound to fetch. Close the tab and come back and your Sources
still have their sound.

Two things follow from that:

- **It's tied to this browser on this machine.** A patch file or a share link
  carries no audio, so opening one elsewhere gives you Sources labelled
  **"name · not stored here"** — you can see which file each one wants, but you
  have to reopen it. A **URL…** source is the one kind that travels with its
  sound.
- **Identical sounds are stored once.** The store is keyed by the audio itself,
  so dragging a node's **⠿** to make three Sources from one sound costs one copy,
  not three.

The sound's waveform is kept with it rather than in the patch, so the two always
agree: the patch stays tiny (a share link doesn't grow by ~3 KB per Source), and
clearing a sound never leaves a picture of audio that has gone.

**Options ▸ Stored audio…** shows what's there: every sound with its waveform,
its size and whether the open patch is using it, plus **▶** to hear it, **↓** to
save it to disk and **✕** to remove it. **Clear all** empties the store. Removing
a sound the open patch relies on asks first — that Source will reopen with only
its name. If the browser refuses to store anything (private windows often do),
the app says so in the Log and keeps working; the audio just lasts the session.

In the **plugin** none of this applies: source audio is saved into the DAW's own
project state, so it travels with the project.

## The minimap

When a patch grows larger than the visible desk, a **minimap** appears in the
bottom-right corner. It draws every window as a small block, with an outlined
rectangle showing your current view.

- **Drag or click** the minimap to pan — the spot you point at is centred in the
  view.
- **Double-click** (or **double-tap**) the minimap to **zoom-to-fit** the whole
  patch ("see everything").

The minimap shows itself only when needed and hides when the whole patch already
fits on screen; there's no switch to toggle it.

## The sampler keyboard

Along the bottom of the screen is an on-screen **sampler keyboard**. It isn't a
node in the graph — it's a 16-voice instrument that always holds the **most
recently rendered Output**. Every time you **Run** an Output, that sound is
loaded into the sampler, so you can immediately play it back **pitched across the
keys** (middle C plays it at its original pitch; other keys transpose it).

- Play with the mouse/touch or your computer keys; **z / x** shift the octave.
- **VOL** sets the level, and there's a **panic** button to silence stuck notes.
- A **chromatic / repitch toggle** switches between playing every key at the
  sample's native pitch and pitching each key musically.

It's the fastest way to turn a rendered CDP transformation into something
playable — render a chain, then play it as an instrument.

## The Log

A collapsible **LOG** bar sits at the bottom of the screen. It's the app's status
console: it reports renders finishing (*"done — N bytes"*), files saved, and why
a connection was refused, with hints on how to fix it. If something fails the log
reveals itself so the error isn't missed.

Click the **▾ / ▸** button (or double-click the bar) to collapse or expand it;
your choice is remembered between sessions.

## Installing it on a phone

cdp-web is a normal web page, so there's nothing to install — but it can be
added to a home screen and opened like an app, with its own icon and no browser
chrome around it:

- **iPhone / iPad (Safari)** — the Share button, then **Add to Home Screen**.
- **Android (Chrome)** — the ⋮ menu, then **Install app** / **Add to Home
  screen**.
- **Desktop (Chrome/Edge)** — the install icon at the right of the address bar.

Everything runs locally either way; the app just gets its own window. Your
work-in-progress patch is autosaved per browser — and on iOS a home-screen copy
gets its own storage, so the patch in your Safari tab doesn't follow it there.
Send yourself a share link if you want to carry a patch across.
