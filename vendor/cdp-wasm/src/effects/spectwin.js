// Effect entry for CDP's `spectwin` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'spectwin.hybrid', label: 'Spectral twin', category: 'Formants',
    program: 'spectwin', domain: 'spectral', inputs: 2,
    args: ['spectwin', { p: 'mode' }, '$IN', '$IN2', '$OUT', { p: 'frqint', flag: '-f' }, { p: 'envint', flag: '-e' }, { p: 'dupl', flag: '-d' }, { p: 'step', flag: '-s' }, { p: 'dec', flag: '-r' }],
    params: [
      { name: 'mode', label: 'Envelope', choices: [['Formant envelopes', '1'], ['Whole envelopes', '4']], default: '1', help: 'Whether the hybrid is built from the two sounds’ formant envelopes, or from their total spectral envelopes.' },
      { name: 'frqint', label: 'Frqs from 2nd', min: 0, max: 1, default: 1, step: 0.05, help: 'How strongly the spectral frequencies of the second sound dominate the hybrid (0–1).' },
      { name: 'envint', label: 'Envelope from 2nd', min: 0, max: 1, default: 1, step: 0.05, help: 'How strongly the spectral envelope of the second sound dominates the hybrid (0–1).' },
      { name: 'dupl', label: 'Duplications', min: 0, max: 8, default: 0, step: 1, help: 'Also duplicate the first sound this many times at higher pitches (0 = none).' },
      { name: 'step', label: 'Dup step (semitones)', min: 0, max: 24, default: 12, step: 1, help: 'Pitch step between successive duplications.' },
      { name: 'dec', label: 'Dup level', min: 0.1, max: 1, default: 0.5, step: 0.05, help: 'Level multiplier from one duplication to the next.' },
    ],
    blurb: 'Build a hybrid of the two sounds by exchanging their spectral frequencies and envelopes.',
  },
];
