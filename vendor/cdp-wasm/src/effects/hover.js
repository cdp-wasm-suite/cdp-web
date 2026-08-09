// Effect entry for CDP's `hover` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'hover.hover', label: 'Hover (zigzag read)', category: 'Granular',
    program: 'hover', domain: 'sound', mono: true,
    args: ['hover', '$IN', '$OUT', { p: 'frq' }, '0.5', '0', '0', '0.005', { p: 'dur' }],
    params: [
      { name: 'frq', label: 'Read rate (Hz)', min: 20, max: 1000, default: 200, step: 5, help: 'How fast the read-point zigzags back and forth over the chosen spot (Hz). This rate becomes the perceived pitch.' },
      { name: 'dur', label: 'Duration (s)', min: 0.5, max: 6, default: 2, step: 0.5, help: 'Length of the output, in seconds.' },
    ],
    blurb: 'Hover over a point in the file, zigzag-reading it at a frequency.',
  },
];
