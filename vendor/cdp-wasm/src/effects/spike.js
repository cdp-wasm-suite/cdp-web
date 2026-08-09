// Effect entry for CDP's `spike` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'spike.spike', label: 'Spike envelope', category: 'Envelope',
    program: 'spike', domain: 'sound', mono: false,
    args: ['spike', '$IN', '$OUT', { p: 'peak' }, { p: 'upslope' }, { p: 'downslope' }],
    params: [
      { name: 'peak', label: 'Peak time (s)', min: 0.05, max: 10, default: 0.5, step: 0.05, help: 'Time within the sound the envelope peaks at, in seconds. Everything before rises to it and everything after falls away.' },
      { name: 'upslope', label: 'Attack curve', min: 1, max: 100, default: 4, step: 1, help: 'Steepness of the rise up to the peak. 1 is a straight line; higher holds silence longer then swells sharply.' },
      { name: 'downslope', label: 'Decay curve', min: 1, max: 100, default: 4, step: 1, help: 'Steepness of the fall after the peak. Higher drops away faster, leaving a longer tail of near-silence.' },
    ],
    blurb: 'Envelope the whole sound to swell to a single peak at a chosen time.',
  },
];
