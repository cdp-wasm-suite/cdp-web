# Composer's Desktop Plugin

> **Placeholder page.** This is the home for everything specific to the
> **plugin** build.

The **Composers Desktop plugin** is an audio plugin (VST3/AU/CLAP) that hosts CDP for
Web inside its own window. The patcher works exactly as it does in the
[browser](README.md) — same nodes, cables, [ports](interface.md),
[recipes](recipes.md) and rendering — with a few plugin-specific differences
described here.

## What's different from the browser

- **The render feeds a built-in sampler.** Every time you **Run** an
  [Output](interface.md#the-output-node-rendering-and-the-stale-grey-out), the
  rendered sound is loaded into the plugin's sampler, so it's immediately
  playable from your DAW over MIDI (and from the on-screen
  [sampler keyboard](interface.md#the-sampler-keyboard)).
  Audio signal comes out of the plugin's output channels.
- **⠿ is a real drag-out.** A window's
  [**⠿** handle](interface.md#dragging-sounds-out--the--handle) starts a genuine
  OS drag-and-drop of that sound, so you can drop it straight onto a track in
  your DAW. Because the plain mouse drag belongs to the operating system there,
  **Option-drag** the handle to do the in-patch gesture instead (drop it on the
  desk to make a **Source**).
- **Dragging loads the sampler.** The sound being dragged is what crosses to the
  OS, so it becomes the plugin's playable sample — dragging a bank file or a
  mid-chain node swaps the sampler over to it.

## Installing and loading

_Coming soon — supported formats (VST3/AU), where to install, and how to load
the plugin on a track._

## Known issues & limitations

_Coming soon — plugin-specific quirks (drag-out per host, sampler voice limits,
sample-rate handling, state persistence, etc.)._

## Troubleshooting

_Coming soon._
