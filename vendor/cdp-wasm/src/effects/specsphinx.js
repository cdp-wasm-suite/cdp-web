// Effect entries for CDP's `specsphinx` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'specsphinx.impose', label: 'Amplitude transplant', category: 'Combine',
    program: 'specsphinx', domain: 'spectral', inputs: 2,
    args: ['specsphinx', '1', '$IN', '$IN2', '$OUT', { p: 'ampbalance', flag: '-a' }, { p: 'frqbalance', flag: '-f' }],
    params: [
      { name: 'ampbalance', label: 'Keep own amps', min: 0, max: 1, default: 0, step: 0.05, help: 'Proportion of the first sound’s own channel amplitudes retained (0 = fully replaced by the second sound’s).' },
      { name: 'frqbalance', label: 'Inject 2nd frqs', min: 0, max: 1, default: 0, step: 0.05, help: 'Proportion of the second sound’s channel frequencies injected into the output spectrum.' },
    ],
    blurb: 'Impose the channel amplitudes of the second sound onto the channel frequencies of the first.',
  },
  {
    id: 'specsphinx.multiply', label: 'Spectral multiply', category: 'Combine',
    program: 'specsphinx', domain: 'spectral', inputs: 2,
    args: ['specsphinx', '2', '$IN', '$IN2', '$OUT', { p: 'bias', flag: '-b' }, { p: 'gain', flag: '-g' }],
    params: [
      { name: 'bias', label: 'Bias to 1st', min: 0, max: 0.95, default: 0, step: 0.05, help: 'When above 0, mixes a proportion of the first sound back into the product.' },
      { name: 'gain', label: 'Gain', min: 0.1, max: 10, default: 1, step: 0.1, help: 'Overall output level — multiplied spectra are usually quiet, so raise this if the result is faint.' },
    ],
    blurb: 'Multiply the two spectra together — only frequencies present in both sounds survive.',
  },
];
