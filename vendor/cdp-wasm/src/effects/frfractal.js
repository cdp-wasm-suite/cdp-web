// Effect entry for CDP's `frfractal` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'frfractal.fractal', label: 'Fractalise', category: 'Extend & segment',
    program: 'frfractal', domain: 'sound', mono: false,
    // The tail-splice heap overflow is fixed on the fork
    // (fix/frfractal-splice-chancount, see docs/cdp-upstream-notes.md); full
    // byte-parity with native (deterministic time-domain process).
    args: ['fractal', '$IN', '$OUT', { p: 'layers' }, { p: 'splicelen', flag: '-s' }],
    params: [
      { name: 'layers', label: 'Layers', min: 2, max: 3, default: 2, step: 1, help: 'Number of fractal layers. Each layer doubles the output length (2 layers is 4x, 3 layers is 8x).' },
      { name: 'splicelen', label: 'Splice (ms)', min: 5, max: 50, default: 15, step: 1, help: 'Length of the splices between fractal segments, in milliseconds.' },
    ],
    blurb: 'Build a self-similar (fractal) expansion of the sound.',
  },
];
