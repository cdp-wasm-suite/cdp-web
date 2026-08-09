// Effect entry for CDP's `quirk` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'quirk.power', label: 'Power distort', category: 'Waveset distortion',
    program: 'quirk', domain: 'sound', mono: true,
    // mode 1 applies the power within each half-waveset, preserving the envelope.
    args: ['quirk', '1', '$IN', '$OUT', { p: 'powfac' }],
    params: [
      { name: 'powfac', label: 'Power', min: 0.05, max: 10, default: 0.4, step: 0.05, help: 'Sample values are raised to this power within each half wave-cycle. Below 1 exaggerates the contour, adding edge and grit; above 1 rounds it off and softens it. 1 leaves the sound unchanged.' },
    ],
    blurb: 'Raise the waveform to a power — below 1 adds grit, above 1 smooths.',
  },
];
