// Effect entry for CDP's `abfpan` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    // `abfpan` (portsf external) pans a MONO source into 1st-order B-format
    // (4ch: W,X,Y,Z) — `input: 'mono'` conforms the source and frees the test
    // from a preserved-channel assertion.
    id: 'abfpan.bformat', label: 'B-format pan', category: 'Spatialisation',
    program: 'abfpan', domain: 'sound', input: 'mono', external: true,
    args: ['$IN', '$OUT', { p: 'startpos' }, { p: 'endpos' }],
    params: [
      { name: 'startpos', label: 'Start pos', min: 0, max: 1, default: 0, step: 0.05, help: 'Start position around the circle: 0 (and 1) = centre front, 0.5 = rear.' },
      { name: 'endpos', label: 'End pos', min: -1, max: 1, default: 1, step: 0.05, help: 'End position; the sign sets rotation direction (negative = anticlockwise, positive = clockwise).' },
    ],
    blurb: 'Pan a mono source into 1st-order B-format (4-channel ambisonic W/X/Y/Z), optionally rotating.',
  },
];
