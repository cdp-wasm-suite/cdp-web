// Effect entry for CDP's `envcut` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'envcut.envelope', label: 'Cut to enveloped slices', category: 'Extend & segment',
    program: 'envcut', domain: 'sound', input: 'mono', multiOut: true, parityExempt: 'multi-file output; no single-command native comparison',
    // envcut reads the slice length (seconds) BEFORE the attack (ms) — the
    // opposite of the order printed in its usage text (verified against the
    // source's ECUT_CNT/ECUT_ATT param ranges and by measuring output durations).
    args: ['envcut', '1', '$IN', '$OUT', { p: 'slicelen' }, { p: 'attack' }, { p: 'decay' }],
    params: [
      { name: 'slicelen', label: 'Slice length (s)', min: 0.02, max: 2, default: 0.2, step: 0.02, help: 'Duration of each output slice, in seconds. Shorter gives more, briefer files.' },
      { name: 'attack', label: 'Attack (ms)', min: 0.5, max: 50, default: 5, step: 0.5, help: 'Attack time of each slice, in milliseconds. Must stay under half the slice length.' },
      { name: 'decay', label: 'Decay shape', min: 0.2, max: 4, default: 1, step: 0.1, help: 'Falling-envelope shape applied to each slice. 1 is linear; above 1 decays faster.' },
    ],
    blurb: 'Chop a mono sound into a sequence of separate fixed-length slices, each with a falling envelope.',
  },
];
