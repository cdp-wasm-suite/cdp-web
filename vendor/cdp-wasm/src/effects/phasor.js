// Effect entry for CDP's `phasor` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'phasor.phasor', label: 'Phasing (multi-stream)', category: 'Spatialisation',
    program: 'phasor', domain: 'sound', input: 'mono', setsChannels: true,
    args: ['phasor', '$IN', '$OUT', { p: 'streams' }, { p: 'phasfrq' }, { p: 'shift' }, { p: 'chans' }, { p: 'offset', flag: '-o' }],
    params: [
      { name: 'streams', label: 'Streams', min: 2, max: 8, default: 4, step: 1, help: 'Number of phase-interacting copies of the source. Must be at least the output channel count.' },
      { name: 'phasfrq', label: 'Sweep rate (Hz)', min: 0.2, max: 10, default: 1, step: 0.1, help: 'How many times per second the phase sweeps forward and back. Very slow rates lengthen the output to fit a whole sweep.' },
      { name: 'shift', label: 'Depth (st)', min: 0, max: 12, default: 4, step: 0.5, help: 'Maximum phase shift within each sweep, in semitones. Higher is a deeper, more obvious phase.' },
      { name: 'chans', label: 'Out channels', min: 2, max: 8, default: 2, step: 1, maxOf: (v) => Number(v.streams), help: 'Number of output channels the streams are distributed across. Must not exceed the number of streams.' },
      { name: 'offset', label: 'Offset (ms)', min: 0, max: 500, default: 0, step: 10, help: 'Time-offset of the most-offset stream, in milliseconds; the others are staggered in between. 0 keeps all streams aligned.' },
    ],
    blurb: 'Classic phasing from several phase-shifted copies of a mono source, spread across the output channels.',
  },
];
