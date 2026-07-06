# The patcher window

CDP for Web is a retro **audio-desktop**: every process is a small window, and you
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
- **Pan** the desk by scrolling (trackpad, scrollbars) or by dragging the
  minimap. **Zoom** with a trackpad pinch or **Ctrl + scroll** — the view zooms
  toward the pointer (0.25× – 3×).
- **Select** by dragging a marquee across empty desk; **Shift-drag** adds to the
  selection. A single click on empty desk clears it.
- **Delete** the selected windows with **Delete** or **Backspace**. **Escape**
  clears the selection.

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

A **filled (ink) socket** already has a cable attached; a hollow one is free.
Inputs take a **single** cable; outputs can fan out to many.

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

Cables are curves; hover one to thicken it. **Click a cable to delete it.**
Hovering an audio or spectral cable also pops a small **+** button at its
midpoint — click it to splice a new process into that connection.

### Socket shortcuts

A few double-click gestures save cabling by hand:

- **Double-click an audio output** → cable it straight to the main **Output**
  ("send to the speakers"), replacing whatever the Output was playing.
- **Shift-double-click an audio output** → *mix* it into the Output instead of
  replacing, by splicing in a Mix node.
- **Double-click a spectral output** → cable to the nearest free spectral input
  to its right.
- **Double-click an empty breakpoint socket** → spawn a Breakpoint node already
  wired to that parameter.

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
- **↓ Save** — download the rendered WAV.
- **⤓ Drag me** — drag the rendered sound out to your desktop/DAW, **or** drop
  it back onto the desk to make a new **Source** node from it.

Whenever you change anything upstream — a cable, a parameter, a source — the
render is now **out of date**, so the Output window **shades itself grey** and
its button changes to **⟳ Run** to signal "re-render me". Play stays available
(it plays the last render) but the grey is your cue that what you'd hear no
longer matches the patch. Press **Run** (or **Space**) to bring it up to date.
Turn on **Options ▸ Auto Render** to re-render automatically as you work.

## The minimap

When a patch grows larger than the visible desk, a **minimap** appears in the
bottom-right corner. It draws every window as a small block, with an outlined
rectangle showing your current view.

- **Drag or click** the minimap to pan — the spot you point at is centred in the
  view.
- **Double-click** the minimap to **zoom-to-fit** the whole patch ("see
  everything").

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
