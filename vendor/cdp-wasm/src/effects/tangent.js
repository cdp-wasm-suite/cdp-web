// Effect entry for CDP's `tangent` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'tangent.tangent', label: 'Tangent motion (8ch)', category: 'Spatialisation',
    program: 'tangent', domain: 'sound', setsChannels: true, needs: ['newmix'], paritySkip: true, // multi-program mixfile chain; no single-command native equivalent to compare against (WASM output covered by the catalog test)
    // tangent onefile 1 infile mixfile dur steps maxangle dec
    mixChain: {
      buildProgram: 'tangent', build: ['onefile', '1', '$INS', '$MIX', { p: 'dur' }, { p: 'steps' }, { p: 'maxangle' }, { p: 'decay' }],
      renderProgram: 'newmix', render: ['mix', '$MIX', '$OUT'],
    },
    args: [],
    params: [
      { name: 'dur', label: 'Duration (s)', min: 6, max: 30, default: 8, step: 1, help: 'Length of the output file. The stream of events pans along a tangent path to (or from) the 8-channel ring.' },
      { name: 'steps', label: 'Events', min: 2, max: 64, default: 8, step: 1, help: 'How many events make up the tangent stream.' },
      { name: 'maxangle', label: 'Max angle (°)', min: 90, max: 135, default: 120, step: 1, help: 'Maximum angle of rotation reached by the motion (90–135°).' },
      { name: 'decay', label: 'Event decay', min: 0.1, max: 0.99, default: 0.9, step: 0.01, help: 'Loudness decrement from one event to the next as the stream recedes.' },
    ],
    blurb: 'Play repetitions of a mono sound along a tangent path to or from an 8-channel loudspeaker ring.',
  },
];
