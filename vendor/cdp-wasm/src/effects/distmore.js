// Effect entries for CDP's `distmore` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'distmore.double', label: 'Waveset octave-up', category: 'Waveset distortion',
    program: 'distmore', domain: 'sound', mono: true,
    args: ['double', '$IN', '$OUT', { p: 'mult' }],
    params: [
      { name: 'mult', label: 'Octaves up', min: 1, max: 4, default: 1, step: 1, help: 'How many octaves each waveset is shifted up (its waveform is squeezed and repeated in place).' },
    ],
    blurb: 'Double (or quadruple…) the frequency of each waveset — octave shifts up.',
  },
  {
    id: 'distmore.segszig', label: 'Segment zigzag', category: 'Extend & segment',
    program: 'distmore', domain: 'sound', mono: true,
    args: ['segszig', '2', '$IN', '$OUT', { p: 'repets' }, { p: 'shrinkto', flag: '-s' }, { p: 'prop', flag: '-p' }],
    params: [
      { name: 'repets', label: 'Zigzags', min: 1, max: 8, default: 3, step: 1, help: 'How many times playback zigzags back and forth across the sound. More zigzags give a longer output.' },
      { name: 'shrinkto', label: 'Shrink to (ms)', min: 31, max: 500, default: 250, step: 1, help: 'Zigzag sweeps get progressively shorter, contracting down to this length in milliseconds (31 ms is the smallest the program allows).' },
      { name: 'prop', label: 'Portion', min: 0.2, max: 1, default: 1, step: 0.05, help: 'Proportion of the sound each zigzag sweeps across. 1 uses all of it.' },
    ],
    blurb: 'Zigzag back and forth across the sound with progressively shrinking sweeps.',
  },
];
