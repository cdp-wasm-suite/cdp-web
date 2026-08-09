// Effect entries for CDP's `pulser` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'pulser.pulses', label: 'Pulse stream', category: 'Texture',
    program: 'pulser', domain: 'sound', mono: true,
    parityExempt: 'seeded RNG (rand) differs across platforms',
    // Mode 2: packets derived from the start of the source. The min rise/sustain/
    // decay are hard-coded at the bottom of their legal ranges (0.002 / 0 / 0.02 s);
    // each packet's envelope is a random pick between that floor and the
    // rise/sustain/decay set here.
    args: ['pulser', '2', '$IN', '$OUT', { p: 'dur' }, '0.002', { p: 'rise' }, '0', { p: 'sus' }, '0.02', { p: 'decay' }, { p: 'speed' }, { p: 'scatter' }, { p: 'pscat', flag: '-p' }],
    params: [
      { name: 'dur', label: 'Duration (s)', min: 0.5, max: 20, default: 4, step: 0.5, help: 'Length of the generated pulse stream, in seconds.' },
      { name: 'rise', label: 'Max rise (s)', min: 0.002, max: 0.2, default: 0.05, step: 0.002, help: 'Longest attack a packet can have, in seconds. Each packet picks a random rise up to this.' },
      { name: 'sus', label: 'Max sustain (s)', min: 0, max: 0.2, default: 0.05, step: 0.005, help: 'Longest held portion of a packet, in seconds. Each packet picks a random sustain up to this.' },
      { name: 'decay', label: 'Max decay (s)', min: 0.02, max: 2, default: 0.5, step: 0.01, help: 'Longest tail of a packet, in seconds. Each packet picks a random decay up to this.' },
      { name: 'speed', label: 'Spacing (s)', min: 0.05, max: 1, default: 0.15, step: 0.01, help: 'Average time between packets, in seconds. Smaller fires them faster.' },
      { name: 'scatter', label: 'Time scatter', min: 0, max: 1, default: 0.3, step: 0.05, help: 'Randomisation of the packet timing (0–1). 0 is metronomic, higher is looser.' },
      { name: 'pscat', label: 'Pitch jitter (st)', min: 0, max: 1, default: 0, step: 0.05, help: 'Random pitch variation between packets, in semitones (0–1).' },
    ],
    blurb: 'Chop the source into short enveloped packets and fire them out as a stream of pulses.',
  },
  {
    id: 'pulser.pitched', label: 'Pitched pulses', category: 'Texture',
    program: 'pulser', domain: 'sound', mono: true,
    parityExempt: 'seeded RNG (rand) differs across platforms',
    // Mode 1: packets take spectral brightness from the source and pitch from the
    // pitch parameter. Envelope floors hard-coded as in pulser.pulses.
    args: ['pulser', '1', '$IN', '$OUT', { p: 'dur' }, { p: 'pitch' }, '0.002', { p: 'rise' }, '0', { p: 'sus' }, '0.02', { p: 'decay' }, { p: 'speed' }, { p: 'scatter' }, { p: 'pscat', flag: '-p' }],
    params: [
      { name: 'dur', label: 'Duration (s)', min: 0.5, max: 20, default: 4, step: 0.5, help: 'Length of the generated pulse stream, in seconds.' },
      { name: 'pitch', label: 'Pitch (MIDI)', min: 24, max: 96, default: 60, step: 1, help: 'MIDI pitch of the packets (60 = middle C). The source supplies only the brightness of the timbre.' },
      { name: 'rise', label: 'Max rise (s)', min: 0.002, max: 0.2, default: 0.05, step: 0.002, help: 'Longest attack a packet can have, in seconds. Each packet picks a random rise up to this.' },
      { name: 'sus', label: 'Max sustain (s)', min: 0, max: 0.2, default: 0.05, step: 0.005, help: 'Longest held portion of a packet, in seconds. Each packet picks a random sustain up to this.' },
      { name: 'decay', label: 'Max decay (s)', min: 0.02, max: 2, default: 0.5, step: 0.01, help: 'Longest tail of a packet, in seconds. Each packet picks a random decay up to this.' },
      { name: 'speed', label: 'Spacing (s)', min: 0.05, max: 1, default: 0.15, step: 0.01, help: 'Average time between packets, in seconds. Smaller fires them faster.' },
      { name: 'scatter', label: 'Time scatter', min: 0, max: 1, default: 0.3, step: 0.05, help: 'Randomisation of the packet timing (0–1). 0 is metronomic, higher is looser.' },
      { name: 'pscat', label: 'Pitch jitter (st)', min: 0, max: 1, default: 0, step: 0.05, help: 'Random pitch variation between packets, in semitones (0–1).' },
    ],
    blurb: 'A stream of pitched packets: brightness comes from the source, the pitch from the MIDI pitch control.',
  },
];
