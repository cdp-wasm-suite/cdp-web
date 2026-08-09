// Effect entry for CDP's `fractal` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'fractal.wave', label: 'Fractal wave', category: 'Pitch & time',
    program: 'fractal', domain: 'sound', mono: false,
    // Mode 1 recursively transposes the sound over a triangle pitch contour
    // (generated from depth/dur), applying the pattern to every sub-unit down
    // to the smallest time-scale. Time follows pitch: upward depth contracts
    // the output, downward expands it. Depth is capped at ±8: beyond that the
    // accumulated transposition after full fractalisation exceeds the
    // program's internal limit. -t (stretch) is hard range-checked to 1..2
    // despite usage saying "0 = off"; -m 0 = fractalise to the smallest
    // wavelength. (The 'spectrum' mode is NOT wrapped: known .ana parser bug.)
    args: ['wave', '1', '$IN', '$OUT', '$DATA', { p: 'maxfrac', flag: '-m' }, { p: 'stretch', flag: '-t' }],
    data: (v) => `0 0\n${(v.dur / 2).toFixed(4)} ${v.depth}\n${(+v.dur).toFixed(4)} 0\n`,
    params: [
      { name: 'depth', label: 'Depth (semitones)', min: -8, max: 8, default: -3, step: 1, help: 'How far the fractal pattern bends the pitch at its peak, in semitones. Positive bends up and makes the result shorter and busier; negative bends down and stretches it out — often dramatically.' },
      { name: 'dur', label: 'Pattern (s)', min: 0.1, max: 2, default: 0.5, step: 0.05, help: 'Length of the largest pitch pattern, in seconds. The same shape is repeated inside itself at ever smaller time-scales.' },
      { name: 'maxfrac', label: 'Max depth', min: 0, max: 12, default: 0, step: 1, help: 'How many levels deep the pattern-within-pattern recursion goes. 0 keeps going until the smallest possible time-unit is reached.' },
      { name: 'stretch', label: 'Time stretch', min: 1, max: 2, default: 1, step: 0.05, help: 'Stretches the fractal pattern in time (1 = none, up to 2).' },
    ],
    blurb: 'Recursively transpose the sound over a self-similar pitch pattern — a fractal cascade of speed-ups and slow-downs.',
  },
];
