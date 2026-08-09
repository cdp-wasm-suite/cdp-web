// Effect entries for CDP's `crumble` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  // Single-input transforms that decide their own (multichannel) output width
  // (setsChannels). crumble writes the audio directly; tangent/transit write a
  // mixfile that `newmix` renders (a single-input mixChain).
  {
    id: 'crumble.crumble', label: 'Crumble to 8 channels', category: 'Spatialisation',
    program: 'crumble', domain: 'sound', input: 'mono', setsChannels: true, parityExempt: 'seeded RNG (segment scatter); output differs native vs WASM',
    // crumble sound 1 inf outf stt dur1 dur2 orient size rand iscat oscat ostrch pscat seed
    args: ['sound', '1', '$IN', '$OUT', { p: 'start' }, { p: 'dur1' }, { p: 'dur2' }, '1', { p: 'segsize' }, { p: 'segrand' }, '0.3', '0.3', '1', { p: 'pitchvar' }, '1'],
    params: [
      { name: 'start', label: 'Start (s)', min: 0, max: 5, default: 0.1, step: 0.1, help: 'Time at which the crumbling begins. Before it, the source plays on all channels.' },
      { name: 'dur1', label: 'Split-to-2 (s)', min: 0.2, max: 8, default: 0.35, step: 0.05, help: 'Duration of the section where the sound is split across two half-rings of channels.' },
      { name: 'dur2', label: 'Split-to-4 (s)', min: 0.2, max: 8, default: 0.35, step: 0.05, help: 'Duration of the section where the sound is split across four smaller channel groups.' },
      { name: 'segsize', label: 'Segment size (s)', min: 0.02, max: 1, default: 0.1, step: 0.02, help: 'Average length of the cut segments that get scattered across channels.' },
      { name: 'segrand', label: 'Size randomness', min: 0, max: 1, default: 0.3, step: 0.05, help: 'Random variation of the segment size (0 = even, 1 = maximal).' },
      { name: 'pitchvar', label: 'Pitch variation (±st)', min: 0, max: 12, default: 2, step: 1, help: 'Random pitch variation of the scattered segments, in semitones.' },
    ],
    blurb: 'Project a mono sound onto an 8-channel ring, then progressively crumble it into segments scattered over smaller and smaller channel groups.',
  },
  {
    id: 'crumble.crumble16', label: 'Crumble to 16 channels', category: 'Spatialisation',
    program: 'crumble', domain: 'sound', input: 'mono', setsChannels: true, parityExempt: 'seeded RNG (segment scatter); output differs native vs WASM',
    // crumble sound 2 inf outf stt dur1 dur2 dur3 orient size rand iscat oscat ostrch pscat seed
    args: ['sound', '2', '$IN', '$OUT', { p: 'start' }, { p: 'dur1' }, { p: 'dur2' }, { p: 'dur3' }, '1', { p: 'segsize' }, { p: 'segrand' }, '0.3', '0.3', '1', { p: 'pitchvar' }, '1'],
    params: [
      { name: 'start', label: 'Start (s)', min: 0, max: 5, default: 0.05, step: 0.05, help: 'Time at which the crumbling begins.' },
      { name: 'dur1', label: 'Split-to-2 (s)', min: 0.2, max: 8, default: 0.2, step: 0.05, help: 'Duration of the split-across-two section.' },
      { name: 'dur2', label: 'Split-to-4 (s)', min: 0.2, max: 8, default: 0.2, step: 0.05, help: 'Duration of the split-across-four section.' },
      { name: 'dur3', label: 'Split-to-8 (s)', min: 0.2, max: 8, default: 0.2, step: 0.05, help: 'Duration of the split-across-eight section.' },
      { name: 'segsize', label: 'Segment size (s)', min: 0.02, max: 1, default: 0.1, step: 0.02, help: 'Average length of the cut segments.' },
      { name: 'segrand', label: 'Size randomness', min: 0, max: 1, default: 0.3, step: 0.05, help: 'Random variation of the segment size.' },
      { name: 'pitchvar', label: 'Pitch variation (±st)', min: 0, max: 12, default: 2, step: 1, help: 'Random pitch variation of the segments, in semitones.' },
    ],
    blurb: 'Like Crumble, but onto a 16-channel ring split down to eight images.',
  },
];
