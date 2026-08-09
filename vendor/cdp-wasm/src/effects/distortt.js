// Effect entry for CDP's `distortt` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'distortt.repeat', label: 'Waveset group-repeat', category: 'Waveset distortion',
    program: 'distortt', domain: 'sound', mono: true,
    args: ['repeat', '$IN', '$OUT', { p: 'gpcnt' }, { p: 'rpt' }, { p: 'offset' }, { p: 'dur' }],
    params: [
      { name: 'gpcnt', label: 'Group size', min: 1, max: 16, default: 2, step: 1, help: 'How many wavesets are grouped together before the group is repeated.' },
      { name: 'rpt', label: 'Repeats', min: 2, max: 16, default: 4, step: 1, help: 'How many times each waveset group plays.' },
      { name: 'offset', label: 'Offset (ms)', min: 1, max: 500, default: 10, step: 1, help: 'Sound skipped (and passed through untouched) before the repeating starts, in milliseconds. Must be above zero.' },
      { name: 'dur', label: 'Output (s)', min: 1, max: 8, default: 3, step: 0.5, help: 'Repeating continues until the output reaches this length (or the source runs out).' },
    ],
    blurb: 'Repeat groups of wavesets until the requested duration is filled.',
  },
];
