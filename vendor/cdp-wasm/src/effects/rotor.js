// Effect entry for CDP's `rotor` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'rotor.rotor', label: 'Rotor (note-set cycles)', category: 'Texture',
    program: 'rotor', domain: 'sound', input: 'mono', setsChannels: true,
    parityExempt: 'event onsets/pitches from chained trig round to sample indices; libm ulp differences can shift whole events',
    // Mode 2: next set's start-time depends on spacings within the current set.
    // '-d5' imposes the maximum 5 ms dovetail so arbitrary sources (which may
    // not start/end at zero) don't click; '-s' selects stereo output that
    // widens and narrows with the note-sets.
    args: ['rotor', '2', '$IN', '$OUT', '$DATA', { p: 'cnt' }, { p: 'minp' }, { p: 'maxp' },
      { p: 'step' }, { p: 'prot' }, { p: 'trot' }, { p: 'phas' }, { p: 'dur' }, '-d5', '-s'],
    // Envelope imposed on every event; its duration sets the event length.
    data: (v) => `0 0\n${v.attack} 1\n${(Number(v.attack) + Number(v.decay)).toFixed(4)} 0\n`,
    params: [
      // hard bounds: rotor.c set_param_ranges() (ap->lo/ap->hi). `dur` is capped
      // at 20 s here only because the render is slow, not because CDP minds.
      { name: 'dur', label: 'Duration (s)', min: 1, max: 20, default: 6, step: 0.5, hardMin: 1, hardMax: 32767, help: 'Length of the generated texture, in seconds.' },
      { name: 'cnt', label: 'Events per set', min: 3, max: 24, default: 7, step: 1, hardMin: 3, hardMax: 127, help: 'How many events in each note-set. The sets grow and shrink in range and speed as they cycle.' },
      // The curated windows are disjoint, so the ordering rule never bites while
      // locked; unlocked to the full 0–127 it does — rotor.c:1119 errors on an
      // exactly zero pitch-range.
      { name: 'minp', label: 'Min pitch (MIDI)', min: 24, max: 48, default: 48, step: 1, hardMin: 0, hardMax: 127, maxOf: (v) => Number(v.maxp) - 1, help: 'Lowest pitch an event can take (MIDI note; 48 = C3).' },
      { name: 'maxp', label: 'Max pitch (MIDI)', min: 72, max: 96, default: 72, step: 1, hardMin: 0, hardMax: 127, minOf: (v) => Number(v.minp) + 1, help: 'Highest pitch an event can take (MIDI note; 72 = C5).' },
      { name: 'step', label: 'Max gap (s)', min: 0.02, max: 1, default: 0.1, step: 0.01, hardMin: 0, hardMax: 4, help: 'Largest time-gap between event onsets within a set, in seconds. Smaller packs the notes into faster flurries.' },
      { name: 'prot', label: 'Pitch cycle (sets)', min: 4, max: 64, default: 16, step: 1, hardMin: 4, hardMax: 256, help: 'How many note-sets before the pitch pattern returns to where it started.' },
      { name: 'trot', label: 'Speed cycle (sets)', min: 4, max: 64, default: 12, step: 1, hardMin: 4, hardMax: 256, help: 'How many note-sets before the speed pattern returns to where it started. Different from the pitch cycle keeps the two drifting against each other.' },
      { name: 'phas', label: 'Cycle offset', min: 0, max: 1, default: 0, step: 0.05, help: 'Starting offset between the pitch and speed cycles (0–1).' },
      { name: 'attack', label: 'Event attack (s)', min: 0.005, max: 0.5, default: 0.03, step: 0.005, help: 'Rise time of each event’s envelope, in seconds.' },
      { name: 'decay', label: 'Event decay (s)', min: 0.05, max: 2, default: 0.35, step: 0.05, help: 'Fall time of each event’s envelope, in seconds. Attack + decay is the event length.' },
    ],
    blurb: 'Spin the source into note-sets that grow and shrink in pitch-range, speed and stereo width as two cycles drift in and out of phase.',
  },
];
