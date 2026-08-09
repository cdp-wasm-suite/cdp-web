// Effect entries for CDP's `envspeak` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'envspeak.repeat', label: 'Repeat syllables', category: 'Extend & segment',
    program: 'envspeak', domain: 'sound', mono: true, prefersGrains: true,
    args: ['envspeak', '1', '$IN', '$OUT', { p: 'wsize' }, { p: 'splice' }, { p: 'offset' }, { p: 'repet' }, { p: 'rand' }],
    params: [
      { name: 'wsize', label: 'Window (ms)', min: 10, max: 200, default: 50, step: 5, help: 'Size of the envelope-search window, in milliseconds — sets the scale of the "syllables" the process detects.' },
      { name: 'splice', label: 'Splice (ms)', min: 2, max: 50, default: 15, step: 1, help: 'Crossfade length at each cut, in milliseconds. Longer is smoother but blurs short syllables.' },
      { name: 'offset', label: 'Skip syllables', min: 0, max: 8, default: 0, step: 1, help: 'Number of initial syllables to pass through unchanged before the repeating begins.' },
      { name: 'repet', label: 'Repeats', min: 2, max: 8, default: 3, step: 1, help: 'How many times each syllable is heard.' },
      { name: 'rand', label: 'Randomise', min: 0, max: 1, default: 0, step: 0.05, help: 'Randomly varies the lengths of the repeated units (0 = none). Non-zero values can give a different result on every run.' },
    ],
    blurb: 'Detect speech-like syllables and repeat each one (stutter). Needs articulated, speech-like input.',
  },
  {
    // mode 11: srand(seed)-driven rand() permutation → parity-exempt. The seed
    // shares the OFFSET param slot in envspeak.c, so CDP rejects seeds >=
    // (detected syllables - 2); keep the range small and the default at 1.
    id: 'envspeak.shuffle', label: 'Shuffle syllables', category: 'Extend & segment',
    program: 'envspeak', domain: 'sound', mono: true, prefersGrains: true,
    parityExempt: 'seeded RNG (rand) differs across platforms',
    args: ['envspeak', '11', '$IN', '$OUT', { p: 'wsize' }, { p: 'splice' }, { p: 'seed' }],
    params: [
      { name: 'wsize', label: 'Window (ms)', min: 10, max: 200, default: 50, step: 5, help: 'Size of the envelope-search window, in milliseconds — sets the scale of the "syllables" the process detects.' },
      { name: 'splice', label: 'Splice (ms)', min: 2, max: 50, default: 15, step: 1, help: 'Crossfade length at each cut, in milliseconds. Longer is smoother but blurs short syllables.' },
      { name: 'seed', label: 'Seed', min: 1, max: 8, default: 1, step: 1, help: 'Picks which random order is used; the same seed always gives the same order. Seeds larger than the number of syllables found (minus 2) are rejected.' },
    ],
    blurb: 'Detect speech-like syllables and reorder them at random (repeatable per seed). Needs articulated input.',
  },
];
