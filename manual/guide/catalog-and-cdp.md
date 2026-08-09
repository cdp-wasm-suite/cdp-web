> **⚠ WORK IN PROGRESS** — this documentation is a work in progress

<!-- Overlay of cdp-wasm's docs/guide/catalog-and-cdp.md. The library page ends at
     `cdp.run` as the escape hatch; in the app that hatch is the Raw process node,
     and the curated ranges are a slider affordance (Unlock ranges) rather than an
     API detail. Keep the first three sections in step with upstream. -->
# The catalog and CDP

**If you already know CDP, read this first.** The processes in this app are not
CDP's programs one-for-one. They come from a *curated catalog* — a layer that
picks a program, picks one of its modes, names its arguments in plain language,
and gives each a range sized for a slider. That layer is what makes a patcher
possible, and it is also why a process here can look unfamiliar to someone who has
been typing `blur blur infile outfile 20` for years.

Nothing is out of reach: every program the engine bundles can still be run
directly, from a **Raw process** node. This page explains what the catalog
changed, how to see it per process, and how to get back to the raw program.

## What one process is

Every process in the menus is one *mode* of one CDP program, with an argument
template behind it. The effect reference shows exactly what that template becomes
— the *How this maps to CDP* block under each entry gives the command line the app
runs, next to CDP's own synopsis for the same mode:

```
cdp-wasm  blur blur infile outfile <windows>
CDP       blur blur infile outfile blurring
```

Read the two lines against each other and the whole mapping falls out: the app's
`windows` is CDP's `blurring`, and nothing else has been touched.

`blur` has ten modes and so appears as ten separate processes. That much the name
tells you. Less obvious: a process may also **fix arguments** you would normally
supply. The mapping block makes those visible as bare values:

```
cdp-wasm  filter lohi 1 infile outfile -90 <passband> <stopband>
CDP       filter lohi mode infile outfile attenuation pass-band stop-band [ -s prescale ]
```

Mode `1` (frequencies in Hz, not MIDI) and a `-90`dB attenuation are decisions the
catalog made; `-s prescale` is not offered at all. `hover` is starker — four of its
eight arguments are pinned:

```
cdp-wasm  hover hover infile outfile <frq> 0.5 0 0 0.005 <dur>
CDP       hover hover infile outfile frq loc frqrand locrand splice dur
```

## Ranges are musical spans, not CDP's limits

A slider's travel is **not** the program's validation limit. It covers the part of
the range worth having under a slider, which is usually a good deal narrower than
what CDP will accept. So a range tells you where a process is useful, not what the
program permits.

To leave that span behind, right-click a process's title bar and choose **Unlock
ranges** — see [parameters, ranges and unlocking](../interface.md#parameters-ranges-and-unlocking).
Unlocked, a parameter widens to the engine limit on record or simply stops
clamping, and anything CDP refuses fails with CDP's own message in the Log.

Parameter **names** are the app's too, chosen to be readable without CDP's manual:
`windows` for `blurring`, `semitones` for `transpos`. The mapping block is what
maps them back — CDP's own names sit in the synopsis line, in the same order.

## What the catalog adds

The mapping is not only subtraction. The app also does work the bare programs
leave to you:

- **Phase-vocoder wrapping** for spectral processes, when you don't wire the
  ◈ analysis chain yourself ([spectral effects](spectral-pvoc.md)).
- **Channel handling** — mono-only programs run per channel and recombine, so
  stereo in gives stereo out ([mono & channels](mono-and-channels.md)).
- **Breakpoint automation** — any parameter CDP will read as a breakpoint file can
  take a curve instead of a constant ([breakpoint envelopes](breakpoints.md)).
- **Multi-input plumbing** — sample-rate and channel conforming for second
  sources, mixfile build/render pairs for the multichannel mixers
  ([banks & multichannel](banks-and-multichannel.md)).

## Running a program yourself: the Raw process node

**File ▸ Add raw CDP process** drops a node that runs *any* bundled CDP
program with CDP's own arguments, in CDP's own order. It is the escape hatch for
everything the catalog decided: a mode it didn't expose, an argument it pinned, a
program it never listed at all.

- Pick the **program** from the dropdown — the whole bundled suite is there, with
  spectral programs marked. The argument box starts on a working example.
- Write the arguments as you would on a command line, using tokens for the files:
  **`$IN` `$OUT`** for audio, **`$ANA` `$OUTANA`** for spectral data, **`$DATA`**
  for the text box below (breakpoint tables, note data, and the like).
- The **?** button shows **CDP's own usage text for that mode** — printed by the
  program itself, so it always matches what will run. (On curated processes the
  same button shows the plain-language help instead.)
- A spectral program needs analysis data either side: put the node between
  **PVOC Analyse** and **PVOC Resynthesise**, or use `$ANA`/`$OUTANA`.

There is no curation at this level: no automatic pvoc wrapping, no per-channel
splitting, no ranges — the same arguments and file formats as native CDP, and the
same errors, in the Log, when you get them wrong.

Back to the [conceptual guide](README.md) · [effect reference](../effects/README.md).
