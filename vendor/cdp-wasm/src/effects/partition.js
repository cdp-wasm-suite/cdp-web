// Effect entries for CDP's `partition` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  // These write a *generic* outfile name and produce several numbered files, so
  // applyEffect returns { outputs: Uint8Array[], names: string[] } (see the
  // `multiOut` note in the header). All are waveset/segment processes, so the
  // source is conformed to mono first.
  {
    id: 'partition.wavesets', label: 'Partition (wavesets)', category: 'Extend & segment',
    program: 'partition', domain: 'sound', input: 'mono', multiOut: true, parityExempt: 'multi-file output; no single-command native comparison',
    args: ['partition', '1', '$IN', '$OUT', { p: 'pieces' }, { p: 'group' }],
    params: [
      { name: 'pieces', label: 'Output files', min: 2, max: 8, default: 3, step: 1, help: 'How many separate files to deal the sound out across. Successive blocks go to file 1, 2, 3, 1, 2, 3, … so each file is the source with gaps.' },
      { name: 'group', label: 'Wavesets per block', min: 1, max: 128, default: 16, step: 1, help: 'How many wavesets make up each block before moving to the next output file. Smaller interleaves more finely.' },
    ],
    blurb: 'Deal a mono sound out across several files in waveset-sized blocks (silence fills the gaps).',
  },
  {
    id: 'partition.blocks', label: 'Partition (time blocks)', category: 'Extend & segment',
    program: 'partition', domain: 'sound', input: 'mono', multiOut: true, parityExempt: 'multi-file output; no single-command native comparison',
    args: ['partition', '2', '$IN', '$OUT', { p: 'pieces' }, { p: 'blockdur' }, { p: 'rand', flag: '-r' }],
    params: [
      { name: 'pieces', label: 'Output files', min: 2, max: 8, default: 3, step: 1, help: 'How many separate files to deal the sound out across.' },
      { name: 'blockdur', label: 'Block length (s)', min: 0.02, max: 1, default: 0.2, step: 0.02, help: 'Duration of each block before moving to the next output file. Reduced automatically if too large to fill every file.' },
      { name: 'rand', label: 'Randomise', min: 0, max: 1, default: 0, step: 0.05, help: 'Random variation of the block durations (0 = even, 1 = maximal).' },
    ],
    blurb: 'Deal a mono sound out across several files in fixed-length time blocks.',
  },
];
