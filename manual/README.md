> **⚠ WORK IN PROGRESS** — this documentation is a work in progress
# cdp-web

A retro computing themed node-graph patcher front-end for the **Composers Desktop Project** 
webassembly port (cdp-wasm).

Sounds are built on a **modular desktop**: each process is a small window you
wire to others with patch cables, so you can audition a whole chain and tweak it
as you listen.

Note: the process/nodes are based on a curated [catalog](guide/catalog-and-cdp.md) of
cdp programs. These provide a layer of abstraction over the cdp programs. It's
possible to use the raw cdp programs too.

## How the patcher works

1. **Add a process.** Use the menus (or double-click the empty desktop to
   search) to drop a process onto the desktop. There are three families:
   sound **effects**, **generators** that make sound from nothing, and **Faust**
   devices you can program yourself.
2. **Give it a sound.** Drop an audio file from your computer anywhere on the
   desktop (it becomes a Source window), use a Source's **Choose file…** /
   **URL…** buttons, or start from a generator. Cables carry audio from one
   node's output ○ to the next node's input ○.
3. **Set the controls.** Each parameter has a slider and a plain-language
   description. Right-click a slider to type an exact value. Many parameters can
   also *change over time* — see [Breakpoint envelopes](guide/breakpoints.md).
4. **Render and listen.** Render the chain and play the result. Turn on
   **Options ▸ Auto Render** to re-render automatically as you make changes.

## Finding your way around

- **[Recipes](recipes.md)** — ready-made patches (File ▸ Recipes) that render a
  sound the moment you open them; the quickest way to hear what CDP can do.
- **[Effect reference](effects/README.md)** — every sound-transforming process,
  grouped by category, with its parameters explained.
- **[Generators](generators/README.md)** — synths and noise sources that create
  audio from scratch.
- **[Faust nodes](faust.md)** — write your own DSP (or start from a preset) and
  run it right in the graph.
- **[Concepts guide](guide/)** — a few ideas that pay off across many
  processes: time-varying parameters, spectral (phase-vocoder) effects, and how
  stereo is handled.
- **[Saving & sharing](sharing.md)** — `.cdp` patch files, saving to a chosen
  location, and sharing a whole patch as a link.

The sidebar has two tabs: **Manual**, which is this prose — overview, guides,
recipes, release notes — and **Reference** (also **Help ▸ Reference…**), which is
every effect and generator.

Two names for one thing: the menus show a process by the name the catalog gives
it (*Shudder*), while the reference pages are filed under the CDP program it
belongs to (`modify`). Reference lists them either way — **Catalog** groups them
by the categories the Process and Generate menus use, **CDP** lists the program
pages — and its search box matches both names, so `shudder` and `modify` each
find the entry.

Every entry carries a **+ Add to patch** button, which drops that process onto
the desktop as a window (the manual closes so you can see it land). Going the
other way, right-click any node's title bar and choose **Manual…** to open its
entry.

New to CDP? Check the [concepts guide](guide/), then browse the
[effect reference](effects/README.md) and start patching.

Already know CDP? Start with **[the catalog and CDP](guide/catalog-and-cdp.md)** —
each process here is one *mode* of one CDP program, with its arguments named and
ranged for a slider. That page shows what the curation decided, and how to run any
bundled program with CDP's own arguments instead.
