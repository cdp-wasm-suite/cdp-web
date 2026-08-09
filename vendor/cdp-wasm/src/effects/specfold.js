// Effect entries for CDP's `specfold` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'specfold.fold', label: 'Spectral fold', category: 'Spectral',
    program: 'specfold', domain: 'spectral', mono: false,
    args: ['specfold', '1', '$IN', '$OUT', { p: 'stt' }, { p: 'len' }, { p: 'cnt' }],
    params: [
      { name: 'stt', label: 'Start channel', min: 1, max: 256, default: 1, step: 1, help: 'Lowest analysis channel of the group to fold (1 = bottom of the spectrum).' },
      { name: 'len', label: 'Channels', min: 4, max: 256, default: 64, step: 2, minOf: (v) => Number(v.cnt) + 2, help: 'How many analysis channels are folded. Must be even, and the group must fit under the top of the spectrum (512 channels).' },
      { name: 'cnt', label: 'Folds', min: 1, max: 32, default: 8, step: 1, help: 'How many times the group is folded over on itself. Must be fewer than the channel count.' },
    ],
    blurb: 'Fold a group of spectral channels over on itself, crossing frequency data.',
  },
  {
    id: 'specfold.randomise', label: 'Scramble spectral channels', category: 'Spectral',
    program: 'specfold', domain: 'spectral', mono: false,
    // Same seed reproduces the same permutation per platform, but rand() differs
    // between glibc (native) and Emscripten's musl — exempt from byte parity.
    parityExempt: 'seeded RNG (rand) differs across platforms',
    args: ['specfold', '3', '$IN', '$OUT', { p: 'stt' }, { p: 'len' }, { p: 'seed' }],
    params: [
      { name: 'stt', label: 'Start channel', min: 1, max: 256, default: 1, step: 1, help: 'Lowest analysis channel of the group to scramble (1 = bottom of the spectrum).' },
      { name: 'len', label: 'Channels', min: 4, max: 256, default: 128, step: 1, help: 'How many analysis channels are scrambled. The group must fit under the top of the spectrum (512 channels).' },
      { name: 'seed', label: 'Seed', min: 1, max: 64, default: 1, step: 1, help: 'Chooses which random channel permutation is used; the same seed always gives the same scramble.' },
    ],
    blurb: 'Randomly permute a group of spectral channels, scattering frequency data.',
  },
];
