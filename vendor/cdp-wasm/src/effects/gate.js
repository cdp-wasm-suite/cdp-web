// Effect entries for CDP's `gate` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'gate.gate', label: 'Noise gate', category: 'Filter & dynamics',
    program: 'gate', domain: 'sound', mono: true,
    args: ['gate', '1', '$IN', '$OUT', { p: 'level' }],
    params: [{ name: 'level', label: 'Threshold (dB)', min: -96, max: 0, default: -30, step: 1, help: 'Anything quieter than this is silenced. Higher (closer to 0) gates more aggressively; lower lets more through.' }],
    blurb: 'Replace sound below the threshold with silence.',
  },
  {
    id: 'gate.edit', label: 'Gate (remove gaps)', category: 'Filter & dynamics',
    program: 'gate', domain: 'sound', mono: true,
    args: ['gate', '2', '$IN', '$OUT', { p: 'level' }],
    params: [{ name: 'level', label: 'Threshold (dB)', min: -96, max: 0, default: -30, step: 1, help: 'Sound below this level is edited out (removed) rather than silenced, shortening the file.' }],
    blurb: 'Edit out (delete) the stretches quieter than the threshold, shortening the sound.',
  },
];
