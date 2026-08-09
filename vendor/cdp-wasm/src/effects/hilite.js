// Effect entries for CDP's `hilite` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'hilite.trace', label: 'Trace partials', category: 'Spectral',
    program: 'hilite', domain: 'spectral', mono: false,
    args: ['trace', '1', '$IN', '$OUT', { p: 'partials' }],
    params: [{ name: 'partials', label: 'Keep N loudest', min: 1, max: 64, default: 8, step: 1, help: 'How many of the loudest partials to keep; the rest are discarded. Fewer gives a thinner, purer, more whistle-like sound.' }],
    blurb: 'Retain only the N loudest partials (spectral thinning).',
  },
  {
    id: 'hilite.bltr', label: 'Blur + trace', category: 'Spectral',
    program: 'hilite', domain: 'spectral', mono: false,
    args: ['bltr', '$IN', '$OUT', { p: 'blurring' }, { p: 'tracing' }],
    params: [
      { name: 'blurring', label: 'Blur windows', min: 1, max: 100, default: 10, step: 1, help: 'How many frames are time-averaged first (the blur amount). Higher smears more.' },
      { name: 'tracing', label: 'Keep N loudest', min: 1, max: 64, default: 8, step: 1, help: 'How many of the loudest partials to keep after blurring. Fewer gives a thinner, purer result.' },
    ],
    blurb: 'Time-average the spectrum and then retain only the N loudest partials.',
  },
  {
    id: 'hilite.splow', label: 'Spectral low-pass', category: 'Spectral',
    program: 'hilite', domain: 'spectral', mono: false,
    args: ['filter', '3', '$IN', '$OUT', { p: 'freq' }, { p: 'q' }],
    params: [
      { name: 'freq', label: 'Cutoff (Hz)', min: 50, max: 16000, default: 2000, step: 10, help: 'Cutoff frequency; spectral energy above it is attenuated.' },
      { name: 'q', label: 'Skirt (Hz)', min: 1, max: 4000, default: 200, step: 10, help: 'Width of the filter skirt in Hz — how gradually it rolls off.' },
    ],
    blurb: 'Low-pass the spectrum (frequency-domain).',
  },
  {
    id: 'hilite.sphigh', label: 'Spectral high-pass', category: 'Spectral',
    program: 'hilite', domain: 'spectral', mono: false,
    args: ['filter', '1', '$IN', '$OUT', { p: 'freq' }, { p: 'q' }],
    params: [
      { name: 'freq', label: 'Cutoff (Hz)', min: 50, max: 16000, default: 800, step: 10, help: 'Cutoff frequency; spectral energy below it is attenuated.' },
      { name: 'q', label: 'Skirt (Hz)', min: 1, max: 4000, default: 200, step: 10, help: 'Width of the filter skirt in Hz — how gradually it rolls off.' },
    ],
    blurb: 'High-pass the spectrum (frequency-domain).',
  },
  {
    id: 'hilite.spband', label: 'Spectral band-pass', category: 'Spectral',
    program: 'hilite', domain: 'spectral', mono: false,
    args: ['filter', '7', '$IN', '$OUT', { p: 'freqlo' }, { p: 'freqhi' }, { p: 'q' }],
    params: [
      { name: 'freqlo', label: 'Low (Hz)', min: 50, max: 16000, default: 400, step: 10, help: 'Bottom of the passband, in Hz.' },
      { name: 'freqhi', label: 'High (Hz)', min: 80, max: 16000, default: 3000, step: 10, help: 'Top of the passband, in Hz.' },
      { name: 'q', label: 'Skirt (Hz)', min: 1, max: 4000, default: 200, step: 10, help: 'Width of the filter skirts in Hz.' },
    ],
    blurb: 'Band-pass the spectrum between two frequencies (frequency-domain).',
  },
  {
    id: 'hilite.spnotch', label: 'Spectral notch', category: 'Spectral',
    program: 'hilite', domain: 'spectral', mono: false,
    args: ['filter', '9', '$IN', '$OUT', { p: 'freqlo' }, { p: 'freqhi' }, { p: 'q' }],
    params: [
      { name: 'freqlo', label: 'Low (Hz)', min: 50, max: 16000, default: 400, step: 10, help: 'Bottom of the rejected band, in Hz.' },
      { name: 'freqhi', label: 'High (Hz)', min: 80, max: 16000, default: 3000, step: 10, help: 'Top of the rejected band, in Hz.' },
      { name: 'q', label: 'Skirt (Hz)', min: 1, max: 4000, default: 200, step: 10, help: 'Width of the filter skirts in Hz.' },
    ],
    blurb: 'Reject a band of the spectrum between two frequencies (frequency-domain notch).',
  },
  {
    id: 'hilite.pluck', label: 'Emphasise changes', category: 'Spectral',
    program: 'hilite', domain: 'spectral', mono: false,
    args: ['pluck', '$IN', '$OUT', { p: 'gain' }],
    params: [
      { name: 'gain', label: 'Gain', min: 0.5, max: 20, default: 4, step: 0.5, help: 'How strongly newly-prominent spectral components are boosted as the spectrum changes.' },
    ],
    blurb: 'Emphasise moments of spectral change (plucked/transient-like).',
  },
  {
    id: 'hilite.arpeg', label: 'Arpeggiate spectrum', category: 'Spectral',
    program: 'hilite', domain: 'spectral', mono: false,
    // The sweep hard-thresholds each channel against the swept band, so a
    // 1-ULP libm difference (glibc vs macOS/Emscripten sin()) flips whole
    // partials in or out of the band — native and WASM output can't be
    // byte-compared across platforms.
    parityExempt: 'band-edge thresholding amplifies platform libm differences',
    args: ['arpeg', '2', '$IN', '$OUT', { p: 'wave' }, { p: 'rate' }],
    params: [
      { name: 'wave', label: 'Sweep shape', min: 1, max: 4, default: 2, step: 1, help: 'Shape of the sweep through the spectrum: 1 down-ramp, 2 sine, 3 saw, 4 up-ramp.' },
      { name: 'rate', label: 'Rate (Hz)', min: 0.1, max: 20, default: 4, step: 0.1, help: 'How many times per second the boosted band sweeps across the spectrum.' },
    ],
    blurb: 'Sweep a boosted band up and down the spectrum, arpeggiating its partials.',
  },
  {
    id: 'hilite.band', label: 'Split-band gain', category: 'Spectral',
    program: 'hilite', domain: 'spectral', mono: false,
    // datafile lines: "lofrq hifrq bitflag amp". bitflag 1000 = amplitude change.
    // Two bands (below / above the split) get independent gain multipliers.
    args: ['band', '$IN', '$OUT', '$DATA'],
    data: (v) => `0 ${v.split} 1000 ${v.loamp}\n${v.split} 22050 1000 ${v.hiamp}\n`,
    params: [
      { name: 'split', label: 'Split (Hz)', min: 200, max: 8000, default: 1500, step: 50, help: 'Frequency dividing the spectrum into a low and a high band.' },
      { name: 'loamp', label: 'Low gain', min: 0, max: 4, default: 2, step: 0.1, help: 'Amplitude multiplier applied to the band below the split (1 = unchanged, 0 = silenced).' },
      { name: 'hiamp', label: 'High gain', min: 0, max: 4, default: 0.3, step: 0.1, help: 'Amplitude multiplier applied to the band above the split — a frequency-domain tilt/balance.' },
    ],
    blurb: 'Split the spectrum at a frequency and scale the low and high bands independently.',
  },
];
