// Effect entry for CDP's `fracture` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

import { fractureData } from './helpers.js';

export default [
  {
    id: 'fracture.fracture', label: 'Fracture (fragment scatter)', category: 'Spatialisation',
    program: 'fracture', domain: 'sound', input: 'mono', setsChannels: true,
    parityExempt: 'seeded RNG (rand) differs across platforms',
    // Mode 1: N-channel dispersal. '-S1' pins the seed — unseeded (0), fracture
    // time-seeds itself and every run of the same settings sounds different.
    // (The usage text says -h, but mode 1's variant flags are "rpdvestSmM":
    // the seed flag is -S; -h only exists in mode 2.)
    args: ['fracture', '1', '$IN', '$OUT', '$DATA', { p: 'chns' }, { p: 'strms' },
      { p: 'pulse' }, { p: 'edpth' }, { p: 'stkint' }, { p: 'disp', flag: '-d' }, { p: 'prnd', flag: '-p' }, '-S1'],
    data: fractureData,
    params: [
      { name: 'chns', label: 'Out channels', min: 2, max: 8, default: 2, step: 1, help: 'Number of output channels the fragments are dispersed across.' },
      { name: 'strms', label: 'Streams', min: 4, max: 32, default: 8, step: 1, help: 'Number of spatial positions the fragments are dealt out to.' },
      { name: 'pulse', label: 'Pulse gap (s)', min: 0.05, max: 4, default: 0.3, step: 0.05, help: 'Average time between one set of fragments and the next, in seconds.' },
      { name: 'edpth', label: 'Envelope depth', min: 0, max: 2, default: 1, step: 0.05, help: 'How deeply the envelope cuts each fragment (0 = no shaping, 1 = down to silence). Above 1, transposed copies stack onto each fragment.' },
      { name: 'stkint', label: 'Stack interval (st)', min: 0, max: 12, default: 0, step: 1, help: 'Transposition between stacked copies, in semitones (only active when depth exceeds 1). 0 is read as an octave.' },
      { name: 'disp', label: 'Stream scatter', min: 0, max: 1, default: 0.5, step: 0.05, help: 'Time-scatter of the fragments between streams (0–1). 0 fires every stream in sync at each pulse; higher smears them around it.' },
      { name: 'prnd', label: 'Pulse jitter', min: 0, max: 1, default: 0.3, step: 0.05, help: 'Randomisation of the pulse timing itself (0–1). 0 keeps the pulses perfectly regular.' },
      { name: 'peak', label: 'Attack position', min: 0.05, max: 0.9, default: 0.15, step: 0.05, help: 'Where each fragment’s envelope peaks (0–1). Early gives percussive fragments, late gives swells.' },
    ],
    blurb: 'Shatter the source into enveloped fragments dealt out across the channels in pulsing waves.',
  },
];
