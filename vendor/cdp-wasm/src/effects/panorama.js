// Effect entry for CDP's `panorama` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'panorama.spatial', label: 'Spatial panorama', category: 'Spatialisation',
    program: 'panorama', domain: 'sound', setsChannels: true, needs: ['newmix'], paritySkip: true, // multi-program mixfile chain; no single-command native equivalent to compare against (WASM output covered by the catalog test)
    // panorama panorama 1 infile(s) outmixfile lspk_cnt lspk_aw sounds_aw sounds_ao config
    // sounds_aw is tied to lspk_aw (so the angular offset can stay 0) and config
    // is 1 (a divisor of any input count).
    mixChain: {
      multiInput: true, buildProgram: 'panorama', build: ['panorama', '1', '$INS', '$MIX', { p: 'speakers' }, { p: 'width' }, { p: 'width' }, '0', '1'],
      renderProgram: 'newmix', render: ['mix', '$MIX', '$OUT'],
    },
    args: [],
    params: [
      // panorama itself requires 3..16 loudspeakers (panorama.c ap->lo/hi[PANO_LCNT]).
      { name: 'speakers', label: 'Loudspeakers', min: 3, max: 8, default: 6, step: 1, help: 'How many loudspeakers (output channels) surround the listening area. The sounds are spread left-to-right across them.' },
      { name: 'width', label: 'Array width (°)', min: 190, max: 360, default: 360, step: 5, help: 'Angular width of the loudspeaker array, front-centre at 0°. 360 fully surrounds the listener; 190 is a front arc.' },
    ],
    blurb: 'Distribute several mono sounds around a ring of loudspeakers, spread from left to right. Supply the extra sounds as extra.inputs.',
  },
];
