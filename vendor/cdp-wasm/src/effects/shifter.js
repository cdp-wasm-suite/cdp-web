// Effect entry for CDP's `shifter` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'shifter.cycles', label: 'Shifting cycles', category: 'Extend & segment',
    program: 'shifter', domain: 'sound', input: 'mono', setsChannels: true,
    parityExempt: 'time-seeded rand() drives stream layout — runs in different seconds differ byte-wise',
    // Cycles datafile: one beat-count per line. CDP constraints (verified):
    // subdiv must be a multiple of 2 or 3 (4 is accepted despite usage's ">4",
    // 5 rejected); linger+transit must sum >= 1; transit 0 writes NaNs into
    // the output, so its minimum is 1 here. Output width is `ochans`.
    args: ['shifter', '1', '$IN', '$OUT', '$DATA', { p: 'cycdur' }, { p: 'dur' }, { p: 'ochans' }, { p: 'subdiv' }, { p: 'linger' }, { p: 'transit' }, { p: 'boost' }],
    data: (v) => `${Math.round(v.cycle1)}\n${Math.round(v.cycle2)}\n${Math.round(v.cycle3)}\n`,
    params: [
      { name: 'cycle1', label: 'Cycle 1 (beats)', min: 2, max: 16, default: 3, step: 1, help: 'Beats in the first repeating cycle. Different lengths make the layers drift in and out of phase.' },
      { name: 'cycle2', label: 'Cycle 2 (beats)', min: 2, max: 16, default: 4, step: 1, help: 'Beats in the second repeating cycle.' },
      { name: 'cycle3', label: 'Cycle 3 (beats)', min: 2, max: 16, default: 5, step: 1, help: 'Beats in the third repeating cycle.' },
      { name: 'cycdur', label: 'Cycle time (s)', min: 0.5, max: 8, default: 2, step: 0.1, help: 'How long one complete cycle lasts, in seconds. Shorter is faster and busier.' },
      { name: 'dur', label: 'Length (s)', min: 1, max: 30, default: 8, step: 0.5, help: 'How long the generated texture runs, in seconds.' },
      { name: 'ochans', label: 'Out channels', min: 1, max: 8, default: 2, step: 1, help: 'Number of output channels the cycles are laid out across.' },
      { name: 'subdiv', label: 'Subdivision', min: 4, max: 12, default: 6, step: 2, help: 'How finely each beat can be divided. Must divide neatly into halves and thirds (4, 6, 8, 10 or 12).' },
      { name: 'linger', label: 'Linger (cycles)', min: 0, max: 8, default: 1, step: 1, help: 'How many cycles the spotlight stays on one layer before moving on.' },
      { name: 'transit', label: 'Transition (cycles)', min: 1, max: 8, default: 1, step: 1, help: 'How many cycles the spotlight takes to move from one layer to the next.' },
      { name: 'boost', label: 'Boost', min: 0, max: 4, default: 1, step: 0.1, help: 'How much louder the spotlit layer is than the rest. 0 makes all layers equal.' },
    ],
    blurb: 'Layer the sound into simultaneous repeating cycles of different lengths, moving a louder “focus” from one to the next.',
  },
];
