// Effect entry for CDP's `ceracu` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'ceracu.cycles', label: 'Resync cycles', category: 'Spatialisation',
    program: 'ceracu', domain: 'sound', input: 'mono', setsChannels: true,
    // The datafile lists the repeat-counts of the cyclestreams. The counts must
    // be distinct integers, so cycle2 is bumped above cycle1 when they collide.
    // mincycdur 0 = use the source duration; outdur 0 = one resync cycle
    // (roughly source-duration x the larger count); echshift is ignored when
    // echo is 0.
    args: ['ceracu', '$IN', '$OUT', '$DATA', { p: 'mincycdur' }, { p: 'chans' }, { p: 'outdur' }, { p: 'echo' }, { p: 'echshift' }],
    data: (v) => {
      const a = Math.round(v.cycle1);
      const b0 = Math.round(v.cycle2);
      return `${a} ${b0 <= a ? a + 1 : b0}\n`;
    },
    params: [
      { name: 'cycle1', label: 'Repeats A', min: 1, max: 7, default: 2, step: 1, help: 'How many times the first cyclestream repeats the source before the streams resynchronise.' },
      { name: 'cycle2', label: 'Repeats B', min: 2, max: 8, default: 3, step: 1, help: 'Repeats in the second cyclestream. Must differ from stream A — equal values are bumped up by one.' },
      { name: 'mincycdur', label: 'Fast cycle (s)', min: 0, max: 2, default: 0, step: 0.1, help: 'Time before the first repeat in the fastest stream, in seconds. 0 uses the source duration (streams overlap densely).' },
      { name: 'chans', label: 'Out channels', min: 1, max: 8, default: 2, step: 1, help: 'Number of output channels the cyclestreams are placed across.' },
      { name: 'outdur', label: 'Duration (s)', min: 0, max: 12, default: 0, step: 0.5, help: 'Requested output length, in seconds — always rounded up to whole resync cycles. 0 gives exactly one cycle (about the source length times the larger repeat count).' },
      { name: 'echo', label: 'Echo (s)', min: 0, max: 1, default: 0, step: 0.05, help: 'Delay of a single echo of the whole output, in seconds. 0 for no echo.' },
      { name: 'echshift', label: 'Echo shift', min: -4, max: 4, default: 1, step: 1, help: 'How many channels to the right (negative = left) the echo is displaced. Ignored when there is no echo.' },
    ],
    blurb: 'Repeat the source in phasing cyclestreams that drift apart and resynchronise across the output channels (Reich-style phase loops).',
  },
];
