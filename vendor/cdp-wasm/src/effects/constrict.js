// Effect entry for CDP's `constrict` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'constrict.constrict', label: 'Tighten silences', category: 'Extend & segment',
    program: 'constrict', domain: 'sound', mono: false,
    args: ['constrict', '$IN', '$OUT', { p: 'constriction' }],
    params: [
      { name: 'constriction', label: 'Tighten by (%)', min: 0, max: 200, default: 100, step: 5, help: 'How much to shorten the silent gaps in the sound. 100 removes them entirely; above 100 overlaps the sound either side of each gap; 0 leaves them unchanged.' },
    ],
    blurb: 'Shorten (or close up) the silent gaps in a sound, tightening its rhythm.',
  },
];
