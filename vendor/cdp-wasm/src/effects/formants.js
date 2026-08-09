// Effect entry for CDP's `formants` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'formants.vocode', label: 'Vocoder (cross-synth)', category: 'Formants',
    program: 'formants', domain: 'spectral', inputs: 2,
    parityExempt: 'formant envelope of near-empty bands amplifies FFT rounding (SIMD FFT reorders sums; CDP_SIMD_FFT=0 restores bit-parity)',
    args: ['vocode', '$IN', '$IN2', '$OUT', { p: 'bands', flag: '-p' }, { p: 'gain', flag: '-g' }],
    params: [
      { name: 'bands', label: 'Bands / octave', min: 2, max: 12, default: 8, step: 1, help: 'Resolution of the formant (spectral-envelope) analysis, in bands per octave. Higher tracks the second sound’s character more finely.' },
      { name: 'gain', label: 'Gain', min: 0.1, max: 2, default: 1, step: 0.1, help: 'Output level of the cross-synthesised result.' },
    ],
    blurb: 'Impose the spectral envelope (formants) of the second sound onto the first.',
  },
];
