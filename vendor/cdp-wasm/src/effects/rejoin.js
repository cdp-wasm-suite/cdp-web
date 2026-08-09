// Effect entry for CDP's `rejoin` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'rejoin.rejoin', label: 'Rejoin segments', category: 'Extend & segment',
    program: 'rejoin', domain: 'sound', input: 'mono', variadicInputs: true, needs: ['partition'], paritySkip: true, // variadic multi-input mix; no single-command native equivalent to compare against (WASM output covered by the catalog test)
    // rejoin rejoin 1 infile infile2 [infile3 ...] outfile [-ggain]
    // The inverse of partition/isolate: remix segment files (which carry their
    // original timing as silent surrounds) back into one sound.
    args: ['rejoin', '1', '$INS', '$OUT', { p: 'gain', flag: '-g' }],
    params: [
      { name: 'gain', label: 'Gain', min: 0.05, max: 1, default: 1, step: 0.05, help: 'Output level (0–1). Turned down automatically if the mix would clip.' },
    ],
    blurb: 'Remix segment files from Partition / Isolate back into one sound (the inverse operation). Supply the segments as extra.inputs.',
  },
];
