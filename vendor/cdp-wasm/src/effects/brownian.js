// Effect entry for CDP's `brownian` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    // brownian mode 2. pstart (60) and sstart (1) are hard-coded — the plo/phi
    // ranges (max 48 / min 72) guarantee 60 always sits inside, and the step max
    // (12) stays below the minimum plo-phi gap (24): the program errors when
    // step exceeds the pitch range. Trailing '1' pins the seed argument.
    id: 'brownian.motion', label: 'Brownian texture', category: 'Texture',
    program: 'brownian', domain: 'sound', input: 'mono', setsChannels: true,
    parityExempt: 'seeded RNG (rand) differs across platforms',
    args: ['motion', '2', '$IN', '$OUT', { p: 'chans' }, { p: 'dur' }, { p: 'plo' }, { p: 'phi' },
      '60', '1', { p: 'step' }, { p: 'sstep' }, { p: 'tick' }, '1'],
    params: [
      { name: 'chans', label: 'Out channels', min: 2, max: 8, default: 2, step: 1, help: 'Number of output channels the events wander across.' },
      { name: 'dur', label: 'Duration (s)', min: 1, max: 20, default: 6, step: 0.5, help: 'Maximum length of the generated texture, in seconds.' },
      { name: 'plo', label: 'Min pitch (MIDI)', min: 24, max: 48, default: 48, step: 1, help: 'Bottom of the pitch range the walk can reach (MIDI note; 48 = C3).' },
      { name: 'phi', label: 'Max pitch (MIDI)', min: 72, max: 96, default: 72, step: 1, help: 'Top of the pitch range the walk can reach (MIDI note; 72 = C5).' },
      { name: 'step', label: 'Pitch step', min: 0.5, max: 12, default: 2, step: 0.5, help: 'Maximum pitch step between events, in semitones. Larger makes the melody leap about.' },
      { name: 'sstep', label: 'Space step', min: 0, max: 1, default: 0.5, step: 0.05, help: 'Maximum spatial step between events, as a fraction of the distance between channels. 0 keeps the position fixed.' },
      { name: 'tick', label: 'Event gap (s)', min: 0.02, max: 1, default: 0.15, step: 0.01, help: 'Average time between events, in seconds. Smaller gives a denser stream.' },
    ],
    blurb: 'Scatter transposed copies of the source into a stream that drifts through pitch and space by brownian motion.',
  },
];
