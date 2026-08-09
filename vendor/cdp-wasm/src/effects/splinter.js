// Effect entries for CDP's `splinter` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'splinter.into', label: 'Splinter into', category: 'Extend & segment',
    program: 'splinter', domain: 'sound', mono: true,
    // mode 1: splinters lead into the source at the target time, changing pitch as they shrink.
    args: ['splinter', '1', '$IN', '$OUT', { p: 'target' }, { p: 'wcnt' }, { p: 'shrcnt' }, { p: 'ocnt' }, { p: 'p1' }, { p: 'p2' }],
    params: [
      { name: 'target', label: 'Grab at (s)', min: 0.02, max: 10, default: 0.5, step: 0.05, help: 'Point in the source where the splinter fragment is taken and where the splinters arrive, in seconds. Must lie inside the sound.' },
      { name: 'wcnt', label: 'Wavesets', min: 1, max: 30, default: 4, step: 1, help: 'How many wave-cycles at that point make up the repeated fragment. More gives a longer, more recognisable fragment.' },
      { name: 'shrcnt', label: 'Shrink steps', min: 2, max: 60, default: 12, step: 1, help: 'Number of repeats over which the fragment shrinks down to a tiny splinter.' },
      { name: 'ocnt', label: 'Extra splinters', min: 0, max: 30, default: 4, step: 1, help: 'How many fully-shrunken splinters sound beyond the shrinking phase.' },
      { name: 'p1', label: 'Start pulse (Hz)', min: 0, max: 50, default: 0, step: 1, help: 'Repetition speed next to the source, in pulses per second. 0 picks a speed from the fragment length.' },
      { name: 'p2', label: 'End pulse (Hz)', min: 0, max: 50, default: 30, step: 1, help: 'Repetition speed of the fully-shrunken splinters, in pulses per second. 0 keeps the starting speed.' },
    ],
    blurb: 'A stream of tiny, rising splinters of the sound leads into it at the chosen point.',
  },
  {
    id: 'splinter.outof', label: 'Splinter away', category: 'Extend & segment',
    program: 'splinter', domain: 'sound', mono: true,
    // mode 2: the source plays to the target time, then splinters emerge from it.
    args: ['splinter', '2', '$IN', '$OUT', { p: 'target' }, { p: 'wcnt' }, { p: 'shrcnt' }, { p: 'ocnt' }, { p: 'p1' }, { p: 'p2' }],
    params: [
      { name: 'target', label: 'Shatter at (s)', min: 0.02, max: 10, default: 0.5, step: 0.05, help: 'Point in the source where it breaks into splinters, in seconds. Must lie inside the sound.' },
      { name: 'wcnt', label: 'Wavesets', min: 1, max: 30, default: 4, step: 1, help: 'How many wave-cycles at that point make up the repeated fragment. More gives a longer, more recognisable fragment.' },
      { name: 'shrcnt', label: 'Shrink steps', min: 2, max: 60, default: 12, step: 1, help: 'Number of repeats over which the fragment shrinks down to a tiny splinter.' },
      { name: 'ocnt', label: 'Extra splinters', min: 0, max: 30, default: 4, step: 1, help: 'How many fully-shrunken splinters sound beyond the shrinking phase.' },
      { name: 'p1', label: 'Start pulse (Hz)', min: 0, max: 50, default: 0, step: 1, help: 'Repetition speed next to the source, in pulses per second. 0 picks a speed from the fragment length.' },
      { name: 'p2', label: 'End pulse (Hz)', min: 0, max: 50, default: 30, step: 1, help: 'Repetition speed of the fully-shrunken splinters, in pulses per second. 0 keeps the starting speed.' },
    ],
    blurb: 'The sound plays to the chosen point, then shatters into a stream of shrinking splinters.',
  },
];
