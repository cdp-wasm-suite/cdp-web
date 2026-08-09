// Effect entry for CDP's `iterfof` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    // iterfof mode 3: iterate the source as short FOF-style packets whose onset
    // rate follows a MIDI pitch — a plain value ('60') is accepted as linedata.
    // Elements are trimmed to 50ms (-t0.05) with a 20ms fade (-T0.02) so a long
    // source stays granular; -s1 pins the line seed (prand/ampcut/rand/-T draw
    // from an unseeded stream, so runs still differ).
    id: 'iterfof.line', label: 'FOF iterate (pitch line)', category: 'Extend & segment',
    program: 'iterfof', domain: 'sound', input: 'mono',
    parityExempt: 'seeded RNG (rand) differs across platforms',
    args: ['iterfof', '3', '$IN', '$OUT', { p: 'pitch' }, { p: 'outdur' },
      { p: 'prand', flag: '-p' }, { p: 'ampcut', flag: '-a' }, { p: 'rand', flag: '-r' },
      { p: 'vibfrq', flag: '-v' }, { p: 'vibfrq', flag: '-V' },
      { p: 'vibdepth', flag: '-d' }, { p: 'vibdepth', flag: '-D' },
      '-t0.05', '-T0.02', '-s1'],
    params: [
      { name: 'pitch', label: 'Pitch (MIDI)', min: 24, max: 96, default: 60, step: 1, help: 'Pitch the iterated packets sound at (MIDI note; 60 = middle C). Sets the rate at which packets are emitted.' },
      { name: 'outdur', label: 'Duration (s)', min: 0.5, max: 20, default: 4, step: 0.5, help: 'Length of the generated output, in seconds.' },
      { name: 'prand', label: 'Pitch scatter', min: 0, max: 2, default: 0.5, step: 0.1, help: 'Maximum random pitch variation of each packet, in semitones (up to 2). 0 keeps every packet on the line.' },
      { name: 'ampcut', label: 'Level scatter', min: 0, max: 1, default: 0.3, step: 0.05, help: 'Maximum random level reduction on each packet (0–1). Higher gives a more uneven, breathy texture.' },
      { name: 'rand', label: 'Time scatter', min: 0, max: 1, default: 0.3, step: 0.05, help: 'Randomisation of the delay between packets (0–1). Higher loosens the pitch focus into noise.' },
      { name: 'vibfrq', label: 'Vibrato (Hz)', min: 0, max: 12, default: 5, step: 0.5, help: 'Vibrato rate applied to the pitch line, in Hz. 0 turns vibrato off.' },
      { name: 'vibdepth', label: 'Vibrato depth', min: 0, max: 2, default: 0.3, step: 0.1, help: 'Vibrato depth in semitones (up to 2). 0 gives a steady pitch.' },
    ],
    blurb: 'Re-sound the source as a rapid stream of short packets at a chosen pitch (FOF-style vocal synthesis), with vibrato and random scatter.',
  },
];
