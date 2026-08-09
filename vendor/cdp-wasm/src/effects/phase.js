// Effect entry for CDP's `phase` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    // phase mode 2 only (mode 1, whole-file polarity flip, is inaudible alone).
    // At transfer=1 material common to both channels is fully cancelled — a
    // mono-derived stereo source nulls to silence — so the default is 0.7 and
    // the range is capped below 1.
    id: 'phase.stereo', label: 'Stereo enhance', category: 'Spatialisation',
    program: 'phase', domain: 'sound', input: 'stereo',
    args: ['phase', '2', '$IN', '$OUT', { p: 'transfer', flag: '-t' }],
    params: [
      { name: 'transfer', label: 'Amount', min: 0.1, max: 0.95, default: 0.7, step: 0.05, help: 'How much of the opposite channel is phase-cancelled out of each side. Higher widens the image more; at the top end the material common to both channels (the centre) starts to disappear.' },
    ],
    blurb: 'Widen a stereo image by phase-cancelling each channel out of the other.',
  },
];
