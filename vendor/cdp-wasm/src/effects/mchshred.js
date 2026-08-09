// Effect entry for CDP's `mchshred` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'mchshred.shred', label: 'Shred to multichannel', category: 'Spatialisation',
    program: 'mchshred', domain: 'sound', input: 'mono', setsChannels: true,
    parityExempt: 'seeded RNG (rand) differs across platforms',
    args: ['shred', '1', '$IN', '$OUT', { p: 'repeats' }, { p: 'chunklen' }, { p: 'scatter' }, { p: 'chans' }],
    params: [
      { name: 'repeats', label: 'Shred passes', min: 1, max: 8, default: 2, step: 1, help: 'How many times the shredding process is applied; each pass re-shreds the previous result.' },
      { name: 'chunklen', label: 'Chunk (s)', min: 0.02, max: 0.5, default: 0.15, step: 0.01, help: 'Average length of the chunks the sound is cut into, in seconds. Smaller gives a finer scramble.' },
      { name: 'scatter', label: 'Cut scatter', min: 0, max: 2, default: 1, step: 0.25, help: 'Randomisation of the cut points. 0 reorders equal chunks without shredding; must stay below duration ÷ chunk length.' },
      { name: 'chans', label: 'Out channels', min: 2, max: 8, default: 2, step: 1, help: 'Number of output channels the shredded segments are permuted across.' },
    ],
    blurb: 'Cut the sound into random chunks and reassemble them in random order, spraying the segments across a multichannel field.',
  },
];
