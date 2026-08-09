// Effect entry for CDP's `specross` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'specross.partials', label: 'Partial cross', category: 'Morph',
    program: 'specross', domain: 'spectral', inputs: 2, prefersHarmonic: true,
    args: ['partials', '$IN', '$IN2', '$OUT', { p: 'tuning' }, { p: 'minwin' }, { p: 'signois' }, { p: 'harmcnt' }, { p: 'lo' }, { p: 'hi' }, { p: 'thresh' }, { p: 'level' }, { p: 'interp' }],
    params: [
      { name: 'tuning', label: 'Tuning (semitones)', min: 0.1, max: 6, default: 2, step: 0.1, help: 'How far (in semitones) a partial may deviate from a harmonic and still count as in tune. Widen this if CDP reports it cannot find a pitch.' },
      { name: 'minwin', label: 'Min windows', min: 1, max: 8, default: 2, step: 1, help: 'How many adjacent analysis windows must agree on a pitch before it is accepted.' },
      { name: 'signois', label: 'Signal/noise (dB)', min: 20, max: 100, default: 80, step: 1, help: 'Windows more than this far below the peak level are treated as noise and their pitch ignored.' },
      { name: 'harmcnt', label: 'Harmonics needed', min: 1, max: 8, default: 3, step: 1, help: 'How many of the 8 loudest spectral peaks must be harmonics to confirm the sound is pitched. Lower this if CDP reports it cannot find a pitch.' },
      { name: 'lo', label: 'Lowest pitch (Hz)', min: 10, max: 1000, default: 10, step: 1, help: 'Lowest frequency accepted as a pitch.' },
      { name: 'hi', label: 'Highest pitch (Hz)', min: 100, max: 2756, default: 2756, step: 1, help: 'Highest frequency accepted as a pitch (CDP caps this at an eighth of the sample rate — 2756 Hz at 44.1 kHz).' },
      { name: 'thresh', label: 'Partial threshold', min: 0, max: 0.5, default: 0.01, step: 0.01, help: 'Minimum level (relative to the loudest partial) a partial needs to be used in the rebuilt spectrum.' },
      { name: 'level', label: 'Level', min: 0.1, max: 1, default: 1, step: 0.1, help: 'Output level.' },
      { name: 'interp', label: 'Interpolation', min: 0, max: 1, default: 1, step: 0.05, help: 'How far the partials of the second sound move towards those of the first (0 = stay, 1 = fully cross).' },
    ],
    blurb: 'Interpolate the partials of one pitched sound towards those of another (both sounds must be clearly pitched).',
  },
];
