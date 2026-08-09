// Effect entry for CDP's `mchanpan` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    // mode 4: spread a mono source gradually from a centre channel across the
    // output. `setsChannels` — output width is the `chans` param, not the input.
    id: 'mchanpan.spread', label: 'Multichannel spread', category: 'Spatialisation',
    program: 'mchanpan', domain: 'sound', input: 'mono', setsChannels: true,
    args: ['mchanpan', '4', '$IN', '$OUT', { p: 'chans' }, { p: 'centre' }, { p: 'spread' }, { p: 'depth' }, { p: 'rolloff' }],
    params: [
      { name: 'chans', label: 'Out channels', min: 3, max: 8, default: 4, step: 1, help: 'Number of output channels the source is spread across.' },
      { name: 'centre', label: 'Centre channel', min: 1, max: 8, default: 1, step: 1, maxOf: (v) => Number(v.chans), help: 'The channel the spread radiates out from (1 = first channel). Must not exceed the output channel count.' },
      { name: 'spread', label: 'Spread (chans)', min: 0, max: 16, default: 8, step: 1, help: 'How far, in channels, the sound spreads to either side of the centre. 0 keeps it at the centre.' },
      { name: 'depth', label: 'Depth (chans)', min: 0, max: 8, default: 4, step: 1, help: 'Maximum number of channels filled behind the leading edge on each side.' },
      { name: 'rolloff', label: 'Rolloff', min: 0, max: 1, default: 0.5, step: 0.05, help: 'How much the level falls as the signal spreads over more channels (0 = no fall, 1 = strong).' },
    ],
    blurb: 'Spread a mono source outward from a centre channel across a multichannel field.',
  },
];
