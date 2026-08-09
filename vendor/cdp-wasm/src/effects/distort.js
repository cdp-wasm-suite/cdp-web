// Effect entries for CDP's `distort` program.
// Entry shape and arg-token grammar: see the header comment in ../effects.js.

export default [
  {
    id: 'distort.multiply', label: 'Waveset multiply', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    args: ['multiply', '$IN', '$OUT', { p: 'factor' }],
    params: [{ name: 'factor', label: 'Factor', min: 2, max: 16, default: 8, step: 1, help: 'How many times each wave-segment is repeated in place. Higher raises the pitch and adds buzzy grit.' }],
    blurb: 'Repeat each waveset N times (raises pitch, adds grit).',
  },
  {
    id: 'distort.average', label: 'Waveset average', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    args: ['average', '$IN', '$OUT', { p: 'cycles' }],
    params: [{ name: 'cycles', label: 'Cycles', min: 2, max: 30, default: 4, step: 1, help: 'How many neighbouring wave-segments are averaged into one. Higher smooths the waveform and blurs the timbre.' }],
    blurb: 'Average groups of wavesets together.',
  },
  {
    id: 'distort.reverse', label: 'Waveset reverse', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    args: ['reverse', '$IN', '$OUT', { p: 'cyclecnt' }],
    params: [{ name: 'cyclecnt', label: 'Group size', min: 1, max: 50, default: 8, step: 1, help: 'Wave-segments are reversed in blocks of this many. Larger groups scramble the sound more coarsely.' }],
    blurb: 'Reverse wavesets in groups.',
  },
  {
    id: 'distort.interpolate', label: 'Waveset interpolate', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    args: ['interpolate', '$IN', '$OUT', { p: 'cycles' }],
    params: [{ name: 'cycles', label: 'Interp cycles', min: 2, max: 20, default: 4, step: 1, help: 'How many steps are interpolated between successive wave-segments. Higher stretches and smears the sound more.' }],
    blurb: 'Interpolate between successive wavesets (stretches & smears).',
  },
  {
    id: 'distort.telescope', label: 'Waveset telescope', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    args: ['telescope', '$IN', '$OUT', { p: 'cycles' }],
    params: [{ name: 'cycles', label: 'Cycles', min: 2, max: 30, default: 4, step: 1, help: 'How many wave-segments are collapsed (telescoped) into one. Higher thins the sound and raises its pitch.' }],
    blurb: 'Telescope (compress) groups of wavesets into one.',
  },
  {
    id: 'distort.divide', label: 'Waveset divide', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    args: ['divide', '$IN', '$OUT', { p: 'div' }],
    params: [{ name: 'div', label: 'Divisor', min: 2, max: 8, default: 2, step: 1, help: 'Splits each wave-cycle by this factor, adding lower subharmonics. 2 drops the pitch roughly an octave.' }],
    blurb: 'Divide each wavecycle, adding subharmonics.',
  },
  {
    id: 'distort.delete', label: 'Waveset delete', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    args: ['delete', '1', '$IN', '$OUT', { p: 'cyclecnt' }],
    params: [{ name: 'cyclecnt', label: 'Keep 1 in', min: 2, max: 32, default: 4, step: 1, help: 'Only 1 in this many wave-cycles is kept, shortening (time-contracting) the sound and raising its pitch.' }],
    blurb: 'Time-contract by keeping only 1 in every N wave-cycles.',
  },
  {
    id: 'distort.replace', label: 'Waveset replace', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    args: ['replace', '$IN', '$OUT', { p: 'cyclecnt' }],
    params: [{ name: 'cyclecnt', label: 'Group size', min: 2, max: 32, default: 4, step: 1, help: 'In each group of this many wave-cycles, the strongest one replaces the others — coarsens and buzzes the sound.' }],
    blurb: 'In each group of N wave-cycles, the strongest replaces the rest.',
  },
  {
    id: 'distort.cyclefilter', label: 'Waveset band-filter', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    args: ['filter', '3', '$IN', '$OUT', { p: 'freqlo' }, { p: 'freqhi' }],
    params: [
      { name: 'freqlo', label: 'Low (Hz)', min: 20, max: 4000, default: 200, step: 10, help: 'Wave-cycles whose pseudo-frequency is below this are omitted.' },
      { name: 'freqhi', label: 'High (Hz)', min: 50, max: 12000, default: 2000, step: 10, help: 'Wave-cycles whose pseudo-frequency is above this are omitted. Cycles between low and high are kept.' },
    ],
    blurb: 'Drop wave-cycles outside a pseudo-frequency band (waveset band-pass).',
  },
  {
    id: 'distort.pitch', label: 'Waveset pitchwarp', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    parityExempt: 'randomised per-cycle transposition (rand)',
    args: ['pitch', '$IN', '$OUT', { p: 'octvary' }, { p: 'cyclelen', flag: '-c' }],
    params: [
      { name: 'octvary', label: 'Range (octaves)', min: 0.05, max: 3, default: 0.5, step: 0.05, help: 'Each wave-cycle is transposed by a random amount up to this many octaves up or down.' },
      { name: 'cyclelen', label: 'Hold (cycles)', min: 2, max: 50, default: 4, step: 1, help: 'Maximum number of wave-cycles between changes of the random transposition. Larger holds each pitch longer.' },
    ],
    blurb: 'Randomly pitch-warp each wave-cycle (warbly, granular detuning).',
  },
  // ==========================================================================
  // Phase A — additional modes exposed from the already-bundled programs.
  // (No new .wasm needed; each is verified on mono + stereo by `npm test`.)
  // ==========================================================================
  {
    id: 'distort.omit', label: 'Waveset omit', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    args: ['omit', '$IN', '$OUT', { p: 'a' }, { p: 'b' }],
    params: [
      { name: 'a', label: 'Omit', min: 1, max: 7, default: 1, step: 1, maxOf: (v) => Number(v.b) - 1, help: 'How many wave-segments to silence in each group.' },
      { name: 'b', label: 'out of', min: 2, max: 8, default: 2, step: 1, help: 'Group size: silence A segments out of every B, leaving gappy, rhythmic holes.' },
    ],
    blurb: 'Silence A out of every B wavesets (gappy, rhythmic thinning).',
  },
  {
    id: 'distort.repeat', label: 'Waveset repeat', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    args: ['repeat2', '$IN', '$OUT', { p: 'multiplier' }],
    params: [{ name: 'multiplier', label: 'Repeats', min: 2, max: 16, default: 3, step: 1, help: 'How many times each wave-cycle is repeated without stretching the overall timing. Higher roughens the tone and lowers the pitch.' }],
    blurb: 'Repeat each wavecycle N times without time-stretching (roughens, lowers pitch).',
  },
  {
    id: 'distort.overload', label: 'Waveset overload', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    parityExempt: 'noise distortion pattern uses rand()',
    args: ['overload', '1', '$IN', '$OUT', { p: 'level' }, { p: 'depth' }],
    params: [
      { name: 'level', label: 'Clip level', min: 0.05, max: 1, default: 0.3, step: 0.05, help: 'Amplitude where clipping begins (0–1). Lower clips more of the signal.' },
      { name: 'depth', label: 'Depth', min: 0, max: 1, default: 0.7, step: 0.05, help: 'How much noisy distortion is overlaid onto the clipped parts.' },
    ],
    blurb: 'Clip the signal and overlay a noise distortion pattern on the clipped parts.',
  },
  {
    id: 'distort.reform', label: 'Waveset reform', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    args: ['reform', '8', '$IN', '$OUT', { p: 'exag' }],
    params: [{ name: 'exag', label: 'Exaggeration', min: 0.1, max: 8, default: 2, step: 0.1, help: 'How strongly each wave-cycle’s shape is exaggerated. Higher makes the tone sharper and brighter.' }],
    blurb: 'Exaggerate the contour of each wavecycle (sharper, brighter).',
  },
  {
    id: 'distort.fractal', label: 'Waveset fractal', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    args: ['fractal', '$IN', '$OUT', { p: 'scaling' }, { p: 'loudness' }],
    params: [
      { name: 'scaling', label: 'Scaling', min: 2, max: 64, default: 4, step: 1, help: 'How much smaller the superimposed copy of each wave-cycle is. Higher packs in finer, higher-pitched detail.' },
      { name: 'loudness', label: 'Copy level', min: 0.05, max: 1, default: 0.5, step: 0.05, help: 'Loudness of the miniature copies relative to the original wave-cycle. Higher adds more buzzy, fractal grit.' },
    ],
    blurb: 'Superimpose miniature copies of each wavecycle onto itself (fractal graininess).',
  },
  {
    id: 'distort.envel', label: 'Waveset envelope', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    args: ['envel', '1', '$IN', '$OUT', { p: 'cyclecnt' }],
    params: [{ name: 'cyclecnt', label: 'Group size', min: 1, max: 50, default: 8, step: 1, help: 'How many wave-cycles sit under each rising envelope. Larger groups give a slower, coarser amplitude pulsing.' }],
    blurb: 'Impose a rising amplitude envelope over each group of N wavecycles (rhythmic pulsing).',
  },
  {
    id: 'distort.harmonic', label: 'Harmonic distortion', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    args: ['harmonic', '$IN', '$OUT', '$DATA'],
    // harmonics-file: one "harmonic_number amplitude" pair per line (src = 1.0).
    data: (v) => `2 ${v.h2}\n3 ${v.h3}\n4 ${v.h4}\n`,
    params: [
      { name: 'h2', label: '2nd harmonic', min: 0, max: 1, default: 0.5, step: 0.05, help: 'Level of the added 2nd harmonic (one octave up) relative to the original.' },
      { name: 'h3', label: '3rd harmonic', min: 0, max: 1, default: 0.3, step: 0.05, help: 'Level of the added 3rd harmonic (an octave-and-a-fifth up).' },
      { name: 'h4', label: '4th harmonic', min: 0, max: 1, default: 0.15, step: 0.05, help: 'Level of the added 4th harmonic (two octaves up). More of the upper harmonics adds brightness and grit.' },
    ],
    blurb: 'Superimpose chosen harmonics onto each wavecycle (adds richness/grit).',
  },
  {
    id: 'distort.elongate', label: 'Waveset elongate', category: 'Waveset distortion',
    program: 'distort', domain: 'sound', mono: true,
    // `repeat` mode: repeat each wavecycle(group) N times, stretching the sound in
    // time (unlike `distort.repeat`/repeat2, which keeps the original duration).
    args: ['repeat', '$IN', '$OUT', { p: 'multiplier' }, { p: 'cyclecnt', flag: '-c' }],
    params: [
      { name: 'multiplier', label: 'Repeats', min: 2, max: 16, default: 3, step: 1, help: 'How many times each wave-cycle is repeated. Because nothing is removed, the whole sound is stretched by this factor while its pitch drops.' },
      { name: 'cyclecnt', label: 'Cycles per group', min: 1, max: 8, default: 1, step: 1, help: 'How many neighbouring wave-cycles are treated as one unit before repeating. Larger groups give a coarser, more granular stretch.' },
    ],
    blurb: 'Repeat each wavecycle N times, stretching the sound in time and lowering its pitch.',
  },
];
