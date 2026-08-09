// Effect entry for CDP's `sfecho` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'sfecho.echo', label: 'Echoes', category: 'Delay & reverb',
    program: 'sfecho', domain: 'sound', mono: false,
    // Discrete echoes: CDP requires delay >= source duration (repeats never overlap).
    args: ['echo', '$IN', '$OUT', { p: 'delay' }, { p: 'atten' }, { p: 'dur' }, { p: 'rand', flag: '-r' }],
    params: [
      { name: 'delay', label: 'Delay (s)', min: 0.5, max: 10, default: 3, step: 0.5, help: 'Time between echo repeats, in seconds. The echoes never overlap, so this must be at least the length of the source sound.' },
      { name: 'atten', label: 'Decay', min: 0.1, max: 0.95, default: 0.5, step: 0.05, help: 'Level of each echo relative to the one before (0–1). Higher keeps the echoes going for longer.' },
      { name: 'dur', label: 'Max length (s)', min: 4, max: 30, default: 12, step: 1, help: 'Longest the output can be, in seconds. The echoes stop here, or earlier once they have died away.' },
      { name: 'rand', label: 'Time scatter', min: 0, max: 1, default: 0, step: 0.05, help: 'Random variation in the echo timing (0–1). 0 keeps the repeats perfectly regular.' },
    ],
    blurb: 'Discrete, non-overlapping echoes of the whole sound, dying away.',
  },
];
