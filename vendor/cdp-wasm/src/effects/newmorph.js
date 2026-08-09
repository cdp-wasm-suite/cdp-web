// Effect entries for CDP's `newmorph` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'newmorph.morph', label: 'Peak morph', category: 'Morph',
    program: 'newmorph', domain: 'spectral', inputs: 2,
    args: ['newmorph', { p: 'shape' }, '$IN', '$IN2', '$OUT', { p: 'stagger' }, { p: 'startmorph' }, { p: 'endmorph' }, { p: 'exponent' }, { p: 'peaks' }],
    params: [
      { name: 'shape', label: 'Curve', choices: [['Linear', '1'], ['Cosinusoidal', '2']], default: '1', help: 'Shape of the interpolation path between the spectral peaks — linear, or an S-shaped cosine curve.' },
      { name: 'stagger', label: 'Stagger (s)', min: 0, max: 2, default: 0, step: 0.1, help: 'Delay before the second sound enters. Must not exceed the morph start time.' },
      { name: 'startmorph', label: 'Morph start (s)', min: 0, max: 4, default: 0, step: 0.1, help: 'Time in the first sound at which the morph begins (must be at least the stagger time, and within the sound).' },
      { name: 'endmorph', label: 'Morph end (s)', min: 0.1, max: 4, default: 0.5, step: 0.1, help: 'Time in the first sound at which the morph is complete (must lie within the sound).' },
      { name: 'exponent', label: 'Curve exponent', min: 0.1, max: 4, default: 1, step: 0.1, help: 'Slope of the interpolation. 1 is even; above 1 the change accelerates, below 1 it front-loads.' },
      { name: 'peaks', label: 'Peaks', min: 1, max: 16, default: 8, step: 1, help: 'Number of spectral peaks to track and move between the two sounds.' },
    ],
    blurb: 'Morph between dissimilar spectra by moving the spectral peaks of the first sound onto those of the second.',
  },
  {
    id: 'newmorph.tune', label: 'Tune to harmonic field', category: 'Morph',
    program: 'newmorph', domain: 'spectral', inputs: 2,
    // Retuning snaps each bin's frequency to the nearest harmonic-field pitch;
    // WASM/native libm rounding flips near-midpoint snap choices (amps stay
    // bit-identical). Deterministic on both sides; not FFT-related.
    parityExempt: 'harmonic-field retuning snaps bin frqs to the nearest field pitch; libm rounding flips near-midpoint choices',
    args: ['newmorph', { p: 'shape' }, '$IN', '$IN2', '$OUT', { p: 'stagger' }, { p: 'startmorph' }, { p: 'endmorph' }, { p: 'exponent' }, { p: 'peaks' }],
    params: [
      { name: 'shape', label: 'Curve', choices: [['Linear', '5'], ['Cosinusoidal', '6']], default: '5', help: 'Shape of the retuning trajectory — linear, or an S-shaped cosine curve.' },
      { name: 'stagger', label: 'Stagger (s)', min: 0, max: 2, default: 0, step: 0.1, help: 'Delay before the second sound enters. Must not exceed the morph start time.' },
      { name: 'startmorph', label: 'Morph start (s)', min: 0, max: 4, default: 0, step: 0.1, help: 'Time in the first sound at which the retuning begins (must be at least the stagger time, and within the sound).' },
      { name: 'endmorph', label: 'Morph end (s)', min: 0.1, max: 4, default: 0.5, step: 0.1, help: 'Time in the first sound at which the retuning is complete (must lie within the sound).' },
      { name: 'exponent', label: 'Curve exponent', min: 0.1, max: 4, default: 1, step: 0.1, help: 'Slope of the retuning. 1 is even; above 1 the change accelerates, below 1 it front-loads.' },
      { name: 'peaks', label: 'Peaks', min: 1, max: 16, default: 8, step: 1, help: 'Number of spectral peaks used to define the second sound’s harmonic field.' },
    ],
    blurb: 'Gradually tune the first sound to the (averaged) harmonic field of the second.',
  },
];
