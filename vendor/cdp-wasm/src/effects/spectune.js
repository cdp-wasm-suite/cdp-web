// Effect entry for CDP's `spectune` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'spectune.nearest', label: 'Auto-tune (nearest note)', category: 'Spectral pitch',
    program: 'spectune', domain: 'spectral', mono: false,
    parityExempt: 'pitch detection amplifies FFT rounding (SIMD FFT reorders sums; CDP_SIMD_FFT=0 restores bit-parity)',
    // Mode 1: find the most prominent pitch, transpose to nearest tempered pitch.
    args: ['tune', '1', '$IN', '$OUT', { p: 'match', flag: '-m' }, { p: 'intune', flag: '-i' }],
    params: [
      { name: 'match', label: 'Partials to match', min: 1, max: 8, default: 5, step: 1, help: 'How many partials must line up on a harmonic series before a pitch is accepted. Lower is more permissive with noisy or ambiguous sources.' },
      { name: 'intune', label: 'Tolerance (semitones)', min: 0.1, max: 3, default: 1, step: 0.1, help: 'How closely partials must sit on the harmonic series to count, in semitones. Wider helps with slightly out-of-tune or wobbly sources.' },
    ],
    blurb: 'Find the most prominent pitch in the sound and transpose it to the nearest tempered (keyboard) note.',
  },
];
