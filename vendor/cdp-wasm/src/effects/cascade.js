// Effect entry for CDP's `cascade` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'cascade.cascade', label: 'Cascade echoes', category: 'Extend & segment',
    program: 'cascade', domain: 'sound', mono: false,
    // Uses a seeded RNG for echo-time randomisation; rand() differs between
    // glibc (native) and Emscripten's musl — exempt from byte-exact parity.
    parityExempt: 'seeded RNG (rand) differs across platforms',
    args: ['cascade', '1', '$IN', '$OUT', { p: 'clipsize' }, { p: 'echos' }, { p: 'clipmax' }, { p: 'rand', flag: '-r' }, '-s1'],
    params: [
      { name: 'clipsize', label: 'Clip (s)', min: 0.02, max: 1, default: 0.25, step: 0.01, help: 'Length of the successive source segments that are echoed, in seconds.' },
      { name: 'echos', label: 'Echoes', min: 1, max: 64, default: 8, step: 1, help: 'Number of echoes in each echo-set.' },
      { name: 'clipmax', label: 'Clip max (s)', min: 0, max: 2, default: 0, step: 0.05, help: 'If above zero, each clip length is randomised between "Clip" and this maximum. 0 keeps clips a fixed size.' },
      { name: 'rand', label: 'Randomise', min: 0, max: 1, default: 0.3, step: 0.05, help: 'Random variation of the time-steps between echoes. 0 is perfectly regular.' },
    ],
    blurb: 'Echo successive segments of the source and superimpose the echo-sets.',
  },
];
