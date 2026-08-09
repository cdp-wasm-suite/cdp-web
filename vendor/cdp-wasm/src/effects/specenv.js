// Effect entry for CDP's `specenv` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'specenv.replace', label: 'Envelope transfer', category: 'Formants',
    program: 'specenv', domain: 'spectral', inputs: 2,
    // The two heap *writes* that made native abort under glibc are fixed on the
    // fork (fix/specenv-heap-overruns, see docs/cdp-upstream-notes.md), so this
    // runs natively again. Exempt (not full parity) because a benign residual
    // over-read remains in the band interpolation (flagged by the parity-asan
    // job); it reads adjacent heap that differs native-vs-WASM, so only check
    // both produce audio. maxdiff was ~5e-6 locally.
    parityExempt: 'residual benign heap over-read in band interpolation reads adjacent memory that differs native-vs-WASM (tracked by parity-asan; see docs/cdp-upstream-notes.md)',
    args: ['specenv', '$IN', '$IN2', '$OUT', { p: 'windowsize' }, { p: 'bal', flag: '-b' }],
    params: [
      { name: 'windowsize', label: 'Window (channels)', min: 1, max: 100, default: 15, step: 1, help: 'Width of the spectral-envelope window, in analysis-channel widths. Larger windows track broader spectral shapes.' },
      { name: 'bal', label: 'Keep original', min: 0, max: 0.95, default: 0, step: 0.05, help: 'Proportion of the unprocessed first sound mixed back into the output.' },
    ],
    blurb: 'Replace the spectral envelope of the first sound with that of the second (the second sound must be at least as long as the first).',
  },
];
