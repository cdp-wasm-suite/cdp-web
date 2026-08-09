// Effect entries for CDP's `extend` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  // ==========================================================================
  // Phase B — new programs added to the build (extend, pitch, repitch, glisten).
  // ==========================================================================
  {
    id: 'extend.loop', label: 'Loop segment', category: 'Extend & segment',
    program: 'extend', domain: 'sound', mono: false,
    args: ['loop', '3', '$IN', '$OUT', { p: 'cnt' }, '0', { p: 'len' }],
    params: [
      { name: 'cnt', label: 'Repeats', min: 1, max: 32, default: 6, step: 1, help: 'How many times the looped segment plays.' },
      { name: 'len', label: 'Loop length (ms)', min: 40, max: 1000, default: 200, step: 10, help: 'Length of the segment taken from the start of the file to loop, in milliseconds.' },
    ],
    blurb: 'Loop a segment from the start of the file a number of times.',
  },
  {
    id: 'extend.iterate', label: 'Iterate (fluid)', category: 'Extend & segment',
    program: 'extend', domain: 'sound', mono: false,
    parityExempt: 'random pitch/time scatter (rand)',
    args: ['iterate', '2', '$IN', '$OUT', { p: 'reps' }, { p: 'pshift', flag: '-p' }, { p: 'rand', flag: '-r' }],
    params: [
      { name: 'reps', label: 'Repetitions', min: 1, max: 32, default: 6, step: 1, help: 'How many times the sound is re-sounded.' },
      { name: 'pshift', label: 'Pitch scatter', min: 0, max: 12, default: 2, step: 0.5, help: 'Maximum random pitch variation between repeats, in semitones. 0 keeps every repeat at the same pitch.' },
      { name: 'rand', label: 'Time scatter', min: 0, max: 1, default: 0.2, step: 0.05, help: 'Maximum random variation in the timing of repeats (0–1). Higher gives a looser, more fluid feel.' },
    ],
    blurb: 'Iterate the whole sound in a fluid manner with random pitch/time scatter.',
  },
  {
    id: 'extend.doublets', label: 'Doublets', category: 'Extend & segment',
    program: 'extend', domain: 'sound', mono: false,
    args: ['doublets', '$IN', '$OUT', { p: 'segdur' }, { p: 'repets' }],
    params: [
      { name: 'segdur', label: 'Segment (s)', min: 0.02, max: 1, default: 0.15, step: 0.01, help: 'Length of each chunk the source is cut into, in seconds.' },
      { name: 'repets', label: 'Repeats', min: 2, max: 8, default: 2, step: 1, help: 'How many times each chunk is repeated before moving on, giving a stutter.' },
    ],
    blurb: 'Cut the source into segments and repeat each one (stuttering).',
  },
  {
    id: 'extend.zigzag', label: 'Zigzag', category: 'Extend & segment',
    program: 'extend', domain: 'sound', mono: false,
    parityExempt: 'random zigzag points (rand)',
    args: ['zigzag', '1', '$IN', '$OUT', '0', { p: 'end' }, { p: 'dur' }, { p: 'minzig' }],
    params: [
      { name: 'end', label: 'Window end (s)', min: 0.15, max: 2, default: 0.5, step: 0.05, help: 'End of the region (from the start of the file) that is read back and forth, in seconds.' },
      { name: 'dur', label: 'Output (s)', min: 0.5, max: 8, default: 2, step: 0.5, help: 'Length of the output, in seconds.' },
      { name: 'minzig', label: 'Min zig (s)', min: 0.02, max: 0.45, default: 0.1, step: 0.01, help: 'Shortest single back-or-forth sweep, in seconds. Smaller allows faster, more jittery zigzagging.' },
    ],
    blurb: 'Read back and forth (zigzag) inside the first part of the file.',
  },
  {
    id: 'extend.freeze', label: 'Freeze / sustain', category: 'Extend & segment',
    program: 'extend', domain: 'sound', mono: false,
    parityExempt: 'randomised iteration (rand)',
    args: ['freeze', '1', '$IN', '$OUT', { p: 'outdur' }, { p: 'delay' }, { p: 'rand' }, { p: 'pshift' }, { p: 'ampcut' }, { p: 'start' }, { p: 'end' }, { p: 'gain' }],
    params: [
      { name: 'outdur', label: 'Output (s)', min: 0.5, max: 20, default: 4, step: 0.5, help: 'Total length of the stretched-out (frozen) result, in seconds.' },
      { name: 'start', label: 'Freeze from (s)', min: 0, max: 60, default: 0, step: 0.05, help: 'Start of the segment in the source that gets frozen, in seconds.' },
      { name: 'end', label: 'Freeze to (s)', min: 0.05, max: 60, default: 0.5, step: 0.05, help: 'End of the frozen segment in the source, in seconds.' },
      { name: 'delay', label: 'Iter delay (s)', min: 0.01, max: 1, default: 0.1, step: 0.01, help: 'Average gap between re-soundings of the frozen segment (must be ≤ the segment length).' },
      { name: 'rand', label: 'Delay scatter', min: 0, max: 1, default: 0.2, step: 0.05, help: 'Randomisation of the delay between iterations (0–1).' },
      { name: 'pshift', label: 'Pitch scatter', min: 0, max: 12, default: 1, step: 0.5, help: 'Maximum random pitch shift per iteration, in semitones (up or down).' },
      { name: 'ampcut', label: 'Amp scatter', min: 0, max: 1, default: 0.2, step: 0.05, help: 'Maximum random amplitude reduction per iteration (0–1).' },
      { name: 'gain', label: 'Gain', min: 0.25, max: 4, default: 1, step: 0.05, help: 'Level adjustment of the frozen segment.' },
    ],
    blurb: 'Freeze a segment and re-sound it to fill a longer duration (granular sustain).',
  },
  {
    id: 'extend.drunk', label: 'Drunk walk', category: 'Extend & segment',
    program: 'extend', domain: 'sound', mono: false,
    parityExempt: 'drunken-walk randomisation (rand)',
    args: ['drunk', '1', '$IN', '$OUT', { p: 'outdur' }, { p: 'locus' }, { p: 'ambitus' }, { p: 'step' }, { p: 'clock' }],
    params: [
      { name: 'outdur', label: 'Output (s)', min: 0.5, max: 20, default: 4, step: 0.5, help: 'Total length of the output, in seconds.' },
      { name: 'locus', label: 'Centre (s)', min: 0, max: 60, default: 0.5, step: 0.05, help: 'Time in the source the drunken walk wanders around, in seconds. Can move through the source.' },
      { name: 'ambitus', label: 'Wander (s)', min: 0.02, max: 10, default: 0.4, step: 0.02, help: 'Half-width of the region around the centre that segments are read from, in seconds.' },
      { name: 'step', label: 'Step (s)', min: 0.01, max: 2, default: 0.1, step: 0.01, help: 'Maximum random step between successive segment reads, in seconds (kept within the wander region).' },
      { name: 'clock', label: 'Segment (s)', min: 0.02, max: 1, default: 0.1, step: 0.01, help: 'Time between reads, i.e. the duration of each segment, in seconds.' },
    ],
    blurb: 'Splice segments read by a drunken walk around a moving point in the source.',
  },
  {
    id: 'extend.baktobak', label: 'Back-to-back', category: 'Extend & segment',
    program: 'extend', domain: 'sound', mono: false,
    args: ['baktobak', '$IN', '$OUT', { p: 'join' }, { p: 'splice' }],
    params: [
      { name: 'join', label: 'Join at (s)', min: 0, max: 60, default: 0.5, step: 0.05, help: 'Time in the source where it is cut and abutted to its reverse, in seconds.' },
      { name: 'splice', label: 'Splice (ms)', min: 1, max: 200, default: 15, step: 1, help: 'Length of the crossfade at the join, in milliseconds.' },
    ],
    blurb: 'Abut the sound to a reversed copy of itself at the join point (palindrome).',
  },
  {
    id: 'extend.repetitions', label: 'Repeat at times', category: 'Extend & segment',
    program: 'extend', domain: 'sound', mono: false,
    args: ['repetitions', '$IN', '$OUT', '$DATA', { p: 'level' }],
    // timesfile: one start-time (seconds) per line at which the whole source plays.
    data: (v) => Array.from({ length: v.count }, (_, i) => (i * v.gap).toFixed(3)).join('\n') + '\n',
    params: [
      { name: 'count', label: 'Repeats', min: 2, max: 16, default: 4, step: 1, help: 'How many times the whole source is replayed.' },
      { name: 'gap', label: 'Spacing (s)', min: 0.1, max: 3, default: 1.2, step: 0.1, help: 'Time between the start of one replay and the next, in seconds. Spacings shorter than the source make the copies overlap.' },
      { name: 'level', label: 'Level', min: 0, max: 1, default: 0.8, step: 0.05, help: 'Output level (0–1), lowered to leave headroom when the copies overlap.' },
    ],
    blurb: 'Replay the whole source at a series of evenly-spaced times (echo/overlay).',
  },
];
