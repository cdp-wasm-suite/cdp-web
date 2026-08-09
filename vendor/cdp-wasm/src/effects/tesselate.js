// Effect entry for CDP's `tesselate` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'tesselate.tesselate', label: 'Tesselate (phase pattern)', category: 'Spatialisation',
    program: 'tesselate', domain: 'sound', input: 'mono', setsChannels: true,
    // No RNG: the delay-drift pattern is fully determined by the data file.
    // Datafile line 1: repeats before the drifting copy resyncs with the
    // cycledur-delayed source; line 2: entry delay (0 — single source).
    args: ['tesselate', '$IN', '$OUT', '$DATA', { p: 'chans' }, { p: 'cycledur' },
      { p: 'outdur' }, { p: 'type' }],
    data: (v) => `${v.repeats}\n0\n`,
    params: [
      { name: 'chans', label: 'Out channels', min: 2, max: 8, default: 2, step: 2, help: 'Number of output channels (even). The source repeats on pairs of channels with slowly drifting delays.' },
      { name: 'cycledur', label: 'Cycle (s)', min: 0.1, max: 4, default: 0.5, step: 0.05, help: 'Shortest repeat-time of the pattern, in seconds.' },
      { name: 'outdur', label: 'Duration (s)', min: 1, max: 20, default: 6, step: 0.5, help: 'Length of the output, in seconds.' },
      { name: 'repeats', label: 'Drift cycles', min: 2, max: 32, default: 5, step: 1, help: 'How many repeats the drifting copy takes to resynchronise with the steady one. More repeats is a slower, subtler phase-drift.' },
      { name: 'type', label: 'Drift pairing', min: 0, max: 3, default: 0, step: 1, maxOf: (v) => Number(v.chans) - 1, help: 'Which channels drift against each other: 0 odd v even, 1 adjacent, 2 alternate, 3 every third. Must be less than the channel count.' },
    ],
    blurb: 'Steve-Reich-style phase pattern: the source repeats across channel pairs whose delays drift apart and resynchronise.',
  },
];
