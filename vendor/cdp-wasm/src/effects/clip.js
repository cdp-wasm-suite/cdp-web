// Effect entries for CDP's `clip` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'clip.clip', label: 'Clip', category: 'Filter & dynamics',
    program: 'clip', domain: 'sound', mono: false,
    args: ['clip', '1', '$IN', '$OUT', { p: 'level' }],
    params: [{ name: 'level', label: 'Clip level', min: 0.01, max: 1, default: 0.3, step: 0.01, help: 'Amplitude at which the signal is flattened (0–1). Lower clips more of the waveform, giving harder, dirtier distortion.' }],
    blurb: 'Hard-clip the signal at the given level (distortion).',
  },
  {
    id: 'clip.half', label: 'Clip half-waves', category: 'Filter & dynamics',
    program: 'clip', domain: 'sound', mono: true,
    args: ['clip', '2', '$IN', '$OUT', { p: 'fraction' }],
    params: [{ name: 'fraction', label: 'Fraction', min: 0.01, max: 1, default: 0.5, step: 0.01, help: 'Each half-waveform is clipped at this fraction of its own peak. Lower flattens more, giving a squarer, dirtier tone.' }],
    blurb: 'Clip each half-waveform at a fraction of its own peak (level-following distortion).',
  },
];
