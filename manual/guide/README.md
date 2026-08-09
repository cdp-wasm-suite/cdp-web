> **⚠ WORK IN PROGRESS** — this documentation is a work in progress
<!-- Overlay of cdp-wasm's docs/guide/README.md: adds the app-side "banks &
     multichannel" entry (Pick/Gather are patcher concepts, not library ones).
     Keep the library entries in sync with upstream when re-vendoring. -->
# Conceptual guide

Background concepts that apply across many effects. Read these once and the
per-effect pages make more sense.

- **[The catalog and CDP](catalog-and-cdp.md)** — what the curated catalog changed
  about the programs you know: one mode per process, arguments it fixes for you,
  ranges that are musical spans rather than CDP's limits. **Start here if you
  already know CDP.**
- **[Spectral effects & the phase vocoder](spectral-pvoc.md)** — what `domain:
  'spectral'` means, the automatic `pvoc anal → … → pvoc synth` wrapping, and why
  spectral output is mono.
- **[Breakpoint envelopes](breakpoints.md)** — give a parameter a `time value` curve
  so it varies over the sound; which parameters allow it, how to supply one, and
  how to extract an envelope from a sound and reuse its shape.
- **[Mono effects & channel handling](mono-and-channels.md)** — how stereo is split,
  processed and recombined for mono-only effects.
- **[Banks and multichannel sound](banks-and-multichannel.md)** — effects that
  produce or consume *sets* of sounds (the ▣ bank cable, Pick and Gather nodes),
  and effects that set their own output channel count.

Back to the [documentation index](../README.md) · [effect reference](../effects/README.md).
