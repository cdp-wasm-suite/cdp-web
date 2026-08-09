// Effect entry for CDP's `tremolo` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'tremolo.tremolo', label: 'Tremolo', category: 'Envelope',
    program: 'tremolo', domain: 'sound', mono: false,
    args: ['tremolo', '1', '$IN', '$OUT', { p: 'frq' }, { p: 'depth' }, '1', '1'],
    params: [
      { name: 'frq', label: 'Rate (Hz)', min: 0.1, max: 20, default: 6, step: 0.1, help: 'Speed of the volume wobble, in wobbles per second.' },
      { name: 'depth', label: 'Depth', min: 0, max: 1, default: 0.7, step: 0.05, help: 'How deep the wobble cuts: 0 is none, 1 dips all the way to silence.' },
    ],
    blurb: 'Amplitude modulation (tremolo).',
  },
];
