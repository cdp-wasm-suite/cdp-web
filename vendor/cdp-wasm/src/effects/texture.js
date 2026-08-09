// Effect entry for CDP's `texture` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'texture.simple', label: 'Texture (event cloud)', category: 'Texture',
    program: 'texture', domain: 'sound', input: 'mono',
    // Mode 5 (no harmonic field): notedata is just the input sound's assumed MIDI pitch.
    args: ['simple', '5', '$IN', '$OUT', '$DATA', { p: 'outdur' }, { p: 'packing' }, { p: 'scatter' },
      '0', '1', '1', '64', '64', { p: 'mindur' }, { p: 'maxdur' }, { p: 'minpich' }, { p: 'maxpich' }, '0'],
    parityExempt: 'randomised event placement (rand)',
    data: () => '60\n',
    params: [
      { name: 'outdur', label: 'Duration (s)', min: 1, max: 10, default: 3, step: 0.5, help: 'Length of the generated texture, in seconds.' },
      { name: 'packing', label: 'Density (s)', min: 0.02, max: 1, default: 0.2, step: 0.02, help: 'Average gap between events, in seconds. Smaller packs events closer for a denser cloud.' },
      { name: 'scatter', label: 'Scatter', min: 0, max: 10, default: 1, step: 0.5, help: 'How irregularly events are placed in time. 0 is even; higher randomises the timing.' },
      { name: 'mindur', label: 'Min event (s)', min: 0.05, max: 2, default: 0.2, step: 0.05, help: 'Shortest a single event can be, in seconds.' },
      { name: 'maxdur', label: 'Max event (s)', min: 0.05, max: 2, default: 0.4, step: 0.05, help: 'Longest a single event can be, in seconds.' },
      { name: 'minpich', label: 'Min pitch (MIDI)', min: 24, max: 96, default: 48, step: 1, help: 'Lowest pitch events are transposed to (MIDI note; 48 = C3, 60 = middle C).' },
      { name: 'maxpich', label: 'Max pitch (MIDI)', min: 24, max: 96, default: 72, step: 1, help: 'Highest pitch events are transposed to (MIDI note; 72 = C5).' },
    ],
    blurb: 'Scatter copies of the source into a cloud of events at random times and pitches.',
  },
];
