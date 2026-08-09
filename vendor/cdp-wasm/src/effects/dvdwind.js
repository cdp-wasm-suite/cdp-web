// Effect entry for CDP's `dvdwind` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'dvdwind.dvdwind', label: 'Fast wind', category: 'Extend & segment',
    program: 'dvdwind', domain: 'sound', mono: false,
    args: ['dvdwind', '$IN', '$OUT', { p: 'contraction' }, { p: 'clipsize' }],
    params: [
      { name: 'contraction', label: 'Contract ×', min: 1.1, max: 16, default: 2, step: 0.1, help: 'How much shorter the result is. 2 roughly halves the length by skipping ahead between the kept clips.' },
      { name: 'clipsize', label: 'Clip (ms)', min: 10, max: 500, default: 20, step: 5, help: 'Length of each kept snippet, in milliseconds. Short clips give a fluttery scan; long clips sound like jump-cuts.' },
    ],
    blurb: 'Shorten the sound by keeping small clips and skipping between them (fast-wind scan).',
  },
];
