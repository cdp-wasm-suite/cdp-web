// Effect entry for CDP's `rmverb` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'reverb.room', label: 'Room reverb', category: 'Delay & reverb',
    program: 'rmverb', domain: 'sound', external: true, setsChannels: true,
    args: [{ p: 'chans', flag: '-c' }, '$IN', '$OUT', { p: 'rmsize' }, { p: 'rgain' }, { p: 'mix' }, { p: 'fback' }, { p: 'absorb' }, { p: 'lpfreq' }, { p: 'trtime' }],
    params: [
      { name: 'chans', label: 'Out channels', min: 1, max: 8, default: 2, step: 1, help: 'Number of output channels the reverb fills (1–16).' },
      { name: 'rmsize', label: 'Room size', min: 1, max: 3, default: 2, step: 1, help: 'Room size: 1 small, 2 medium, 3 large.' },
      { name: 'rgain', label: 'Reverb level', min: 0.05, max: 1, default: 0.5, step: 0.05, help: 'Level of the dense reverb.' },
      { name: 'mix', label: 'Dry/wet', min: 0, max: 1, default: 0.4, step: 0.05, help: 'Dry/wet balance: 1 is fully dry, 0 fully wet.' },
      { name: 'fback', label: 'Feedback', min: 0, max: 1, default: 0.3, step: 0.05, help: 'Reverb feedback — controls decay time.' },
      { name: 'absorb', label: 'Absorb (Hz)', min: 500, max: 8000, default: 3000, step: 100, help: 'Cutoff of the internal low-pass filters modelling air absorption (≈2500 large room, ≈4200 small).' },
      // As reverb.reverb above, but rmverb's ceiling is 0.7 of nyquist (15434 Hz
      // at 44.1k, 16799 at 48k); pinned to a round value safe at 44.1k.
      { name: 'lpfreq', label: 'Input LP (Hz)', min: 0, max: 15000, default: 8000, step: 100, help: 'Low-pass cutoff applied to the input before the reverb (0 disables). The ceiling is 0.7 of the Nyquist frequency.' },
      { name: 'trtime', label: 'Tail (s)', min: 0, max: 5, default: 0.5, step: 0.1, help: 'Extra trailer time for the reverb tail, in seconds.' },
    ],
    blurb: 'Room-model multichannel reverb with small/medium/large presets.',
  },
];
