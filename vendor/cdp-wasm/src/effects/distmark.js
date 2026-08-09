// Effect entry for CDP's `distmark` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'distmark.interp', label: 'Waveset interpolate (marks)', category: 'Waveset distortion',
    program: 'distmark', domain: 'sound', mono: true,
    // Mode 1. The datafile lists times at which waveset-groups are found; marks
    // past the end of a short source are tolerated (ignored). The trailing '-t'
    // keeps the remaining tail of the source so the output spans the full
    // duration. unitlen must stay under half the min gap between marks — its
    // max (45ms) is pinned under half the spacing minimum (0.1s). rand > 0
    // consumes rand() (platform-dependent) but the default 0 is bit-exact.
    args: ['distmark', '1', '$IN', '$OUT', '$DATA', { p: 'unitlen' }, { p: 'stretch', flag: '-s' }, { p: 'rand', flag: '-r' }, '-t'],
    data: (v) => Array.from({ length: Math.round(v.marks) }, (_, i) => ((i + 1) * v.spacing).toFixed(3)).join('\n') + '\n',
    params: [
      { name: 'marks', label: 'Marks', min: 2, max: 6, default: 3, step: 1, help: 'How many marked points in the source the interpolation moves between. Marks past the end of a short sound are ignored.' },
      { name: 'spacing', label: 'Every (s)', min: 0.1, max: 0.5, default: 0.25, step: 0.05, help: 'Spacing of the marks in the source, in seconds.' },
      { name: 'unitlen', label: 'Unit (ms)', min: 5, max: 45, default: 20, step: 1, help: 'Approximate size of the waveset group found at each mark, in milliseconds. Must stay under half the mark spacing.' },
      { name: 'stretch', label: 'Time stretch', min: 1, max: 4, default: 1, step: 0.25, help: 'Stretches the distances between marks in the output. 1 keeps the original timing.' },
      { name: 'rand', label: 'Randomise', min: 0, max: 1, default: 0, step: 0.05, help: 'Randomly shortens the interpolated wavesets (0–1), making the heard pitch rise unevenly.' },
    ],
    blurb: 'Rebuild the sound by interpolating between waveset-groups found at marked times (glassy waveset morphing).',
  },
];
