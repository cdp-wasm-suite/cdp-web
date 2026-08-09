// Effect entry for CDP's `hover2` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    // frqrand/locrand hard-coded 0 (deterministic; non-zero values use the
    // platform RNG). loc is a TIME IN SECONDS in the source (not a fraction):
    // values at/past the source end error or produce an empty file.
    id: 'hover2.hover2', label: 'Hover 2 (symmetric zigzag)', category: 'Granular',
    program: 'hover2', domain: 'sound', mono: true,
    args: ['hover2', '$IN', '$OUT', { p: 'frq' }, { p: 'loc' }, '0', '0', { p: 'dur' }],
    params: [
      { name: 'frq', label: 'Read rate (Hz)', min: 20, max: 1000, default: 200, step: 5, help: 'How fast the read-point zigzags back and forth over the chosen spot (Hz). This rate becomes the perceived pitch.' },
      { name: 'loc', label: 'Read point (s)', min: 0, max: 10, default: 0.5, step: 0.05, help: 'Time in the source, in seconds, the zigzag read hovers around. Must lie inside the source — at or past its end there is nothing to read.' },
      { name: 'dur', label: 'Duration (s)', min: 0.5, max: 6, default: 2, step: 0.5, help: 'Length of the output, in seconds.' },
    ],
    blurb: 'Hover over a point in the file, zigzag-reading it into symmetrical zero-centred waveforms.',
  },
];
