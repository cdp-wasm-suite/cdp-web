// Effect entry for CDP's `transit` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'transit.transit', label: 'Transit motion (8ch)', category: 'Spatialisation',
    program: 'transit', domain: 'sound', setsChannels: true, needs: ['newmix'], paritySkip: true, // multi-program mixfile chain; no single-command native equivalent to compare against (WASM output covered by the catalog test)
    // transit simple 1 infile mixfile focus dur steps max dec
    mixChain: {
      buildProgram: 'transit', build: ['simple', { p: 'mode' }, '$INS', '$MIX', { p: 'focus' }, { p: 'dur' }, { p: 'steps' }, { p: 'maxangle' }, { p: 'decay' }],
      renderProgram: 'newmix', render: ['mix', '$MIX', '$OUT'],
    },
    args: [],
    params: [
      { name: 'mode', label: 'Path', min: 1, max: 5, default: 3, step: 1, help: 'Shape of the crossing motion: 1 glancing, 2 edgewise, 3 crossing, 4 close, 5 central.' },
      { name: 'focus', label: 'Focus speaker', min: 1, max: 8, default: 1, step: 1, help: 'Loudspeaker at the centre of the motion (whole numbers for odd path modes).' },
      { name: 'dur', label: 'Duration (s)', min: 6, max: 30, default: 8, step: 1, help: 'Duration of the motion from edge to centre.' },
      { name: 'steps', label: 'Events', min: 2, max: 64, default: 8, step: 1, help: 'How many events from edge to centre.' },
      { name: 'maxangle', label: 'Max angle (°)', min: 45, max: 89, default: 80, step: 1, help: 'Maximum angle from the centre line reached by the motion (< 90°).' },
      { name: 'decay', label: 'Event decay', min: 0.1, max: 0.99, default: 0.9, step: 0.01, help: 'Gain decrement from one event to the next.' },
    ],
    blurb: 'Send repetitions of a mono sound crossing an 8-channel loudspeaker ring along a chosen path.',
  },
];
