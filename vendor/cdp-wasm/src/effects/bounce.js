// Effect entry for CDP's `bounce` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'bounce.bounce', label: 'Bounce', category: 'Extend & segment',
    program: 'bounce', domain: 'sound', mono: false,
    // -c cuts each repeat where the next begins, so the accelerating repeats
    // never pile up (uncut overlaps sum and can clip).
    args: ['bounce', '$IN', '$OUT', { p: 'count' }, { p: 'startgap' }, { p: 'shorten' }, { p: 'endlevel' }, { p: 'ewarp' }, '-c'],
    params: [
      { name: 'count', label: 'Bounces', min: 2, max: 30, default: 6, step: 1, help: 'How many repeats (bounces) follow the initial sound.' },
      { name: 'startgap', label: 'First gap (s)', min: 0.04, max: 3, default: 0.5, step: 0.01, help: 'Time from the start of the sound to the first bounce, in seconds. The gaps shrink from here as the bounces accelerate.' },
      { name: 'shorten', label: 'Gap shrink', min: 0.4, max: 1, default: 0.8, step: 0.05, help: 'How much each gap shortens from one bounce to the next. 0.8 makes each gap 80% of the last; 1 keeps them even.' },
      { name: 'endlevel', label: 'Last level', min: 0, max: 1, default: 0.1, step: 0.05, help: 'Loudness of the final bounce as a fraction of the source level.' },
      { name: 'ewarp', label: 'Decay warp', min: 0.5, max: 3, default: 1, step: 0.1, help: 'Shapes the fade across the bounces. 1 is even; above 1 drops quickly at first, below 1 holds the level longer before dying.' },
    ],
    blurb: 'Bounce the whole sound: accelerating repeats that die away, like a dropped ball settling.',
  },
];
