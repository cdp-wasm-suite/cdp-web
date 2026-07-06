# Faust nodes

Alongside the built-in CDP processes you can run your own DSP, written in
[**Faust**](https://faust.grame.fr) — a concise language for audio synthesis and
effects. A Faust node compiles your code in the browser and runs it inside the
patch, right next to the CDP nodes, with the same cables, breakpoints and
rendering.

There are two to choose from in the **Faust** menu — but they are really the
same device seeded with different starter code:

- **Faust generator** — starts from a synth preset (makes sound from nothing).
- **Faust effect** — starts from a processing preset (transforms its input).

## Writing and running

1. **Pick a preset** to seed the editor, then edit the code freely.
2. Press **Compile**. The node compiles the DSP and rebuilds itself to match.
3. **Render** — a generator renders a number of seconds; an effect processes
   whatever sound is cabled into it.

Your code is saved with the patch, so a compiled device travels with the piece.
If the code doesn't compile, the error is shown in the node and nothing else in
the graph is disturbed.

## Inputs and outputs follow the code

A Faust node's I/O isn't fixed — it is **whatever the compiled DSP declares**,
and the node re-wires its cables to match:

- **0 audio inputs** → a *generator*: it gets a **Generate** button and renders
  a fixed duration.
- **1 or more audio inputs** → an *effect*: it processes the cabled sound.

Cables carry multichannel audio. A mono (1-in / 1-out) effect fed a stereo file
processes each channel independently — the same convention the CDP nodes use
(see [Mono effects & channel handling](guide/mono-and-channels.md)).

## Controls become automatable parameters

Every Faust UI control — `hslider`, `vslider`, `nentry`, `button`, `checkbox` —
becomes a node parameter with a slider **and** a breakpoint input ○, exactly
like a CDP parameter. That means any control can be driven by an envelope that
varies over the render (see [Breakpoint envelopes](guide/breakpoints.md)).

> **One-shot tip.** Each render is a fresh instance of the DSP, and a control
> held at `1` fires once at the start of the render. So `hslider("gate",1,0,1,1)`
> feeding an `en.adsr(…)` with **sustain = 0** gives a one-shot percussive
> envelope — no gate signal or note-off needed.

## Presets

**Generators:** Decaying sine · FM (2-op) · Karplus–Strong pluck · Filtered noise.

**Effects:** Ring modulator · Resonant low-pass · Echo · Reverb (freeverb) ·
Distortion · Ring mod (external carrier) · Crossfade A/B.

Each is a compact, readable starting point — change a few numbers, recompile,
and listen. For the full language, see the
[Faust documentation](https://faust.grame.fr/doc/manual/).
