// Effect entries for CDP's `strange` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'strange.shift', label: 'Frequency shift', category: 'Spectral',
    program: 'strange', domain: 'spectral', mono: false,
    // mode 1: shift the whole spectrum by a fixed number of Hz (linear, not a
    // musical transposition — turns harmonic spectra inharmonic / bell-like).
    args: ['shift', '1', '$IN', '$OUT', { p: 'frqshift' }],
    params: [
      { name: 'frqshift', label: 'Shift (Hz)', min: -500, max: 500, default: 100, step: 10, help: 'How far to slide every partial, in Hz (the same amount for all). Because it is a linear shift, not a transposition, harmonic sounds become inharmonic and metallic. Negative shifts downward.' },
    ],
    blurb: 'Slide the whole spectrum by a fixed number of Hz (linear shift → inharmonic/bell-like).',
  },
  {
    id: 'strange.waver', label: 'Waver (in/harmonic)', category: 'Spectral',
    program: 'strange', domain: 'spectral', mono: false,
    // mode 1: oscillate between the harmonic source and a spectrally-stretched
    // (inharmonic) version at a chosen rate.
    args: ['waver', '1', '$IN', '$OUT', { p: 'vibfrq' }, { p: 'stretch' }, { p: 'botfrq' }],
    params: [
      { name: 'vibfrq', label: 'Rate (Hz)', min: 0.1, max: 20, default: 5, step: 0.1, help: 'How fast the sound wavers between its harmonic and inharmonic states, in cycles per second.' },
      { name: 'stretch', label: 'Max stretch', min: 1, max: 4, default: 2, step: 0.1, help: 'How far the spectrum is stretched at the peak of the inharmonic state. 1 is no stretch; higher spreads the partials further apart for a more bell-like, detuned timbre.' },
      { name: 'botfrq', label: 'Above (Hz)', min: 20, max: 2000, default: 200, step: 10, help: 'Only partials above this frequency are stretched, so the low end stays anchored.' },
    ],
    blurb: 'Oscillate between the harmonic sound and a spectrally-stretched inharmonic version.',
  },
  {
    id: 'strange.invert', label: 'Spectral invert', category: 'Spectral',
    program: 'strange', domain: 'spectral', mono: false,
    // mode 1: invert the spectrum (turn peaks into troughs) about its own centre.
    args: ['invert', '1', '$IN', '$OUT'],
    params: [],
    blurb: 'Invert the spectrum, turning spectral peaks into troughs (timbral negative).',
  },
  {
    id: 'strange.glis', label: 'Spectral glissando', category: 'Spectral',
    program: 'strange', domain: 'spectral', mono: false,
    // mode 1: Shepard-tone glissando inside the source's changing spectral envelope.
    // -f8 extracts the formant envelope using one point per 8 frequency channels.
    args: ['glis', '1', '$IN', '$OUT', '-f8', { p: 'glisrate' }],
    params: [
      { name: 'glisrate', label: 'Glide (semitones/s)', min: -12, max: 12, default: 3, step: 0.5, help: 'Speed of the endless (Shepard) glissando in semitones per second. Positive glides upward, negative downward; the partials fade in and out to keep the glide seamless.' },
    ],
    blurb: 'Create an endless Shepard-tone glissando inside the source’s spectral envelope.',
  },
];
