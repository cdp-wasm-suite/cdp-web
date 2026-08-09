// Effect entries for CDP's `grain` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'grain.duplicate', label: 'Duplicate grains', category: 'Granular',
    program: 'grain', domain: 'sound', mono: true, prefersGrains: true,
    args: ['duplicate', '$IN', '$OUT', { p: 'n' }],
    params: [{ name: 'n', label: 'Repeats', min: 1, max: 8, default: 3, step: 1, help: 'How many times each detected grain (note/hit) is repeated. Works best on rhythmic or percussive material.' }],
    blurb: 'Repeat each detected grain N times. Needs rhythmic/percussive input.',
  },
  {
    id: 'grain.timewarp', label: 'Grain time-warp', category: 'Granular',
    program: 'grain', domain: 'sound', mono: true, prefersGrains: true,
    args: ['timewarp', '$IN', '$OUT', { p: 'ratio' }],
    params: [{ name: 'ratio', label: 'Stretch ×', min: 0.25, max: 4, default: 2, step: 0.25, help: 'Stretches the gaps between grains: 2 spaces them twice as far apart, 0.5 packs them closer. The grains themselves keep their length.' }],
    blurb: 'Stretch the time between grains without stretching the grains. Needs rhythmic input.',
  },
  {
    id: 'grain.reverse', label: 'Reverse grain order', category: 'Granular',
    program: 'grain', domain: 'sound', mono: true, prefersGrains: true,
    args: ['reverse', '$IN', '$OUT'],
    params: [],
    blurb: 'Reverse the order of grains without reversing the grains. Needs rhythmic input.',
  },
  {
    id: 'grain.omit', label: 'Omit grains', category: 'Granular',
    program: 'grain', domain: 'sound', mono: true, prefersGrains: true,
    args: ['omit', '$IN', '$OUT', { p: 'keep' }, { p: 'outof' }],
    params: [
      { name: 'keep', label: 'Keep', min: 1, max: 4, default: 1, step: 1, maxOf: (v) => Number(v.outof), help: 'How many grains to keep in each group.' },
      { name: 'outof', label: 'out of', min: 2, max: 6, default: 2, step: 1, help: 'Group size: keep K grains out of every N, dropping the rest for a thinner, more rhythmic result.' },
    ],
    blurb: 'Keep K out of every N detected grains (rhythmic thinning). Needs rhythmic input.',
  },
  {
    id: 'grain.reorder', label: 'Reorder grains', category: 'Granular',
    program: 'grain', domain: 'sound', mono: true, prefersGrains: true,
    args: ['reorder', '$IN', '$OUT', 'abc:b'],
    params: [],
    blurb: 'Reorder grains following a fixed jump pattern. Needs rhythmic input.',
  },
  {
    id: 'grain.align', label: 'Align grains (2 sounds)', category: 'Granular',
    program: 'grain', domain: 'sound', inputs: 2, prefersGrains: true,
    parityExempt: 'grain detection / platform edge handling',
    args: ['align', '$IN', '$IN2', '$OUT', { p: 'offset' }, { p: 'gate2' }, { p: 'gate1', flag: '-l' }],
    params: [
      { name: 'offset', label: 'Offset (s)', min: 0, max: 4, default: 0, step: 0.05, help: 'Time added to every grain placement, in seconds.' },
      { name: 'gate2', label: '2nd gate', min: 0.001, max: 1, default: 0.05, step: 0.001, help: 'Minimum level to count as a grain in the second sound (the grain source). Lower finds more grains.' },
      { name: 'gate1', label: '1st gate', min: 0.001, max: 1, default: 0.05, step: 0.001, help: 'Minimum level to count as a grain-onset in the first sound (the timing source).' },
    ],
    blurb: 'Retime the grains of the second sound onto the grain-onset times of the first.',
  },
  {
    id: 'grain.repitch', label: 'Repitch grains', category: 'Granular',
    program: 'grain', domain: 'sound', mono: true, prefersGrains: true,
    args: ['repitch', '1', '$IN', '$OUT', '$DATA'],
    // The transposition list is one semitone-shift per line; a single value
    // transposes every grain by the same amount.
    data: (v) => `${v.semitones}\n`,
    params: [{ name: 'semitones', label: 'Semitones', min: -24, max: 24, default: 7, step: 1, help: 'How far to transpose every detected grain, in semitones. ±12 = one octave. Works best on rhythmic material.' }],
    blurb: 'Transpose each detected grain by a number of semitones. Needs rhythmic input.',
  },
];
