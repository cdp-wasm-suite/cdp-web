// Effect entry for CDP's `fastconv` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    // `fastconv` is a portsf-based external (self-contained static module); the
    // 2nd input is the impulse response (mono or N-channel, or a mono .txt FIR).
    id: 'fastconv.reverb', label: 'Convolution reverb', category: 'Delay & reverb',
    program: 'fastconv', domain: 'sound', inputs: 2, external: true,
    args: ['$IN', '$IN2', '$OUT', { p: 'dry' }],
    params: [
      { name: 'dry', label: 'Dry/wet', min: 0, max: 1, default: 0.3, step: 0.05, help: 'Dry/wet balance: 0 is fully wet (just the convolved signal), 1 is fully dry. The 2nd input is the impulse response.' },
    ],
    blurb: 'Convolve the sound with an impulse response (reverb IR or FIR filter) on the 2nd input.',
  },
];
