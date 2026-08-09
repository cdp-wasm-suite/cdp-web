// Effect entry for CDP's `tremenv` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'tremenv.tremenv', label: 'Tremolo (narrowing)', category: 'Envelope',
    program: 'tremenv', domain: 'sound', mono: false,
    args: ['tremenv', '$IN', '$OUT', { p: 'frq' }, { p: 'depth' }, '20', '1'],
    params: [
      { name: 'frq', label: 'Rate (Hz)', min: 0.1, max: 30, default: 5, step: 0.1, help: 'Speed of the tremolo, in pulses per second.' },
      { name: 'depth', label: 'Depth', min: 0, max: 1, default: 0.8, step: 0.05, help: 'How deep the tremolo cuts (0–1). Each pulse narrows after its peak, giving a tighter, more rhythmic feel.' },
    ],
    blurb: 'Tremolo whose width narrows after each peak.',
  },
];
