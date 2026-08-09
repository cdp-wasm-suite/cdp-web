// Effect entries for CDP's `combine` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'combine.mean', label: 'Spectral mean', category: 'Combine',
    program: 'combine', domain: 'spectral', inputs: 2,
    parityExempt: 'amplifies FFT rounding in near-empty bins (SIMD FFT reorders sums; CDP_SIMD_FFT=0 restores bit-parity)',
    args: ['mean', '1', '$IN', '$IN2', '$OUT'],
    params: [],
    blurb: 'Combine two sounds by taking the mean of their spectra (a hybrid).',
  },
  {
    id: 'combine.cross', label: 'Spectral cross', category: 'Combine',
    program: 'combine', domain: 'spectral', inputs: 2,
    args: ['cross', '$IN', '$IN2', '$OUT', { p: 'interp', flag: '-i' }],
    params: [
      { name: 'interp', label: 'Amount', min: 0, max: 1, default: 1, step: 0.05, help: 'Degree to which the first sound’s spectral amplitudes are replaced by the second’s. 1 = full cross-synthesis.' },
    ],
    blurb: 'Replace the spectral amplitudes of the first sound with those of the second (cross-synthesis).',
  },
  {
    id: 'combine.sum', label: 'Spectral sum', category: 'Combine',
    program: 'combine', domain: 'spectral', inputs: 2,
    args: ['sum', '$IN', '$IN2', '$OUT', { p: 'crossover', flag: '-c' }],
    params: [
      { name: 'crossover', label: 'Mix in 2nd', min: 0, max: 1, default: 1, step: 0.05, help: 'How much of the second spectrum is added to the first (0–1).' },
    ],
    blurb: 'Add the two spectra together.',
  },
  {
    id: 'combine.diff', label: 'Spectral difference', category: 'Combine',
    program: 'combine', domain: 'spectral', inputs: 2,
    args: ['diff', '$IN', '$IN2', '$OUT', { p: 'crossover', flag: '-c' }],
    params: [
      { name: 'crossover', label: 'Subtract 2nd', min: 0, max: 1, default: 1, step: 0.05, help: 'How much of the second spectrum is subtracted from the first (0–1) — spectral cancellation.' },
    ],
    blurb: 'Subtract the second spectrum from the first (spectral cancellation).',
  },
  {
    id: 'combine.interleave', label: 'Spectral interleave', category: 'Combine',
    program: 'combine', domain: 'spectral', inputs: 2,
    args: ['interleave', '$IN', '$IN2', '$OUT', { p: 'leafsize' }],
    params: [
      { name: 'leafsize', label: 'Leaf (windows)', min: 1, max: 64, default: 4, step: 1, help: 'How many analysis frames are taken from each sound in turn before switching — small values interleave finely.' },
    ],
    blurb: 'Interleave alternating blocks of analysis frames from the two sounds.',
  },
  {
    id: 'combine.max', label: 'Spectral maximum', category: 'Combine',
    program: 'combine', domain: 'spectral', inputs: 2,
    args: ['max', '$IN', '$IN2', '$OUT'],
    params: [],
    blurb: 'Keep, in every channel and frame, the louder of the two spectra.',
  },
];
