// Effect entries for CDP's `distshift` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'distshift.1', label: 'Half-cycle shift', category: 'Waveset distortion',
    program: 'distshift', domain: 'sound', mono: true,
    // Output differs slightly between native and WASM (platform-dependent edge
    // handling), so it is exempt from the byte-exact parity check.
    parityExempt: 'platform-dependent edge handling',
    args: ['distshift', '1', '$IN', '$OUT', { p: 'grpcnt' }, { p: 'shift' }],
    params: [
      { name: 'grpcnt', label: 'Group size', min: 1, max: 20, default: 4, step: 1, help: 'Half-wave-cycles are handled in groups of this many.' },
      { name: 'shift', label: 'Shift', min: 1, max: 10, default: 2, step: 1, help: 'How many half-cycles each alternate group is nudged forward in time. Larger gives a stronger smearing.' },
    ],
    blurb: 'Shift alternate groups of half-wavecycles forward in time.',
  },
  {
    id: 'distshift.swap', label: 'Half-cycle swap', category: 'Waveset distortion',
    program: 'distshift', domain: 'sound', mono: true,
    parityExempt: 'platform-dependent edge handling',
    args: ['distshift', '2', '$IN', '$OUT', { p: 'grpcnt' }],
    params: [
      { name: 'grpcnt', label: 'Group size', min: 1, max: 20, default: 4, step: 1, help: 'Half-wave-cycles are handled in groups of this many; alternate groups are swapped with each other.' },
    ],
    blurb: 'Swap alternate groups of half-wavecycles.',
  },
];
