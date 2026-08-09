// Effect entry for CDP's `spin` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'spin.stereo', label: 'Spin stereo image', category: 'Spatialisation',
    program: 'spin', domain: 'sound', input: 'stereo',
    args: ['stereo', '1', '$IN', '$OUT', { p: 'rate' }, '0', '2'],
    params: [{ name: 'rate', label: 'Rate (cps)', min: -4, max: 4, default: 1, step: 0.25, help: 'How fast the image rotates around the stereo field, in cycles per second. The sign sets the direction.' }],
    blurb: 'Spin a (stereo) image around the stereo field, with optional doppler.',
  },
];
