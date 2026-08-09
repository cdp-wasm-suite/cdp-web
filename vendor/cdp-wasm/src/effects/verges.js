// Effect entry for CDP's `verges` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'verges.verges', label: 'Verge glisses', category: 'Pitch & time',
    program: 'verges', domain: 'sound', mono: false,
    // The datafile lists verge-attack times, one per line. The program needs
    // the gap between times (and to the end of the file) to exceed ~0.75x the
    // gliss duration, so the dur max (150ms) stays under the spacing minimum
    // (0.2s); times must also stay inside the source (a time past the end is
    // an error, not ignored) — the defaults fit a 1s source.
    args: ['verges', '$IN', '$OUT', '$DATA', { p: 'transp', flag: '-t' }, { p: 'exp', flag: '-e' }, { p: 'dur', flag: '-d' }],
    data: (v) => Array.from({ length: Math.round(v.count) }, (_, i) => ((i + 1) * v.spacing).toFixed(3)).join('\n') + '\n',
    params: [
      { name: 'count', label: 'Verges', min: 1, max: 3, default: 3, step: 1, help: 'How many gliss attacks are placed in the sound.' },
      { name: 'spacing', label: 'Every (s)', min: 0.2, max: 0.6, default: 0.25, step: 0.05, help: 'Spacing of the verge attacks, in seconds. All attacks must fall inside the sound, with room for the gliss before the end.' },
      { name: 'transp', label: 'Gliss from (st)', min: -12, max: 12, default: 5, step: 1, help: 'Transposition at the start of each verge, in semitones. Positive glisses down onto the pitch from above; negative swoops up from below.' },
      { name: 'exp', label: 'Slope', min: 1, max: 8, default: 1, step: 0.5, help: 'Curve of the gliss. Higher values gliss faster at the start.' },
      { name: 'dur', label: 'Gliss (ms)', min: 30, max: 150, default: 100, step: 10, help: 'Duration of each gliss, in milliseconds. Must stay well under the spacing between verges.' },
    ],
    blurb: 'Play the source with brief pitch-gliss "verges" swooping onto chosen moments.',
  },
];
