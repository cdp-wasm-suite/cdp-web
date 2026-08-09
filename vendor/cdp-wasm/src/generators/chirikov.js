// Generator entry for CDP's `chirikov` program. Entry shape: see the
// header comment in ../generators.js.

export default [
  // No docUrl: chirikov has no section in the CDP HTML reference (neither the
  // Release 8 zip nor the live site's index mentions it).
  { id: 'chirikov', label: 'Chaotic (Chirikov)', category: 'Synthesis', program: 'chirikov', mode: ['chirikov'],
    args: ['chirikov', '1', '$OUT', { p: 'dur' }, { p: 'frq' }, { p: 'damping' }, '$SR', { p: 'splice' }],
    params: [
      { name: 'dur', label: 'Duration (s)', min: 0.1, max: 20, default: 2, step: 0.1 },
      { name: 'frq', label: 'Frequency', min: 20, max: 4000, default: 220, step: 1, env: true },
      { name: 'damping', label: 'Damping', min: 0, max: 1, default: 0, step: 0.05, env: true },
      { name: 'splice', label: 'Splice (ms)', min: 1, max: 50, default: 5, step: 1 },
    ],
    parityExempt: 'chaotic (FP-divergent)',
    blurb: 'Potentially chaotic Chirikov standard-map synthesis.' },
];
