// Effect entry for CDP's `scramble` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'scramble.scramble', label: 'Waveset scramble', category: 'Waveset distortion',
    program: 'scramble', domain: 'sound', mono: true,
    // Uses a seeded RNG; rand() differs between glibc (native) and Emscripten's
    // musl, so native and WASM diverge — exempt from the byte-exact parity check.
    parityExempt: 'seeded RNG (rand) differs across platforms',
    args: ['scramble', '1', '$IN', '$OUT', { p: 'dur' }, '0'],
    params: [{ name: 'dur', label: 'Duration (s)', min: 1, max: 10, default: 3, step: 0.5, help: 'Length of the output, in seconds. Wave-segments are pulled from the source at random to fill it.' }],
    blurb: 'Randomly reorder wavesets from the source.',
  },
];
