// Effect entry for CDP's `newtex` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'newtex.drunk', label: 'Grain texture (spatial)', category: 'Texture',
    program: 'newtex', domain: 'sound', input: 'mono', setsChannels: true,
    // Mode 3: read the mono source as overlapping "drunken walks" and scatter the
    // grains, fading in and out, across a multichannel field. spacetype 0 (random)
    // works at any channel count; locus/ambitus/gstep are left neutral.
    args: ['newtex', '3', '$IN', '$OUT', { p: 'dur' }, { p: 'chans' }, { p: 'density' }, { p: 'step' }, '0', '0', '0', '0.1'],
    params: [
      { name: 'dur', label: 'Duration (s)', min: 0.5, max: 20, default: 4, step: 0.5, help: 'Length of the generated texture, in seconds.' },
      { name: 'chans', label: 'Out channels', min: 2, max: 8, default: 4, step: 1, help: 'Number of output channels the grains are spread across.' },
      { name: 'density', label: 'Simultaneous grains', min: 1, max: 8, default: 2, step: 1, help: 'How many copies of the source can sound at once. Higher makes a denser, busier texture.' },
      { name: 'step', label: 'Change rate (s)', min: 0.02, max: 2, default: 0.2, step: 0.02, help: 'Average time between changes to which grains are sounding, in seconds. Smaller churns faster.' },
    ],
    parityExempt: 'rand()',
    blurb: 'Scatter grains read as drunken walks through the source across a multichannel field.',
  },
];
