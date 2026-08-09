// Effect entry for CDP's `mchanrev` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    // "Stadium" echoes: average echo spacing is 0.1s x size, so the tail is
    // roughly size*0.1*count seconds long.
    id: 'mchanrev.stadium', label: 'Multichannel echoes', category: 'Delay & reverb',
    program: 'mchanrev', domain: 'sound', input: 'mono', setsChannels: true,
    parityExempt: 'seeded RNG (rand) differs across platforms',
    args: ['mchanrev', '$IN', '$OUT', { p: 'gain' }, { p: 'rolloff' }, { p: 'size' }, { p: 'count' },
      { p: 'chans' }, { p: 'centre' }, { p: 'spread' }],
    params: [
      { name: 'gain', label: 'Input gain', min: 0.1, max: 1, default: 0.6457, step: 0.01, help: 'Gain applied to the input signal before the echoes are added.' },
      { name: 'rolloff', label: 'Roll-off', min: 0.05, max: 1, default: 1, step: 0.05, help: 'How quickly successive echoes lose level. Lower keeps the tail loud for longer.' },
      { name: 'size', label: 'Echo spacing ×', min: 0.1, max: 4, default: 1, step: 0.1, help: 'Multiplies the average 0.1s gap between echoes — larger spreads the echoes (and lengthens the tail).' },
      { name: 'count', label: 'Echoes', min: 10, max: 100, default: 30, step: 5, help: 'Number of stadium echoes. More echoes give a longer, denser tail.' },
      { name: 'chans', label: 'Out channels', min: 2, max: 8, default: 2, step: 1, help: 'Number of output channels.' },
      { name: 'centre', label: 'Centre channel', min: 1, max: 8, default: 1, step: 0.5, maxOf: (v) => Number(v.chans), help: 'Channel the echo image is centred on (fractions sit between channels). Must not exceed the output channel count.' },
      { name: 'spread', label: 'Spread (chans)', min: 2, max: 8, default: 2, step: 0.5, maxOf: (v) => Number(v.chans), help: 'Number of output channels the echoes are spread over (the program requires at least 2).' },
    ],
    blurb: 'Scatter decaying "stadium" echoes of the source around a multichannel field.',
  },
];
