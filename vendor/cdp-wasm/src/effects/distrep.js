// Effect entry for CDP's `distrep` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'distrep.stretch', label: 'Wavecycle repeat-stretch', category: 'Waveset distortion',
    program: 'distrep', domain: 'sound', mono: true,
    // Mode 2 (repeat-then-skip) is NOT wrapped: it hangs in an infinite loop on
    // some parameter/material combinations with no fenceable safe range.
    args: ['distrep', '1', '$IN', '$OUT', { p: 'multiplier' }, { p: 'cyclecnt' }, { p: 'splicelen', flag: '-s' }],
    params: [
      { name: 'multiplier', label: 'Repeats', min: 2, max: 8, default: 3, step: 1, help: 'How many times each wave-cycle group is repeated. The output becomes roughly this many times longer.' },
      { name: 'cyclecnt', label: 'Group size', min: 1, max: 8, default: 1, step: 1, help: 'How many wave-cycles are grouped and repeated together. Larger groups give a coarser, more stuttering texture.' },
      { name: 'splicelen', label: 'Splice (ms)', min: 2, max: 25, default: 15, step: 1, help: 'Length of the crossfade splice between repeated blocks, in milliseconds. Shorter is buzzier, longer is smoother.' },
    ],
    blurb: 'Time-stretch by repeating each wave-cycle group (with splices).',
  },
];
