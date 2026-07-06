# CDP for Web

A retro computing themed node-graph front-end for the **Composers Desktop Project** 
webassembly port (cdp-wasm).

Sounds are built on a **modular desktop**: each process is a small window you
wire to others with patch cables, so you can audition a whole chain and tweak it
as you listen.

## How the patcher works

1. **Add a process.** Use the menus (or double-click the empty desktop to
   search) to drop a process onto the desktop. There are three families:
   sound **effects**, **generators** that make sound from nothing, and **Faust**
   devices you can program yourself.
2. **Give it a sound.** Drag an audio file onto a source node, or start from a
   generator. Cables carry audio from one node's output ○ to the next node's
   input ○.
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
- **[Generators](generators.md)** — synths and noise sources that create audio
  from scratch.
- **[Faust nodes](faust.md)** — write your own DSP (or start from a preset) and
  run it right in the graph.
- **[Concepts guide](guide/)** — a few ideas that pay off across many
  processes: time-varying parameters, spectral (phase-vocoder) effects, and how
  stereo is handled.

New to CDP? Check the [concepts guide](guide/), then browse the
[effect reference](effects/README.md) and start patching.
