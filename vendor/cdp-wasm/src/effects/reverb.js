// Effect entry for CDP's `reverb` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    // `reverb` sets its own output width via -cN (independent of input channels),
    // so it carries `setsChannels` — the test doesn't assert a preserved count.
    id: 'reverb.reverb', label: 'Reverb', category: 'Delay & reverb',
    program: 'reverb', domain: 'sound', external: true, setsChannels: true,
    args: [{ p: 'chans', flag: '-c' }, '$IN', '$OUT', { p: 'rgain' }, { p: 'mix' }, { p: 'rvbtime' }, { p: 'absorb' }, { p: 'lpfreq' }, { p: 'trtime' }],
    params: [
      { name: 'chans', label: 'Out channels', min: 1, max: 8, default: 2, step: 1, help: 'Number of output channels the reverb fills (1–16). The dry signal is spread into this many channels.' },
      { name: 'rgain', label: 'Reverb level', min: 0, max: 1, default: 0.5, step: 0.05, help: 'Level of the dense reverb.' },
      { name: 'mix', label: 'Dry/wet', min: 0, max: 0.95, default: 0.4, step: 0.05, help: 'Dry/wet balance: 1 is fully dry, 0 fully wet. (reverb rejects a fully-dry 1.)' },
      { name: 'rvbtime', label: 'Decay (s)', min: 0.1, max: 10, default: 1.5, step: 0.1, help: 'Reverb decay time to -60 dB, in seconds.' },
      { name: 'absorb', label: 'HF damping', min: 0, max: 1, default: 0.5, step: 0.05, help: 'Air-absorption high-frequency damping (0 disables).' },
      // reverb caps lpfreq at 2/3 of nyquist, so the usable ceiling scales with
      // the sample rate (14699 Hz at 44.1k, 15999 at 48k). The max is pinned to
      // a round value safe at 44.1k — the lowest rate the app commonly runs at.
      { name: 'lpfreq', label: 'Input LP (Hz)', min: 0, max: 14000, default: 8000, step: 100, help: 'Low-pass cutoff applied to the input before the reverb (0 disables). The ceiling is two-thirds of the Nyquist frequency.' },
      { name: 'trtime', label: 'Tail (s)', min: 0, max: 5, default: 0.5, step: 0.1, help: 'Extra trailer time for the reverb tail, in seconds.' },
    ],
    blurb: 'Algorithmic multichannel reverb (fills 1–8 output channels).',
  },
];
