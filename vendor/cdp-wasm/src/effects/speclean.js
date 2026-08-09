// Effect entry for CDP's `speclean` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'speclean.clean', label: 'Spectral denoise', category: 'Combine',
    program: 'speclean', domain: 'spectral', inputs: 2,
    args: ['clean', '$IN', '$IN2', '$OUT', { p: 'persist' }, { p: 'noisgain' }],
    params: [
      { name: 'persist', label: 'Persist (s)', min: 0.003, max: 1, default: 0.05, step: 0.001, help: 'How long (in seconds) a channel must stay above the noise level to be kept — longer values remove more transient noise.' },
      { name: 'noisgain', label: 'Noise gain', min: 1, max: 40, default: 2, step: 0.5, help: 'Multiplier on the noise-profile levels before comparison — higher values clean more aggressively.' },
    ],
    blurb: 'Remove noise from the first sound using the second as a noise profile (the second input should be a sample of noise or room tone alone).',
  },
];
