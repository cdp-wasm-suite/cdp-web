// Effect entry for CDP's `stutter` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'stutter.stutter', label: 'Stutter', category: 'Extend & segment',
    program: 'stutter', domain: 'sound', mono: false,
    parityExempt: 'seeded RNG (rand) differs across platforms',
    // The datafile lists times slicing the source into elements. We generate
    // `slices` times at `interval` spacing; times past the end of a short
    // source are tolerated (ignored) by the program. TRANS is hard-limited to
    // 0-3 semitones (usage text gives no range) and segjoins must not exceed
    // slices+1 elements, so its max is pinned at 3.
    args: ['stutter', '$IN', '$OUT', '$DATA', { p: 'dur' }, { p: 'segjoins' }, { p: 'silprop' },
      { p: 'silmin' }, { p: 'silmax' }, { p: 'seed' }, { p: 'trans', flag: '-t' }],
    data: (v) => Array.from({ length: Math.round(v.slices) }, (_, i) => ((i + 1) * v.interval).toFixed(3)).join('\n') + '\n',
    params: [
      { name: 'slices', label: 'Elements', min: 2, max: 6, default: 3, step: 1, help: 'How many cut points divide the source into elements the stutter draws from. Cut points that fall past the end of a short sound are ignored.' },
      { name: 'interval', label: 'Slice every (s)', min: 0.1, max: 0.4, default: 0.25, step: 0.05, help: 'Spacing of the cut points in the source, in seconds.' },
      { name: 'dur', label: 'Duration (s)', min: 1, max: 10, default: 4, step: 0.5, help: 'Length of the stuttered output, in seconds.' },
      { name: 'segjoins', label: 'Join up to', min: 1, max: 3, default: 2, step: 1, help: 'Segments may be cut from runs of up to this many joined elements. 1 cuts only from single elements.' },
      { name: 'silprop', label: 'Silence prop.', min: 0.05, max: 1, default: 0.3, step: 0.05, help: 'Proportion of the joins between segments that get a silence inserted (0 = none).' },
      { name: 'silmin', label: 'Min silence (s)', min: 0.01, max: 0.2, default: 0.05, step: 0.01, help: 'Shortest inserted silence, in seconds.' },
      { name: 'silmax', label: 'Max silence (s)', min: 0.2, max: 0.6, default: 0.2, step: 0.05, help: 'Longest inserted silence, in seconds.' },
      { name: 'trans', label: 'Transpose range', min: 0, max: 3, default: 2, step: 0.5, help: 'Range of random transposition applied to segments, in semitones (the program allows at most 3). 0 keeps every segment at source pitch.' },
      { name: 'seed', label: 'Seed', min: 1, max: 100, default: 1, step: 1, help: 'Chooses which random segment order is used; the same seed always gives the same stutter.' },
    ],
    blurb: 'Slice the source into elements and replay randomly cut segments of them in random order, with optional silences (speech-stutter effect).',
  },
];
