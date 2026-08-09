// Effect entry for CDP's `spectstr` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'spectstr.stretch', label: 'Time stretch (smooth)', category: 'Pitch & time',
    program: 'spectstr', domain: 'spectral', mono: false,
    parityExempt: 'randomises discohered channel frequencies (rand)',
    // NB: the program's own usage text shows a literal 'time' token after
    // 'stretch', but that fails ("Failed tp parse input file time") — the real
    // argv has no mode token.
    args: ['stretch', '$IN', '$OUT', { p: 'stretch' }, { p: 'dratio' }, { p: 'dirand' }],
    params: [
      { name: 'stretch', label: 'Stretch ×', min: 0.25, max: 8, default: 2, step: 0.25, help: 'How much longer to make the sound. 2 is twice as long, 0.5 half. The pitch stays the same.' },
      { name: 'dratio', label: 'Discohere amount', min: 0, max: 1, default: 0.5, step: 0.05, help: 'Proportion of spectral channels whose phase-locking is broken up. Higher hides more of the metallic ringing typical of long stretches.' },
      { name: 'dirand', label: 'Discohere random', min: 0, max: 1, default: 0.5, step: 0.05, help: 'How much the loosened channels are randomised in frequency. Higher gives a softer, airier stretch.' },
    ],
    blurb: 'Phase-vocoder time-stretch that breaks up channel coherence to suppress the usual stretch artefacts.',
  },
];
