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
- **"Drag me" is a real drag-out.** The Output's **⤓ Drag me** button starts a
  genuine OS drag-and-drop of the rendered WAV, so you can drop it straight onto
  a track in your DAW.

## Installing and loading

_Coming soon — supported formats (VST3/AU), where to install, and how to load
the plugin on a track._

## Known issues & limitations

_Coming soon — plugin-specific quirks (drag-out per host, sampler voice limits,
sample-rate handling, state persistence, etc.)._

## Troubleshooting

_Coming soon._
