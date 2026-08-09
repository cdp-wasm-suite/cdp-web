> **⚠ WORK IN PROGRESS** — this documentation is a work in progress
# Composer's Desktop Plug-in (cdp-plugin)

The **Composer's Desktop Plug-in** (cdp-plugin) embeds the cdp-web frontend in
the UI of an audio plug-in (VST3 / Audio Unit / CLAP) for use inside a DAW.  
You build patches exactly as in the browser, but you can play the sampler
via MIDI in the DAW and the patch should save with your project. For
tighter integration of offline processing in the DAW see the cdp-extension.


## What's different from the browser

- **The render feeds a sampler in the DAW.** Every time you **Run** an
  [Output](interface.md#the-output-node-rendering-and-the-stale-grey-out), the
  rendered sound is loaded into the plug-in's sampler, so it's immediately
  playable from your DAW over MIDI (and from the on-screen
  [sampler keyboard](interface.md#the-sampler-keyboard)).
  Audio comes out of the plug-in's output channels.
- **⠿ is a real drag-out.** A window's
  [**⠿** handle](interface.md#dragging-sounds-out--the--handle) starts a genuine
  OS drag-and-drop of that sound, so you can drop it straight onto a track in
  your DAW. Because the plain mouse drag belongs to the operating system there,
  **Option-drag** the handle to do the in-patch gesture instead (drop it on the
  desk to make a **Source**).
- **Dragging loads the sampler.** The sound being dragged is what crosses to the
  OS, so it becomes the plug-in's playable sample — dragging a bank file or a
  mid-chain node swaps the sampler over to it.
- **Your patch is saved in the DAW project.** In the browser the
  work-in-progress patch autosaves per browser; in the plug-in it is part of the
  plug-in's state, so saving the project saves the patch and reopening the
  editor restores your desktop. See
  [Patches and project files](#patches-and-project-files).
- **Links open in your browser.** Anything that leaves the app (the CDP
  documentation, the issue tracker) opens in your web browser rather than
  navigating the plug-in window away.

Everything else — the desktop, recipes, breakpoint envelopes, Faust nodes, the
manual — behaves as in the browser.

## The sampler and plug-in parameters

The sampler is a 16-voice one-shot player: MIDI note 60 plays the render at its
native pitch, each semitone away repitches it by a factor of 2^(1/12), and a
released key rings out through the Release stage. Pitch-bend covers ±2
semitones and the mod wheel adds vibrato.

The keyboard bar's controls are real host parameters, so your DAW can save and
automate them:

| Parameter | Range | Default |
| --- | --- | --- |
| Gain | −60 … 0 dB | −12 dB |
| Attack / Decay / Release | 0 … 2 s | 5 ms / 0 / 50 ms |
| Sustain | 0 … 1 | 1 |
| Repitch | Off / On | Off |

**Repitch** is the keyboard's REPITCH toggle: off plays every note at the
sample's native pitch (auditioning), on maps notes to semitones around MIDI 60.
It applies to host-sequenced MIDI the same as to the on-screen keyboard, so
flip it on when you want to play the render melodically from a MIDI track.

## Installing and loading

**macOS** — the disk image contains all the formats; drag each into the
matching folder (use the same paths under `~/Library` for a per-user install):

    cdp-plugin.vst3       →  /Library/Audio/Plug-Ins/VST3
    cdp-plugin.clap       →  /Library/Audio/Plug-Ins/CLAP
    cdp-plugin.component  →  /Library/Audio/Plug-Ins/Components   (Audio Unit)

Everything is signed and notarized, so there are no Gatekeeper warnings. After
installing the Audio Unit you may need to restart your DAW (or log out and back
in) before it appears.

**Windows** — run the installer; it places the VST3 and CLAP plug-ins.

The plug-in is an **instrument** (MIDI in, stereo out), so load it where your
DAW expects instruments — an instrument track in Live, a track FX slot in
REAPER (it will route MIDI automatically), the instrument slot in Logic.

## Patches and project files

The node graph is the plug-in's document. It is saved into the plug-in's state
— with the project, and with host presets — together with the most recent
render, so a reloaded project plays over MIDI immediately, even if you never
open the editor. Source sounds are embedded in the patch too: the project is
self-contained and doesn't reference files on disk.

The price of self-containment is project size: the saved state carries your
source audio and the render, so patches with long sounds make noticeably
larger project files. If that matters, keep renders trim and delete Source
nodes you no longer use.

## Known issues & limitations

- **Editor preview plays outside the DAW.** What you hear while building or
  auditioning a patch in the editor (play buttons, auto-render) goes to your
  system's default sound device, not through the plug-in's outputs. Render the
  patch and play it via host MIDI or the on-screen keyboard to hear it through
  the host — and to record or bounce it.
- **Drag-out is macOS and Windows only**, and what a host accepts on drop
  varies; if a host refuses the drop, use the Output's save button instead.

## Troubleshooting

- **Keyboard input doesn't work (REAPER, FLStudio)** — REAPER keeps the keyboard
  for itself by default, so search, shortcuts (like space to render) and typing
  values won't reach the plug-in. In the FX window, open the **FX** menu (or
  right-click the plug-in's title bar) and enable. FLStudio has a similar setting.
- **The Audio Unit doesn't show up** — restart the DAW; if it still doesn't
  appear, log out and back in so macOS rescans its component registry.

Report issues at
[github.com/cdp-wasm-suite/cdp-plugin/issues](https://github.com/cdp-wasm-suite/cdp-plugin/issues).
