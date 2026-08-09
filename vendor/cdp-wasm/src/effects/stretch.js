// Effect entries for CDP's `stretch` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'stretch.time', label: 'Time stretch', category: 'Pitch & time',
    program: 'stretch', domain: 'spectral', mono: false,
    args: ['time', '1', '$IN', '$OUT', { p: 'factor' }],
    params: [{ name: 'factor', label: 'Stretch ×', min: 0.25, max: 8, default: 2, step: 0.25, help: 'How much longer to make the sound. 2 is twice as long, 0.5 half. The pitch stays the same.' }],
    blurb: 'Phase-vocoder time-stretch without changing pitch.',
  },
  {
    id: 'stretch.spectrum', label: 'Spectral stretch', category: 'Spectral',
    program: 'stretch', domain: 'spectral', mono: false,
    args: ['spectrum', '1', '$IN', '$OUT', { p: 'divide' }, { p: 'stretch' }, '1'],
    params: [
      { name: 'divide', label: 'Divide (Hz)', min: 100, max: 8000, default: 1000, step: 50, help: 'Frequencies above this point are stretched apart; below it they stay put.' },
      { name: 'stretch', label: 'Stretch ×', min: 0.25, max: 4, default: 2, step: 0.25, help: 'How far the upper spectrum is spread: above 1 pushes partials apart (brighter, more inharmonic), below 1 squeezes them together.' },
    ],
    blurb: 'Stretch the frequencies of the spectrum above the divide point.',
  },
];
