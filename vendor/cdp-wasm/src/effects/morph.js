// Effect entries for CDP's `morph` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  // ==========================================================================
  // Phase C — two-input spectral effects (need a second source soundfile).
  // Each analyses both sounds to .ana, combines them, and resynthesises (mono).
  // ==========================================================================
  {
    id: 'morph.morph', label: 'Spectral morph', category: 'Morph',
    program: 'morph', domain: 'spectral', inputs: 2,
    args: ['morph', '1', '$IN', '$IN2', '$OUT', '0', { p: 'dur' }, '0', { p: 'dur' }, { p: 'expa' }, { p: 'expf' }],
    params: [
      { name: 'dur', label: 'Morph over (s)', min: 0.1, max: 4, default: 0.5, step: 0.1, help: 'How long the crossfade from the first sound into the second takes, in seconds.' },
      { name: 'expa', label: 'Amp curve', min: 0.1, max: 4, default: 1, step: 0.1, help: 'Shape of the loudness crossfade. 1 is linear; below 1 favours the second sound early, above 1 holds the first longer.' },
      { name: 'expf', label: 'Freq curve', min: 0.1, max: 4, default: 1, step: 0.1, help: 'Shape of the frequency crossfade. 1 is linear; values either side bias when the pitch/spectrum changes over.' },
    ],
    blurb: 'Interpolate (morph) from the first sound into the second over a span of time.',
  },
  {
    id: 'morph.bridge', label: 'Spectral bridge', category: 'Morph',
    program: 'morph', domain: 'spectral', inputs: 2,
    args: ['bridge', '1', '$IN', '$IN2', '$OUT'],
    params: [],
    blurb: 'Interpolate across the whole sound between the two spectra (a bridge from one to the other).',
  },
];
