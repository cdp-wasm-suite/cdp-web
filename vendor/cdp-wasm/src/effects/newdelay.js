// Effect entry for CDP's `newdelay` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'newdelay.newdelay', label: 'Tuned delay', category: 'Delay & reverb',
    program: 'newdelay', domain: 'sound', mono: false,
    args: ['newdelay', '$IN', '$OUT', { p: 'midipitch' }, { p: 'mix' }, { p: 'feedback' }],
    params: [
      { name: 'midipitch', label: 'Pitch (MIDI)', min: 24, max: 96, default: 48, step: 1, help: 'The delay length is tuned so its resonance sounds at this pitch (MIDI note; 48 = C3, 60 = middle C).' },
      { name: 'mix', label: 'Mix', min: 0, max: 1, default: 0.6, step: 0.05, help: 'Balance between the dry sound and the resonant delay.' },
      { name: 'feedback', label: 'Feedback', min: 0, max: 0.95, default: 0.5, step: 0.05, help: 'How much of the output is fed back in. Higher gives a longer, more pronounced resonant tone.' },
    ],
    blurb: 'Short tuned delay producing a resonant pitch.',
  },
];
