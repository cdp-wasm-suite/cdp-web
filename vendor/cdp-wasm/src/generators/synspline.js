// Generator entry for CDP's `synspline` program. Entry shape: see the
// header comment in ../generators.js.

export default [
  // The spline points have to fit inside one wavecycle: synspline rejects a
  // count above (samplerate / 4) / frq. The bound assumes 44.1k — the usual
  // session rate — so at a higher rate it is merely conservative, never wrong.
  { id: 'synspline', label: 'Spline synth', category: 'Synthesis', program: 'synspline', mode: ['synspline'],
    args: ['synspline', '$OUT', '$SR', { p: 'dur' }, { p: 'frq' }, { p: 'splinecnt' }, { p: 'interp' }, { p: 'seed' }],
    params: [
      { name: 'dur', label: 'Duration (s)', min: 0.1, max: 20, default: 2, step: 0.1 },
      { name: 'frq', label: 'Frequency', min: 20, max: 4000, default: 220, step: 1, maxOf: (v) => (Number(v.splinecnt) > 0 ? 44100 / (4 * Number(v.splinecnt)) : Infinity), env: true },
      { name: 'splinecnt', label: 'Spline points', min: 0, max: 64, default: 8, step: 1, maxOf: (v) => Math.floor(44100 / (4 * Number(v.frq))), env: true },
      { name: 'interp', label: 'Morph wavecycles', min: 0, max: 200, default: 2, step: 1, env: true },
      { name: 'seed', label: 'Seed', min: 1, max: 64, default: 1, step: 1 },
    ],
    parityExempt: 'rand()',
    docUrl: 'https://www.composersdesktop.com/docs/html/cgrosynt.htm#SYNSPLINE',
    blurb: 'Evolving timbres from smoothly-joined random points.' },
];
