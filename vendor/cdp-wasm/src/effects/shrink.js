// Effect entry for CDP's `shrink` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'shrink.shrink', label: 'Shrinking repeats', category: 'Extend & segment',
    program: 'shrink', domain: 'sound', mono: false,
    // mode 1 shrinks each repeat from its end, keeping the attack. Ranges are
    // chosen so Closing up >= Shrink always holds (CDP errors otherwise).
    args: ['shrink', '1', '$IN', '$OUT', { p: 'shrinkage' }, { p: 'gap' }, { p: 'contract' }, { p: 'dur' }, { p: 'splice' }],
    params: [
      { name: 'shrinkage', label: 'Shrink ×', min: 0.3, max: 0.85, default: 0.8, step: 0.05, help: 'How much shorter each repeat is than the one before. 0.8 makes every repeat 80% the length of the last; lower shrinks faster.' },
      { name: 'gap', label: 'Gap (s)', min: 0.5, max: 10, default: 3, step: 0.1, help: 'Time from the start of one repeat to the next at the outset, in seconds. Must be at least the length of the source sound.' },
      { name: 'contract', label: 'Closing up', min: 0.85, max: 1, default: 0.9, step: 0.01, help: 'How the gaps between repeats close as they shrink. 1 keeps them evenly spaced; lower pulls the repeats closer and closer together.' },
      { name: 'dur', label: 'Output (s)', min: 4, max: 30, default: 10, step: 0.5, help: 'Minimum length of the output, in seconds. Needs to be at least twice the length of the source sound.' },
      { name: 'splice', label: 'Splice (ms)', min: 5, max: 50, default: 15, step: 1, help: 'Crossfade at the edges of each repeat, in milliseconds. Shrinking stops once repeats get too short to splice.' },
    ],
    blurb: 'Repeat the sound with each repeat shorter than the last, closing up as it goes.',
  },
];
