// Effect entries for CDP's `specnu` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'specnu.rand', label: 'Randomise window order', category: 'Spectral',
    program: 'specnu', domain: 'spectral', mono: false,
    // The shuffle is internally seeded (byte-identical across runs on one
    // platform) but rand() differs native vs WASM — exempt from byte parity.
    parityExempt: 'seeded RNG (rand) differs across platforms',
    // -t timescale (local shuffle span, seconds) deliberately omitted: its legal
    // range tops out at the source duration, so any fixed default breaks short clips.
    args: ['rand', '$IN', '$OUT', { p: 'grouping', flag: '-g' }],
    params: [
      { name: 'grouping', label: 'Grouping', min: 1, max: 32, default: 1, step: 1, help: 'Consecutive analysis windows are kept together in sets of this size when the time-order is shuffled. 1 scrambles every window independently.' },
    ],
    blurb: 'Shuffle the time-order of the analysis windows, scrambling the sound’s evolution.',
  },
  {
    id: 'specnu.squeeze', label: 'Spectral squeeze', category: 'Spectral',
    program: 'specnu', domain: 'spectral', mono: false,
    args: ['squeeze', '$IN', '$OUT', { p: 'centrefrq' }, { p: 'squeeze' }],
    params: [
      { name: 'centrefrq', label: 'Centre (Hz)', min: 20, max: 8000, default: 500, step: 10, help: 'The frequency the spectrum is squeezed towards; energy gathers around here.' },
      { name: 'squeeze', label: 'Squeeze', min: 0.05, max: 0.95, default: 0.5, step: 0.05, help: 'How strongly the spectrum is compressed towards the centre: lower squeezes harder (darker, narrower); values near 1 barely squeeze.' },
    ],
    blurb: 'Compress the whole spectrum in frequency around a centre, narrowing its range.',
  },
  {
    id: 'specnu.remove', label: 'Remove a pitch', category: 'Spectral',
    program: 'specnu', domain: 'spectral', mono: false,
    // mode 1 removes the found pitch and its harmonics; mode 2 would keep only them.
    args: ['remove', '1', '$IN', '$OUT', { p: 'midimin' }, { p: 'midimax' }, { p: 'rangetop' }, { p: 'atten' }],
    params: [
      { name: 'midimin', label: 'Low pitch (MIDI)', min: 0, max: 127, default: 56, step: 1, help: 'Bottom of the pitch range to hunt for and remove, as a MIDI note number.' },
      { name: 'midimax', label: 'High pitch (MIDI)', min: 0, max: 127, default: 58, step: 1, help: 'Top of the pitch range to remove. Keep the range narrow (under an octave), or everything between the low pitch and the search top is stripped.' },
      { name: 'rangetop', label: 'Search top (Hz)', min: 1000, max: 16000, default: 4000, step: 100, help: 'Harmonics of the found pitch are removed up to this frequency. Must sit above the pitch range itself.' },
      { name: 'atten', label: 'Attenuation', min: 0.1, max: 1, default: 1, step: 0.05, help: 'How completely the found pitch and its harmonics are suppressed: 1 removes them fully, lower values only turn them down.' },
    ],
    blurb: 'Find a pitch in the spectrum and strip it and its harmonics away.',
  },
];
