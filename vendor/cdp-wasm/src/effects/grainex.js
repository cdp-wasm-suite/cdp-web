// Effect entry for CDP's `grainex` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    // grainex extend: finds grains in the stt..end region and repeats a random
    // re-selection of them to add `plus` seconds.
    id: 'grainex.extend', label: 'Extend grain region', category: 'Granular',
    program: 'grainex', domain: 'sound', mono: true, prefersGrains: true,
    parityExempt: 'random grain reselection (rand)',
    args: ['extend', '$IN', '$OUT', { p: 'wsiz' }, { p: 'trof' }, { p: 'plus' }, { p: 'stt' }, { p: 'end' }],
    params: [
      { name: 'wsiz', label: 'Window (ms)', min: 10, max: 200, default: 50, step: 5, help: 'Size of the search window, in milliseconds — sets the size of the grains the process looks for.' },
      { name: 'trof', label: 'Trough depth', min: 0.05, max: 0.95, default: 0.5, step: 0.05, help: 'How deep a dip must be, relative to its neighbouring peaks, to count as a gap between grains. Lower keeps only clearly-separated grains; higher splits more readily.' },
      { name: 'plus', label: 'Add (s)', min: 0.5, max: 30, default: 2, step: 0.5, help: 'How many seconds of material to add to the source by repeating grains from the region.' },
      { name: 'stt', label: 'Region start (s)', min: 0, max: 10, default: 0, step: 0.1, help: 'Start of the grain region within the source, in seconds. Must lie within the file.' },
      { name: 'end', label: 'Region end (s)', min: 0.2, max: 30, default: 1, step: 0.1, help: 'End of the grain region, in seconds. Must be no later than the end of the file.' },
    ],
    blurb: 'Find grains in a region of the sound and extend it by repeating them. Needs rhythmic/grainy input.',
  },
];
