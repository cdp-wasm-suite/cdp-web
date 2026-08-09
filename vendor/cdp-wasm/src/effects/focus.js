// Effect entries for CDP's `focus` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'focus.exag', label: 'Exaggerate contour', category: 'Spectral',
    program: 'focus', domain: 'spectral', mono: false,
    args: ['exag', '$IN', '$OUT', { p: 'exag' }],
    params: [{ name: 'exag', label: 'Exaggeration', min: 0.1, max: 6, default: 2, step: 0.1, help: 'Sharpens the spectral peaks: above 1 exaggerates the contour (brighter, more focused), below 1 flattens it.' }],
    blurb: 'Exaggerate the spectral contour (sharpen peaks).',
  },
  {
    id: 'focus.fold', label: 'Fold into range', category: 'Spectral',
    program: 'focus', domain: 'spectral', mono: false,
    args: ['fold', '$IN', '$OUT', { p: 'lofrq' }, { p: 'hifrq' }],
    params: [
      { name: 'lofrq', label: 'Low (Hz)', min: 50, max: 2000, default: 200, step: 10, help: 'Bottom of the target band. Everything is octave-shifted to land at or above here.' },
      { name: 'hifrq', label: 'High (Hz)', min: 200, max: 8000, default: 800, step: 10, help: 'Top of the target band. All spectral components are folded into the lo–hi window.' },
    ],
    blurb: 'Octave-transpose all spectral components into a chosen frequency band.',
  },
  {
    id: 'focus.step', label: 'Step-freeze', category: 'Spectral',
    program: 'focus', domain: 'spectral', mono: false,
    args: ['step', '$IN', '$OUT', { p: 'step' }],
    params: [{ name: 'step', label: 'Step (s)', min: 0.02, max: 1, default: 0.08, step: 0.01, help: 'How often the spectrum is frozen, in seconds. Larger steps hold each freeze longer, giving a more stuttering, stepped texture.' }],
    blurb: 'Freeze the spectrum at regular time intervals (stepped, stuttering texture).',
  },
  {
    id: 'focus.accu', label: 'Accumulate', category: 'Spectral',
    program: 'focus', domain: 'spectral', mono: false,
    args: ['accu', '$IN', '$OUT', { p: 'decay', flag: '-d' }, { p: 'glis', flag: '-g' }],
    params: [
      { name: 'decay', label: 'Decay /s', min: 0.1, max: 1, default: 0.9, step: 0.01, help: 'How fast each sustained band fades, per second. 1 sustains forever (thick drone); lower lets bands die away.' },
      { name: 'glis', label: 'Glissando', min: -11.7, max: 11.7, default: 0, step: 0.1, help: 'Octaves-per-second the sustained bands slide. 0 holds pitch; non-zero smears it up or down.' },
    ],
    blurb: 'Sustain each spectral band until louder energy arrives, building an accumulating wash.',
  },
  {
    id: 'focus.focus', label: 'Focus on peaks', category: 'Spectral',
    program: 'focus', domain: 'spectral', mono: false,
    args: ['focus', '$IN', '$OUT', { p: 'bands', flag: '-p' }, { p: 'peaks' }, { p: 'bw' }],
    params: [
      { name: 'bands', label: 'Analysis (bands/8ve)', min: 0.5, max: 8, default: 1, step: 0.5, help: 'Resolution of the spectral-envelope analysis, in bands per octave (1.0 recommended).' },
      { name: 'peaks', label: 'Peaks', min: 1, max: 16, default: 4, step: 1, help: 'How many spectral peaks to find and concentrate energy onto.' },
      { name: 'bw', label: 'Bandwidth (8ves)', min: 0.1, max: 2, default: 0.5, step: 0.05, help: 'Width of the band kept around each peak, in octaves. Narrower gives a purer, more whistly focus.' },
    ],
    blurb: 'Concentrate spectral energy onto the strongest peaks (pitch/formant focusing).',
  },
  {
    id: 'focus.hold', label: 'Hold spectrum', category: 'Spectral',
    program: 'focus', domain: 'spectral', mono: false,
    parityExempt: 'amplifies FFT rounding in near-empty bins (SIMD FFT reorders sums; CDP_SIMD_FFT=0 restores bit-parity)',
    // datafile: "time duration" pairs — the spectral window at `time` is expanded
    // to `dur` seconds, so the output is longer than the input.
    args: ['hold', '$IN', '$OUT', '$DATA'],
    data: (v) => `${v.time} ${v.dur}\n`,
    params: [
      { name: 'time', label: 'Hold at (s)', min: 0, max: 60, default: 0.3, step: 0.05, help: 'Moment in the source whose spectrum is held, in seconds.' },
      { name: 'dur', label: 'Hold for (s)', min: 0.05, max: 5, default: 0.5, step: 0.05, help: 'How long that frozen spectrum is sustained, in seconds. The output is lengthened by this hold.' },
    ],
    blurb: 'Freeze the spectrum at a chosen moment and sustain it, stretching the sound.',
  },
  {
    id: 'focus.freeze', label: 'Freeze spectrum', category: 'Spectral',
    program: 'focus', domain: 'spectral', mono: false,
    // mode 3 freezes channel amplitudes & frequencies. The "a" marker fixes the
    // window AFTER the given time as the freeze window (no length change).
    args: ['freeze', '3', '$IN', '$OUT', '$DATA'],
    data: (v) => `a${v.time}\n`,
    params: [
      { name: 'time', label: 'Freeze from (s)', min: 0, max: 60, default: 0.5, step: 0.05, help: 'Time from which the spectrum is frozen, in seconds. The sound plays normally up to here, then holds the spectral character it had at this moment.' },
    ],
    blurb: 'Freeze the spectral character of the sound from a given moment onward.',
  },
];
