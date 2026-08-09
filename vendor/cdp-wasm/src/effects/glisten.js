// Effect entry for CDP's `glisten` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'glisten.glisten', label: 'Glisten (partition)', category: 'Spectral',
    program: 'glisten', domain: 'spectral', mono: false,
    parityExempt: 'random spectral partition (rand)',
    args: ['glisten', '$IN', '$OUT', { p: 'grpdiv' }, { p: 'setdur' }, { p: 'pshift', flag: '-p' }],
    params: [
      { name: 'grpdiv', label: 'Sets', min: 2, max: 16, default: 4, step: 1, help: 'How many sets the spectrum is randomly split into; the sets then play in turn.' },
      { name: 'setdur', label: 'Set dur (windows)', min: 1, max: 32, default: 8, step: 1, help: 'How long each set sounds before the next, measured in analysis frames.' },
      { name: 'pshift', label: 'Pitch shift', min: 0, max: 12, default: 0, step: 1, help: 'Optional transposition applied to each set, in semitones. 0 leaves the pitch unchanged.' },
    ],
    blurb: 'Randomly partition the spectrum into sets and play them back in turn.',
  },
];
