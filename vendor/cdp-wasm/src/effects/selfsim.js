// Effect entry for CDP's `selfsim` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'selfsim.selfsim', label: 'Self-similarity', category: 'Spectral',
    program: 'selfsim', domain: 'spectral', mono: false,
    // The similarity ranking of windows is exquisitely sensitive to FFT rounding,
    // so native and WASM can pick different replacement windows — parity exempt.
    parityExempt: 'window-similarity ranking amplifies FFT rounding (replacement choices can differ)',
    args: ['selfsim', '$IN', '$OUT', { p: 'index' }],
    params: [
      { name: 'index', label: 'Similarity index', min: 1, max: 20, default: 2, step: 1, help: 'How many of the most-similar analysis windows each loud window replaces. Higher makes more of the sound converge on its loudest moments.' },
    ],
    blurb: 'Replace spectral windows with the louder windows they most resemble, making the sound more self-similar.',
  },
];
