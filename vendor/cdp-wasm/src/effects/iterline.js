// Effect entry for CDP's `iterline` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'iterline.iterline', label: 'Iterate on a pitch line', category: 'Extend & segment',
    program: 'iterline', domain: 'sound', mono: false,
    // Mode 1 interpolates the transposition between the datafile breakpoints.
    // The datafile is time/semitone pairs spanning the output duration, built
    // from the start/end params. GAIN is pinned at 0 = auto maximum level.
    // NB: despite the usage text showing -d/-r/-p/-a/-g/-s flags, the program
    // reads every parameter positionally (flags are rejected).
    parityExempt: 'seeded RNG (rand) differs across platforms',
    args: ['iterline', '1', '$IN', '$OUT', '$DATA', { p: 'dur' }, { p: 'delay' }, { p: 'rand' },
      { p: 'pshift' }, { p: 'ampcut' }, '0', { p: 'seed' }],
    data: (v) => `0 ${v.start}\n${v.dur} ${v.end}\n`,
    params: [
      { name: 'dur', label: 'Duration (s)', min: 1, max: 10, default: 4, step: 0.5, help: 'Length of the iterated output, in seconds (the last iterations may spill slightly past it).' },
      { name: 'start', label: 'Start pitch (st)', min: -12, max: 12, default: 0, step: 1, help: 'Transposition of the iterations at the start, in semitones.' },
      { name: 'end', label: 'End pitch (st)', min: -12, max: 12, default: 12, step: 1, help: 'Transposition reached at the end, in semitones. The pitch of successive iterations slides from the start value to here.' },
      { name: 'delay', label: 'Delay (s)', min: 0.05, max: 1, default: 0.5, step: 0.05, help: 'Average time between iterations, in seconds. Smaller packs the repeats closer.' },
      { name: 'rand', label: 'Time scatter', min: 0, max: 1, default: 0.3, step: 0.05, help: 'Randomisation of the delay between iterations (0–1).' },
      { name: 'pshift', label: 'Pitch scatter', min: 0, max: 12, default: 1, step: 0.5, help: 'Maximum random pitch offset of each iteration from the line, in semitones.' },
      { name: 'ampcut', label: 'Level scatter', min: 0, max: 1, default: 0.3, step: 0.05, help: 'Maximum random level reduction on each iteration (0–1).' },
      { name: 'seed', label: 'Seed', min: 1, max: 100, default: 1, step: 1, help: 'Chooses which random scatter pattern is used; the same seed always gives the same result.' },
    ],
    blurb: 'Re-sound the source repeatedly while its transposition follows a line from a start to an end pitch.',
  },
];
