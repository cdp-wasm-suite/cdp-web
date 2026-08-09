// Effect entry for CDP's `motor` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'motor.motor', label: 'Motor (pulse engine)', category: 'Texture',
    program: 'motor', domain: 'sound', mono: false,
    parityExempt: 'seeded RNG (rand) differs across platforms',
    // Mode 1. '-s1' pins the seed: unseeded, motor time-seeds itself and every
    // run of the same settings sounds different.
    args: ['motor', '1', '$IN', '$OUT', { p: 'dur' }, { p: 'freq' }, { p: 'pulse' }, { p: 'fratio' }, { p: 'pratio' }, { p: 'sym' }, { p: 'frand', flag: '-f' }, { p: 'jitter', flag: '-j' }, '-s1'],
    params: [
      { name: 'dur', label: 'Duration (s)', min: 1, max: 20, default: 4, step: 0.5, help: 'Length of the output, in seconds.' },
      { name: 'freq', label: 'Inner rate (Hz)', min: 2, max: 100, default: 20, step: 1, help: 'Rate of the fast inner pulses cut from the source, in Hz.' },
      { name: 'pulse', label: 'Outer rate (Hz)', min: 0.1, max: 10, default: 2, step: 0.1, help: 'Rate of the slower outer envelope, in Hz. Each outer pulse must fit at least two inner pulses, so keep this well below half the inner rate.' },
      { name: 'fratio', label: 'Inner on/off', min: 0.05, max: 1, default: 0.5, step: 0.05, help: 'Proportion of each inner pulse that sounds (0.05–1). Lower is choppier.' },
      { name: 'pratio', label: 'Outer on/off', min: 0.1, max: 1, default: 0.5, step: 0.05, help: 'Proportion of each outer pulse that sounds (0.1–1). Lower leaves longer gaps between bursts.' },
      { name: 'sym', label: 'Symmetry', min: 0, max: 1, default: 0.5, step: 0.05, help: 'Where each outer envelope peaks: 0.5 is a symmetrical swell, 1 pure crescendo, 0 pure decrescendo.' },
      { name: 'frand', label: 'Rate jitter', min: 0, max: 1, default: 0, step: 0.05, help: 'Random variation of the inner pulse rate (0–1). 0 keeps the motor strictly regular.' },
      { name: 'jitter', label: 'Pitch jitter (st)', min: 0, max: 3, default: 0, step: 0.1, help: 'Random pitch variation of the inner pulses, in semitones.' },
    ],
    blurb: 'Machine-like texture: a fast inner pulse-stream cut from the source, driven under a slower rising-and-falling outer envelope.',
  },
];
