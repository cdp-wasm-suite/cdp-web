// Effect entries for CDP's `specfnu` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'specfnu.narrow', label: 'Narrow formants', category: 'Spectral',
    program: 'specfnu', domain: 'spectral', mono: false, prefersHarmonic: true,
    args: ['specfnu', '1', '$IN', '$OUT', { p: 'narrow' }],
    params: [
      { name: 'narrow', label: 'Narrowing', min: 1, max: 100, default: 5, step: 1, help: 'How steeply the skirts of the formant peaks are sharpened. Higher gives a thinner, more vowel-like, resonant colour. Works best on pitched material like voice.' },
    ],
    blurb: 'Steepen the formant peaks of the spectrum, sharpening the vowel-like resonances. Needs a pitched source.',
  },
  {
    id: 'specfnu.vibrate', label: 'Invert formants', category: 'Spectral',
    program: 'specfnu', domain: 'spectral', mono: false, prefersHarmonic: true,
    parityExempt: 'formant analysis amplifies FFT rounding (SIMD FFT reorders sums; CDP_SIMD_FFT=0 restores bit-parity)',
    args: ['specfnu', '3', '$IN', '$OUT', { p: 'vibrate' }],
    params: [
      { name: 'vibrate', label: 'Vibrate (Hz)', min: 0, max: 20, default: 2, step: 0.5, help: 'Speed of cycling between the original and inverted spectrum, in Hz — a strange timbral tremolo. 0 holds the pure inversion throughout. Works best on pitched material like voice.' },
    ],
    blurb: 'Turn formant peaks into troughs and troughs into peaks, optionally cycling between original and inverted.',
  },
  {
    id: 'specfnu.transpose', label: 'Transpose (keep formants)', category: 'Spectral pitch',
    program: 'specfnu', domain: 'spectral', mono: false, prefersHarmonic: true,
    // The mode-12 heap *writes* that made native abort under glibc are fixed on
    // the fork (fix/specfnu-recolor-windowbuf-overrun, see docs/cdp-upstream-notes.md),
    // so this runs natively again. Exempt (not full parity): the pitch/formant
    // path amplifies SIMD-FFT rounding like its sibling .vibrate, and a benign
    // residual over-read remains in formants_recolor (flagged by parity-asan).
    parityExempt: 'pitch/formant recolour amplifies FFT rounding + a residual benign over-read reads adjacent memory (tracked by parity-asan; see docs/cdp-upstream-notes.md)',
    args: ['specfnu', '12', '$IN', '$OUT', { p: 'semitones' }],
    params: [
      { name: 'semitones', label: 'Semitones', min: -48, max: 48, default: 5, step: 1, help: 'How far to transpose the pitch, in semitones. The formants stay put, so voices keep their character instead of going chipmunk-like. Needs a clearly pitched source. ±12 = one octave.' },
    ],
    blurb: 'Transpose the pitch while keeping the formant envelope in place (voice keeps its character).',
  },
];
