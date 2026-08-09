// Effect entries for CDP's `multimix` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  // These take the primary source plus `extra.inputs` (an array of extra WAVs),
  // build a CDP mixfile describing them, and render it to a multichannel WAV.
  // `setsChannels` marks that the output width is decided by the mix, not the
  // source. All inputs are conformed to mono (the mix programs require it).
  {
    id: 'multimix.spread', label: 'Spread to channels', category: 'Spatialisation',
    program: 'multimix', domain: 'sound', setsChannels: true, needs: ['newmix'], paritySkip: true, // multi-program mixfile chain; no single-command native equivalent to compare against (WASM output covered by the catalog test)
    mixChain: {
      multiInput: true, buildProgram: 'multimix', build: ['create', '6', '$INS', '$MIX'],
      renderProgram: 'newmix', render: ['mix', '$MIX', '$OUT'],
    },
    args: [], params: [],
    blurb: 'Place each input sound on its own output channel (N mono sounds → an N-channel file). Supply the extra sounds as extra.inputs.',
  },
  {
    id: 'multimix.channels', label: 'Distribute across N channels', category: 'Spatialisation',
    program: 'multimix', domain: 'sound', setsChannels: true, needs: ['newmix'], paritySkip: true, // multi-program mixfile chain; no single-command native equivalent to compare against (WASM output covered by the catalog test)
    mixChain: {
      // Mode 7 deals successive mono inputs across the output channels, wrapping
      // round; mode 8 sends every input's leftmost channel to output channel 1,
      // which leaves every channel but the first silent. The trailing '1' is the
      // start channel.
      multiInput: true, buildProgram: 'multimix', build: ['create', '7', '$INS', '$MIX', { p: 'outchans' }, '1'],
      renderProgram: 'newmix', render: ['mix', '$MIX', '$OUT'],
    },
    args: [],
    params: [
      { name: 'outchans', label: 'Output channels', min: 2, max: 16, default: 6, step: 1, help: 'How many channels the output file has. The input sounds are dealt out in order across them (wrapping round if there are more sounds than channels).' },
    ],
    blurb: 'Deal the input sounds, in order, across a fixed number of output channels. Supply the extra sounds as extra.inputs.',
  },
];
