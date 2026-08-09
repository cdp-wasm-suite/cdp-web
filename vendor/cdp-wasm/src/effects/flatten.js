// Effect entry for CDP's `flatten` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'flatten.flatten', label: 'Level (equalise)', category: 'Envelope',
    program: 'flatten', domain: 'sound', mono: true,
    args: ['flatten', '$IN', '$OUT', { p: 'elementsize' }, { p: 'shoulder' }],
    params: [
      { name: 'elementsize', label: 'Element size (s)', min: 0.05, max: 1, default: 0.15, step: 0.05, help: 'Approximate length of the events (e.g. syllables or notes) whose levels are being evened out, in seconds. Set it near the length of the loudness bumps in the sound.' },
      { name: 'shoulder', label: 'Rise time (ms)', min: 20, max: 50, default: 25, step: 5, help: 'How quickly the imposed level is allowed to change at an element edge, in milliseconds. Shorter reacts faster but can sound abrupt.' },
    ],
    blurb: 'Even out the loudness of successive sound elements (levels the dynamics).',
  },
];
