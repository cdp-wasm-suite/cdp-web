// Effect entry for CDP's `repeater` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'repeater.bounce', label: 'Bouncing repeat', category: 'Extend & segment',
    program: 'repeater', domain: 'sound', mono: false,
    // mode 3: one repeating element (datafile "start end repeat-cnt delay"),
    // accelerating and dimming like a bouncing object. Output is lengthened.
    args: ['repeater', '3', '$IN', '$OUT', '$DATA', { p: 'accel' }, { p: 'warp' }, { p: 'fade' }],
    data: (v) => `0 ${v.seg} ${v.repcnt} ${v.delay}\n`,
    params: [
      { name: 'seg', label: 'Segment (s)', min: 0.05, max: 1, default: 0.3, step: 0.05, help: 'Length of the chunk from the start of the source that gets repeated, in seconds.' },
      { name: 'repcnt', label: 'Repeats', min: 2, max: 32, default: 8, step: 1, help: 'How many times the segment bounces.' },
      { name: 'delay', label: 'Initial gap (s)', min: 0.02, max: 0.5, default: 0.12, step: 0.01, help: 'Time between the start of one repeat and the next at the beginning, in seconds. The gap shortens as it accelerates.' },
      { name: 'accel', label: 'Acceleration', min: 1, max: 4, default: 2, step: 0.1, help: 'How much the gap shortens by the end. 2 halves it — the bounces speed up toward the end.' },
      { name: 'warp', label: 'Warp', min: 0.5, max: 3, default: 1, step: 0.1, help: 'Shapes the acceleration curve. 1 is even; above 1 holds the slow gaps longer then speeds up sharply.' },
      { name: 'fade', label: 'Decay', min: 0.5, max: 3, default: 1, step: 0.1, help: 'How the repeats dim. 1 is linear; above 1 fades fast then slow; below 1 slow then fast.' },
    ],
    blurb: 'Repeat a segment with accelerating, dimming bounces (like a dropped object settling).',
  },
];
