// Effect entries for CDP's `cantor` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'cantor.holes', label: 'Cantor holes (proportional)', category: 'Extend & segment',
    program: 'cantor', domain: 'sound', input: 'mono', multiOut: true, parityExempt: 'multi-file output; no single-command native comparison',
    args: ['set', '1', '$IN', '$OUT', { p: 'holesize' }, { p: 'depth' }, { p: 'trigger' }, { p: 'splice' }, { p: 'maxdur' }],
    params: [
      { name: 'holesize', label: 'Hole size (%)', min: 5, max: 90, default: 40, step: 1, help: 'Percentage of each segment cut away as a hole (proportional to segment length).' },
      { name: 'depth', label: 'Hole depth', min: 0.05, max: 1, default: 0.7, step: 0.05, help: 'How deep each cut goes as the hole is gradually created (0–1).' },
      { name: 'trigger', label: 'Trigger depth', min: 0.05, max: 1, default: 0.3, step: 0.05, help: 'Hole depth that triggers the next round of hole-cutting.' },
      { name: 'splice', label: 'Splice (ms)', min: 3, max: 50, default: 15, step: 1, help: 'Splice length at the hole edges, in milliseconds.' },
      { name: 'maxdur', label: 'Max total (s)', min: 2, max: 60, default: 30, step: 1, help: 'Maximum total duration across all the output files.' },
    ],
    blurb: 'Cantor-set erosion: cut a hole in the middle third, then in the pieces that remain, and so on — output is the growing sequence.',
  },
  {
    id: 'cantor.holesfixed', label: 'Cantor holes (fixed)', category: 'Extend & segment',
    program: 'cantor', domain: 'sound', input: 'mono', multiOut: true, parityExempt: 'multi-file output; no single-command native comparison',
    args: ['set', '2', '$IN', '$OUT', { p: 'holedur' }, { p: 'depth' }, { p: 'trigger' }, { p: 'splice' }, { p: 'maxdur' }],
    params: [
      { name: 'holedur', label: 'Hole length (s)', min: 0.02, max: 1, default: 0.2, step: 0.02, help: 'Fixed duration of each hole, in seconds (rather than proportional to the segment).' },
      { name: 'depth', label: 'Hole depth', min: 0.05, max: 1, default: 0.7, step: 0.05, help: 'How deep each cut goes as the hole is gradually created (0–1).' },
      { name: 'trigger', label: 'Trigger depth', min: 0.05, max: 1, default: 0.3, step: 0.05, help: 'Hole depth that triggers the next round of hole-cutting.' },
      { name: 'splice', label: 'Splice (ms)', min: 1, max: 50, default: 15, step: 1, help: 'Splice length at the hole edges, in milliseconds.' },
      { name: 'maxdur', label: 'Max total (s)', min: 2, max: 60, default: 30, step: 1, help: 'Maximum total duration across all the output files.' },
    ],
    blurb: 'Cantor-set erosion with fixed-length holes: the growing sequence of ever-more-perforated sounds.',
  },
  {
    id: 'cantor.vibrato', label: 'Cantor vibrato layers', category: 'Extend & segment',
    program: 'cantor', domain: 'sound', input: 'mono', multiOut: true, parityExempt: 'multi-file output; no single-command native comparison',
    args: ['set', '3', '$IN', '$OUT', { p: 'holelev' }, { p: 'repeats' }, { p: 'layers' }, { p: 'layerdec' }, { p: 'maxdur' }],
    params: [
      { name: 'holelev', label: 'Hole floor', min: 0, max: 0.9, default: 0.1, step: 0.05, help: 'Signal level at the base of the holes (0 = full cut).' },
      { name: 'repeats', label: 'Repeats to full', min: 2, max: 10, default: 3, step: 1, help: 'How many repeats before a hole reaches full depth.' },
      { name: 'layers', label: 'Vibrato layers', min: 1, max: 8, default: 2, step: 1, help: 'How many superimposed vibrato envelopes are used.' },
      { name: 'layerdec', label: 'Layer decay', min: 0.1, max: 1, default: 0.5, step: 0.05, help: 'Depth of each vibrato layer relative to the previous one.' },
      { name: 'maxdur', label: 'Max total (s)', min: 2, max: 60, default: 30, step: 1, help: 'Maximum total duration across all the output files.' },
    ],
    blurb: 'Cantor-set erosion driven by superimposed vibrato envelopes — a shimmering sequence of perforated sounds.',
  },
];
