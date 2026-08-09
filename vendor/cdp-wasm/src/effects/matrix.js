// Effect entries for CDP's `matrix` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    // matrix does its OWN FFT on the soundfile: domain 'sound', no pvoc wrap.
    id: 'matrix.swap', label: 'Swap FFT real/imag', category: 'Spectral',
    program: 'matrix', domain: 'sound', mono: true,
    args: ['matrix', '3', '$IN', '$OUT', { p: 'analchans' }, { p: 'winoverlap' }],
    params: [
      { name: 'analchans', label: 'FFT size', choices: [['256', '256'], ['512', '512'], ['1024', '1024'], ['2048', '2048'], ['4096', '4096']], default: '1024', help: 'Size of the analysis FFT (must be a power of 2). Smaller sizes glitch faster and grittier; larger ones smear more.' },
      { name: 'winoverlap', label: 'Overlap', min: 1, max: 4, default: 3, step: 1, help: 'How much successive analysis windows overlap (1–4). More overlap gives a smoother result.' },
    ],
    blurb: 'Exchange the real and imaginary parts of the sound’s FFT — a metallic, phase-mangled glitch.',
  },
  {
    id: 'matrix.invphase', label: 'Invert FFT phase', category: 'Spectral',
    program: 'matrix', domain: 'sound', mono: true,
    args: ['matrix', '4', '$IN', '$OUT', { p: 'analchans' }, { p: 'winoverlap' }],
    params: [
      { name: 'analchans', label: 'FFT size', choices: [['256', '256'], ['512', '512'], ['1024', '1024'], ['2048', '2048'], ['4096', '4096']], default: '1024', help: 'Size of the analysis FFT (must be a power of 2).' },
      { name: 'winoverlap', label: 'Overlap', min: 1, max: 4, default: 3, step: 1, help: 'How much successive analysis windows overlap (1–4). More overlap gives a smoother result.' },
    ],
    blurb: 'Flip the phase of every FFT channel, subtly (or not so subtly) recolouring the sound.',
  },
];
