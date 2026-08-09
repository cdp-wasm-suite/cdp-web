// Effect entry for CDP's `madrid` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'madrid.syncopate', label: 'Spatial syncopation', category: 'Spatialisation',
    program: 'madrid', domain: 'sound', input: 'mono', setsChannels: true,
    parityExempt: 'seeded RNG (rand) differs across platforms',
    args: ['madrid', '1', '$IN', '$OUT', { p: 'dur' }, { p: 'chans' }, { p: 'strmcnt' },
      { p: 'delfact' }, { p: 'step' }, { p: 'rand' }, '-s1', '-e'],
    params: [
      { name: 'dur', label: 'Duration (s)', min: 1, max: 20, default: 6, step: 0.5, help: 'Length of the generated output, in seconds.' },
      { name: 'chans', label: 'Out channels', min: 2, max: 8, default: 2, step: 1, help: 'Number of output channels the repetition streams are placed across.' },
      { name: 'strmcnt', label: 'Streams', min: 2, max: 8, default: 4, step: 1, help: 'Number of spatially distinct repetition streams (the program requires at least 2).' },
      { name: 'delfact', label: 'Deletions', min: 0, max: 1, default: 0.4, step: 0.05, help: 'Proportion of repeats randomly deleted from the streams — the key rhythm-making control.' },
      { name: 'step', label: 'Step (s)', min: 0.05, max: 2, default: 0.25, step: 0.05, help: 'Time between event repetitions, in seconds — the underlying pulse.' },
      { name: 'rand', label: 'Step scatter', min: 0, max: 1, default: 0.2, step: 0.05, help: 'Randomisation of the step size (0–1). Higher loosens the pulse.' },
    ],
    blurb: 'Repeat the source as a pulse in spatially separated streams, randomly deleting repeats to syncopate the rhythm around the space.',
  },
];
