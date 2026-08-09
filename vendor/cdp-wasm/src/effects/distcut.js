// Effect entry for CDP's `distcut` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'distcut.envelope', label: 'Cut to enveloped grains', category: 'Extend & segment',
    program: 'distcut', domain: 'sound', input: 'mono', multiOut: true, parityExempt: 'multi-file output; no single-command native comparison',
    args: ['distcut', '1', '$IN', '$OUT', { p: 'cyclecnt' }, { p: 'decay' }],
    params: [
      { name: 'cyclecnt', label: 'Wavesets per grain', min: 1, max: 64, default: 8, step: 1, help: 'How many wavesets make up each output grain. Fewer gives shorter, more numerous grains.' },
      { name: 'decay', label: 'Decay shape', min: 0.2, max: 4, default: 1, step: 0.1, help: 'Falling-envelope shape applied to each grain. 1 is linear; above 1 decays faster, below 1 slower.' },
    ],
    blurb: 'Chop a mono sound into a sequence of separate waveset-grains, each with a falling envelope.',
  },
];
