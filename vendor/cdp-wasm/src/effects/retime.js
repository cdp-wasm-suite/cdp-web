// Effect entry for CDP's `retime` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'retime.speed', label: 'Respeed events', category: 'Extend & segment',
    program: 'retime', domain: 'sound', mono: false, prefersGrains: true,
    // mode 5: find silence-separated events and change their playback speed.
    args: ['retime', '5', '$IN', '$OUT', { p: 'factor' }, { p: 'minsil' }],
    params: [
      { name: 'factor', label: 'Speed ×', min: 0.25, max: 4, default: 2, step: 0.25, help: 'Playback-speed factor for each event. Above 1 speeds up and shortens (raising pitch); below 1 slows down. Needs rhythmic, silence-separated material.' },
      { name: 'minsil', label: 'Min gap (ms)', min: 5, max: 200, default: 20, step: 5, help: 'Shortest silence counted as a gap between events, in milliseconds. Set below the actual gaps so the events are detected.' },
    ],
    blurb: 'Find silence-separated events and change their speed. Needs rhythmic/percussive input.',
  },
];
