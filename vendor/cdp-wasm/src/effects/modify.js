// Effect entries for CDP's `modify` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'modify.speed', label: 'Transpose (speed)', category: 'Pitch & time',
    program: 'modify', domain: 'sound', mono: false,
    args: ['speed', '2', '$IN', '$OUT', { p: 'semitones' }],
    params: [{ name: 'semitones', label: 'Semitones', min: -24, max: 24, default: -7, step: 1, help: 'How far to shift, in semitones. Positive speeds the sound up and raises its pitch; negative slows it down and lowers it. ±12 is one octave.' }],
    blurb: 'Vary speed and pitch together by a number of semitones.',
  },
  {
    id: 'modify.loudness', label: 'Gain', category: 'Pitch & time',
    program: 'modify', domain: 'sound', mono: false,
    args: ['loudness', '1', '$IN', '$OUT', { p: 'gain' }],
    params: [{ name: 'gain', label: 'Gain', min: 0.1, max: 6, default: 2, step: 0.1, help: 'Volume multiplier. 1 leaves the level unchanged, 2 is twice as loud (about +6 dB), 0.5 is half.' }],
    blurb: 'Scale the loudness of the sound.',
  },
  {
    id: 'modify.stack', label: 'Stack (harmoniser)', category: 'Pitch & time',
    program: 'modify', domain: 'sound', mono: false,
    args: ['stack', '$IN', '$OUT', { p: 'transpos' }, { p: 'count' }, { p: 'lean' }, { p: 'atk' }, { p: 'gain' }, { p: 'dur' }],
    params: [
      { name: 'transpos', label: 'Interval (semitones)', min: -24, max: 24, default: 12, step: 1, help: 'Transposition between successive layers, in semitones. 12 stacks octaves; 7 stacks fifths. The stack builds up from the original.' },
      { name: 'count', label: 'Layers', min: 2, max: 8, default: 3, step: 1, help: 'How many transposed copies are stacked on the original.' },
      { name: 'lean', label: 'Top level', min: 0.05, max: 1, default: 0.5, step: 0.05, help: 'Loudness of the highest layer relative to the lowest. Lower makes the upper transpositions quieter.' },
      { name: 'atk', label: 'Attack at (s)', min: 0, max: 2, default: 0, step: 0.05, help: 'Time of the attack within the source the layers are aligned to, in seconds.' },
      { name: 'gain', label: 'Gain', min: 0.1, max: 4, default: 1, step: 0.1, help: 'Overall output level of the stacked mix.' },
      { name: 'dur', label: 'Length', min: 0.1, max: 1, default: 1, step: 0.05, help: 'How much of the output to keep, as a proportion (1 = all).' },
    ],
    blurb: 'Stack transposed copies of the source on the original (octave/chord doubler).',
  },
  {
    id: 'modify.space', label: 'Pan (mono → stereo)', category: 'Spatialisation',
    program: 'modify', domain: 'sound', input: 'mono',
    args: ['space', '1', '$IN', '$OUT', { p: 'pan' }],
    params: [{ name: 'pan', label: 'Position (L −1 … +1 R)', min: -1, max: 1, default: 0.3, step: 0.1, help: 'Where to place the sound in the stereo field: −1 hard left, 0 centre, +1 hard right.' }],
    blurb: 'Place a (mono-mixed) source at a position in the stereo field.',
  },
  {
    id: 'modify.shudder', label: 'Shudder', category: 'Filter & dynamics',
    program: 'modify', domain: 'sound', input: 'stereo',
    parityExempt: 'randomised shudder events (rand)',
    args: ['shudder', '$IN', '$OUT', { p: 'start' }, { p: 'frq' }, { p: 'scatter' }, { p: 'spread' }, { p: 'mindepth' }, { p: 'maxdepth' }, { p: 'minwidth' }, { p: 'maxwidth' }],
    params: [
      { name: 'start', label: 'Start (s)', min: 0, max: 5, default: 0, step: 0.05, help: 'When the shuddering begins, in seconds from the start.' },
      { name: 'frq', label: 'Rate (Hz)', min: 0.5, max: 30, default: 8, step: 0.5, help: 'Average rate of the shudder events, in events per second.' },
      { name: 'scatter', label: 'Time scatter', min: 0, max: 1, default: 0.3, step: 0.05, help: 'How irregularly the events are placed in time. 0 is even; higher randomises the rhythm.' },
      { name: 'spread', label: 'Stereo spread', min: 0, max: 1, default: 0.5, step: 0.05, help: 'How widely the events are scattered across the stereo field. 0 keeps them central.' },
      { name: 'mindepth', label: 'Min depth', min: 0, max: 1, default: 0.3, step: 0.05, help: 'Smallest amplitude dip an event can make (each event picks a random value between min and max).' },
      { name: 'maxdepth', label: 'Max depth', min: 0, max: 1, default: 0.8, step: 0.05, help: 'Largest amplitude dip an event can make.' },
      { name: 'minwidth', label: 'Min width (s)', min: 0.01, max: 0.5, default: 0.05, step: 0.01, help: 'Shortest event duration, in seconds.' },
      { name: 'maxwidth', label: 'Max width (s)', min: 0.01, max: 0.5, default: 0.15, step: 0.01, help: 'Longest event duration, in seconds.' },
    ],
    blurb: 'Shudder a stereo sound with scattered amplitude dips of random depth and width.',
  },
  {
    id: 'modify.revecho', label: 'Delay / resonance', category: 'Delay & reverb',
    program: 'modify', domain: 'sound', mono: false,
    args: ['revecho', '1', '$IN', '$OUT', { p: 'delay' }, { p: 'mix' }, { p: 'feedback' }, { p: 'tail' }],
    params: [
      { name: 'delay', label: 'Delay (ms)', min: 1, max: 1000, default: 120, step: 1, help: 'Gap between echoes, in milliseconds. Short times give a resonant tone; long times give distinct echoes.' },
      { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.5, step: 0.05, help: 'Balance between the dry sound and the echoes.' },
      { name: 'feedback', label: 'Feedback', min: 0, max: 0.95, default: 0.5, step: 0.05, help: 'How much of the output recirculates. Higher gives more repeats and a longer tail.' },
      { name: 'tail', label: 'Tail (s)', min: 0, max: 5, default: 1, step: 0.1, help: 'Extra time added to the end for the echoes to die away, in seconds.' },
    ],
    blurb: 'Delay with feedback — short times give resonance, long times give echo.',
  },
  {
    id: 'modify.brassage', label: 'Granular pitch-shift', category: 'Granular',
    program: 'modify', domain: 'sound', mono: false,
    // Granular reconstitution scatters grains using rand(), which differs between
    // glibc (native) and Emscripten's musl, so output diverges — parity-exempt.
    parityExempt: 'granular grain scatter uses rand()',
    args: ['brassage', '1', '$IN', '$OUT', { p: 'pitch' }],
    params: [{ name: 'pitch', label: 'Pitch shift', min: -2, max: 2, default: -0.5, step: 0.1, help: 'How much to transpose as the sound is rebuilt from grains. Negative lowers the pitch, positive raises it; 0 leaves it unchanged.' }],
    blurb: 'Granular reconstitution that pitch-shifts the source (transposition ratio).',
  },
  {
    id: 'modify.convolve', label: 'Convolve', category: 'Combine',
    program: 'modify', domain: 'sound', inputs: 2,
    // The native `modify convolve` binary crashes on the parity test inputs, so
    // there's no native side to compare against — skip parity (the WASM output is
    // exercised by the catalog test). `fastconv.reverb` is the robust convolver.
    paritySkip: true,
    args: ['convolve', '1', '$IN', '$IN2', '$OUT'],
    params: [],
    blurb: 'Convolve the first sound with the second (cross-filtering / impulse-response colouring).',
  },
];
