// Effect entries for CDP's `submix` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'submix.merge', label: 'Mix two sounds', category: 'Mix',
    program: 'submix', domain: 'sound', inputs: 2,
    args: ['merge', '$IN', '$IN2', '$OUT', { p: 'stagger', flag: '-s' }, { p: 'skew', flag: '-k' }],
    params: [
      { name: 'stagger', label: '2nd entry (s)', min: 0, max: 4, default: 0, step: 0.1, help: 'How long to delay the second sound before it enters, in seconds. 0 starts both together.' },
      { name: 'skew', label: '1st:2nd gain', min: 0.1, max: 10, default: 1, step: 0.1, help: 'Loudness balance between the two sounds. 1 is equal; higher favours the first, lower the second.' },
    ],
    blurb: 'Mix the first and second sounds together (mono or stereo), with optional offset and balance.',
  },
  {
    id: 'submix.interleave', label: 'Join channels (interleave)', category: 'Mix',
    program: 'submix', domain: 'sound', inputs: 2, input: 'mono', in2: 'mono', setsChannels: true,
    args: ['interleave', '$IN', '$IN2', '$OUT'],
    params: [],
    blurb: 'Interleave two (mono) sounds into one stereo file: first → left, second → right. The inverse of Split channels.',
  },
];
