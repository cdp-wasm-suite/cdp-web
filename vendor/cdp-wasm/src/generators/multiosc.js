// Generator entry for CDP's `multiosc` program. Entry shape: see the
// header comment in ../generators.js.

export default [
  { id: 'multiosc', label: 'Nested oscillator', category: 'Synthesis', program: 'multiosc', mode: ['multiosc'],
    args: ['multiosc', '1', '$OUT', { p: 'dur' }, { p: 'frq1' }, { p: 'frq2' }, { p: 'amp2' }, '$SR', { p: 'splice' }],
    params: [
      { name: 'dur', label: 'Duration (s)', min: 0.1, max: 20, default: 2, step: 0.1 },
      { name: 'frq1', label: 'Frequency 1', min: 20, max: 4000, default: 220, step: 1, env: true },
      { name: 'frq2', label: 'Sub-osc rate', min: 0.1, max: 200, default: 5, step: 0.1, env: true },
      { name: 'amp2', label: 'Sub-osc depth', min: 0, max: 1, default: 0.5, step: 0.05 },
      { name: 'splice', label: 'Splice (ms)', min: 1, max: 50, default: 5, step: 1 },
    ],
    docUrl: 'https://www.composersdesktop.com/docs/html/cgrosynt.htm#MULTIOSC',
    blurb: 'An oscillation modulated by a nested oscillation.' },
];
