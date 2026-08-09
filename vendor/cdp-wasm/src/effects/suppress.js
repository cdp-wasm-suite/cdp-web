// Effect entry for CDP's `suppress` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'suppress.partials', label: 'Suppress partials', category: 'Spectral',
    program: 'suppress', domain: 'spectral', mono: false,
    // timeslots datafile: pairs of times between which suppression is active;
    // "0 60" covers the whole file (times may exceed its length).
    args: ['partials', '$IN', '$OUT', '$DATA', { p: 'lofrq' }, { p: 'hifrq' }, { p: 'chancnt' }],
    data: () => `0 60\n`,
    params: [
      { name: 'lofrq', label: 'Low (Hz)', min: 20, max: 10000, default: 100, step: 10, help: 'Bottom of the frequency band the process listens to.' },
      { name: 'hifrq', label: 'High (Hz)', min: 50, max: 20000, default: 4000, step: 50, help: 'Top of the frequency band. Only the loudest components between the low and high limits are removed.' },
      { name: 'chancnt', label: 'Count', min: 1, max: 64, default: 8, step: 1, help: 'How many of the most prominent components in the band are silenced. More removes more of the sound’s core, leaving its residue.' },
    ],
    blurb: 'Remove the N loudest spectral components in a band, leaving the residual noise and halo around them.',
  },
];
