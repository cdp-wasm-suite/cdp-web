// Effect entry for CDP's `superaccu` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'superaccu.superaccu', label: 'Super accumulate', category: 'Spectral',
    program: 'superaccu', domain: 'spectral', mono: false,
    // Mode 1. Like focus.accu but with per-band sustain; the tail rings on well
    // past the input, so the output is several times longer than the source
    // (~6-7x at decay 0.3; decay 0.9 gave 66x in testing — keep the default low).
    args: ['superaccu', '1', '$IN', '$OUT', { p: 'decay', flag: '-d' }, { p: 'glis', flag: '-g' }],
    params: [
      { name: 'decay', label: 'Decay /s', min: 0.05, max: 0.9, default: 0.3, step: 0.05, help: 'How much of each sustained band survives per second. Higher rings on far longer — at 0.9 the output can be dozens of times longer than the source.' },
      { name: 'glis', label: 'Glissando', min: -11.7, max: 11.7, default: 0, step: 0.1, help: 'Octaves-per-second the sustained bands slide. 0 holds them steady; non-zero smears the wash up or down in pitch.' },
    ],
    blurb: 'Sustain every spectral band until louder sound arrives there, building a long, ringing resonant wash.',
  },
];
