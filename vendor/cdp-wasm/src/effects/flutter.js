// Effect entry for CDP's `flutter` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'flutter.flutter', label: 'Flutter (spatial tremolo)', category: 'Spatialisation',
    program: 'flutter', domain: 'sound', input: 'stereo',
    // The chanseq data file alternates the tremulation between left (1) and
    // right (2), one flutter cycle per channel. Deterministic (no -r flag).
    args: ['flutter', '$IN', '$OUT', '$DATA', { p: 'freq' }, { p: 'depth' }, { p: 'gain' }],
    data: () => '1\n2\n',
    params: [
      { name: 'freq', label: 'Rate (Hz)', min: 0.5, max: 30, default: 6, step: 0.5, help: 'Speed of the loudness flutter, in cycles per second.' },
      { name: 'depth', label: 'Depth', min: 0.1, max: 4, default: 1, step: 0.05, help: 'Depth of the loudness dips. At 1 the troughs reach silence; above 1 the peaks get narrower and spikier.' },
      { name: 'gain', label: 'Level', min: 0.1, max: 1, default: 1, step: 0.05, help: 'Overall output level (0–1).' },
    ],
    blurb: 'Bounce a loudness tremor between the left and right channels, fluttering the sound around the stereo field.',
  },
];
