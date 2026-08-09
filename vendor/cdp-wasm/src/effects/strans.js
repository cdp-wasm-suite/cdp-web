// Effect entries for CDP's `strans` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'strans.accel', label: 'Accelerando', category: 'Pitch & time',
    program: 'strans', domain: 'sound', mono: false,
    args: ['multi', '3', '$IN', '$OUT', { p: 'accel' }, { p: 'goaltime' }, { p: 'starttime', flag: '-s' }],
    params: [
      { name: 'accel', label: 'Goal speed ×', min: 0.25, max: 4, default: 2, step: 0.25, help: 'Speed multiplier reached at the goal time. Above 1 the sound speeds up and rises in pitch; below 1 it slows down and falls.' },
      { name: 'goaltime', label: 'Goal at (s)', min: 0.1, max: 10, default: 1, step: 0.1, help: 'Time within the source, in seconds, at which the full speed change is reached.' },
      { name: 'starttime', label: 'Start at (s)', min: 0, max: 5, default: 0, step: 0.1, help: 'When the acceleration begins, in seconds. Before this the sound plays at its original speed.' },
    ],
    blurb: 'Accelerate (or decelerate) smoothly towards a goal speed, tape-style (pitch follows).',
  },
  {
    id: 'strans.vibrato', label: 'Vibrato', category: 'Pitch & time',
    program: 'strans', domain: 'sound', mono: false,
    args: ['multi', '4', '$IN', '$OUT', { p: 'vibfrq' }, { p: 'vibdepth' }],
    params: [
      { name: 'vibfrq', label: 'Rate (Hz)', min: 0.1, max: 20, default: 6, step: 0.1, help: 'Speed of the pitch wobble, in cycles per second.' },
      { name: 'vibdepth', label: 'Depth (semitones)', min: 0.1, max: 12, default: 1, step: 0.1, help: 'How far the pitch swings either side of the original, in semitones. Small values are a classic vibrato; large ones are a siren.' },
    ],
    blurb: 'Add vibrato: wobble the pitch of the sound at a set rate and depth.',
  },
];
