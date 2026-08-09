// Effect entry for CDP's `tunevary` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'tunevary.chord', label: 'Tune to chord', category: 'Spectral pitch',
    program: 'tunevary', domain: 'spectral', mono: false, prefersHarmonic: true,
    // Pitch template: lines of "time midi midi midi..."; CDP requires at least
    // two lines with equal entry counts, so a constant chord is written at 0
    // and 60s (times may exceed the file's length).
    args: ['tunevary', '$IN', '$OUT', '$DATA', { p: 'focus', flag: '-f' }, { p: 'clarity', flag: '-c' }],
    data: (v) => `0 ${v.pitch1} ${v.pitch2} ${v.pitch3}\n60 ${v.pitch1} ${v.pitch2} ${v.pitch3}\n`,
    params: [
      { name: 'pitch1', label: 'Note 1 (MIDI)', min: 24, max: 96, default: 48, step: 1, help: 'First note of the chord the sound is tuned to (MIDI note; 48 = C3, 60 = middle C).' },
      { name: 'pitch2', label: 'Note 2 (MIDI)', min: 24, max: 96, default: 55, step: 1, help: 'Second note of the chord (MIDI note). 55 with the defaults makes a bare fifth.' },
      { name: 'pitch3', label: 'Note 3 (MIDI)', min: 24, max: 96, default: 64, step: 1, help: 'Third note of the chord (MIDI note). 64 with the defaults completes a major chord.' },
      { name: 'focus', label: 'Focus', min: 0, max: 1, default: 1, step: 0.05, help: 'How firmly the sound’s partials are pulled onto the chord notes. 1 snaps them fully; lower values only lean towards the chord.' },
      { name: 'clarity', label: 'Clarity', min: 0, max: 1, default: 0, step: 0.05, help: 'How much energy that doesn’t fit the chord is removed. Higher gives a purer, more obviously chordal result.' },
    ],
    blurb: 'Pull the spectrum onto the harmonics of a chosen chord (spectral retuning to several pitches at once).',
  },
];
